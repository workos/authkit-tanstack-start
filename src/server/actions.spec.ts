import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock context state
let mockAuthContext: any = null;
let mockIsConfigured = true;

vi.mock('./context', () => ({
  getAuthKitContext: () => {
    if (!mockAuthContext) {
      throw new Error('AuthKit middleware is not configured');
    }
    return mockAuthContext;
  },
  getAuthKitContextOrNull: () => mockAuthContext,
}));

vi.mock('./auth-helpers', () => ({
  getRawAuthFromContext: () => {
    if (!mockAuthContext) {
      throw new Error('AuthKit middleware is not configured');
    }
    return mockAuthContext.auth();
  },
  isAuthConfigured: () => mockIsConfigured,
  refreshSession: vi.fn(),
}));

// Mock createServerFn
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    inputValidator: (validator: Function) => ({
      handler: (handler: Function) => {
        return async (opts?: { data?: any }) => {
          const data = opts?.data !== undefined ? validator(opts.data) : undefined;
          return handler({ data });
        };
      },
    }),
    handler: (handler: Function) => {
      return async (opts?: { data?: any }) => {
        return handler(opts || {});
      };
    },
  }),
}));

import { refreshSession } from './auth-helpers';
import {
  checkSessionAction,
  getAuthAction,
  refreshAuthAction,
  getAccessTokenAction,
  refreshAccessTokenAction,
  switchToOrganizationAction,
} from './actions';

describe('Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthContext = null;
    mockIsConfigured = true;
  });

  describe('checkSessionAction', () => {
    it('returns false when auth is not configured', async () => {
      mockIsConfigured = false;

      const result = await checkSessionAction();

      expect(result).toBe(false);
    });

    it('returns true when user exists', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' } }),
        request: new Request('http://test.local'),
      };

      const result = await checkSessionAction();

      expect(result).toBe(true);
    });

    it('returns false when user is null', async () => {
      mockAuthContext = {
        auth: () => ({ user: null }),
        request: new Request('http://test.local'),
      };

      const result = await checkSessionAction();

      expect(result).toBe(false);
    });
  });

  describe('getAuthAction', () => {
    it('returns sanitized user info without access token', async () => {
      mockAuthContext = {
        auth: () => ({
          user: { id: 'user_123', email: 'test@example.com' },
          sessionId: 'session_123',
          accessToken: 'secret_token',
          claims: {
            org_id: 'org_123',
            role: 'admin',
            roles: ['admin', 'user'],
            permissions: ['read', 'write'],
            entitlements: ['premium'],
            feature_flags: ['beta'],
          },
          impersonator: { email: 'admin@example.com' },
        }),
        request: new Request('http://test.local'),
      };

      const result = await getAuthAction();

      expect(result).toEqual({
        user: { id: 'user_123', email: 'test@example.com' },
        sessionId: 'session_123',
        organizationId: 'org_123',
        role: 'admin',
        roles: ['admin', 'user'],
        permissions: ['read', 'write'],
        entitlements: ['premium'],
        featureFlags: ['beta'],
        impersonator: { email: 'admin@example.com' },
      });
      expect(result).not.toHaveProperty('accessToken');
    });

    it('returns null user when not authenticated', async () => {
      mockAuthContext = {
        auth: () => ({ user: null }),
        request: new Request('http://test.local'),
      };

      const result = await getAuthAction();

      expect(result).toEqual({ user: null });
    });
  });

  describe('refreshAuthAction', () => {
    it('returns sanitized auth after refresh', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' } }),
        request: new Request('http://test.local'),
      };

      vi.mocked(refreshSession).mockResolvedValue({
        user: { id: 'user_123', email: 'test@example.com' },
        sessionId: 'session_456',
        accessToken: 'new_token',
        claims: { org_id: 'org_456' },
      } as any);

      const result = await refreshAuthAction({ data: { organizationId: 'org_456' } });

      expect(refreshSession).toHaveBeenCalledWith('org_456');
      expect(result).toHaveProperty('user');
      expect(result).not.toHaveProperty('accessToken');
    });

    it('returns null user when refresh fails', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' } }),
        request: new Request('http://test.local'),
      };

      vi.mocked(refreshSession).mockResolvedValue(null);

      const result = await refreshAuthAction({ data: {} });

      expect(result).toEqual({ user: null });
    });
  });

  describe('getAccessTokenAction', () => {
    it('returns undefined when auth is not configured', async () => {
      mockIsConfigured = false;

      const result = await getAccessTokenAction();

      expect(result).toBeUndefined();
    });

    it('returns access token when user exists', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' }, accessToken: 'my_token' }),
        request: new Request('http://test.local'),
      };

      const result = await getAccessTokenAction();

      expect(result).toBe('my_token');
    });

    it('returns undefined when no user', async () => {
      mockAuthContext = {
        auth: () => ({ user: null }),
        request: new Request('http://test.local'),
      };

      const result = await getAccessTokenAction();

      expect(result).toBeUndefined();
    });
  });

  describe('refreshAccessTokenAction', () => {
    it('returns new access token after refresh', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' } }),
        request: new Request('http://test.local'),
      };

      vi.mocked(refreshSession).mockResolvedValue({
        user: { id: 'user_123' },
        accessToken: 'refreshed_token',
      } as any);

      const result = await refreshAccessTokenAction();

      expect(result).toBe('refreshed_token');
    });

    it('returns undefined when refresh fails', async () => {
      vi.mocked(refreshSession).mockResolvedValue(null);

      const result = await refreshAccessTokenAction();

      expect(result).toBeUndefined();
    });
  });

  describe('switchToOrganizationAction', () => {
    it('returns sanitized auth after switching org', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' } }),
        request: new Request('http://test.local'),
      };

      vi.mocked(refreshSession).mockResolvedValue({
        user: { id: 'user_123' },
        sessionId: 'session_123',
        accessToken: 'token',
        claims: { org_id: 'new_org' },
      } as any);

      const result = await switchToOrganizationAction({ data: { organizationId: 'new_org' } });

      expect(refreshSession).toHaveBeenCalledWith('new_org');
      expect(result).toHaveProperty('user');
      expect(result).not.toHaveProperty('accessToken');
    });

    it('returns null user when switch fails', async () => {
      mockAuthContext = {
        auth: () => ({ user: { id: 'user_123' } }),
        request: new Request('http://test.local'),
      };

      vi.mocked(refreshSession).mockResolvedValue(null);

      const result = await switchToOrganizationAction({ data: { organizationId: 'bad_org' } });

      expect(result).toEqual({ user: null });
    });
  });
});
