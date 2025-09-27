/**
 * @workos/authkit-tanstack-start
 *
 * Server functions and utilities for WorkOS AuthKit integration with TanStack Start
 */

// Export all server functions (safe to import anywhere - they create RPC boundaries)
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
} from './server/server-functions.js';

// Export types that are commonly used
export type { Session, AuthResult, BaseTokenClaims, CustomClaims } from '@workos/authkit-session';
export type { User, Impersonator, Organization } from '@workos-inc/node';

// Export utilities for server.ts and server route handlers
// These are wrapped to be server-only
export { createWorkOSHandler, handleCallbackRoute, requireAuth } from './server/server.js';