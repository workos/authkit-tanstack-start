/**
 * Server-side exports for @workos/authkit-tanstack-start/server
 */

// Note: Storage implementation is omitted from public exports
// TanStackStartCookieSessionStorage should only be used internally

export type { Session, AuthResult, BaseTokenClaims, CustomClaims } from '@workos/authkit-session';

// Re-export WorkOS types that are commonly used
export type { User, Impersonator, Organization } from '@workos-inc/node';

// Export server functions
export {
  type UserInfo,
  type NoUserInfo,
  type GetAuthURLOptions,
  getAuth,
  getAuthorizationUrl,
  getSignInUrl,
  getSignUpUrl,
  terminateSession,
  signOut,
  handleCallback,
} from './server-functions.js';

// Note: createWorkOSHandler, requireAuth, and handleCallbackRoute are omitted
// These should only be imported in server.ts files, not in isomorphic route files

// Note: Direct exports of authkit functions are intentionally omitted here
// to prevent client-side bundling of server dependencies.
// Use the server functions from server-functions.ts instead.
