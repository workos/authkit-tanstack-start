/**
 * Central orchestrator for AuthKit service creation.
 *
 * All imports of @workos/authkit-session and ./storage.js are dynamic so that
 * this module can appear in the client module graph (via the barrel re-export)
 * without pulling server-only dependencies into the client bundle.
 */

import type { AuthService, AuthKitConfig } from '@workos/authkit-session';

let authkitInstancePromise: Promise<AuthService<Request, Response>> | undefined;

export function getAuthkit(): Promise<AuthService<Request, Response>> {
  if (!authkitInstancePromise) {
    authkitInstancePromise = (async () => {
      const { createAuthService } = await import('@workos/authkit-session');
      const { TanStackStartCookieSessionStorage } = await import('./storage.js');
      return createAuthService({
        sessionStorageFactory: (config) => new TanStackStartCookieSessionStorage(config),
      });
    })();
  }
  return authkitInstancePromise;
}

export async function getConfig<K extends keyof AuthKitConfig>(key: K): Promise<AuthKitConfig[K]> {
  const { getConfig: getConfigFromSession } = await import('@workos/authkit-session');
  return getConfigFromSession(key);
}

export async function validateConfig(): Promise<void> {
  const { validateConfig: validateConfigFromSession } = await import('@workos/authkit-session');
  return validateConfigFromSession();
}

export type { AuthService };
