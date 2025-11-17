import { createServerFn } from '@tanstack/react-start';
import { getRawAuthFromContext, isAuthConfigured, refreshSession } from './auth-helpers.js';
import type { UserInfo, NoUserInfo } from './server-functions.js';

/**
 * Server actions for client-side hooks.
 * These mirror the Next.js actions API but use TanStack Start's server functions.
 */

/**
 * Converts raw auth to sanitized UserInfo (without access token).
 */
function sanitizeAuthForClient(auth: any): Omit<UserInfo, 'accessToken'> | NoUserInfo {
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
}

/**
 * Check if a session exists. Used by client to detect session expiration.
 */
export const checkSessionAction = createServerFn({ method: 'GET' }).handler(() => {
  if (!isAuthConfigured()) {
    return false;
  }

  try {
    const auth = getRawAuthFromContext();
    return auth.user !== null;
  } catch {
    return false;
  }
});

/**
 * Get authentication context. Sanitized for client use (no access token).
 */
export const getAuthAction = createServerFn({ method: 'GET' })
  .inputValidator((options?: { ensureSignedIn?: boolean }) => options)
  .handler(({ data: options }): Omit<UserInfo, 'accessToken'> | NoUserInfo => {
    console.log('[getAuthAction] Called from client with options:', options);
    const auth = getRawAuthFromContext();
    console.log('[getAuthAction] Auth result:', auth?.user?.email || 'no user');
    return sanitizeAuthForClient(auth);
  });

/**
 * Refresh authentication session. Sanitized for client use (no access token).
 */
export const refreshAuthAction = createServerFn({ method: 'POST' })
  .inputValidator((options?: { ensureSignedIn?: boolean; organizationId?: string }) => options)
  .handler(async ({ data: options }): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> => {
    const result = await refreshSession(options?.organizationId);

    if (!result || !result.user) {
      return { user: null };
    }

    return sanitizeAuthForClient(result);
  });

/**
 * Get access token for the current session.
 */
export const getAccessTokenAction = createServerFn({ method: 'GET' }).handler((): string | undefined => {
  if (!isAuthConfigured()) {
    return undefined;
  }

  try {
    const auth = getRawAuthFromContext();
    return auth.user ? auth.accessToken : undefined;
  } catch {
    return undefined;
  }
});

/**
 * Refresh and get a new access token.
 */
export const refreshAccessTokenAction = createServerFn({ method: 'POST' }).handler(
  async (): Promise<string | undefined> => {
    const result = await refreshSession();
    return result?.user ? result.accessToken : undefined;
  },
);

/**
 * Switch to a different organization. Sanitized for client use (no access token).
 */
export const switchToOrganizationAction = createServerFn({ method: 'POST' })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> => {
    const result = await refreshSession(data.organizationId);

    if (!result || !result.user) {
      return { user: null };
    }

    return sanitizeAuthForClient(result);
  });