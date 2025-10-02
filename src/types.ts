/**
 * Re-export types from authkit-session to avoid importing from workos-node in client code.
 * This prevents server-only dependencies from being bundled into the client.
 */

export type { User, Impersonator, AuthResult, BaseTokenClaims, CustomClaims, Session } from '@workos/authkit-session';
