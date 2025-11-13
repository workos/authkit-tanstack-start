import { createMiddleware } from '@tanstack/react-start';
import { authkit } from './authkit.js';
import { validateConfig } from '@workos/authkit-session';

// Track if we've validated config to avoid redundant checks
let configValidated = false;

/**
 * AuthKit middleware for TanStack Start.
 * Runs on every server request and stores authentication state in global context.
 *
 * @example
 * ```typescript
 * // In your start.ts
 * import { createStart } from '@tanstack/react-start';
 * import { authkitMiddleware } from '@workos/authkit-tanstack-start';
 *
 * export const startInstance = createStart(() => {
 *   return {
 *     requestMiddleware: [authkitMiddleware()],
 *   };
 * });
 * ```
 */
export const authkitMiddleware = () => {
  return createMiddleware().server(async (args) => {
    // Validate configuration on first request (fails fast with helpful errors)
    if (!configValidated) {
      validateConfig();
      configValidated = true;
    }

    // authkit.withAuth handles token validation, refresh, and session decryption
    const { auth, refreshedSessionData } = await authkit.withAuth(args.request);

    // If session was refreshed, save the new session data to the cookie
    if (refreshedSessionData) {
      console.log('[middleware] ✅ Session was refreshed, saving to cookie');
      await authkit.saveSession(undefined, refreshedSessionData);
    }

    // Store auth result in global context for routes and server functions to access
    return args.next({
      context: {
        auth: () => auth,
      },
    });
  });
};
