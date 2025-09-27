import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set up all mocks before any imports that use them
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => new Request('http://test.local')),
}));

vi.mock('./authkit', () => ({
  authkit: {
    withAuth: vi.fn(),
    getWorkOS: vi.fn(),
    handleCallback: vi.fn(),
  },
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: (options: any) => {
    const error = new Error('REDIRECT');
    (error as any).options = options;
    throw error;
  },
}));

vi.mock('@workos/authkit-session', () => ({
  getConfig: vi.fn((key: string) => {
    const configs: Record<string, any> = {
      clientId: 'test_client_id',
      redirectUri: 'http://test.local/callback',
      cookieName: 'wos_session',
    };
    return configs[key];
  }),
}));

// Mock createServerFn to return testable functions
vi.mock('@tanstack/react-start', () => ({
  createServerFn: (options?: any) => ({
    inputValidator: (validator: Function) => ({
      handler: (handler: Function) => {
        const fn = async (opts?: { data?: any }) => {
          const data = opts?.data !== undefined ? validator(opts.data) : undefined;
          return handler({ data });
        };
        return fn;
      },
    }),
    handler: (handler: Function) => {
      const fn = async (opts?: { data?: any }) => {
        return handler(opts || {});
      };
      return fn;
    },
  }),
}));

// Now import everything after mocks are set up
import { getRequest } from '@tanstack/react-start/server';
import { authkit } from './authkit';
import * as serverFunctions from './server-functions';

