import { describe, it, expect } from 'vitest';
import * as exports from '../src/index';

describe('SDK exports', () => {
  it('exports expected functions', () => {
    // Server functions
    expect(exports.getAuth).toBeDefined();
    expect(exports.checkRecentAuth).toBeDefined();
    expect(exports.signOut).toBeDefined();
    expect(exports.switchToOrganization).toBeDefined();
    expect(exports.getAuthorizationUrl).toBeDefined();
    expect(exports.getSignInUrl).toBeDefined();
    expect(exports.getSignUpUrl).toBeDefined();

    // Route handlers
    expect(exports.handleCallbackRoute).toBeDefined();

    // Middleware
    expect(exports.authkitMiddleware).toBeDefined();

    // Auth context accessors (public replacement for the middleware's
    // inferred downstream context type, lost in the lazy-shell refactor)
    expect(exports.getAuthKitContext).toBeDefined();
    expect(exports.getAuthKitContextOrNull).toBeDefined();

    // Error classes re-exported from authkit-session for adopter error handling
    expect(exports.OAuthStateMismatchError).toBeDefined();
    expect(exports.PKCECookieMissingError).toBeDefined();
  });

  it('exports expected types', () => {
    // The types are exported correctly if the file compiles
    // This is more of a compilation test than a runtime test
    const typeExports: Array<keyof typeof exports> = [
      'getAuth',
      'signOut',
      'switchToOrganization',
      'getAuthorizationUrl',
      'getSignInUrl',
      'getSignUpUrl',
      'handleCallbackRoute',
      'authkitMiddleware',
    ];

    typeExports.forEach((exportName) => {
      expect(exports[exportName]).toBeDefined();
    });
  });
});
