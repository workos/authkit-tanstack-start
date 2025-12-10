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
    const pendingHeaders: Record<string, string> = {};

    const result = await args.next({
      context: {
        auth: () => auth,
        request: args.request,
        __setPendingHeader: (key: string, value: string) => {
          pendingHeaders[key] = value;
        },
      },
    });

    if (refreshedSessionData) {
      const { headers } = await authkit.saveSession(undefined, refreshedSessionData);
      if (headers?.['Set-Cookie']) {
        pendingHeaders['Set-Cookie'] = headers['Set-Cookie'] as string;
      }
    }

    if (Object.keys(pendingHeaders).length === 0) {
      return result;
    }

    const newResponse = new Response(result.response.body, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers: result.response.headers,
    });

    for (const [key, value] of Object.entries(pendingHeaders)) {
      newResponse.headers.set(key, value);
    }

    return { ...result, response: newResponse };
  });
};
