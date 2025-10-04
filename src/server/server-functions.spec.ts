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
    getAuthorizationUrl: vi.fn(),
    getSignInUrl: vi.fn(),
    getSignUpUrl: vi.fn(),
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

// Mock global context for middleware pattern
let mockAuthContext: any = null;

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
  getGlobalStartContext: () => ({
    auth: mockAuthContext,
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

      // Set up mock auth context (what middleware would provide)
      mockAuthContext = () => ({
        user: mockUser,
        sessionId: 'session_123',
        accessToken: 'access_token',
        impersonator: undefined,
        claims: {
          sid: 'session_123',
          org_id: 'org_123',
          role: 'member',
          permissions: ['read'],
          entitlements: [],
        },
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
        featureFlags: undefined,
        roles: undefined,
      });
    });

    it('returns null user when not authenticated', async () => {
      // Set up mock auth context with no user
      mockAuthContext = () => ({ user: null });

      const result = await serverFunctions.getAuth();

      expect(result).toEqual({ user: null });
    });
  });

  describe('signOut', () => {
    it('redirects to home when no session', async () => {
      // Set up mock auth context with no user
      mockAuthContext = () => ({ user: null });

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

      // Set up mock auth context with authenticated user
      mockAuthContext = () => ({
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
      // Set up mock auth context with no user
      mockAuthContext = () => ({ user: null });

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
      (authkit.getAuthorizationUrl as any).mockResolvedValue(authUrl);

      const result = await serverFunctions.getAuthorizationUrl({
        data: {
          screenHint: 'sign-up',
          returnPathname: '/dashboard',
          redirectUri: 'http://custom.local/callback',
        },
      });

      expect(result).toBe(authUrl);
      expect(authkit.getAuthorizationUrl).toHaveBeenCalledWith({
        screenHint: 'sign-up',
        returnPathname: '/dashboard',
        redirectUri: 'http://custom.local/callback',
      });
    });

    it('works with minimal options', async () => {
      const authUrl = 'https://auth.workos.com/authorize';
      (authkit.getAuthorizationUrl as any).mockResolvedValue(authUrl);

      const result = await serverFunctions.getAuthorizationUrl({ data: {} });

      expect(result).toBe(authUrl);
    });

    it('handles undefined data', async () => {
      const authUrl = 'https://auth.workos.com/authorize';
      (authkit.getAuthorizationUrl as any).mockResolvedValue(authUrl);

      const result = await serverFunctions.getAuthorizationUrl({ data: undefined });

      expect(result).toBe(authUrl);
      expect(authkit.getAuthorizationUrl).toHaveBeenCalledWith({});
    });
  });

  describe('getSignInUrl', () => {
    it('generates sign-in URL with return path', async () => {
      const signInUrl = 'https://auth.workos.com/sign-in';
      (authkit.getSignInUrl as any).mockResolvedValue(signInUrl);

      const result = await serverFunctions.getSignInUrl({ data: '/profile' });

      expect(result).toBe(signInUrl);
      expect(authkit.getSignInUrl).toHaveBeenCalledWith({ returnPathname: '/profile' });
    });

    it('works without return path', async () => {
      const signInUrl = 'https://auth.workos.com/sign-in';
      (authkit.getSignInUrl as any).mockResolvedValue(signInUrl);

      const result = await serverFunctions.getSignInUrl({ data: undefined });

      expect(result).toBe(signInUrl);
      expect(authkit.getSignInUrl).toHaveBeenCalledWith({ returnPathname: undefined });
    });
  });

  describe('getSignUpUrl', () => {
    it('generates sign-up URL with return path', async () => {
      const signUpUrl = 'https://auth.workos.com/sign-up';
      (authkit.getSignUpUrl as any).mockResolvedValue(signUpUrl);

      const result = await serverFunctions.getSignUpUrl({ data: '/welcome' });

      expect(result).toBe(signUpUrl);
      expect(authkit.getSignUpUrl).toHaveBeenCalledWith({ returnPathname: '/welcome' });
    });
  });

  describe('exported types', () => {
    it('exports all expected functions', () => {
      expect(typeof serverFunctions.getAuth).toBe('function');
      expect(typeof serverFunctions.signOut).toBe('function');
      expect(typeof serverFunctions.getAuthorizationUrl).toBe('function');
      expect(typeof serverFunctions.getSignInUrl).toBe('function');
      expect(typeof serverFunctions.getSignUpUrl).toBe('function');
    });
  });
});
