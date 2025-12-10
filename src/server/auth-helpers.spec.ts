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

import {
  getRawAuthFromContext,
  isAuthConfigured,
  getSessionWithRefreshToken,
  refreshSession,
  decodeState,
} from './auth-helpers';

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

    it('returns null when no refresh token in session', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' }, accessToken: 'token' }),
        request: new Request('http://test.local'),
      };
      mockAuthkit.getSession.mockResolvedValue({ refreshToken: null });

      const result = await getSessionWithRefreshToken();

      expect(result).toBeNull();
    });

    it('returns session data with refresh token', async () => {
      const user = { id: 'user_123', email: 'test@example.com' };
      const impersonator = { email: 'admin@example.com' };
      mockAuthContext = {
        auth: () => ({ user, accessToken: 'access_token', impersonator }),
        request: new Request('http://test.local'),
      };
      mockAuthkit.getSession.mockResolvedValue({ refreshToken: 'refresh_token' });

      const result = await getSessionWithRefreshToken();

      expect(result).toEqual({
        refreshToken: 'refresh_token',
        accessToken: 'access_token',
        user,
        impersonator,
      });
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
        auth: () => ({ user, accessToken: 'old_token' }),
        request: new Request('http://test.local'),
      };
      mockAuthkit.getSession.mockResolvedValue({ refreshToken: 'refresh_token' });
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
        auth: () => ({ user, accessToken: 'token' }),
        request: new Request('http://test.local'),
      };
      mockAuthkit.getSession.mockResolvedValue({ refreshToken: 'refresh_token' });
      mockAuthkit.refreshSession.mockResolvedValue({
        auth: { user },
        encryptedSession: null,
      });

      await refreshSession();

      expect(mockAuthkit.saveSession).not.toHaveBeenCalled();
    });
  });

  describe('decodeState', () => {
    it('returns default when state is null', () => {
      expect(decodeState(null)).toEqual({ returnPathname: '/' });
    });

    it('returns default when state is "null" string', () => {
      expect(decodeState('null')).toEqual({ returnPathname: '/' });
    });

    it('decodes valid base64 state', () => {
      const internal = btoa(JSON.stringify({ returnPathname: '/dashboard' }));

      const result = decodeState(internal);

      expect(result).toEqual({ returnPathname: '/dashboard' });
    });

    it('extracts custom state after dot separator', () => {
      const internal = btoa(JSON.stringify({ returnPathname: '/profile' }));
      const state = `${internal}.custom-user-state`;

      const result = decodeState(state);

      expect(result).toEqual({
        returnPathname: '/profile',
        customState: 'custom-user-state',
      });
    });

    it('handles multiple dots in custom state', () => {
      const internal = btoa(JSON.stringify({ returnPathname: '/' }));
      const state = `${internal}.part1.part2.part3`;

      const result = decodeState(state);

      expect(result).toEqual({
        returnPathname: '/',
        customState: 'part1.part2.part3',
      });
    });

    it('returns root with custom state when decode fails', () => {
      const result = decodeState('invalid-base64');

      expect(result).toEqual({
        returnPathname: '/',
        customState: 'invalid-base64',
      });
    });
  });
});
