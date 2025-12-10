/**
 * Central orchestrator for server-only dynamic imports.
 * All actual server dependencies are only loaded when functions are called at runtime.
 */

import type { AuthService } from '@workos/authkit-session';

let authkitInstance: AuthService<Request, Response> | undefined;
let getConfigFn: ((key: any) => any) | undefined;
let validateConfigFn: (() => void) | undefined;

export async function getAuthkit(): Promise<AuthService<Request, Response>> {
  if (!authkitInstance) {
    const { createAuthService } = await import('@workos/authkit-session');
    const { TanStackStartCookieSessionStorage } = await import('./storage.js');

    authkitInstance = createAuthService({
      sessionStorageFactory: (config) => new TanStackStartCookieSessionStorage(config),
    });
  }
  return authkitInstance;
}

export async function getConfig(key: string): Promise<any> {
  if (!getConfigFn) {
    const { getConfig } = await import('@workos/authkit-session');
    getConfigFn = getConfig;
  }
  return getConfigFn(key);
}

export async function validateConfig(): Promise<void> {
  if (!validateConfigFn) {
    const { validateConfig } = await import('@workos/authkit-session');
    validateConfigFn = validateConfig;
  }
  return validateConfigFn();
}

export type { AuthService };
