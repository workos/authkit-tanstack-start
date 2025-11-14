import { createAuthService, getConfigurationProvider } from '@workos/authkit-session';
import { TanStackStartCookieSessionStorage } from './storage.js';

/**
 * Create the AuthKit instance for TanStack Start
 * This uses the new AuthService architecture with lazy initialization.
 *
 * The service is created at module load time, but AuthKitCore and AuthOperations
 * are lazily instantiated on first use. This allows configure() to be called
 * after import but before first method call.
 *
 * Note: This should only be imported in server-side code (server functions, server.ts, etc.)
 * Never import this directly in route components.
 */
export const authkit = createAuthService({
  sessionStorageFactory: (config) => new TanStackStartCookieSessionStorage(getConfigurationProvider()),
});
