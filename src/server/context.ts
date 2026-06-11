import { getGlobalStartContext } from '@tanstack/react-start';
import type { AuthResult } from '@workos/authkit-session';
import type { User } from '../types.js';

/**
 * Auth context provided by `authkitMiddleware`, available in server
 * functions and any middleware that runs after it.
 */
export interface AuthKitContext {
  /** Returns the auth result for the current request. */
  auth: () => AuthResult<User>;
  /** The original incoming request. */
  request: Request;
  /** The redirect URI configured on the middleware, if any. */
  redirectUri?: string;
}

/**
 * Internal context shape set by authkitMiddleware. Extends the public
 * context with the pending-header channel used to flush Set-Cookie
 * headers onto the outgoing response. Not part of the public API.
 */
export interface AuthKitServerContext extends AuthKitContext {
  __setPendingHeader: (key: string, value: string) => void;
}

const MIDDLEWARE_NOT_CONFIGURED_ERROR = `AuthKit middleware is not configured.

Add authkitMiddleware() to your app.tsx file:

import { authkitMiddleware } from '@workos/authkit-tanstack-react-start';

export default createRouter({
  routeTree,
  context: { ... },
  middleware: [authkitMiddleware()],
});

See the documentation for more details: https://github.com/workos/authkit-tanstack-start`;

/**
 * Gets the AuthKit context from TanStack's global context.
 * Throws if middleware is not configured.
 *
 * Use this in your own server functions or middleware to access the
 * auth result that `authkitMiddleware` already resolved for the request:
 *
 * @example
 * ```typescript
 * import { getAuthKitContext } from '@workos/authkit-tanstack-react-start';
 *
 * const myServerFn = createServerFn().handler(async () => {
 *   const { auth } = getAuthKitContext();
 *   const { user } = auth();
 *   // ...
 * });
 * ```
 */
export function getAuthKitContext(): AuthKitContext {
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
export function getAuthKitContextOrNull(): AuthKitContext | null {
  return getInternalAuthKitContextOrNull();
}

/**
 * Full middleware context including the pending-header channel.
 * For sibling server modules only — not exported from the package.
 *
 * @internal
 */
export function getInternalAuthKitContextOrNull(): AuthKitServerContext | null {
  try {
    const ctx = getGlobalStartContext() as AuthKitServerContext | undefined;
    // Validate that both auth and request are present
    return ctx?.auth && ctx?.request ? ctx : null;
  } catch {
    // Context not available (e.g., outside request lifecycle)
    return null;
  }
}
