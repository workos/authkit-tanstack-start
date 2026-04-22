import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock context state
let mockAuthContext: any = null;

vi.mock('./context', () => ({
  getAuthKitContext: () => {
    if (!mockAuthContext) {
      throw new Error('AuthKit middleware is not configured');
    }
    return mockAuthContext;
  },
  getAuthKitContextOrNull: () => mockAuthContext,
}));

const mockAuthkit = {
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  saveSession: vi.fn(),
};

vi.mock('./authkit-loader', () => ({
  getAuthkit: vi.fn(() => Promise.resolve(mockAuthkit)),
}));

import { getRawAuthFromContext, isAuthConfigured, getSessionWithRefreshToken, refreshSession } from './auth-helpers';

describe('Auth Helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext = null;
  });

  describe('getRawAuthFromContext', () => {
    it('returns auth from context', () => {
      const authData = { user: { id: 'user_123' }, accessToken: 'token' };
      mockAuthContext = {
        auth: () => authData,
        request: new Request('http://test.local'),
      };

      const result = getRawAuthFromContext();

      expect(result).toEqual(authData);
    });

    it('throws when context is not available', () => {
      mockAuthContext = null;

      expect(() => getRawAuthFromContext()).toThrow('AuthKit middleware is not configured');
    });
  });

  describe('isAuthConfigured', () => {
    it('returns true when context is available', () => {
      mockAuthContext = {
        auth: () => ({ user: null }),
        request: new Request('http://test.local'),
      };

      expect(isAuthConfigured()).toBe(true);
    });

    it('returns false when context is not available', () => {
      mockAuthContext = null;

      expect(isAuthConfigured()).toBe(false);
    });
  });

  describe('getSessionWithRefreshToken', () => {
    it('returns null when no user', async () => {
      mockAuthContext = {
        auth: () => ({ user: null }),
        request: new Request('http://test.local'),
      };

      const result = await getSessionWithRefreshToken();

      expect(result).toBeNull();
    });

    it('returns null when no access token', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' }, accessToken: null }),
        request: new Request('http://test.local'),
      };

      const result = await getSessionWithRefreshToken();

      expect(result).toBeNull();
    });

    it('returns null when no refresh token in auth context', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' }, accessToken: 'token' }),
        request: new Request('http://test.local'),
      };

      const result = await getSessionWithRefreshToken();

      expect(result).toBeNull();
    });

    it('returns session data with refresh token from auth context', async () => {
      const user = { id: 'user_123', email: 'test@example.com' };
      const impersonator = { email: 'admin@example.com' };
      mockAuthContext = {
        auth: () => ({ user, accessToken: 'access_token', refreshToken: 'refresh_token', impersonator }),
        request: new Request('http://test.local'),
      };

      const result = await getSessionWithRefreshToken();

      expect(result).toEqual({
        refreshToken: 'refresh_token',
        accessToken: 'access_token',
        user,
        impersonator,
      });
    });

    it('uses middleware-refreshed token instead of stale request token', async () => {
      // Simulates the case where middleware auto-refreshed the session
      // (e.g., expired access token). The auth context has the NEW refresh token,
      // while the original request cookie has the OLD (invalidated) one.
      const user = { id: 'user_123' };
      mockAuthContext = {
        auth: () => ({
          user,
          accessToken: 'new_access_token',
          refreshToken: 'new_refresh_token', // refreshed by middleware
          impersonator: undefined,
        }),
        request: new Request('http://test.local', {
          headers: { cookie: 'wos-session=old_encrypted_session' },
        }),
      };

      const result = await getSessionWithRefreshToken();

      // Should use the NEW refresh token from auth context, not the old one from request
      expect(result).toEqual({
        refreshToken: 'new_refresh_token',
        accessToken: 'new_access_token',
        user,
        impersonator: undefined,
      });

      // Should NOT call getSession on the request (no longer needed)
      expect(mockAuthkit.getSession).not.toHaveBeenCalled();
    });
  });

  describe('refreshSession', () => {
    it('returns null when no session data', async () => {
      mockAuthContext = {
        auth: () => ({ user: null }),
        request: new Request('http://test.local'),
      };

      const result = await refreshSession();

      expect(result).toBeNull();
    });

    it('refreshes session and saves encrypted session', async () => {
      const user = { id: 'user_123' };
      mockAuthContext = {
        auth: () => ({ user, accessToken: 'old_token', refreshToken: 'refresh_token' }),
        request: new Request('http://test.local'),
      };
      mockAuthkit.refreshSession.mockResolvedValue({
        auth: { user, accessToken: 'new_token', sessionId: 'session_123' },
        encryptedSession: 'encrypted_data',
      });

      const result = await refreshSession('org_123');

      expect(mockAuthkit.refreshSession).toHaveBeenCalledWith(
        {
          accessToken: 'old_token',
          refreshToken: 'refresh_token',
          user,
          impersonator: undefined,
        },
        'org_123',
      );
      expect(mockAuthkit.saveSession).toHaveBeenCalledWith(undefined, 'encrypted_data');
      expect(result).toEqual({ user, accessToken: 'new_token', sessionId: 'session_123' });
    });

    it('does not save session when no encrypted data', async () => {
      const user = { id: 'user_123' };
      mockAuthContext = {
        auth: () => ({ user, accessToken: 'token', refreshToken: 'refresh_token' }),
        request: new Request('http://test.local'),
      };
      mockAuthkit.refreshSession.mockResolvedValue({
        auth: { user },
        encryptedSession: null,
      });

      await refreshSession();

      expect(mockAuthkit.saveSession).not.toHaveBeenCalled();
    });
  });
});
