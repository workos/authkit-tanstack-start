import { getGlobalStartContext } from '@tanstack/react-start';
import { getAuthkit } from './authkit-loader.js';
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

  const globalContext = getGlobalStartContext() as any;
  const request = globalContext?.request;

  if (!request) {
    throw new Error('Request not found in context. Ensure authkitMiddleware() is configured.');
  }

  const authkit = await getAuthkit();
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

  if (encryptedSession) {
    await authkit.saveSession(undefined, encryptedSession);
  }

  return result;
}

/**
 * Decodes a state parameter from OAuth callback.
 * Format: base64EncodedInternal.customUserState (dot-separated)
 */
export function decodeState(state: string | null): { returnPathname: string; customState?: string } {
  if (!state || state === 'null') {
    return { returnPathname: '/' };
  }

  const [internal, ...rest] = state.split('.');
  const customState = rest.length > 0 ? rest.join('.') : undefined;

  try {
    const decoded = JSON.parse(atob(internal));
    return {
      returnPathname: decoded.returnPathname || '/',
      customState,
    };
  } catch {
    return { returnPathname: '/', customState: customState ?? state };
  }
}
