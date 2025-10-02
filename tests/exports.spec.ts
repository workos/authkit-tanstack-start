import { describe, it, expect } from 'vitest';
import * as exports from '../src/index';

describe('SDK exports', () => {
  it('exports expected functions', () => {
    // Server functions
    expect(exports.getAuth).toBeDefined();
    expect(exports.signOut).toBeDefined();
    expect(exports.terminateSession).toBeDefined();
    expect(exports.getAuthorizationUrl).toBeDefined();
    expect(exports.getSignInUrl).toBeDefined();
    expect(exports.getSignUpUrl).toBeDefined();
    expect(exports.handleCallback).toBeDefined();

    // Middleware
    expect(exports.authkitMiddleware).toBeDefined();
  });

  it('exports expected types', () => {
    // The types are exported correctly if the file compiles
    // This is more of a compilation test than a runtime test
    const typeExports: Array<keyof typeof exports> = [
      'getAuth',
      'signOut',
      'getAuthorizationUrl',
      'getSignInUrl',
      'getSignUpUrl',
      'handleCallback',
      'authkitMiddleware',
    ];

    typeExports.forEach((exportName) => {
      expect(exports[exportName]).toBeDefined();
    });
  });
});
