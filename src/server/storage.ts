import { CookieSessionStorage } from '@workos/authkit-session';
import { getGlobalStartContext } from '@tanstack/react-start';

export class TanStackStartCookieSessionStorage extends CookieSessionStorage<Request, Response> {
  async getSession(request: Request): Promise<string | null> {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = this.parseCookies(cookieHeader);
    const value = cookies[this.cookieName];
    return value ? decodeURIComponent(value) : null;
  }

  protected async applyHeaders(
    response: Response | undefined,
    headers: Record<string, string>,
  ): Promise<{ response: Response }> {
    try {
      const globalContext = getGlobalStartContext() as any;
      const setPendingHeader = globalContext?._setPendingHeader;
      if (typeof setPendingHeader === 'function') {
        Object.entries(headers).forEach(([key, value]) => setPendingHeader(key, value));
      }
    } catch {
      // Not in a request context
    }

    const newResponse = response
      ? new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: new Headers(response.headers),
        })
      : new Response();

    Object.entries(headers).forEach(([key, value]) => newResponse.headers.append(key, value));

    return { response: newResponse };
  }

  private parseCookies(cookieHeader: string): Record<string, string> {
    return Object.fromEntries(
      cookieHeader.split(';').map((cookie) => {
        const [key, ...valueParts] = cookie.trim().split('=');
        return [key, valueParts.join('=')];
      }),
    );
  }
}
