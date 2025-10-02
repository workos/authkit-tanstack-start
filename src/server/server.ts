import { authkit } from './authkit.js';
import { redirect } from '@tanstack/react-router';

type TanStackHandler = (ctx: {
  request: Request;
  router: any;
  responseHeaders: Headers;
}) => Promise<Response> | Response;

/**
 * Creates a WorkOS-enabled handler that wraps the TanStack Start handler.
 * This handler automatically manages authentication state for all requests.
 *
 * @param handler The TanStack Start handler to wrap (typically defaultStreamHandler)
 * @returns A wrapped handler that includes WorkOS authentication
 *
 * @example
 * ```typescript
 * // src/server.ts
 * import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server';
 * import { createWorkOSHandler } from '@workos/authkit-tanstack-start';
 *
 * const handler = createWorkOSHandler(defaultStreamHandler);
 *
 * export default {
 *   fetch: createStartHandler(handler),
 * };
 * ```
 */
export function createWorkOSHandler(handler: TanStackHandler): TanStackHandler {
  return async (ctx) => {
    const { request } = ctx;

    // Use withAuth to check and refresh the session
    const authResult = await authkit.withAuth(request);

    // Attach auth context to request for downstream use
    Object.defineProperty(request, 'authContext', {
      value: authResult,
      writable: false,
      configurable: true,
    });

    return handler(ctx);
  };
}

/**
 * Utility to require authentication in route loaders.
 * Throws a redirect to the sign-in page if not authenticated.
 *
 * @example
 * ```typescript
 * // routes/_authenticated.tsx
 * import { createFileRoute } from '@tanstack/react-router';
 * import { requireAuth } from '@workos/authkit-tanstack-start';
 *
 * export const Route = createFileRoute('/_authenticated')({
 *   beforeLoad: requireAuth,
 * });
 * ```
 */
export async function requireAuth({ context, location }: { context: any; location: Location }) {
  if (!context.user) {
    const signInUrl = await authkit.getSignInUrl({
      redirectUri: `${location.origin}/api/auth/callback`,
    });

    throw redirect({ href: signInUrl });
  }
}

/**
 * Handles the OAuth callback from WorkOS.
 * This should be used in your callback route to complete the authentication flow.
 *
 * @example
 * ```typescript
 * // routes/api/auth/callback.tsx
 * import { handleCallbackRoute } from '@workos/authkit-tanstack-start';
 *
 * export const Route = createFileRoute('/api/auth/callback')({
 *   server: {
 *     handlers: {
 *       GET: handleCallbackRoute,
 *     },
 *   },
 * });
 * ```
 */
export async function handleCallbackRoute({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return new Response(JSON.stringify({ error: { message: 'Missing authorization code' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Decode return pathname from state
    const returnPathname = decodeReturnPathname(state);

    // Handle OAuth callback
    const response = new Response();
    const result = await authkit.handleCallback(request, response, { code });

    // Build redirect URL
    const redirectUrl = buildRedirectUrl(url, returnPathname);

    // Extract session headers from the result
    const sessionHeaders = extractSessionHeaders(result.response);

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

function extractSessionHeaders(response: any): Record<string, string> {
  const headers: Record<string, string> = {};

  // Handle nested response structure from authkit
  const targetResponse = response?.response || response;
  if (targetResponse?.headers) {
    targetResponse.headers.forEach((value: string, key: string) => {
      headers[key] = value;
    });
  }

  return headers;
}
