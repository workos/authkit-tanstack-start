import { authkit } from './authkit.js';

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
