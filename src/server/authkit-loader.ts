/**
 * Central orchestrator for ALL dynamic imports in the authkit integration.
 *
 * This module serves as the single point for all server-only dynamic imports.
 * It can be imported anywhere (even client bundles) because all actual server
 * dependencies are only loaded when the exported functions are called at runtime.
 *
 * This design makes it easy to remove dynamic imports in the future if TanStack Start
 * fixes their bundling behavior - just update this file to use static imports.
 */

import type { AuthService } from '@workos/authkit-session';

// Cached instances to avoid repeated dynamic imports
let authkitInstance: AuthService<Request, Response> | undefined;
let getRequestFn: (() => Request) | undefined;
let getConfigFn: ((key: any) => any) | undefined;
let validateConfigFn: (() => void) | undefined;

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
 * Gets the current request object from TanStack Start.
 * Dynamically imports @tanstack/react-start/server to prevent client bundling.
 */
export async function getServerRequest(): Promise<Request> {
  if (!getRequestFn) {
    const { getRequest } = await import('@tanstack/react-start/server');
    getRequestFn = getRequest;
  }
  return getRequestFn();
}

/**
 * Gets configuration values from authkit-session.
 * Dynamically imports to prevent client bundling.
 */
export async function getConfig(key: string): Promise<any> {
  if (!getConfigFn) {
    const { getConfig } = await import('@workos/authkit-session');
    getConfigFn = getConfig;
  }
  return getConfigFn(key);
}

/**
 * Validates the authkit configuration.
 * Dynamically imports to prevent client bundling.
 */
export async function validateConfig(): Promise<void> {
  if (!validateConfigFn) {
    const { validateConfig } = await import('@workos/authkit-session');
    validateConfigFn = validateConfig;
  }
  return validateConfigFn();
}

/**
 * Type-only export for better DX.
 * This allows other modules to import the type without triggering module evaluation.
 */
export type { AuthService };