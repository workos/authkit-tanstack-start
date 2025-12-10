/**
 * Central orchestrator for AuthKit service creation.
 */

import {
  createAuthService,
  getConfig as getConfigFromSession,
  validateConfig as validateConfigFromSession,
  type AuthService,
  type AuthKitConfig,
} from '@workos/authkit-session';
import { TanStackStartCookieSessionStorage } from './storage.js';

let authkitInstance: AuthService<Request, Response> | undefined;

export async function getAuthkit(): Promise<AuthService<Request, Response>> {
  if (!authkitInstance) {
    authkitInstance = createAuthService({
      sessionStorageFactory: (config) => new TanStackStartCookieSessionStorage(config),
    });
  }
  return authkitInstance;
}

export async function getConfig<K extends keyof AuthKitConfig>(key: K): Promise<AuthKitConfig[K]> {
  return getConfigFromSession(key);
}

export async function validateConfig(): Promise<void> {
  return validateConfigFromSession();
}

export type { AuthService };
