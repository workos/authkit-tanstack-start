import type { HeadersBag } from '@workos/authkit-session';

/**
 * Iterate every header entry in a `HeadersBag`, invoking `emit(key, value)`
 * once per value. Array values (e.g. multi-`Set-Cookie`) are expanded so each
 * entry is emitted as its own header — never comma-joined.
 */
export function forEachHeaderBagEntry(bag: HeadersBag, emit: (key: string, value: string) => void): void {
  for (const [key, value] of Object.entries(bag)) {
    if (Array.isArray(value)) {
      for (const v of value) emit(key, v);
    } else if (typeof value === 'string') {
      emit(key, value);
    }
  }
}

/**
 * Emit cookies/headers from an upstream result that may carry them in either a
 * `HeadersBag` or a mutated `Response` (storage's context-unavailable fallback
 * path). Returns `true` if anything was emitted, so callers can choose between
 * silent no-op and throwing.
 */
export function emitHeadersFrom(
  source: { headers?: HeadersBag; response?: { headers?: Headers } },
  emit: (key: string, value: string) => void,
): boolean {
  if (source.headers) {
    forEachHeaderBagEntry(source.headers, emit);
    return true;
  }
  const responseHeaders = source.response?.headers;
  if (!responseHeaders) return false;
  if (typeof responseHeaders.getSetCookie === 'function') {
    const setCookies = responseHeaders.getSetCookie();
    for (const value of setCookies) emit('Set-Cookie', value);
    return setCookies.length > 0;
  }
  if (typeof responseHeaders.get === 'function') {
    const setCookie = responseHeaders.get('Set-Cookie');
    if (setCookie) {
      emit('Set-Cookie', setCookie);
      return true;
    }
  }
  return false;
}
