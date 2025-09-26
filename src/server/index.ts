/**
 * Server-side exports for @workos/authkit-tanstack-start/server
 */

// Storage implementation
export { TanStackStartCookieSessionStorage } from './storage';

export type { Session, AuthResult, BaseTokenClaims, CustomClaims } from '@workos/authkit-session';

// Re-export WorkOS types that are commonly used
export type { User, Impersonator, Organization } from '@workos-inc/node';

// Export server functions
export {
  type UserInfo,
  type NoUserInfo,
  type GetAuthURLOptions,
  createWorkOSHandler,
  getAuth,
  getAuthorizationUrl,
  getSignInUrl,
  getSignUpUrl,
  requireAuth,
  terminateSession,
  signOut,
  handleCallbackRoute,
} from './server';

import { authkit } from './authkit';

// Re-export server-specific utilities from authkit (non server-function versions)
export const { withAuth, refreshSession, handleCallback } = authkit;
