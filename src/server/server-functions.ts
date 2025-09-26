import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

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
    const { authkit } = await import('./authkit.js');

    // Get current auth state
    const auth = await authkit.withAuth(request);

    if (!auth.user || !auth.sessionId) {
      // No session to terminate, just redirect
      throw redirect({
        to: data?.returnTo || '/',
        throw: true,
        reloadDocument: true,
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
  const { authkit } = await import('./authkit.js');
  const auth = await authkit.withAuth(request);

  if (!auth.user) {
    return {
      user: null,
    };
  }

  return {
    // FIXME: these tyeps
    user: auth.user,
    sessionId: auth.sessionId!,
    organizationId: (auth as any).organizationId,
    role: (auth as any).role,
    permissions: (auth as any).permissions,
    entitlements: (auth as any).entitlements,
    impersonator: auth.impersonator,
    accessToken: auth.accessToken!,
  };
});

/**
 * Server function to get the authorization URL for WorkOS authentication.
 * Supports different screen hints and return paths.
 */
export const getAuthorizationUrl = createServerFn({ method: 'GET' })
  .inputValidator((options?: GetAuthURLOptions) => options)
  .handler(async ({ data: options = {} }) => {
    const { returnPathname, screenHint, redirectUri } = options;
    const { authkit } = await import('./authkit.js');
    const { getConfig } = await import('@workos/authkit-session');
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

/**
 * Handles the OAuth callback from WorkOS.
 * This should be used in your callback route to complete the authentication flow.
 *
 * @example
 * ```typescript
 * // routes/api/auth/callback.tsx
 * import { handleCallback } from '@workos/authkit-tanstack-start/server';
 *
 * export const Route = createFileRoute('/api/auth/callback')({
 *   loader: async ({ request }) => {
 *     const url = new URL(request.url);
 *     const code = url.searchParams.get('code');
 *
 *     if (!code) {
 *       throw new Error('Missing authorization code');
 *     }
 *
 *     const result = await handleCallback({ code });
 *     // Handle the result...
 *   },
 * });
 * ```
 */
export const handleCallback = createServerFn({ method: 'POST' })
  .inputValidator((data: { code: string; state?: string }) => data)
  .handler(async ({ data }) => {
    const { authkit } = await import('./authkit.js');
    const request = getRequest();

    const result = await authkit.handleCallback(request, new Response(), data);

    // Decode state if provided
    let returnPathname = '/';
    if (data.state) {
      try {
        const decoded = JSON.parse(atob(data.state));
        returnPathname = decoded.returnPathname || '/';
      } catch {
        // Invalid state, use default
      }
    }

    // Extract serializable data from result
    return {
      success: true,
      returnPathname,
      user: result.authResponse?.user,
      accessToken: result.authResponse?.accessToken,
    };
  });
