import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TokenStore } from './tokenStore';
import { getAccessTokenAction, refreshAccessTokenAction } from '../server/actions';

vi.mock('../server/actions', () => ({
  getAccessTokenAction: vi.fn(),
  refreshAccessTokenAction: vi.fn(),
}));

describe('TokenStore', () => {
  let store: TokenStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    store = new TokenStore();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('initializes with empty state', () => {
    const snapshot = store.getSnapshot();
    expect(snapshot.token).toBeUndefined();
    expect(snapshot.loading).toBe(false);
    expect(snapshot.error).toBeNull();
  });

  it('returns static server snapshot', () => {
    const snapshot = store.getServerSnapshot();
    expect(snapshot).toEqual({
      token: undefined,
      loading: false,
      error: null,
    });
  });

  describe('token parsing', () => {
    it('parses valid JWT token', () => {
      const token =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOiJzZXNzaW9uXzEyMyIsImlzcyI6Imh0dHBzOi8vYXBpLndvcmtvcy5jb20iLCJzdWIiOiJ1c2VyXzEyMyIsImV4cCI6OTk5OTk5OTk5OSwiaWF0IjoxNzMyODk2NDAwLCJqdGkiOiJ0b2tlbl8xMjMifQ.signature';

      const result = store.parseToken(token);

      expect(result).not.toBeNull();
      expect(result?.payload.sid).toBe('session_123');
      expect(result?.isExpiring).toBe(false);
    });

    it('returns null for invalid token', () => {
      const result = store.parseToken('invalid');
      expect(result).toBeNull();
    });

    it('returns null for token without exp field', () => {
      const tokenWithoutExp = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify({ sub: '123' }))}.mock-signature`;
      const result = store.parseToken(tokenWithoutExp);
      expect(result).toBeNull();
    });

    it('identifies expired tokens', () => {
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const expiredPayload = {
        sub: '1234567890',
        sid: 'session_123',
        exp: currentTimeInSeconds - 10,
        iat: currentTimeInSeconds - 70,
      };
      const expiredToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(expiredPayload))}.mock-signature`;

      const result = store.parseToken(expiredToken);

      expect(result).not.toBeNull();
      expect(result?.isExpiring).toBe(true);
    });

    it('uses 30-second buffer for short-lived tokens', () => {
      const now = Math.floor(Date.now() / 1000);
      const shortLivedPayload = {
        sub: 'user_123',
        sid: 'session_123',
        iat: now,
        exp: now + 60, // 60 seconds
      };

      const tokenString = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(shortLivedPayload))}.mock-signature`;
      const result = store.parseToken(tokenString);

      expect(result?.isExpiring).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('returns cached valid JWT without refreshing', async () => {
      const mockToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwic2lkIjoic2Vzc2lvbl8xMjMiLCJleHAiOjk5OTk5OTk5OTl9.mock-signature';

      vi.mocked(getAccessTokenAction).mockResolvedValue(mockToken);
      await store.getAccessTokenSilently();

      vi.mocked(getAccessTokenAction).mockClear();
      vi.mocked(refreshAccessTokenAction).mockClear();

      const token = await store.getAccessToken();

      expect(token).toBe(mockToken);
      expect(getAccessTokenAction).not.toHaveBeenCalled();
      expect(refreshAccessTokenAction).not.toHaveBeenCalled();
    });

    it('returns cached opaque token without refreshing', async () => {
      const opaqueToken = 'opaque-token-string';

      vi.mocked(getAccessTokenAction).mockResolvedValue(opaqueToken);
      await store.getAccessTokenSilently();

      vi.mocked(getAccessTokenAction).mockClear();
      vi.mocked(refreshAccessTokenAction).mockClear();

      const token = await store.getAccessToken();

      expect(token).toBe(opaqueToken);
      expect(refreshAccessTokenAction).not.toHaveBeenCalled();
    });

    it('refreshes when JWT is expiring', async () => {
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const expiringPayload = {
        sub: '1234567890',
        sid: 'session_123',
        exp: currentTimeInSeconds + 25, // Within buffer
        iat: currentTimeInSeconds - 35,
      };
      const expiringToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(expiringPayload))}.mock-signature`;

      const refreshedToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZWZyZXNoZWQiLCJzaWQiOiJzZXNzaW9uXzEyMyIsImV4cCI6OTk5OTk5OTk5OX0.mock-signature-2';

      vi.mocked(getAccessTokenAction).mockResolvedValue(expiringToken);
      await store.getAccessTokenSilently();

      vi.mocked(refreshAccessTokenAction).mockResolvedValue(refreshedToken);

      const token = await store.getAccessToken();

      expect(token).toBe(refreshedToken);
      expect(refreshAccessTokenAction).toHaveBeenCalled();
    });
  });

  describe('refresh behavior', () => {
    it('tracks refresh state correctly', async () => {
      const mockToken = 'test-token';

      let resolvePromise: (value: string) => void;
      const slowPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(refreshAccessTokenAction).mockReturnValue(slowPromise);

      expect(store.isRefreshing()).toBe(false);

      const refreshPromise = store.refreshToken();
      expect(store.isRefreshing()).toBe(true);

      resolvePromise!(mockToken);
      await refreshPromise;

      expect(store.isRefreshing()).toBe(false);
    });

    it('prevents concurrent refresh requests', async () => {
      const mockToken = 'refresh-token';
      let callCount = 0;

      let resolvePromise: (value: string) => void;
      const slowPromise = new Promise<string>((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(refreshAccessTokenAction).mockImplementation(() => {
        callCount++;
        return slowPromise;
      });

      const promise1 = store.refreshToken();
      const promise2 = store.refreshToken();

      resolvePromise!(mockToken);
      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toBe(mockToken);
      expect(result2).toBe(mockToken);
      expect(callCount).toBe(1);
    });

    it('preserves token when refresh fails', async () => {
      const existingToken = 'existing-valid-token';

      vi.mocked(getAccessTokenAction).mockResolvedValue(existingToken);
      await store.getAccessTokenSilently();

      vi.mocked(refreshAccessTokenAction).mockRejectedValue(new Error('Network error'));

      try {
        await store.refreshToken();
      } catch (e) {
        // Expected to throw
      }

      const state = store.getSnapshot();
      expect(state.token).toBe(existingToken);
      expect(state.error).toBeTruthy();
    });
  });

  describe('subscription management', () => {
    it('notifies subscribers on state changes', () => {
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      store.clearToken();

      expect(listener).toHaveBeenCalled();

      unsubscribe();
      listener.mockClear();

      store.clearToken();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('clearToken', () => {
    it('clears token and resets state', () => {
      store.clearToken();
      const snapshot = store.getSnapshot();
      expect(snapshot.token).toBeUndefined();
      expect(snapshot.error).toBeNull();
      expect(snapshot.loading).toBe(false);
    });
  });
});

