import { createMiddleware } from '@tanstack/react-start';
import { authkit } from './authkit.js';

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
    // authkit.withAuth handles token validation, refresh, and session decryption
    const authResult = await authkit.withAuth(args.request);

    // Store auth result in global context for routes and server functions to access
    return args.next({
      context: {
        auth: () => authResult,
      },
    });
  });
};
