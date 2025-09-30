import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { authkit } from './authkit.js';
import type { UserInfo, NoUserInfo } from './server-functions.js';

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

    if (!session.user || !session.accessToken || !session.refreshToken) {
      return { user: null };
    }

    const result = await authkit.refreshSession(
      {
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        user: session.user,
        impersonator: session.impersonator,
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

    if (!session.user || !session.accessToken || !session.refreshToken) {
      return undefined;
    }

    const result = await authkit.refreshSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
      impersonator: session.impersonator,
    });
    return result.accessToken;
  },
);
