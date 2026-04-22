export function parseCookies(cookieHeader: string): Record<string, string> {
  if (!cookieHeader.trim()) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((cookie) => {
      const [key, ...valueParts] = cookie.trim().split('=');
      return [key, valueParts.join('=')];
    }),
  );
}
