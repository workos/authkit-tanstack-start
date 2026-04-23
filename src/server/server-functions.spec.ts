import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPKCECookieNameForState } from '@workos/authkit-session';

// Set up all mocks before any imports that use them
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => new Request('http://test.local')),
}));

const SEALED_STATE_FIXTURE = 'sealed-blob-abc';
const PKCE_COOKIE_NAME = getPKCECookieNameForState(SEALED_STATE_FIXTURE);

const authorizationResult = (url: string) => ({
  url,
  headers: {
    'Set-Cookie': `${PKCE_COOKIE_NAME}=${SEALED_STATE_FIXTURE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; Secure`,
  },
});

const mockAuthkit = {
  withAuth: vi.fn(),
  getWorkOS: vi.fn(() => ({
    userManagement: {
      getLogoutUrl: vi.fn().mockReturnValue('https://auth.workos.com/logout'),
    },
  })),
  signOut: vi.fn().mockResolvedValue({
    logoutUrl: 'https://auth.workos.com/logout',
    headers: { 'Set-Cookie': 'wos-session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' },
  }),
  handleCallback: vi.fn(),
  createAuthorization: vi.fn().mockResolvedValue(authorizationResult('https://auth.workos.com/authorize')),
  createSignIn: vi.fn().mockResolvedValue(authorizationResult('https://auth.workos.com/signin')),
  createSignUp: vi.fn().mockResolvedValue(authorizationResult('https://auth.workos.com/signup')),
};

const mockSetPendingHeader = vi.fn();
let mockContextAvailable = true;

vi.mock('./authkit-loader', () => ({
  getAuthkit: vi.fn(() => Promise.resolve(mockAuthkit)),
  getConfig: vi.fn((key: string) => {
    const configs: Record<string, any> = {
      clientId: 'test_client_id',
      redirectUri: 'http://test.local/callback',
      cookieName: 'wos-session',
    };
    return Promise.resolve(configs[key]);
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: (options: any) => {
    const error = new Error('REDIRECT');
    (error as any).options = options;
    throw error;
  },
}));

vi.mock('@workos/authkit-session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@workos/authkit-session')>();
  return {
    ...actual,
    getConfig: vi.fn((key: string) => {
      const configs: Record<string, any> = {
        clientId: 'test_client_id',
        redirectUri: 'http://test.local/callback',
        cookieName: 'wos-session',
      };
      return configs[key];
    }),
  };
});

// Mock global context for middleware pattern
let mockAuthContext: any = null;

