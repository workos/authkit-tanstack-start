import { getGlobalStartContext } from '@tanstack/react-start';
import type { AuthResult } from '@workos/authkit-session';
import type { User } from '../types.js';

/**
 * Internal context shape set by authkitMiddleware.
 */
export interface AuthKitServerContext {
  auth: () => AuthResult<User>;
  request: Request;
  __setPendingHeader: (key: string, value: string) => void;
}

const MIDDLEWARE_NOT_CONFIGURED_ERROR = `AuthKit middleware is not configured.

Add authkitMiddleware() to your app.tsx file:

import { authkitMiddleware } from '@workos/authkit-tanstack-start';

export default createRouter({
  routeTree,
  context: { ... },
  middleware: [authkitMiddleware()],
});

See the documentation for more details: https://github.com/workos/authkit-tanstack-start`;

/**
 * Gets the AuthKit context from TanStack's global context.
 * Throws if middleware is not configured.
 */
export function getAuthKitContext(): AuthKitServerContext {
  const ctx = getGlobalStartContext() as AuthKitServerContext | undefined;

  // Validate that both auth and request are present (ensures middleware ran correctly)
  if (!ctx?.auth || !ctx?.request) {
    throw new Error(MIDDLEWARE_NOT_CONFIGURED_ERROR);
  }

  return ctx;
}

/**
 * Gets the AuthKit context if available, returns null otherwise.
 * Gracefully handles the case where TanStack Start context is not available
 * (e.g., when called after args.next() returns in middleware).
 */
export function getAuthKitContextOrNull(): AuthKitServerContext | null {
  try {
    const ctx = getGlobalStartContext() as AuthKitServerContext | undefined;
    // Validate that both auth and request are present
    return ctx?.auth && ctx?.request ? ctx : null;
  } catch {
    // Context not available (e.g., outside request lifecycle)
    return null;
  }
}
