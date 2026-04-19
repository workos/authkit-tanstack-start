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
