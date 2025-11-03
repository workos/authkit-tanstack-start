/**
 * @workos/authkit-tanstack-start/client
 *
 * Client-side hooks for WorkOS AuthKit integration with TanStack Start
 */

export { AuthKitProvider, useAuth } from './AuthKitProvider.js';
export { useAccessToken } from './useAccessToken.js';
export { useTokenClaims } from './useTokenClaims.js';

export { getAuthAction } from '../server/actions.js';

export type { AuthContextType, AuthKitProviderProps, UseAccessTokenReturn } from './types.js';
export type { JWTPayload, TokenClaims } from './jwt.js';
