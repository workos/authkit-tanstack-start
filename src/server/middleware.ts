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
    const authkit = await getAuthkit();

    if (!configValidated) {
      await validateConfig();
      configValidated = true;
    }

    const { auth, refreshedSessionData } = await authkit.withAuth(args.request);

    const result = await args.next({
      context: {
        auth: () => auth,
      },
    });

    // Apply refreshed session cookie to response
    if (refreshedSessionData) {
      const { headers } = await authkit.saveSession(undefined, refreshedSessionData);

      if (headers?.['Set-Cookie']) {
        const newResponse = new Response(result.response.body, {
          status: result.response.status,
          statusText: result.response.statusText,
          headers: result.response.headers,
        });
        newResponse.headers.set('Set-Cookie', headers['Set-Cookie'] as string);

        return { ...result, response: newResponse };
      }
    }

    return result;
  });
};
