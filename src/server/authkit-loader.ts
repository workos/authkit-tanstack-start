/**
 * Lazy loader for authkit instance.
 * This module can be imported anywhere (even client bundles) because it only
 * loads the actual authkit dependencies when getInstance() is called on the server.
 */

import type { AuthService } from '@workos/authkit-session';

let authkitInstance: AuthService<Request, Response> | undefined;

/**
 * Get or create the authkit instance.
 * This function will only ever be called on the server (inside server functions),
 * so it's safe to dynamically import server-only dependencies here.
 */
export async function getAuthkit(): Promise<AuthService<Request, Response>> {
  if (!authkitInstance) {
    // These imports happen ONLY when this function is called (on server)
    const { createAuthService, getConfigurationProvider } = await import('@workos/authkit-session');
    const { TanStackStartCookieSessionStorage } = await import('./storage.js');

    authkitInstance = createAuthService({
      sessionStorageFactory: (config) => new TanStackStartCookieSessionStorage(getConfigurationProvider()),
    });
  }

  return authkitInstance;
}

/**
 * Type-only export for better DX.
 * This allows other modules to import the type without triggering module evaluation.
 */
export type { AuthService };