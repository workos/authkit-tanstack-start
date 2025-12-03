import { getAuthkit } from './authkit-loader.js';
import { decodeState } from './auth-helpers.js';
import type { HandleCallbackOptions } from './types.js';

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
 * import { handleCallbackRoute } from '@workos/authkit-tanstack-start';
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
 * import { handleCallbackRoute } from '@workos/authkit-tanstack-start';
 *
 * export const Route = createFileRoute('/api/auth/callback')({
 *   server: {
 *     handlers: {
 *       GET: handleCallbackRoute({
 *         onSuccess: async ({ user, authenticationMethod }) => {
 *           // Create user record in your database
 *           await db.users.upsert({ id: user.id, email: user.email });
 *           // Track analytics
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

async function handleCallbackInternal(request: Request, options: HandleCallbackOptions): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    if (options.onError) {
      return options.onError({ error: new Error('Missing authorization code'), request });
    }

    return new Response(JSON.stringify({ error: { message: 'Missing authorization code' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { returnPathname: stateReturnPathname, customState } = decodeState(state);
    const returnPathname = options.returnPathname ?? stateReturnPathname;

    const response = new Response();
    const authkit = await getAuthkit();
    const result = await authkit.handleCallback(request, response, { code, state: state ?? undefined });
    const { authResponse } = result;

    if (options.onSuccess) {
      await options.onSuccess({
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
        user: authResponse.user,
        impersonator: authResponse.impersonator,
        oauthTokens: authResponse.oauthTokens,
        authenticationMethod: authResponse.authenticationMethod,
        organizationId: authResponse.organizationId,
        state: customState,
      });
    }

    const redirectUrl = buildRedirectUrl(url, returnPathname);
    const sessionHeaders = extractSessionHeaders(result);

    return new Response(null, {
      status: 307,
      headers: {
        Location: redirectUrl.toString(),
        ...sessionHeaders,
      },
    });
  } catch (error) {
    console.error('OAuth callback failed:', error);

    if (options.onError) {
      return options.onError({ error, request });
    }

    return new Response(
      JSON.stringify({
        error: {
          message: 'Authentication failed',
          description: "Couldn't sign in. Please contact your organization admin if the issue persists.",
          details: error instanceof Error ? error.message : String(error),
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

/**
 * Builds the redirect URL after OAuth callback.
 */
function buildRedirectUrl(originalUrl: URL, returnPathname: string): URL {
  const url = new URL(originalUrl);

  // Clean up OAuth params
  url.searchParams.delete('code');
  url.searchParams.delete('state');

  // Handle pathname with query params
  if (returnPathname.includes('?')) {
    const targetUrl = new URL(returnPathname, url.origin);
    url.pathname = targetUrl.pathname;

    targetUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
  } else {
    url.pathname = returnPathname;
  }

  return url;
}

function extractSessionHeaders(result: any): Record<string, string> {
  const setCookie = result?.response?.headers?.get?.('Set-Cookie');
  if (setCookie) {
    return { 'Set-Cookie': setCookie };
  }

  if (result?.headers && typeof result.headers === 'object') {
    return result.headers;
  }

  return {};
}
