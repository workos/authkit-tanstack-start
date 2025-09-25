import { authkit } from './authkit';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { getConfig } from '@workos/authkit-session';

type Handler = (request: Request, env?: any) => Promise<Response> | Response;
type TanStackHandler = (ctx: {
  request: Request;
  router: any;
  responseHeaders: Headers;
}) => Promise<Response> | Response;

// Type exports
export interface GetAuthURLOptions {
  redirectUri?: string;
  screenHint?: 'sign-up' | 'sign-in';
  returnPathname?: string;
}

export interface UserInfo {
  user: import('@workos-inc/node').User;
  sessionId: string;
  organizationId?: string;
  role?: string;
  permissions?: Array<string>;
  entitlements?: Array<string>;
  impersonator?: import('@workos-inc/node').Impersonator;
  accessToken: string;
}

export interface NoUserInfo {
  user: null;
  sessionId?: undefined;
  organizationId?: undefined;
  role?: undefined;
  permissions?: undefined;
  entitlements?: undefined;
  impersonator?: undefined;
  accessToken?: undefined;
}

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
 * Server function to get the authorization URL for WorkOS authentication.
 * Supports different screen hints and return paths.
 */
export const getAuthorizationUrl = createServerFn({ method: 'GET' })
  .inputValidator((options?: GetAuthURLOptions) => options)
  .handler(({ data: options = {} }) => {
    const { returnPathname, screenHint, redirectUri } = options;
    const workos = authkit.getWorkOS();

    return workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      clientId: getConfig('clientId'),
      redirectUri: redirectUri || getConfig('redirectUri'),
      state: returnPathname ? btoa(JSON.stringify({ returnPathname })) : undefined,
      screenHint,
    });
  });

/**
 * Server function to get the sign-in URL.
 * Convenience wrapper around getAuthorizationUrl with sign-in screen hint.
 */
export const getSignInUrl = createServerFn({ method: 'GET' })
  .inputValidator((returnPathname?: string) => returnPathname)
  .handler(async ({ data: returnPathname }) => {
    return await getAuthorizationUrl({ data: { returnPathname, screenHint: 'sign-in' } });
  });

/**
 * Server function to get the sign-up URL.
 * Convenience wrapper around getAuthorizationUrl with sign-up screen hint.
 */
export const getSignUpUrl = createServerFn({ method: 'GET' })
  .inputValidator((returnPathname?: string) => returnPathname)
  .handler(async ({ data: returnPathname }) => {
    return await getAuthorizationUrl({ data: { returnPathname, screenHint: 'sign-up' } });
  });

/**
 * Get authentication context from the current request.
 * This is a server function that returns UserInfo or NoUserInfo.
 *
 * @returns The authentication context with user info or null user
 *
 * @example
 * ```typescript
 * // In a route loader
 * import { getAuth } from '@workos/authkit-tanstack-start/server';
 *
 * export const Route = createFileRoute('/protected')({
 *   loader: async () => {
 *     const auth = await getAuth();
 *     if (!auth.user) {
 *       throw redirect({ to: '/login' });
 *     }
 *     return auth;
 *   },
 * });
 * ```
 */
export const getAuth = createServerFn({ method: 'GET' }).handler(async (): Promise<UserInfo | NoUserInfo> => {
  const request = getRequest();
  const auth = await authkit.withAuth(request);

  if (!auth.user) {
    return {
      user: null,
    };
  }

  return {
    user: auth.user,
    sessionId: auth.sessionId,
    organizationId: auth.organizationId,
    role: auth.role,
    permissions: auth.permissions,
    entitlements: auth.entitlements,
    impersonator: auth.impersonator,
    accessToken: auth.accessToken,
  };
});

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

    // Use TanStack Router's redirect
    const { redirect } = await import('@tanstack/react-router');
    throw redirect({ href: signInUrl });
  }
}

/**
 * Terminates the current session and returns the logout URL.
 * This server function handles session termination with WorkOS.
 *
 * @example
 * ```typescript
 * import { terminateSession } from '@workos/authkit-tanstack-start/server';
 *
 * // In a server function or route
 * await terminateSession({ returnTo: '/' });
 * ```
 */
export const terminateSession = createServerFn({ method: 'POST' })
  .inputValidator((options?: { returnTo?: string }) => options)
  .handler(async ({ data }) => {
    const request = getRequest();
    const { redirect } = await import('@tanstack/react-router');

    // Get current auth state
    const auth = await authkit.withAuth(request);

    if (!auth.user || !auth.sessionId) {
      // No session to terminate, just redirect
      throw redirect({
        to: data?.returnTo || '/',
        throw: true,
        reloadDocument: true
      });
    }

    // Get the WorkOS client
    const workos = authkit.getWorkOS();

    // Get the logout URL from WorkOS (this will also revoke the session)
    const logoutUrl = workos.userManagement.getLogoutUrl({
      sessionId: auth.sessionId,
      returnTo: data?.returnTo,
    });

    // Clear the session cookie and redirect to WorkOS logout
    throw redirect({
      href: logoutUrl,
      throw: true,
      reloadDocument: true,
      headers: {
        'Set-Cookie': `wos_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=lax`,
      },
    });
  });

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

  if (!code) {
    return new Response(JSON.stringify({ error: { message: 'Missing authorization code' } }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Handle the callback with the SDK
    const response = new Response();
    const result = await authkit.handleCallback(request, response, { code, state });

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
    const redirectResponse = new Response(null, {
      status: 307,
      headers: {
        Location: url.toString(),
        ...Object.fromEntries(result.response?.headers || []),
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

/**
 * Signs out the current user by terminating their session.
 * Alias for terminateSession for convenience.
 *
 * @example
 * ```typescript
 * import { signOut } from '@workos/authkit-tanstack-start/server';
 *
 * // In a logout route
 * export const Route = createFileRoute('/logout')({
 *   loader: async () => {
 *     await signOut();
 *   },
 * });
 * ```
 */
export const signOut = terminateSession;
