import { createServerFn, getGlobalStartContext } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { authkit } from './authkit.js';
import { getConfig } from '@workos/authkit-session';
import type { User, Impersonator } from '../types.js';

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
    const auth = getAuthFromContext();

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
 * Internal function to get auth from context (server-only).
 * Used by other server functions and the public getAuth server function.
 */
export function getAuthFromContext(): UserInfo | NoUserInfo {
  // @ts-expect-error: Untyped internal TanStack Start context
  const authFn = getGlobalStartContext()?.auth;

  if (!authFn) {
    throw new Error(
      'authkitMiddleware not configured. Add authkitMiddleware() to your start.ts requestMiddleware array.',
    );
  }

  const auth = authFn();

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
}

/**
 * Get authentication context from the current request.
 * Can be called from route loaders (works during client-side navigation via RPC).
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
export const getAuth = createServerFn({ method: 'GET' }).handler((): UserInfo | NoUserInfo => {
  return getAuthFromContext();
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
 *
 * @example
 * ```typescript
 * // Without return path
 * const url = await getSignInUrl();
 *
 * // With return path
 * const url = await getSignInUrl({ data: { returnPathname: '/dashboard' } });
 * ```
 */
export const getSignInUrl = createServerFn({ method: 'GET' })
  .inputValidator((data?: string | { returnPathname?: string }) => data)
  .handler(async ({ data }) => {
    const returnPathname = typeof data === 'string' ? data : data?.returnPathname;
    const workos = authkit.getWorkOS();

    return workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      clientId: getConfig('clientId'),
      redirectUri: getConfig('redirectUri'),
      state: returnPathname ? btoa(JSON.stringify({ returnPathname })) : undefined,
      screenHint: 'sign-in',
    });
  });

/**
 * Get the sign-up URL.
 * Convenience wrapper around getAuthorizationUrl with sign-up screen hint.
 *
 * @example
 * ```typescript
 * // Without return path
 * const url = await getSignUpUrl();
 *
 * // With return path
 * const url = await getSignUpUrl({ data: { returnPathname: '/dashboard' } });
 * ```
 */
export const getSignUpUrl = createServerFn({ method: 'GET' })
  .inputValidator((data?: string | { returnPathname?: string }) => data)
  .handler(async ({ data }) => {
    const returnPathname = typeof data === 'string' ? data : data?.returnPathname;
    const workos = authkit.getWorkOS();

    return workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      clientId: getConfig('clientId'),
      redirectUri: getConfig('redirectUri'),
      state: returnPathname ? btoa(JSON.stringify({ returnPathname })) : undefined,
      screenHint: 'sign-up',
    });
  });

/**
 * Switch the active organization for the current session.
 * Refreshes the session with organization-specific claims (role, permissions, etc).
 *
 * @param organizationId - The ID of the organization to switch to
 * @param options - Optional configuration
 * @returns The updated authentication context with new organization claims
 *
 * @example
 * ```typescript
 * import { switchToOrganization } from '@workos/authkit-tanstack-start';
 *
 * // In a server function or route loader
 * const auth = await switchToOrganization({
 *   data: { organizationId: 'org_123' }
 * });
 * ```
 */
export const switchToOrganization = createServerFn({ method: 'POST' })
  .inputValidator((data: { organizationId: string; returnTo?: string }) => data)
  .handler(async ({ data }): Promise<UserInfo> => {
    const request = getRequest();
    const auth = getAuthFromContext();

    if (!auth.user || !auth.accessToken) {
      throw redirect({ to: data.returnTo || '/' });
    }

    const session = await authkit.getSession(request);
    if (!session || !session.refreshToken) {
      throw redirect({ to: data.returnTo || '/' });
    }

    const result = await authkit.refreshSession(
      {
        accessToken: auth.accessToken,
        refreshToken: session.refreshToken,
        user: auth.user,
        impersonator: auth.impersonator,
      },
      data.organizationId,
    );

    if (!result.user) {
      throw redirect({ to: data.returnTo || '/' });
    }

    return {
      user: result.user,
      sessionId: result.sessionId,
      organizationId: result.organizationId,
      role: result.role,
      roles: result.roles,
      permissions: result.permissions,
      entitlements: result.entitlements,
      featureFlags: result.claims?.feature_flags,
      impersonator: result.impersonator,
      accessToken: result.accessToken!,
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
