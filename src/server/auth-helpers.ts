import { getAuthkit } from './authkit-loader.js';
import { getAuthKitContext, getAuthKitContextOrNull } from './context.js';
import type { AuthResult } from '@workos/authkit-session';
import type { User, Impersonator } from '../types.js';

/**
 * Gets the raw auth result from the global context.
 * This is the core function that all other auth helpers use.
 */
export function getRawAuthFromContext(): AuthResult<User> {
  const ctx = getAuthKitContext();
  return ctx.auth();
}

/**
 * Checks if auth middleware is configured.
 */
export function isAuthConfigured(): boolean {
  return getAuthKitContextOrNull() !== null;
}

/**
 * Gets the redirect URI from middleware context if configured.
 */
export function getRedirectUriFromContext(): string | undefined {
  const ctx = getAuthKitContextOrNull();
  return ctx?.redirectUri;
}

/**
 * Gets the session with refresh token from the auth context.
 * Uses the middleware auth context which always has the latest refresh token,
 * even if the middleware auto-refreshed during withAuth().
 * Returns null if no valid session exists.
 */
export async function getSessionWithRefreshToken(): Promise<{
  refreshToken: string;
  accessToken: string;
  user: User;
  impersonator?: Impersonator;
} | null> {
  const auth = getRawAuthFromContext();

  if (!auth.user || !auth.accessToken) {
    return null;
  }

  // Use the refresh token from the auth context — it's always up-to-date.
  // Previously we re-read the session from the original request, but if the
  // middleware auto-refreshed (e.g., expired access token), the old refresh
  // token in the request cookie would already be invalidated.
  const refreshToken = 'refreshToken' in auth ? auth.refreshToken : undefined;
  if (!refreshToken) {
    return null;
  }

  return {
    refreshToken,
    accessToken: auth.accessToken,
    user: auth.user,
    impersonator: auth.impersonator,
  };
}

/**
 * Refreshes the session with an optional organization ID.
 */
export async function refreshSession(organizationId?: string) {
  const sessionData = await getSessionWithRefreshToken();

  if (!sessionData) {
    return null;
  }

  const authkit = await getAuthkit();

  const { auth: result, encryptedSession } = await authkit.refreshSession(
    {
      accessToken: sessionData.accessToken,
      refreshToken: sessionData.refreshToken,
      user: sessionData.user,
      impersonator: sessionData.impersonator,
    },
    organizationId,
  );

  if (encryptedSession) {
    await authkit.saveSession(undefined, encryptedSession);
  }

  return result;
}
