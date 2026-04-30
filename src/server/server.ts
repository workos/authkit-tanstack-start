import { getPKCECookieNameForState, type HeadersBag } from '@workos/authkit-session';
import { getAuthkit } from './authkit-loader.js';
import { getRedirectUriFromContext } from './auth-helpers.js';
import { emitHeadersFrom } from './headers-bag.js';
import type { HandleCallbackOptions } from './types.js';

/**
 * Build Set-Cookie headers that delete the per-flow PKCE verifier
 * cookie identified by `state`. When `state` is absent (malformed
 * callback), return an empty list — the 10-minute TTL handles orphans.
 */
function deleteHeadersForState(state: string | null): readonly string[] {
  if (!state) return [];
  const name = getPKCECookieNameForState(state);
  return [
    `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    `${name}=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];
}

/**
 * Creates a callback route handler for OAuth authentication.
 * This should be used in your callback route to complete the authentication flow.
 *
 * @param options - Optional configuration for the callback handler
 * @returns A route handler function
 *
 * @example
 * ```typescript
 * // Basic usage (no options)
 * import { handleCallbackRoute } from '@workos/authkit-tanstack-react-start';
 *
 * export const Route = createFileRoute('/api/auth/callback')({
 *   server: {
 *     handlers: {
 *       GET: handleCallbackRoute(),
 *     },
 *   },
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With onSuccess hook
 * import { handleCallbackRoute } from '@workos/authkit-tanstack-react-start';
 *
 * export const Route = createFileRoute('/api/auth/callback')({
 *   server: {
 *     handlers: {
 *       GET: handleCallbackRoute({
 *         onSuccess: async ({ user, authenticationMethod }) => {
 *           await db.users.upsert({ id: user.id, email: user.email });
 *           analytics.track('User Signed In', { method: authenticationMethod });
 *         },
 *       }),
 *     },
 *   },
 * });
 * ```
 */
export function handleCallbackRoute(options: HandleCallbackOptions = {}) {
  return async ({ request }: { request: Request }): Promise<Response> => {
    return handleCallbackInternal(request, options);
  };
}

/**
 * Extract the `Set-Cookie` header(s) produced by
 * `authkit.clearPendingVerifier()` for the flow identified by `state`.
 *
 * Delete matching is on (name, domain, path); `path` is always `/`
 * for PKCE cookies in authkit-session (see `getPKCECookieOptions`).
 * When authkit setup itself failed or `clearPendingVerifier` throws,
 * fall back to a state-derived header pair that covers both
 * SameSite=Lax and SameSite=None set paths — browsers use
 * (name, domain, path) for cookie replacement, not SameSite, so
 * either variant deletes the original regardless of its original
 * SameSite attribute.
 */
async function buildVerifierDeleteHeaders(
  authkit: Awaited<ReturnType<typeof getAuthkit>> | undefined,
  state: string | null,
): Promise<readonly string[]> {
  if (!state) return [];
  if (!authkit) return deleteHeadersForState(state);
  try {
    const redirectUri = getRedirectUriFromContext();
    const { response, headers } = await authkit.clearPendingVerifier(new Response(), {
      state,
      ...(redirectUri ? { redirectUri } : {}),
    });
    const fromResponse = response?.headers.getSetCookie?.() ?? [];
    if (fromResponse.length > 0) return fromResponse;
    const fromBag = headers?.['Set-Cookie'];
    if (fromBag) return Array.isArray(fromBag) ? fromBag : [fromBag];
    return deleteHeadersForState(state);
  } catch (error) {
    console.error('[authkit-tanstack-react-start] clearPendingVerifier failed:', error);
    return deleteHeadersForState(state);
  }
}

async function handleCallbackInternal(request: Request, options: HandleCallbackOptions): Promise<Response> {
  let authkit: Awaited<ReturnType<typeof getAuthkit>> | undefined;

  let setupError: unknown;
  try {
    authkit = await getAuthkit();
  } catch (error) {
    setupError = error;
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return errorResponse(new Error('Missing authorization code'), request, options, authkit, state, 400);
  }
  if (!authkit) {
    return errorResponse(setupError ?? new Error('AuthKit not initialized'), request, options, authkit, state, 500);
  }

  try {
    const response = new Response();
    const result = await authkit.handleCallback(request, response, {
      code,
      state: state ?? undefined,
    });

    if (options.onSuccess) {
      await options.onSuccess({
        accessToken: result.authResponse.accessToken,
        refreshToken: result.authResponse.refreshToken,
        user: result.authResponse.user,
        impersonator: result.authResponse.impersonator,
        oauthTokens: result.authResponse.oauthTokens,
        authenticationMethod: result.authResponse.authenticationMethod,
        organizationId: result.authResponse.organizationId,
        state: result.state,
      });
    }

    const returnPathname = options.returnPathname ?? result.returnPathname ?? '/';
    const redirectUrl = buildRedirectUrl(url, returnPathname);

    const headers = new Headers({ Location: redirectUrl.toString() });
    appendSessionHeaders(headers, result);

    return new Response(null, { status: 307, headers });
  } catch (error) {
    return errorResponse(error, request, options, authkit, state, 500);
  }
}

async function errorResponse(
  error: unknown,
  request: Request,
  options: HandleCallbackOptions,
  authkit: Awaited<ReturnType<typeof getAuthkit>> | undefined,
  state: string | null,
  defaultStatus: number,
): Promise<Response> {
  console.error('[authkit-tanstack-react-start] OAuth callback failed:', error);

  // Only the error path needs delete-cookie headers, so skip the
  // clearPendingVerifier round-trip on the happy path.
  const deleteCookieHeaders = await buildVerifierDeleteHeaders(authkit, state);

  if (options.onError) {
    const userResponse = await options.onError({ error, request });
    const headers = new Headers(userResponse.headers);
    for (const h of deleteCookieHeaders) headers.append('Set-Cookie', h);
    return new Response(userResponse.body, {
      status: userResponse.status,
      statusText: userResponse.statusText,
      headers,
    });
  }

  if (options.errorRedirectUrl) {
    try {
      const target = new URL(options.errorRedirectUrl, request.url);
      const headers = new Headers({ Location: target.toString() });
      for (const h of deleteCookieHeaders) headers.append('Set-Cookie', h);
      return new Response(null, { status: 302, headers });
    } catch (urlError) {
      console.error(
        `[authkit-tanstack-react-start] errorRedirectUrl is malformed; falling back to JSON ${defaultStatus}:`,
        urlError,
      );
      // fall through to JSON
    }
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const h of deleteCookieHeaders) headers.append('Set-Cookie', h);
  return new Response(
    JSON.stringify({
      error: {
        message: 'Authentication failed',
        description: "Couldn't sign in. Please contact your organization admin if the issue persists.",
      },
    }),
    { status: defaultStatus, headers },
  );
}

function buildRedirectUrl(originalUrl: URL, returnPathname: string): URL {
  const url = new URL(originalUrl);
  url.searchParams.delete('code');
  url.searchParams.delete('state');

  if (returnPathname.includes('?')) {
    const targetUrl = new URL(returnPathname, url.origin);
    url.pathname = targetUrl.pathname;
    targetUrl.searchParams.forEach((value, key) => url.searchParams.set(key, value));
  } else {
    url.pathname = returnPathname;
  }

  return url;
}

function appendSessionHeaders(
  target: Headers,
  result: { headers?: HeadersBag; response?: { headers?: Headers } },
): void {
  emitHeadersFrom(result, (key, value) => target.append(key, value));
}
