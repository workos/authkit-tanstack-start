import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { authkit } from './authkit.js';
import { getConfig } from '@workos/authkit-session';
import type { User, Impersonator } from '@workos-inc/node';

// Type exports
export interface GetAuthURLOptions {
  redirectUri?: string;
  screenHint?: 'sign-up' | 'sign-in';
  returnPathname?: string;
}

export interface UserInfo {
  user: User;
  sessionId: string;
  organizationId?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  entitlements?: string[];
  featureFlags?: string[];
  impersonator?: Impersonator;
  accessToken: string;
}

export interface NoUserInfo {
  user: null;
}

/**
 * Signs out the current user by terminating their session.
 *
 * @example
 * ```typescript
 * import { signOut } from '@workos/authkit-tanstack-start';
 *
 * // In a server function or route
 * await signOut({ returnTo: '/' });
 * ```
 */
export const signOut = createServerFn({ method: 'POST' })
  .inputValidator((options?: { returnTo?: string }) => options)
  .handler(async ({ data }) => {
    const request = getRequest();
    const auth = await authkit.withAuth(request);

    if (!auth.user || !auth.sessionId) {
      // No session to terminate
      throw redirect({
        to: data?.returnTo || '/',
        throw: true,
        reloadDocument: true,
      });
    }

    const workos = authkit.getWorkOS();
    const logoutUrl = workos.userManagement.getLogoutUrl({
      sessionId: auth.sessionId,
      returnTo: data?.returnTo,
    });

    // Clear session and redirect to WorkOS logout
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
 * Get authentication context from the current request.
 *
 * @returns The authentication context with user info or null user
 *
 * @example
 * ```typescript
 * // In a route loader
 * import { getAuth } from '@workos/authkit-tanstack-start';
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
    return { user: null };
  }

  return {
    user: auth.user,
    sessionId: auth.sessionId!,
    organizationId: auth.claims?.org_id,
    role: auth.claims?.role,
    roles: auth.claims?.roles,
    permissions: auth.claims?.permissions,
    entitlements: auth.claims?.entitlements,
    featureFlags: auth.claims?.feature_flags,
    impersonator: auth.impersonator,
    accessToken: auth.accessToken!,
  };
});

/**
 * Get the authorization URL for WorkOS authentication.
 * Supports different screen hints and return paths.
 */
export const getAuthorizationUrl = createServerFn({ method: 'GET' })
  .inputValidator((options?: GetAuthURLOptions) => options)
  .handler(async ({ data: options = {} }) => {
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
 * Get the sign-in URL.
 * Convenience wrapper around getAuthorizationUrl with sign-in screen hint.
 */
export const getSignInUrl = createServerFn({ method: 'GET' })
  .inputValidator((returnPathname?: string) => returnPathname)
  .handler(async ({ data: returnPathname }) => {
    return getAuthorizationUrl({ data: { returnPathname, screenHint: 'sign-in' } });
  });

/**
 * Get the sign-up URL.
 * Convenience wrapper around getAuthorizationUrl with sign-up screen hint.
 */
export const getSignUpUrl = createServerFn({ method: 'GET' })
  .inputValidator((returnPathname?: string) => returnPathname)
  .handler(async ({ data: returnPathname }) => {
    return getAuthorizationUrl({ data: { returnPathname, screenHint: 'sign-up' } });
  });

// Alias for backward compatibility
export const terminateSession = signOut;

/**
 * Handles the OAuth callback from WorkOS.
 * This server function is primarily for programmatic use.
 * For route handlers, use handleCallbackRoute instead.
 *
 * @example
 * ```typescript
 * import { handleCallback } from '@workos/authkit-tanstack-start';
 *
 * const result = await handleCallback({ code: 'auth_code_xyz' });
 * ```
 */
export const handleCallback = createServerFn({ method: 'POST' })
  .inputValidator((data: { code: string; state?: string }) => data)
  .handler(async ({ data }) => {
    const request = getRequest();
    const result = await authkit.handleCallback(request, new Response(), data);

    // Decode return pathname from state
    const returnPathname = data.state ? decodeState(data.state) : '/';

    return {
      success: true,
      returnPathname,
      user: result.authResponse?.user,
      accessToken: result.authResponse?.accessToken,
    };
  });

// Helper to decode state parameter
function decodeState(state: string): string {
  try {
    const decoded = JSON.parse(atob(state));
    return decoded.returnPathname || '/';
  } catch {
    return '/';
  }
}
