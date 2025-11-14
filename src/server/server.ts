import { getAuthkit } from './authkit-loader.js';
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
    // Decode return pathname from state (can be overridden by options)
    const stateReturnPathname = decodeReturnPathname(state);
    const returnPathname = options.returnPathname ?? stateReturnPathname;

    // Handle OAuth callback
    const response = new Response();
    const authkit = await getAuthkit();
    const result = await authkit.handleCallback(request, response, { code, state: state ?? undefined });


    // Extract auth response data
    const { authResponse } = result;

    // Call onSuccess hook if provided
    if (options.onSuccess) {
      await options.onSuccess({
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
        user: authResponse.user,
        impersonator: authResponse.impersonator,
        oauthTokens: authResponse.oauthTokens,
        authenticationMethod: authResponse.authenticationMethod,
        organizationId: authResponse.organizationId,
        state: decodeCustomState(state),
      });
    }

    // Build redirect URL
    const redirectUrl = buildRedirectUrl(url, returnPathname);

    // Extract session headers from the result
    const sessionHeaders = extractSessionHeaders(result);

    return new Response(null, {
      status: 307,
      headers: {
        Location: redirectUrl.toString(),
        ...sessionHeaders,
      },
    });
  } catch (error) {
    // Log the actual error for debugging
    console.error('OAuth callback failed:', error);

    // Use custom error handler if provided
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

// Helper functions
function decodeReturnPathname(state: string | null): string {
  if (!state || state === 'null') return '/';

  try {
    const decoded = JSON.parse(atob(state));
    return decoded.returnPathname || '/';
  } catch {
    return '/';
  }
}

function decodeCustomState(state: string | null): string | undefined {
  if (!state || state === 'null') return undefined;

  // State can have custom user data after a dot separator
  // Format: base64EncodedInternal.customUserState
  if (state.includes('.')) {
    const [, ...rest] = state.split('.');
    return rest.join('.');
  }

  // If no dot, check if it's the internal state or custom state
  try {
    const decoded = JSON.parse(atob(state));
    // If it has returnPathname, it's internal state only
    if (decoded.returnPathname) {
      return undefined;
    }
    // Otherwise it's custom state
    return state;
  } catch {
    // If it's not valid JSON, treat it as custom state
    return state;
  }
}

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
  // AuthService returns { response, headers, returnPathname, authResponse }
  // The session cookie is set on the response object
  if (result?.response?.headers) {
    const setCookie = result.response.headers.get('Set-Cookie');
    if (setCookie) {
      return { 'Set-Cookie': setCookie };
    }
  }

  // Fallback to result.headers if it exists
  if (result?.headers && typeof result.headers === 'object') {
    return result.headers;
  }

  return {};
}