// Mock createServerFn to return testable functions
vi.mock('@tanstack/react-start', () => ({
  createServerFn: (_options?: any) => ({
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
  getGlobalStartContext: () => {
    if (!mockContextAvailable) {
      throw new Error('TanStack context not available');
    }
    return {
      auth: mockAuthContext,
      request: new Request('http://test.local'),
      __setPendingHeader: mockSetPendingHeader,
    };
  },
}));

// Now import everything after mocks are set up
// These imports are used by vi.mock hoisting above
import '@tanstack/react-start/server';
import './authkit-loader';
import * as serverFunctions from './server-functions';

describe('Server Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContextAvailable = true;
    mockAuthContext = () => ({ user: null });
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

      mockAuthkit.getWorkOS.mockReturnValue({
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
        expect(error.options.headers.get('Set-Cookie')).toContain('wos-session=');
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
      mockAuthkit.createAuthorization.mockResolvedValue(authorizationResult(authUrl));

      const result = await serverFunctions.getAuthorizationUrl({
        data: {
          screenHint: 'sign-up',
          returnPathname: '/dashboard',
          redirectUri: 'http://custom.local/callback',
        },
      });

      expect(result).toBe(authUrl);
      expect(mockAuthkit.createAuthorization).toHaveBeenCalledWith(undefined, {
        screenHint: 'sign-up',
        returnPathname: '/dashboard',
        redirectUri: 'http://custom.local/callback',
      });
    });

    it('works with minimal options', async () => {
      const authUrl = 'https://auth.workos.com/authorize';
      mockAuthkit.createAuthorization.mockResolvedValue(authorizationResult(authUrl));

      const result = await serverFunctions.getAuthorizationUrl({ data: {} });

      expect(result).toBe(authUrl);
    });

    it('handles undefined data', async () => {
      const authUrl = 'https://auth.workos.com/authorize';
      mockAuthkit.createAuthorization.mockResolvedValue(authorizationResult(authUrl));

      const result = await serverFunctions.getAuthorizationUrl({ data: undefined });

      expect(result).toBe(authUrl);
      expect(mockAuthkit.createAuthorization).toHaveBeenCalledWith(undefined, {});
    });
  });

  describe('getSignInUrl', () => {
    it('generates sign-in URL with return path string', async () => {
      const signInUrl = 'https://auth.workos.com/sign-in';
      mockAuthkit.createSignIn.mockResolvedValue(authorizationResult(signInUrl));

      const result = await serverFunctions.getSignInUrl({ data: '/profile' });

      expect(result).toBe(signInUrl);
      expect(mockAuthkit.createSignIn).toHaveBeenCalledWith(undefined, { returnPathname: '/profile' });
    });

    it('works without options', async () => {
      const signInUrl = 'https://auth.workos.com/sign-in';
      mockAuthkit.createSignIn.mockResolvedValue(authorizationResult(signInUrl));

      const result = await serverFunctions.getSignInUrl({ data: undefined });

      expect(result).toBe(signInUrl);
      expect(mockAuthkit.createSignIn).toHaveBeenCalledWith(undefined, {});
    });

    it('passes state option through', async () => {
      const signInUrl = 'https://auth.workos.com/sign-in';
      mockAuthkit.createSignIn.mockResolvedValue(authorizationResult(signInUrl));

      const result = await serverFunctions.getSignInUrl({
        data: { returnPathname: '/dashboard', state: 'custom-state' },
      });

      expect(result).toBe(signInUrl);
      expect(mockAuthkit.createSignIn).toHaveBeenCalledWith(undefined, {
        returnPathname: '/dashboard',
        state: 'custom-state',
      });
    });

    it('passes all options through', async () => {
      const signInUrl = 'https://auth.workos.com/sign-in';
      mockAuthkit.createSignIn.mockResolvedValue(authorizationResult(signInUrl));

      const result = await serverFunctions.getSignInUrl({
        data: {
          returnPathname: '/dashboard',
          state: 'my-state',
          organizationId: 'org_123',
          loginHint: 'user@example.com',
        },
      });

      expect(result).toBe(signInUrl);
      expect(mockAuthkit.createSignIn).toHaveBeenCalledWith(undefined, {
        returnPathname: '/dashboard',
        state: 'my-state',
        organizationId: 'org_123',
        loginHint: 'user@example.com',
      });
    });
  });

  describe('getSignUpUrl', () => {
    it('generates sign-up URL with return path string', async () => {
      const signUpUrl = 'https://auth.workos.com/sign-up';
      mockAuthkit.createSignUp.mockResolvedValue(authorizationResult(signUpUrl));

      const result = await serverFunctions.getSignUpUrl({ data: '/welcome' });

      expect(result).toBe(signUpUrl);
      expect(mockAuthkit.createSignUp).toHaveBeenCalledWith(undefined, { returnPathname: '/welcome' });
    });

    it('accepts object with returnPathname', async () => {
      const signUpUrl = 'https://auth.workos.com/sign-up';
      mockAuthkit.createSignUp.mockResolvedValue(authorizationResult(signUpUrl));

      const result = await serverFunctions.getSignUpUrl({ data: { returnPathname: '/onboarding' } });

      expect(result).toBe(signUpUrl);
      expect(mockAuthkit.createSignUp).toHaveBeenCalledWith(undefined, { returnPathname: '/onboarding' });
    });

    it('passes state option through', async () => {
      const signUpUrl = 'https://auth.workos.com/sign-up';
      mockAuthkit.createSignUp.mockResolvedValue(authorizationResult(signUpUrl));

      const result = await serverFunctions.getSignUpUrl({
        data: { returnPathname: '/welcome', state: 'signup-flow' },
      });

      expect(result).toBe(signUpUrl);
      expect(mockAuthkit.createSignUp).toHaveBeenCalledWith(undefined, {
        returnPathname: '/welcome',
        state: 'signup-flow',
      });
    });

    it('passes all options through', async () => {
      const signUpUrl = 'https://auth.workos.com/sign-up';
      mockAuthkit.createSignUp.mockResolvedValue(authorizationResult(signUpUrl));

      const result = await serverFunctions.getSignUpUrl({
        data: {
          returnPathname: '/onboarding',
          state: 'invite-123',
          organizationId: 'org_456',
          loginHint: 'newuser@example.com',
        },
      });

      expect(result).toBe(signUpUrl);
      expect(mockAuthkit.createSignUp).toHaveBeenCalledWith(undefined, {
        returnPathname: '/onboarding',
        state: 'invite-123',
        organizationId: 'org_456',
        loginHint: 'newuser@example.com',
      });
    });
  });

  describe('signOut headers handling', () => {
    it('handles array header values', async () => {
      mockAuthContext = () => ({
        user: { id: 'user_123' },
        sessionId: 'session_123',
      });

      mockAuthkit.signOut.mockResolvedValue({
        logoutUrl: 'https://auth.workos.com/logout',
        headers: {
          'Set-Cookie': ['cookie1=value1', 'cookie2=value2'],
        },
      });

      try {
        await serverFunctions.signOut({ data: {} });
        expect.fail('Should have thrown redirect');
      } catch (error: any) {
        expect(error.message).toBe('REDIRECT');
        // Verify array headers were appended
        expect(error.options.headers.get('Set-Cookie')).toContain('cookie1=value1');
      }
    });
  });

  describe('switchToOrganization', () => {
    it('redirects when no user in auth context', async () => {
      mockAuthContext = () => ({ user: null });

      try {
        await serverFunctions.switchToOrganization({ data: { organizationId: 'org_123' } });
        expect.fail('Should have thrown redirect');
      } catch (error: any) {
        expect(error.message).toBe('REDIRECT');
        expect(error.options.to).toBe('/');
      }
    });

    it('redirects with returnTo when no user', async () => {
      mockAuthContext = () => ({ user: null });

      try {
        await serverFunctions.switchToOrganization({ data: { organizationId: 'org_123', returnTo: '/login' } });
        expect.fail('Should have thrown redirect');
      } catch (error: any) {
        expect(error.message).toBe('REDIRECT');
        expect(error.options.to).toBe('/login');
      }
    });

    it('redirects when refresh returns no user', async () => {
      mockAuthContext = () => ({
        user: { id: 'user_123' },
        sessionId: 'session_123',
        accessToken: 'token',
      });

      // Mock refreshSession to return null
      const authHelpers = await import('./auth-helpers');
      vi.spyOn(authHelpers, 'refreshSession').mockResolvedValue(null);

      try {
        await serverFunctions.switchToOrganization({ data: { organizationId: 'org_123' } });
        expect.fail('Should have thrown redirect');
      } catch (error: any) {
        expect(error.message).toBe('REDIRECT');
        expect(error.options.to).toBe('/');
      }
    });

    it('returns user info on successful switch', async () => {
      mockAuthContext = () => ({
        user: { id: 'user_123' },
        sessionId: 'session_123',
        accessToken: 'token',
      });

      const authHelpers = await import('./auth-helpers');
      vi.spyOn(authHelpers, 'refreshSession').mockResolvedValue({
        user: { id: 'user_123', email: 'test@example.com' },
        sessionId: 'new_session',
        accessToken: 'new_token',
        claims: {
          org_id: 'org_456',
          role: 'admin',
          roles: ['admin'],
          permissions: ['read', 'write'],
          entitlements: ['premium'],
          feature_flags: ['beta'],
        },
        impersonator: undefined,
      } as any);

      const result = await serverFunctions.switchToOrganization({ data: { organizationId: 'org_456' } });

      expect(result.user).toEqual({ id: 'user_123', email: 'test@example.com' });
      expect(result.organizationId).toBe('org_456');
      expect(result.role).toBe('admin');
      expect(result.permissions).toEqual(['read', 'write']);
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

  describe('PKCE cookie wiring', () => {
    const cases = [
      {
        name: 'getAuthorizationUrl',
        call: () => serverFunctions.getAuthorizationUrl({ data: {} }),
        mockFn: () => mockAuthkit.createAuthorization,
        url: 'https://auth.workos.com/authorize?client_id=test',
      },
      {
        name: 'getSignInUrl',
        call: () => serverFunctions.getSignInUrl({ data: undefined }),
        mockFn: () => mockAuthkit.createSignIn,
        url: 'https://auth.workos.com/sign-in',
      },
      {
        name: 'getSignUpUrl',
        call: () => serverFunctions.getSignUpUrl({ data: undefined }),
        mockFn: () => mockAuthkit.createSignUp,
        url: 'https://auth.workos.com/sign-up',
      },
    ];

    cases.forEach(({ name, call, mockFn, url }) => {
      describe(name, () => {
        it('writes Set-Cookie with the derived PKCE cookie name exactly once', async () => {
          mockFn().mockResolvedValue(authorizationResult(url));

          await call();

          expect(mockSetPendingHeader).toHaveBeenCalledTimes(1);
          expect(mockSetPendingHeader).toHaveBeenCalledWith(
            'Set-Cookie',
            expect.stringMatching(new RegExp(`^${PKCE_COOKIE_NAME}=`)),
          );
        });

        it('returns only the URL (no sealedState leak)', async () => {
          mockFn().mockResolvedValue(authorizationResult(url));

          const result = await call();

          expect(result).toBe(url);
          expect(typeof result).toBe('string');
        });

        it('throws actionable error when middleware context is unavailable', async () => {
          mockContextAvailable = false;
          mockFn().mockResolvedValue(authorizationResult(url));

          await expect(call()).rejects.toThrow(/authkitMiddleware is registered/);
        });

        it('does not throw when storage returns an empty response (cookies pushed via ctx)', async () => {
          // Real runtime shape: the storage adapter forwards cookies directly
          // through `ctx.__setPendingHeader` and hands back `{ response: new
          // Response() }` as a contract stub — no `headers`, no Set-Cookie on
          // the response. That must not be treated as a contract violation.
          mockFn().mockResolvedValue({ url, response: new Response() });

          const result = await call();

          expect(result).toBe(url);
        });
      });
    });
  });
});
