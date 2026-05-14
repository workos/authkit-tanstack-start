import { createMiddleware } from '@tanstack/react-start';
import type { AuthKitMiddlewareOptions } from './types.js';

export type { AuthKitMiddlewareOptions };

/**
 * AuthKit middleware for TanStack Start.
 * Validates/refreshes sessions and provides auth context to downstream handlers.
 *
 * @example
 * ```typescript
 * import { createStart } from '@tanstack/react-start';
 * import { authkitMiddleware } from '@workos/authkit-tanstack-react-start';
 *
 * export const startInstance = createStart(() => ({
 *   requestMiddleware: [authkitMiddleware()],
 * }));
 * ```
 *
 * @example
 * ```typescript
 * // With custom redirect URI
 * authkitMiddleware({
 *   redirectUri: 'https://preview.example.com/callback',
 * })
 * ```
 */
export const authkitMiddleware = (options?: AuthKitMiddlewareOptions) => {
  return createMiddleware().server(async (args) => {
    const { middlewareBody } = await import('./middleware-body.js');
    return middlewareBody(args, options);
  });
};
