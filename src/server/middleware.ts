import { createMiddleware } from '@tanstack/react-start';
import { getAuthkit, validateConfig } from './authkit-loader.js';

let configValidated = false;

/**
 * AuthKit middleware for TanStack Start.
 * Validates/refreshes sessions and provides auth context to downstream handlers.
 *
 * @example
 * ```typescript
 * import { createStart } from '@tanstack/react-start';
 * import { authkitMiddleware } from '@workos/authkit-tanstack-start';
 *
 * export const startInstance = createStart(() => ({
 *   requestMiddleware: [authkitMiddleware()],
 * }));
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
    const pendingHeaders = new Headers();

    const result = await args.next({
      context: {
        auth: () => auth,
        request: args.request,
        __setPendingHeader: (key: string, value: string) => {
          // Use append for Set-Cookie to support multiple cookies
          if (key.toLowerCase() === 'set-cookie') {
            pendingHeaders.append(key, value);
          } else {
            pendingHeaders.set(key, value);
          }
        },
      },
    });

    // Apply refreshed session cookie via storage's applyHeaders -> __setPendingHeader
    // No need to manually append here as the storage already adds via context
    if (refreshedSessionData) {
      await authkit.saveSession(undefined, refreshedSessionData);
    }

    const headerEntries = [...pendingHeaders];
    if (headerEntries.length === 0) {
      return result;
    }

    const newResponse = new Response(result.response.body, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers: result.response.headers,
    });

    for (const [key, value] of headerEntries) {
      // Use append for Set-Cookie to preserve multiple cookie values
      if (key.toLowerCase() === 'set-cookie') {
        newResponse.headers.append(key, value);
      } else {
        newResponse.headers.set(key, value);
      }
    }

    return { ...result, response: newResponse };
  });
};
