import { getAuthkit, validateConfig, getConfig } from './authkit-loader.js';
import type { AuthKitMiddlewareOptions } from './types.js';

let configValidated = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function middlewareBody(args: any, options?: AuthKitMiddlewareOptions) {
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
      redirectUri: options?.redirectUri ?? (await getConfig('redirectUri')),
      __setPendingHeader: (key: string, value: string) => {
        if (key.toLowerCase() === 'set-cookie') {
          pendingHeaders.append(key, value);
        } else {
          pendingHeaders.set(key, value);
        }
      },
    },
  });

  if (refreshedSessionData) {
    const { response: sessionResponse } = await authkit.saveSession(undefined, refreshedSessionData);
    for (const cookie of sessionResponse?.headers.getSetCookie() ?? []) {
      pendingHeaders.append('Set-Cookie', cookie);
    }
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
    if (key.toLowerCase() === 'set-cookie') {
      newResponse.headers.append(key, value);
    } else {
      newResponse.headers.set(key, value);
    }
  }

  return { ...result, response: newResponse };
}
