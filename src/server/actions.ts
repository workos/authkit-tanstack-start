import { createServerFn, getGlobalStartContext } from '@tanstack/react-start';
import type { UserInfo, NoUserInfo } from './server-functions.js';

/**
 * Server actions for client-side hooks.
 * These mirror the Next.js actions API but use TanStack Start's server functions.
 */

/**
 * Check if a session exists. Used by client to detect session expiration.
 */
export const checkSessionAction = createServerFn({ method: 'GET' }).handler(() => {
  const globalContext = getGlobalStartContext() as any;
  const authFn = globalContext?.auth;

  if (!authFn) {
    return false;
  }

  const auth = authFn();
  return auth.user !== null;
});

/**
 * Get authentication context. Sanitized for client use (no access token).
 */
export const getAuthAction = createServerFn({ method: 'GET' })
  .inputValidator((options?: { ensureSignedIn?: boolean }) => options)
  .handler(({ data: options }): Omit<UserInfo, 'accessToken'> | NoUserInfo => {
    console.log('[getAuthAction] Called from client with options:', options);
    const globalContext = getGlobalStartContext() as any;
    const authFn = globalContext?.auth;

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
    console.log('[getAuthAction] Auth result:', auth?.user?.email || 'no user');

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
    // Import server dependencies inside the handler
    const { getRequest } = await import('@tanstack/react-start/server');
    const { getAuthkit } = await import('./authkit-loader.js');
    const authkit = await getAuthkit();

    const globalContext = getGlobalStartContext() as any;
    const authFn = globalContext?.auth;

    if (!authFn) {
      return { user: null };
    }

    const auth = authFn();

    if (!auth.user || !auth.accessToken || !auth.sessionId) {
      return { user: null };
    }

    // Get refresh token from request since it's not in the auth result
    const request = getRequest();
    const session = await authkit.getSession(request);

    if (!session || !session.refreshToken) {
      return { user: null };
    }

    const { auth: result } = await authkit.refreshSession(
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
      organizationId: result.claims?.org_id,
      role: result.claims?.role,
      roles: result.claims?.roles,
      permissions: result.claims?.permissions,
      entitlements: result.claims?.entitlements,
      featureFlags: result.claims?.feature_flags,
      impersonator: result.impersonator,
    };
  });

/**
 * Get access token for the current session.
 */
export const getAccessTokenAction = createServerFn({ method: 'GET' }).handler((): string | undefined => {
  const globalContext = getGlobalStartContext() as any;
  const authFn = globalContext?.auth;

  if (!authFn) {
    return undefined;
  }

  const auth = authFn();
  return auth.user ? auth.accessToken : undefined;
});

/**
 * Refresh and get a new access token.
 */
export const refreshAccessTokenAction = createServerFn({ method: 'POST' }).handler(
  async (): Promise<string | undefined> => {
    // Import server dependencies inside the handler
    const { getRequest } = await import('@tanstack/react-start/server');
    const { getAuthkit } = await import('./authkit-loader.js');
    const authkit = await getAuthkit();

    const globalContext = getGlobalStartContext() as any;
    const authFn = globalContext?.auth;

    if (!authFn) {
      return undefined;
    }

    const auth = authFn();

    if (!auth.user || !auth.accessToken) {
      return undefined;
    }

    // Get refresh token from request since it's not in the auth result
    const request = getRequest();
    const session = await authkit.getSession(request);

    if (!session || !session.refreshToken) {
      return undefined;
    }

    const { auth: result } = await authkit.refreshSession({
      accessToken: auth.accessToken,
      refreshToken: session.refreshToken,
      user: auth.user,
      impersonator: auth.impersonator,
    });
    return result.user ? result.accessToken : undefined;
  },
);

/**
 * Switch to a different organization. Sanitized for client use (no access token).
 */
export const switchToOrganizationAction = createServerFn({ method: 'POST' })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> => {
    // Import server dependencies inside the handler
    const { getRequest } = await import('@tanstack/react-start/server');
    const { getAuthkit } = await import('./authkit-loader.js');
    const authkit = await getAuthkit();

    const globalContext = getGlobalStartContext() as any;
    const authFn = globalContext?.auth;

    if (!authFn) {
      return { user: null };
    }

    const auth = authFn();

    if (!auth.user || !auth.accessToken) {
      return { user: null };
    }

    const request = getRequest();
    const session = await authkit.getSession(request);

    if (!session || !session.refreshToken) {
      return { user: null };
    }

    const { auth: result } = await authkit.refreshSession(
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
      organizationId: result.claims?.org_id,
      role: result.claims?.role,
      roles: result.claims?.roles,
      permissions: result.claims?.permissions,
      entitlements: result.claims?.entitlements,
      featureFlags: result.claims?.feature_flags,
      impersonator: result.impersonator,
    };
  });
