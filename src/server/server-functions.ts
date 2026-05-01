import { redirect } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import type { Impersonator, User } from '../types.js';

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

/** Options for getSignInUrl/getSignUpUrl - all GetAuthURLOptions except screenHint */
type SignInUrlOptions = Omit<GetAuthURLOptions, 'screenHint'>;

/** Internal: Returns logout URL for client-side sign out. */
export const getSignOutUrl = createServerFn({ method: 'POST' })
  .inputValidator((options?: { returnTo?: string }) => options)
  .handler(async ({ data }): Promise<{ url: string | null }> => {
    const { getSignOutUrlBody } = await import('./server-fn-bodies.js');
    return getSignOutUrlBody(data);
  });

/**
 * Signs out the current user by terminating their session.
 * Best used in route loaders where redirect handling works properly.
 * For client-side button handlers, use the signOut from useAuth() hook instead.
 *
 * @example
 * ```typescript
 * import { signOut } from '@workos/authkit-tanstack-react-start';
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
    const { signOutBody } = await import('./server-fn-bodies.js');
    const plan = await signOutBody(data);

    if (plan.kind === 'returnTo') {
      throw redirect({
        to: plan.to,
        throw: true,
        reloadDocument: true,
      });
    }

    throw redirect({
      href: plan.href,
      throw: true,
      reloadDocument: true,
      headers: plan.headers,
    });
  });

/**
 * Get authentication context from the current request.
 * Can be called from route loaders (works during client-side navigation via RPC).
 *
 * @returns The authentication context with user info or null user
 *
 * @example
 * ```typescript
 * // In a route loader
 * import { getAuth } from '@workos/authkit-tanstack-react-start';
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
  const { getAuthBody } = await import('./server-fn-bodies.js');
  return getAuthBody();
});

/**
 * Get the authorization URL for WorkOS authentication.
 * Supports different screen hints and return paths.
 */
export const getAuthorizationUrl = createServerFn({ method: 'GET' })
  .inputValidator((options?: GetAuthURLOptions) => options)
  .handler(async ({ data: options }): Promise<string> => {
    const { getAuthorizationUrlBody } = await import('./server-fn-bodies.js');
    return getAuthorizationUrlBody(options);
  });

/**
 * Get the sign-in URL.
 * Convenience wrapper around getAuthorizationUrl with sign-in screen hint.
 *
 * @example
 * ```typescript
 * // Without options
 * const url = await getSignInUrl();
 *
 * // With return path (string shorthand)
 * const url = await getSignInUrl({ data: '/dashboard' });
 *
 * // With options
 * const url = await getSignInUrl({ data: { returnPathname: '/dashboard', state: 'custom-state' } });
 * ```
 */
export const getSignInUrl = createServerFn({ method: 'GET' })
  .inputValidator((data?: string | SignInUrlOptions) => data)
  .handler(async ({ data }): Promise<string> => {
    const { getSignInUrlBody } = await import('./server-fn-bodies.js');
    return getSignInUrlBody(data);
  });

/**
 * Get the sign-up URL.
 * Convenience wrapper around getAuthorizationUrl with sign-up screen hint.
 *
 * @example
 * ```typescript
 * // Without options
 * const url = await getSignUpUrl();
 *
 * // With return path (string shorthand)
 * const url = await getSignUpUrl({ data: '/dashboard' });
 *
 * // With options
 * const url = await getSignUpUrl({ data: { returnPathname: '/dashboard', state: 'custom-state' } });
 * ```
 */
export const getSignUpUrl = createServerFn({ method: 'GET' })
  .inputValidator((data?: string | SignInUrlOptions) => data)
  .handler(async ({ data }): Promise<string> => {
    const { getSignUpUrlBody } = await import('./server-fn-bodies.js');
    return getSignUpUrlBody(data);
  });

/**
 * Switch the active organization for the current session.
 * Refreshes the session with organization-specific claims (role, permissions, etc).
 *
 * @example
 * ```typescript
 * import { switchToOrganization } from '@workos/authkit-tanstack-react-start';
 *
 * const auth = await switchToOrganization({ data: { organizationId: 'org_123' } });
 * ```
 */
export const switchToOrganization = createServerFn({ method: 'POST' })
  .inputValidator((data: { organizationId: string; returnTo?: string }) => data)
  .handler(async ({ data }): Promise<UserInfo> => {
    const { switchToOrganizationBody } = await import('./server-fn-bodies.js');
    const plan = await switchToOrganizationBody(data);

    if (plan.kind === 'redirect') {
      throw redirect({ to: plan.to });
    }

    return plan.user;
  });
