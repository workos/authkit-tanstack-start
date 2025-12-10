import { CookieSessionStorage } from '@workos/authkit-session';
import { getAuthKitContextOrNull } from './context.js';

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
    const ctx = getAuthKitContextOrNull();

    // When middleware context is available, use it exclusively
    if (ctx?.__setPendingHeader) {
      Object.entries(headers).forEach(([key, value]) => ctx.__setPendingHeader(key, value));
      return { response: response ?? new Response() };
    }

    // Fallback: Context unavailable (e.g., after args.next() in middleware).
    // Return headers on response - caller must extract and apply them.
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
