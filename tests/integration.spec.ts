import { describe, it, expect, vi } from 'vitest';

// Mock only the essential TanStack pieces
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: (fn: any) => fn,
    }),
    handler: (fn: any) => fn,
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('http://test.com'),
}));

describe('Integration tests', () => {
  it('imports without errors', async () => {
    // This validates that the module structure is correct
    const serverFunctions = await import('../src/server/server-functions');

    expect(serverFunctions.getAuth).toBeDefined();
    expect(serverFunctions.signOut).toBeDefined();
    expect(serverFunctions.getAuthorizationUrl).toBeDefined();
    expect(serverFunctions.getSignInUrl).toBeDefined();
    expect(serverFunctions.getSignUpUrl).toBeDefined();
    expect(serverFunctions.handleCallback).toBeDefined();
    expect(serverFunctions.terminateSession).toBeDefined();
  });

  it('server utilities are properly structured', async () => {
    const server = await import('../src/server/server');

    expect(server.createWorkOSHandler).toBeDefined();
    expect(server.handleCallbackRoute).toBeDefined();
    expect(server.requireAuth).toBeDefined();

    // Verify they're functions
    expect(typeof server.createWorkOSHandler).toBe('function');
    expect(typeof server.handleCallbackRoute).toBe('function');
    expect(typeof server.requireAuth).toBe('function');
  });

  it('storage class is properly structured', async () => {
    const storage = await import('../src/server/storage');

    expect(storage.TanStackStartCookieSessionStorage).toBeDefined();
    expect(typeof storage.TanStackStartCookieSessionStorage).toBe('function');

    // Verify it's a constructor
    const instance = new storage.TanStackStartCookieSessionStorage({
      getValue: () => 'test',
    } as any);

    expect(instance).toBeDefined();
    expect(typeof instance.getSession).toBe('function');
  });
});