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

    // Get result from next() - this calls the next middleware/handler
    const result = await args.next({
      context: {
        auth: () => auth,
      },
    });

    // If session was refreshed, apply Set-Cookie header to the HTTP response
    if (refreshedSessionData) {
      console.log('[middleware] ✅ Session was refreshed, persisting to cookie');

      // Get the properly formatted Set-Cookie header from storage
      const { headers } = await authkit.saveSession(undefined, refreshedSessionData);

      if (headers?.['Set-Cookie']) {
        // Clone the response (Response objects are immutable)
        const newResponse = new Response(result.response.body, {
          status: result.response.status,
          statusText: result.response.statusText,
          headers: result.response.headers,
        });

        // Apply the Set-Cookie header to the HTTP response
        newResponse.headers.set('Set-Cookie', headers['Set-Cookie'] as string);

        return {
          ...result,
          response: newResponse,
        };
      }
    }

    return result;
  });
};
