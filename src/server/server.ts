'use server';

import { authkit } from './authkit.js';
import { redirect } from '@tanstack/react-router';

type Handler = (request: Request, env?: any) => Promise<Response> | Response;
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
 * import { createWorkOSHandler } from '@workos/authkit-tanstack-start/server';
 *
 * const handler = createWorkOSHandler(defaultStreamHandler);
 *
 * export default {
 *   fetch: createStartHandler(handler),
 * };
 * ```
 */
export function createWorkOSHandler(handler: TanStackHandler): TanStackHandler;
export function createWorkOSHandler(handler: Handler): Handler;
export function createWorkOSHandler(handler: any): any {

  // Check if this is a TanStack handler (has ctx with request property)
  return async (ctxOrRequest: any, env?: any): Promise<Response> => {
    const isTanStackHandler = ctxOrRequest && typeof ctxOrRequest === 'object' && 'request' in ctxOrRequest;

    if (isTanStackHandler) {
      // Handle TanStack Start's handler signature
      const ctx = ctxOrRequest;
      const { request, router, responseHeaders } = ctx;

      // Use withAuth to check and refresh the session
      const authResult = await authkit.withAuth(request);

      // Attach auth context directly to the request
      (request as any).authContext = authResult;

      // Call the original handler with the context
      return handler({
        request,
        router,
        responseHeaders,
      });
    } else {
      // Handle standard handler signature
      const request = ctxOrRequest as Request;

      // Use withAuth to check and refresh the session
      const authResult = await authkit.withAuth(request);

      // Attach auth context directly to the request
      (request as any).authContext = authResult;

      // Call the original handler with the request
      return handler(request, env);
    }
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
 * import { requireAuth } from '@workos/authkit-tanstack-start/server';
 *
 * export const Route = createFileRoute('/_authenticated')({
 *   beforeLoad: requireAuth,
 * });
 * ```
 */
export async function requireAuth({ context, location }: any) {

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
 * import { handleCallbackRoute } from '@workos/authkit-tanstack-start/server';
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
  let returnPathname = state && state !== 'null' ? JSON.parse(atob(state)).returnPathname : null;

  console.log('HANDLE CALLBACK', { code, state, returnPathname });

  if (!code) {
    return new Response(JSON.stringify({ error: { message: 'Missing authorization code' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Handle the callback with the SDK
    const response = new Response();
    const result = await authkit.handleCallback(request, response, {
      code,
      // FIXME: why is this here?
      // state
    });

    console.log('RESULT', result);

    // Cleanup params and redirect
    url.searchParams.delete('code');
    url.searchParams.delete('state');

    returnPathname = returnPathname ?? '/';

    // Extract the search params if they are present
    if (returnPathname.includes('?')) {
      const newUrl = new URL(returnPathname, 'https://example.com');
      url.pathname = newUrl.pathname;

      for (const [key, value] of newUrl.searchParams) {
        url.searchParams.append(key, value);
      }
    } else {
      url.pathname = returnPathname;
    }

    // Create redirect response with session cookies
    // Extract headers from the nested response object
    const responseHeaders: Record<string, string> = {};
    if (result.response?.response?.headers) {
      result.response.response.headers.forEach((value: string, key: string) => {
        responseHeaders[key] = value;
      });
    }

    const redirectResponse = new Response(null, {
      status: 307,
      headers: {
        Location: url.toString(),
        ...responseHeaders,
      },
    });

    return redirectResponse;
  } catch (error) {
    console.error('Callback error:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: 'Authentication failed',
          description: "Couldn't sign in. If you are not sure what happened, please contact your organization admin.",
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