describe('Server Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAuth', () => {
    it('returns authenticated user info', async () => {
      const mockUser = {
        id: 'user_123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      };

      (getRequest as any).mockReturnValue(new Request('http://test.local'));
      (authkit.withAuth as any).mockResolvedValue({
        user: mockUser,
        sessionId: 'session_123',
        accessToken: 'access_token',
        organizationId: 'org_123',
        role: 'member',
        permissions: ['read'],
        entitlements: [],
        impersonator: undefined,
      });

      const result = await serverFunctions.getAuth();

      expect(result).toEqual({
        user: mockUser,
        sessionId: 'session_123',
        accessToken: 'access_token',
        organizationId: 'org_123',
        role: 'member',
        permissions: ['read'],
        entitlements: [],
        impersonator: undefined,
      });
    });

    it('returns null user when not authenticated', async () => {
      (getRequest as any).mockReturnValue(new Request('http://test.local'));
      (authkit.withAuth as any).mockResolvedValue({ user: null });

      const result = await serverFunctions.getAuth();

      expect(result).toEqual({ user: null });
    });
  });

  describe('signOut', () => {
    it('redirects to home when no session', async () => {
      (getRequest as any).mockReturnValue(new Request('http://test.local'));
      (authkit.withAuth as any).mockResolvedValue({ user: null });

      try {
        await serverFunctions.signOut({ data: { returnTo: '/home' } });
        expect.fail('Should have thrown redirect');
      } catch (error: any) {
        expect(error.message).toBe('REDIRECT');
        expect(error.options.to).toBe('/home');
        expect(error.options.throw).toBe(true);
      }
    });

    it('clears session and redirects to logout URL', async () => {
      const logoutUrl = 'https://auth.workos.com/logout';
      (getRequest as any).mockReturnValue(new Request('http://test.local'));
      (authkit.withAuth as any).mockResolvedValue({
        user: { id: 'user_123' },
        sessionId: 'session_123',
      });
      (authkit.getWorkOS as any).mockReturnValue({
        userManagement: {
          getLogoutUrl: vi.fn().mockReturnValue(logoutUrl),
        },
      });

      try {
        await serverFunctions.signOut({ data: { returnTo: '/goodbye' } });
        expect.fail('Should have thrown redirect');
      } catch (error: any) {
        expect(error.message).toBe('REDIRECT');
        expect(error.options.href).toBe(logoutUrl);
        expect(error.options.headers['Set-Cookie']).toContain('wos_session=');
      }
    });

    it('defaults to root when no returnTo specified', async () => {
      (getRequest as any).mockReturnValue(new Request('http://test.local'));
      (authkit.withAuth as any).mockResolvedValue({ user: null });

      try {
        await serverFunctions.signOut({ data: undefined });
        expect.fail('Should have thrown redirect');
      } catch (error: any) {
        expect(error.message).toBe('REDIRECT');
        expect(error.options.to).toBe('/');
      }
    });
  });

  describe('getAuthorizationUrl', () => {
    it('generates authorization URL with all options', async () => {
      const authUrl = 'https://auth.workos.com/authorize?client_id=test';
      (authkit.getWorkOS as any).mockReturnValue({
        userManagement: {
          getAuthorizationUrl: vi.fn().mockReturnValue(authUrl),
        },
      });

      const result = await serverFunctions.getAuthorizationUrl({
        data: {
          screenHint: 'sign-up',
          returnPathname: '/dashboard',
          redirectUri: 'http://custom.local/callback',
        },
      });

      expect(result).toBe(authUrl);
      const workos = (authkit.getWorkOS as any)();
      expect(workos.userManagement.getAuthorizationUrl).toHaveBeenCalledWith({
        provider: 'authkit',
        clientId: 'test_client_id',
        redirectUri: 'http://custom.local/callback',
        screenHint: 'sign-up',
        state: expect.any(String),
      });

      // Verify state encoding
      const call = workos.userManagement.getAuthorizationUrl.mock.calls[0][0];
      const decodedState = JSON.parse(atob(call.state));
      expect(decodedState.returnPathname).toBe('/dashboard');
    });

    it('works with minimal options', async () => {
      const authUrl = 'https://auth.workos.com/authorize';
      (authkit.getWorkOS as any).mockReturnValue({
        userManagement: {
          getAuthorizationUrl: vi.fn().mockReturnValue(authUrl),
        },
      });

      const result = await serverFunctions.getAuthorizationUrl({ data: {} });

      expect(result).toBe(authUrl);
    });

    it('handles undefined data', async () => {
      const authUrl = 'https://auth.workos.com/authorize';
      (authkit.getWorkOS as any).mockReturnValue({
        userManagement: {
          getAuthorizationUrl: vi.fn().mockReturnValue(authUrl),
        },
      });

      const result = await serverFunctions.getAuthorizationUrl({ data: undefined });

      expect(result).toBe(authUrl);
      const workos = (authkit.getWorkOS as any)();
      expect(workos.userManagement.getAuthorizationUrl).toHaveBeenCalledWith({
        provider: 'authkit',
        clientId: 'test_client_id',
        redirectUri: 'http://test.local/callback',
        screenHint: undefined,
        state: undefined,
      });
    });
  });

  describe('getSignInUrl', () => {
    it('generates sign-in URL with return path', async () => {
      const signInUrl = 'https://auth.workos.com/sign-in';
      (authkit.getWorkOS as any).mockReturnValue({
        userManagement: {
          getAuthorizationUrl: vi.fn().mockReturnValue(signInUrl),
        },
      });

      const result = await serverFunctions.getSignInUrl({ data: '/profile' });

      expect(result).toBe(signInUrl);
      const workos = (authkit.getWorkOS as any)();
      expect(workos.userManagement.getAuthorizationUrl).toHaveBeenCalledWith({
        provider: 'authkit',
        clientId: 'test_client_id',
        redirectUri: 'http://test.local/callback',
        screenHint: 'sign-in',
        state: expect.any(String),
      });

      // Verify state includes return path
      const call = workos.userManagement.getAuthorizationUrl.mock.calls[0][0];
      const decodedState = JSON.parse(atob(call.state));
      expect(decodedState.returnPathname).toBe('/profile');
    });

    it('works without return path', async () => {
      const signInUrl = 'https://auth.workos.com/sign-in';
      (authkit.getWorkOS as any).mockReturnValue({
        userManagement: {
          getAuthorizationUrl: vi.fn().mockReturnValue(signInUrl),
        },
      });

      const result = await serverFunctions.getSignInUrl({ data: undefined });

      expect(result).toBe(signInUrl);
      const workos = (authkit.getWorkOS as any)();
      expect(workos.userManagement.getAuthorizationUrl).toHaveBeenCalledWith({
        provider: 'authkit',
        clientId: 'test_client_id',
        redirectUri: 'http://test.local/callback',
        screenHint: 'sign-in',
        state: undefined,
      });
    });
  });

  describe('getSignUpUrl', () => {
    it('generates sign-up URL with return path', async () => {
      const signUpUrl = 'https://auth.workos.com/sign-up';
      (authkit.getWorkOS as any).mockReturnValue({
        userManagement: {
          getAuthorizationUrl: vi.fn().mockReturnValue(signUpUrl),
        },
      });

      const result = await serverFunctions.getSignUpUrl({ data: '/welcome' });

      expect(result).toBe(signUpUrl);
      const workos = (authkit.getWorkOS as any)();
      expect(workos.userManagement.getAuthorizationUrl).toHaveBeenCalledWith({
        provider: 'authkit',
        clientId: 'test_client_id',
        redirectUri: 'http://test.local/callback',
        screenHint: 'sign-up',
        state: expect.any(String),
      });
    });
  });

  describe('handleCallback', () => {
    it('handles successful OAuth callback', async () => {
      const mockUser = { id: 'user_123', email: 'test@example.com' };
      (getRequest as any).mockReturnValue(new Request('http://test.local'));
      (authkit.handleCallback as any).mockResolvedValue({
        authResponse: {
          user: mockUser,
          accessToken: 'access_123',
        },
      });

      const result = await serverFunctions.handleCallback({
        data: { code: 'auth_code_123' },
      });

      expect(result).toEqual({
        success: true,
        returnPathname: '/',
        user: mockUser,
        accessToken: 'access_123',
      });
    });

    it('decodes state for return pathname', async () => {
      const state = btoa(JSON.stringify({ returnPathname: '/dashboard' }));
      (getRequest as any).mockReturnValue(new Request('http://test.local'));
      (authkit.handleCallback as any).mockResolvedValue({
        authResponse: { user: { id: 'user_123' } },
      });

      const result = await serverFunctions.handleCallback({
        data: { code: 'auth_code', state },
      });

      expect(result.returnPathname).toBe('/dashboard');
    });

    it('handles malformed state gracefully', async () => {
      (getRequest as any).mockReturnValue(new Request('http://test.local'));
      (authkit.handleCallback as any).mockResolvedValue({
        authResponse: { user: { id: 'user_123' } },
      });

      const result = await serverFunctions.handleCallback({
        data: { code: 'auth_code', state: 'not-base64!' },
      });

      expect(result.returnPathname).toBe('/');
    });

    it('handles undefined auth response', async () => {
      (getRequest as any).mockReturnValue(new Request('http://test.local'));
      (authkit.handleCallback as any).mockResolvedValue({});

      const result = await serverFunctions.handleCallback({
        data: { code: 'auth_code' },
      });

      expect(result).toEqual({
        success: true,
        returnPathname: '/',
        user: undefined,
        accessToken: undefined,
      });
    });
  });

  describe('terminateSession', () => {
    it('is an alias for signOut', () => {
      expect(serverFunctions.terminateSession).toBe(serverFunctions.signOut);
    });
  });

  describe('exported types', () => {
    it('exports all expected functions', () => {
      expect(typeof serverFunctions.getAuth).toBe('function');
      expect(typeof serverFunctions.signOut).toBe('function');
      expect(typeof serverFunctions.getAuthorizationUrl).toBe('function');
      expect(typeof serverFunctions.getSignInUrl).toBe('function');
      expect(typeof serverFunctions.getSignUpUrl).toBe('function');
      expect(typeof serverFunctions.handleCallback).toBe('function');
      expect(typeof serverFunctions.terminateSession).toBe('function');
    });
  });
});