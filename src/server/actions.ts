import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { authkit } from './authkit.js';
import type { UserInfo, NoUserInfo } from './server-functions.js';
import { getAuthFromContext } from './server-functions.js';

/**
 * Server actions for client-side hooks.
 * These mirror the Next.js actions API but use TanStack Start's server functions.
 */

/**
 * Check if a session exists. Used by client to detect session expiration.
 */
export const checkSessionAction = createServerFn({ method: 'GET' }).handler(() => {
  const auth = getAuthFromContext();
  return auth.user !== null;
});

/**
 * Get authentication context. Sanitized for client use (no access token).
 */
export const getAuthAction = createServerFn({ method: 'GET' })
  .inputValidator((options?: { ensureSignedIn?: boolean }) => options)
  .handler(({ data: options }): Omit<UserInfo, 'accessToken'> | NoUserInfo => {
    const auth = getAuthFromContext();

    if (!auth.user) {
      return { user: null };
    }

    return {
      user: auth.user,
      sessionId: auth.sessionId,
      organizationId: auth.organizationId,
      role: auth.role,
      roles: auth.roles,
      permissions: auth.permissions,
      entitlements: auth.entitlements,
      featureFlags: auth.featureFlags,
      impersonator: auth.impersonator,
    };
  });

/**
 * Refresh authentication session. Sanitized for client use (no access token).
 */
export const refreshAuthAction = createServerFn({ method: 'POST' })
  .inputValidator((options?: { ensureSignedIn?: boolean; organizationId?: string }) => options)
  .handler(async ({ data: options }): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> => {
    const auth = getAuthFromContext();

    if (!auth.user || !auth.accessToken || !auth.sessionId) {
      return { user: null };
    }

    // Get refresh token from request since it's not in the auth result
    const request = getRequest();
    const session = await authkit.getSession(request);

    if (!session || !session.refreshToken) {
      return { user: null };
    }

    const result = await authkit.refreshSession(
      {
        accessToken: auth.accessToken,
        refreshToken: session.refreshToken,
        user: auth.user,
        impersonator: auth.impersonator,
      },
      options?.organizationId,
    );

    if (!result.user) {
      return { user: null };
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
    };
  });

/**
 * Get access token for the current session.
 */
export const getAccessTokenAction = createServerFn({ method: 'GET' }).handler((): string | undefined => {
  const auth = getAuthFromContext();
  return auth.user ? auth.accessToken : undefined;
});

/**
 * Refresh and get a new access token.
 */
export const refreshAccessTokenAction = createServerFn({ method: 'POST' }).handler(
  async (): Promise<string | undefined> => {
    const auth = getAuthFromContext();

    if (!auth.user || !auth.accessToken) {
      return undefined;
    }

    // Get refresh token from request since it's not in the auth result
    const request = getRequest();
    const session = await authkit.getSession(request);

    if (!session || !session.refreshToken) {
      return undefined;
    }

    const result = await authkit.refreshSession({
      accessToken: auth.accessToken,
      refreshToken: session.refreshToken,
      user: auth.user,
      impersonator: auth.impersonator,
    });
    return result.accessToken;
  },
);

/**
 * Switch to a different organization. Sanitized for client use (no access token).
 */
export const switchToOrganizationAction = createServerFn({ method: 'POST' })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> => {
    const auth = getAuthFromContext();

    if (!auth.user || !auth.accessToken) {
      return { user: null };
    }

    const request = getRequest();
    const session = await authkit.getSession(request);

    if (!session || !session.refreshToken) {
      return { user: null };
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
      return { user: null };
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
    };
  });
