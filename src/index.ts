/**
 * @workos/authkit-tanstack-start
 *
 * Server functions and utilities for WorkOS AuthKit integration with TanStack Start
 */

// Server functions - these create RPC boundaries and are safe to import anywhere
export {
  // Types
  type UserInfo,
  type NoUserInfo,
  type GetAuthURLOptions,
  // Authentication functions
  getAuth,
  signOut,
  terminateSession, // Alias for backward compatibility
  // URL generation
  getAuthorizationUrl,
  getSignInUrl,
  getSignUpUrl,
  // OAuth callback
  handleCallback,
} from './server/server-functions.js';

// Server utilities for route handlers
export { createWorkOSHandler, handleCallbackRoute, requireAuth, authkitMiddleware } from './server/server.js';

// Re-export commonly used types from local definitions (prevents client bundling issues)
export type { User, Impersonator, Session, AuthResult, BaseTokenClaims, CustomClaims } from './types.js';
