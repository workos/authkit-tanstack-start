import { getGlobalStartContext } from '@tanstack/react-start';
import { getAuthkit, getServerRequest } from './authkit-loader.js';
import type { AuthResult } from '@workos/authkit-session';
import type { User, Impersonator } from '../types.js';

const MIDDLEWARE_NOT_CONFIGURED_ERROR =
  'AuthKit middleware is not configured.\n\n' +
  'Add authkitMiddleware() to your start.ts file:\n\n' +
  "import { createStart } from '@tanstack/react-start';\n" +
  "import { authkitMiddleware } from '@workos/authkit-tanstack-start';\n\n" +
  'export const startInstance = createStart(() => ({\n' +
  '  requestMiddleware: [authkitMiddleware()],\n' +
  '}));';

/**
 * Gets the raw auth result from the global context.
 * This is the core function that all other auth helpers use.
 */
export function getRawAuthFromContext(): AuthResult<User> {
  const globalContext = getGlobalStartContext() as any;
  const authFn = globalContext?.auth;

  if (!authFn) {
    throw new Error(MIDDLEWARE_NOT_CONFIGURED_ERROR);
  }

  return authFn();
}

/**
 * Checks if auth middleware is configured.
 */
export function isAuthConfigured(): boolean {
  const globalContext = getGlobalStartContext() as any;
  return !!globalContext?.auth;
}

/**
 * Gets the session with refresh token from the current request.
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

  const [request, authkit] = await Promise.all([getServerRequest(), getAuthkit()]);
  const session = await authkit.getSession(request);

  if (!session?.refreshToken) {
    return null;
  }

  return {
    refreshToken: session.refreshToken,
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

  // Persist the refreshed session if needed
  if (encryptedSession) {
    await authkit.saveSession(undefined, encryptedSession);
  }

  return result;
}

/**
 * Decodes a state parameter from OAuth callback.
 */
export function decodeState(state: string | null): { returnPathname: string; customState?: string } {
  const defaultReturn = { returnPathname: '/', customState: undefined };

  if (!state || state === 'null') {
    return defaultReturn;
  }

  // State can have custom user data after a dot separator
  // Format: base64EncodedInternal.customUserState
  if (state.includes('.')) {
    const [internal, ...rest] = state.split('.');
    const customState = rest.join('.');

    // Try to decode the internal part
    try {
      const decoded = JSON.parse(atob(internal));
      if (decoded.returnPathname) {
        return { returnPathname: decoded.returnPathname, customState };
      }
      return { returnPathname: '/', customState };
    } catch {
      // If internal part isn't valid base64/json, treat everything after first dot as custom
      return { returnPathname: '/', customState };
    }
  }

  // No dot separator - try to decode as internal state
  try {
    const decoded = JSON.parse(atob(state));
    // If it has returnPathname, it's internal state only
    if (decoded.returnPathname) {
      return { returnPathname: decoded.returnPathname, customState: undefined };
    }
    // Otherwise it's custom state
    return { returnPathname: '/', customState: state };
  } catch {
    // If it's not valid base64/JSON, treat it as custom state
    return { returnPathname: '/', customState: state };
  }
}
