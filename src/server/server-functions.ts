import { createServerFn } from '@tanstack/react-start';
import { redirect } from '@tanstack/react-router';
import { getAuthkit, getConfig } from './authkit-loader.js';
import {
  getRawAuthFromContext,
  getSessionWithRefreshToken,
  refreshSession,
  getRedirectUriFromContext,
} from './auth-helpers.js';
import type { User, Impersonator } from '../types.js';

// Type-only import - safe for bundling
import type { GetAuthorizationUrlOptions as GetAuthURLOptions } from '@workos/authkit-session';

// Type exports - re-export shared types from authkit-session
export type { GetAuthURLOptions };

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

export interface ClientUserInfo extends Omit<UserInfo, 'accessToken'> {}

export interface NoUserInfo {
  user: null;
}

/** Internal: Returns logout URL for client-side sign out. */
export const getSignOutUrl = createServerFn({ method: 'POST' })
  .inputValidator((options?: { returnTo?: string }) => options)
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const auth = getAuthFromContext();

    if (!auth.user || !auth.sessionId) {
      return { url: null };
    }

    const authkit = await getAuthkit();
    const { logoutUrl } = await authkit.signOut(auth.sessionId, { returnTo: data?.returnTo });

    return { url: logoutUrl };
  });

/**
 * Signs out the current user by terminating their session.
 * Best used in route loaders where redirect handling works properly.
 * For client-side button handlers, use the signOut from useAuth() hook instead.
 *
 * @example
 * ```typescript
 * import { signOut } from '@workos/authkit-tanstack-start';
 *
 * // In a route loader
 * export const Route = createFileRoute('/logout')({
 *   loader: async () => {
 *     await signOut();
 *   },
 * });
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

    // Get authkit instance (lazy loaded)
    const authkit = await getAuthkit();

    // Get logout URL and session clear headers from storage
    const { logoutUrl, headers: headersBag } = await authkit.signOut(auth.sessionId, { returnTo: data?.returnTo });

    // Convert HeadersBag to Headers for TanStack compatibility
    const headers = new Headers();
    if (headersBag) {
      for (const [key, value] of Object.entries(headersBag)) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    // Clear session and redirect to WorkOS logout
    throw redirect({
      href: logoutUrl,
      throw: true,
      reloadDocument: true,
      headers,
    });
  });

/** Internal function to get auth from context (server-only). */
export function getAuthFromContext(): UserInfo | NoUserInfo {
  const auth = getRawAuthFromContext();

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
    const authkit = await getAuthkit();
    const contextRedirectUri = getRedirectUriFromContext();
    return authkit.getAuthorizationUrl({
      ...options,
      redirectUri: options.redirectUri ?? contextRedirectUri,
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
  .inputValidator((data?: string | { returnPathname?: string; redirectUri?: string }) => data)
  .handler(async ({ data }) => {
    const returnPathname = typeof data === 'string' ? data : data?.returnPathname;
    const redirectUri = typeof data === 'string' ? undefined : data?.redirectUri;
    const contextRedirectUri = getRedirectUriFromContext();
    const authkit = await getAuthkit();
    return authkit.getSignInUrl({
      returnPathname,
      redirectUri: redirectUri ?? contextRedirectUri,
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
  .inputValidator((data?: string | { returnPathname?: string; redirectUri?: string }) => data)
  .handler(async ({ data }) => {
    const returnPathname = typeof data === 'string' ? data : data?.returnPathname;
    const redirectUri = typeof data === 'string' ? undefined : data?.redirectUri;
    const contextRedirectUri = getRedirectUriFromContext();
    const authkit = await getAuthkit();
    return authkit.getSignUpUrl({
      returnPathname,
      redirectUri: redirectUri ?? contextRedirectUri,
    });
  });

/**
 * Switch the active organization for the current session.
 * Refreshes the session with organization-specific claims (role, permissions, etc).
 *
 * @example
 * ```typescript
 * import { switchToOrganization } from '@workos/authkit-tanstack-start';
 *
 * const auth = await switchToOrganization({ data: { organizationId: 'org_123' } });
 * ```
 */
export const switchToOrganization = createServerFn({ method: 'POST' })
  .inputValidator((data: { organizationId: string; returnTo?: string }) => data)
  .handler(async ({ data }): Promise<UserInfo> => {
    const auth = getAuthFromContext();

    if (!auth.user) {
      throw redirect({ to: data.returnTo || '/' });
    }

    const result = await refreshSession(data.organizationId);

    if (!result?.user) {
      throw redirect({ to: data.returnTo || '/' });
    }

    return {
      user: result.user,
      sessionId: result.sessionId,
      organizationId: result.claims?.org_id,
      role: result.claims?.role,
      roles: result.claims?.roles,
      permissions: result.claims?.permissions,
      entitlements: result.claims?.entitlements,
      featureFlags: result.claims?.feature_flags,
      impersonator: result.impersonator,
      accessToken: result.accessToken,
    };
  });
