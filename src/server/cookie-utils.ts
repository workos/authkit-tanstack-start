import { PKCE_COOKIE_NAME } from '@workos/authkit-session';

export function parseCookies(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split(';').map((cookie) => {
      const [key, ...valueParts] = cookie.trim().split('=');
      return [key, valueParts.join('=')];
    }),
  );
}

export function readPKCECookie(request: Request): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  const raw = parseCookies(header)[PKCE_COOKIE_NAME];
  if (raw === undefined) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}
