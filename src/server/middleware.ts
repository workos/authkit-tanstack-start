import { createMiddleware } from '@tanstack/react-start';

/**
 * Options for AuthKit middleware.
 */
export interface AuthKitMiddlewareOptions {
  /**
   * Override the default redirect URI for OAuth callbacks.
   * Useful for dynamic environments like Vercel preview deployments.
   */
  redirectUri?: string;
}

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
