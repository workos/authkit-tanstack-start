import type { HeadersBag } from '@workos/authkit-session';
import { getAuthkit } from './authkit-loader.js';
import { forEachHeaderBagEntry } from './headers-bag.js';
import type { HandleCallbackOptions } from './types.js';

const STATIC_FALLBACK_DELETE_HEADERS: readonly string[] = [
  'wos-auth-verifier=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  'wos-auth-verifier=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
];

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
 * Extract the `Set-Cookie` header(s) produced by `authkit.clearPendingVerifier()`
 * so we can attach them to whatever response we emit on an error path.
 *
 * The library returns a `HeadersBag` whose `Set-Cookie` is either a string or a
 * `string[]`. We coerce to an array so callers can append each entry in turn.
 */
async function buildVerifierDeleteHeaders(authkit: Awaited<ReturnType<typeof getAuthkit>>): Promise<readonly string[]> {
  try {
    const { headers } = await authkit.clearPendingVerifier(new Response());
    const setCookie = headers?.['Set-Cookie'];
    if (!setCookie) return STATIC_FALLBACK_DELETE_HEADERS;
    return Array.isArray(setCookie) ? setCookie : [setCookie];
  } catch (error) {
    console.error('[authkit-tanstack-react-start] clearPendingVerifier failed:', error);
    return STATIC_FALLBACK_DELETE_HEADERS;
  }
}

async function handleCallbackInternal(request: Request, options: HandleCallbackOptions): Promise<Response> {
  let deleteCookieHeaders: readonly string[] = STATIC_FALLBACK_DELETE_HEADERS;
  let authkit: Awaited<ReturnType<typeof getAuthkit>> | undefined;

  try {
    authkit = await getAuthkit();
    deleteCookieHeaders = await buildVerifierDeleteHeaders(authkit);
  } catch (setupError) {
    console.error('[authkit-tanstack-react-start] Callback setup failed:', setupError);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return errorResponse(new Error('Missing authorization code'), request, options, deleteCookieHeaders, 400);
  }
  if (!authkit) {
    return errorResponse(new Error('AuthKit not initialized'), request, options, deleteCookieHeaders, 500);
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
    console.error('OAuth callback failed:', error);
    return errorResponse(error, request, options, deleteCookieHeaders, 500);
  }
}

async function errorResponse(
  error: unknown,
  request: Request,
  options: HandleCallbackOptions,
  deleteCookieHeaders: readonly string[],
  defaultStatus: number,
): Promise<Response> {
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
  if (result.headers) {
    forEachHeaderBagEntry(result.headers, (key, value) => target.append(key, value));
    return;
  }

  // Fallback: the library routed its output through a mutated Response
  // (storage's context-unavailable path).
  const responseHeaders = result.response?.headers;
  if (responseHeaders && typeof responseHeaders.getSetCookie === 'function') {
    for (const value of responseHeaders.getSetCookie()) {
      target.append('Set-Cookie', value);
    }
  } else if (responseHeaders && typeof responseHeaders.get === 'function') {
    const setCookie = responseHeaders.get('Set-Cookie');
    if (setCookie) target.append('Set-Cookie', setCookie);
  }
}
