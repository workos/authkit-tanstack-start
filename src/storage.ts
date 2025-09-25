import { CookieSessionStorage } from '@workos/authkit-session';

/**
 * TanStack Start compatible CookieSessionStorage implementation for WorkOS AuthKit.
 * This class handles session storage using cookies with Request/Response objects.
 */
export class TanStackStartCookieSessionStorage extends CookieSessionStorage<Request, Response> {
  async getSession(request: Request): Promise<string | null> {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c) => {
        const [key, ...val] = c.trim().split('=');
        return [key, val.join('=')];
      }),
    );

    const value = cookies[this.cookieName];
    return value ? decodeURIComponent(value) : null;
  }

  protected async applyHeaders(
    response: Response | undefined,
    headers: Record<string, string>,
  ): Promise<{ response: Response }> {
    const newResponse = response
      ? new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
        })
      : new Response();

    Object.entries(headers).forEach(([key, value]) => {
      newResponse.headers.append(key, value);
    });

    return { response: newResponse };
  }
}
