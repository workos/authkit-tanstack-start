/**
 * Server-entry exports for @workos/authkit-tanstack-start/server-entry
 *
 * These exports are ONLY for use in server.ts files and server route handlers.
 * They will cause client bundling issues if imported in regular route components.
 */

export { createWorkOSHandler, handleCallbackRoute } from '../server/server.js';