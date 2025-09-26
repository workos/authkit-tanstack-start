import { createAuthKitFactory, getConfigurationProvider } from '@workos/authkit-session';
import { TanStackStartCookieSessionStorage } from './storage';

/**
 * Create the AuthKit instance for TanStack Start
 * This uses the authkit-session factory with our custom storage implementation
 *
 * Note: This should only be imported in server-side code (server functions, server.ts, etc.)
 * Never import this directly in route components.
 */
export const authkit = createAuthKitFactory({
  sessionStorageFactory: (_config) => new TanStackStartCookieSessionStorage(getConfigurationProvider()),
});
