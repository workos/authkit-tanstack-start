import { createMiddleware } from '@tanstack/react-start';
import { getAuthkit, validateConfig } from './authkit-loader.js';

// Track if we've validated config to avoid redundant checks
let configValidated = false;

/**
 * AuthKit middleware for TanStack Start.
 * Runs on every server request, validates/refreshes sessions, and stores auth in context.
 *
 * **What this middleware does:**
 * 1. Validates current session and refreshes if expiring
 * 2. Stores refreshed session in WeakMap for downstream handlers (no stale tokens)
 * 3. Writes Set-Cookie header if session was refreshed
 * 4. Provides auth to downstream via TanStack context
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
    // Get authkit instance (lazy loaded on first request)
    const authkit = await getAuthkit();

    // Validate configuration on first request (fails fast with helpful errors)
    if (!configValidated) {
      await validateConfig();
      configValidated = true;
    }

    // Check auth and potentially refresh
    const { auth, refreshedSessionData } = await authkit.withAuth(args.request);

    // Pass auth to downstream handlers via TanStack context
    // This is the TanStack way - downstream handlers call getAuthFromContext()
    const result = await args.next({
      context: {
        auth: () => auth,
      },
    });

    // If session was refreshed, apply Set-Cookie header to the HTTP response
    if (refreshedSessionData) {
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
