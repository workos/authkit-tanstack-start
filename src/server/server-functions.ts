import { createServerFn, getGlobalStartContext } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { getAuthkit } from './authkit-loader.js';
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

    // Dynamically import getConfig and authkit only when needed
    const authkit = await getAuthkit();
    const { getConfig } = await import('@workos/authkit-session');

    const workos = authkit.getWorkOS();
    const logoutUrl = workos.userManagement.getLogoutUrl({
      sessionId: auth.sessionId,
      returnTo: data?.returnTo,
    });

    // Get the configured cookie name from authkit
    const cookieName = getConfig('cookieName');

    // Clear session and redirect to WorkOS logout
    throw redirect({
      href: logoutUrl,
      throw: true,
      reloadDocument: true,
      headers: {
        'Set-Cookie': `${cookieName}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=lax`,
      },
    });
  });

/**
 * Internal function to get auth from context (server-only).
 * Used by other server functions and the public getAuth server function.
 */
export function getAuthFromContext(): UserInfo | NoUserInfo {
  console.log('[getAuthFromContext] Getting global context...');
  const globalContext = getGlobalStartContext() as any;
  console.log('[getAuthFromContext] Global context keys:', globalContext ? Object.keys(globalContext) : 'null');

  const authFn = globalContext?.auth;
  console.log('[getAuthFromContext] Auth function exists?', !!authFn);

  if (!authFn) {
    throw new Error(
      'AuthKit middleware is not configured.\n\n' +
        'Add authkitMiddleware() to your start.ts file:\n\n' +
        "import { createStart } from '@tanstack/react-start';\n" +
        "import { authkitMiddleware } from '@workos/authkit-tanstack-start';\n\n" +
        'export const startInstance = createStart(() => ({\n' +
        '  requestMiddleware: [authkitMiddleware()],\n' +
        '}));',
    );
  }

  const auth = authFn();
  console.log('[getAuthFromContext] Auth result:', auth?.user?.email || 'no user');

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
    return authkit.getAuthorizationUrl(options);
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
    const authkit = await getAuthkit();
    return authkit.getSignInUrl({ returnPathname });
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
    const authkit = await getAuthkit();
    return authkit.getSignUpUrl({ returnPathname });
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

    const authkit = await getAuthkit();
    const session = await authkit.getSession(request);
    if (!session || !session.refreshToken) {
      throw redirect({ to: data.returnTo || '/' });
    }

    const { auth: result, encryptedSession } = await authkit.refreshSession(
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

    // Persist the refreshed session
    await authkit.saveSession(undefined, encryptedSession);

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

// Helper to decode state parameter
function decodeState(state: string): string {
  try {
    const decoded = JSON.parse(atob(state));
    return decoded.returnPathname || '/';
  } catch {
    return '/';
  }
}
