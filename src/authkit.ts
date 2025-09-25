import { createAuthKitFactory, getConfigurationProvider } from '@workos/authkit-session';
import { TanStackStartCookieSessionStorage } from './storage';

/**
 * Create the AuthKit instance for TanStack Start
 * This uses the authkit-session factory with our custom storage implementation
 */
export const authkit = createAuthKitFactory({
  sessionStorageFactory: (_config) => new TanStackStartCookieSessionStorage(getConfigurationProvider()),
});

