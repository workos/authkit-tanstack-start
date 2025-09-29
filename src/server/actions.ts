import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { authkit } from './authkit.js';
import type { UserInfo, NoUserInfo } from './server-functions.js';
import type { Organization } from '@workos-inc/node';

/**
 * Server actions for client-side hooks.
 * These mirror the Next.js actions API but use TanStack Start's server functions.
 */

/**
 * Check if a session exists. Used by client to detect session expiration.
 */
export const checkSessionAction = createServerFn({ method: 'GET' }).handler(async () => {
  const request = getRequest();
  const auth = await authkit.withAuth(request);
  return auth.user !== null;
});

/**
 * Get authentication context. Sanitized for client use (no access token).
 */
export const getAuthAction = createServerFn({ method: 'GET' })
  .inputValidator((options?: { ensureSignedIn?: boolean }) => options)
  .handler(async ({ data: options }): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> => {
    const request = getRequest();
    const auth = await authkit.withAuth(request);

    if (!auth.user) {
      return { user: null };
    }

    const extendedAuth = auth as any;

    return {
      user: auth.user,
      sessionId: auth.sessionId!,
      organizationId: extendedAuth.organizationId,
      role: extendedAuth.role,
      roles: extendedAuth.roles,
      permissions: extendedAuth.permissions,
      entitlements: extendedAuth.entitlements,
      featureFlags: extendedAuth.featureFlags,
      impersonator: auth.impersonator,
    };
  });

/**
 * Refresh authentication session. Sanitized for client use (no access token).
 */
export const refreshAuthAction = createServerFn({ method: 'POST' })
  .inputValidator((options?: { ensureSignedIn?: boolean; organizationId?: string }) => options)
  .handler(async ({ data: options }): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> => {
    const request = getRequest();
    const session = await authkit.withAuth(request);

    if (!session.user || !session.accessToken) {
      return { user: null };
    }

    const result = await authkit.refreshSession(session as any);

    if (!result.user) {
      return { user: null };
    }

    const extendedAuth = result as any;

    return {
      user: result.user,
      sessionId: result.sessionId!,
      organizationId: extendedAuth.organizationId,
      role: extendedAuth.role,
      roles: extendedAuth.roles,
      permissions: extendedAuth.permissions,
      entitlements: extendedAuth.entitlements,
      featureFlags: extendedAuth.featureFlags,
      impersonator: result.impersonator,
    };
  });

/**
 * Get access token for the current session.
 */
export const getAccessTokenAction = createServerFn({ method: 'GET' }).handler(async (): Promise<string | undefined> => {
  const request = getRequest();
  const auth = await authkit.withAuth(request);
  return auth.accessToken;
});

/**
 * Refresh and get a new access token.
 */
export const refreshAccessTokenAction = createServerFn({ method: 'POST' }).handler(
  async (): Promise<string | undefined> => {
    const request = getRequest();
    const session = await authkit.withAuth(request);

    if (!session.user || !session.accessToken) {
      return undefined;
    }

    const result = await authkit.refreshSession(session as any);
    return result.accessToken;
  },
);

/**
 * Get organization details by ID.
 */
export const getOrganizationAction = createServerFn({ method: 'GET' })
  .inputValidator((organizationId: string) => organizationId)
  .handler(async ({ data: organizationId }): Promise<Organization> => {
    const workos = authkit.getWorkOS();
    return await workos.organizations.getOrganization(organizationId);
  });
