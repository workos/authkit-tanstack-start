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
      } catch {
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

  describe('reset', () => {
    it('resets all state and clears listeners', async () => {
      const listener = vi.fn();
      store.subscribe(listener);

      vi.mocked(getAccessTokenAction).mockResolvedValue('test-token');
      await store.getAccessTokenSilently();

      store.reset();

      const snapshot = store.getSnapshot();
      expect(snapshot.token).toBeUndefined();
      expect(snapshot.loading).toBe(false);
      expect(snapshot.error).toBeNull();
      expect(store.isRefreshing()).toBe(false);
    });
  });

  describe('getRefreshDelay edge cases', () => {
    it('applies the 15 s floor when token is within expiry buffer', async () => {
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const nearExpiryPayload = {
        sub: 'user_123',
        sid: 'session_123',
        iat: currentTimeInSeconds,
        exp: currentTimeInSeconds + 25, // Lifetime shorter than the 30-second buffer
      };
      const nearExpiryToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(nearExpiryPayload))}.mock-signature`;

      vi.mocked(refreshAccessTokenAction).mockResolvedValue(nearExpiryToken);
      await store.refreshToken();

      expect(store.getSnapshot().token).toBe(nearExpiryToken);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(1);

      // The scheduled refresh waits for MIN_REFRESH_DELAY_SECONDS, not 0.
      await vi.advanceTimersByTimeAsync(14_999);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(2);
    });

    it('caps refresh delay at maximum value', async () => {
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const longLivedPayload = {
        sub: 'user_123',
        sid: 'session_123',
        iat: currentTimeInSeconds,
        exp: currentTimeInSeconds + 60 * 60 * 48, // 48 hours
      };
      const longLivedToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(longLivedPayload))}.mock-signature`;

      vi.mocked(refreshAccessTokenAction).mockResolvedValue(longLivedToken);
      await store.refreshToken();

      expect(store.getSnapshot().token).toBe(longLivedToken);
    });
  });

  describe('silent refresh with no previous token', () => {
    it('fetches token when no cached token', async () => {
      // Create fresh store
      const freshStore = new TokenStore();
      freshStore.reset();

      const validToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsInNpZCI6InNlc3Npb25fMTIzIiwiZXhwIjo5OTk5OTk5OTk5fQ.mock-signature';

      vi.mocked(getAccessTokenAction).mockResolvedValue(validToken);

      const result = await freshStore.getAccessTokenSilently();

      expect(getAccessTokenAction).toHaveBeenCalled();
      expect(result).toBe(validToken);
    });
  });

  describe('refresh error handling', () => {
    it('converts non-Error to Error on failure', async () => {
      vi.mocked(refreshAccessTokenAction).mockRejectedValue('string error');

      try {
        await store.refreshToken();
      } catch {
        // Expected
      }

      const snapshot = store.getSnapshot();
      expect(snapshot.error).toBeInstanceOf(Error);
      expect(snapshot.error?.message).toBe('string error');
    });
  });

  describe('refresh schedule buffer', () => {
    it('scheduled refresh fires a real refresh while the token is in the isExpiring state', async () => {
      const now = Math.floor(Date.now() / 1000);
      const initialPayload = {
        sub: 'user_123',
        sid: 'session_123',
        iat: now,
        exp: now + 300,
      };
      const initialToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(initialPayload))}.mock-signature`;

      const refreshedPayload = {
        sub: 'user_123',
        sid: 'session_123',
        iat: now,
        exp: now + 3600,
      };
      const refreshedToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(refreshedPayload))}.mock-signature`;

      // Seed the initial token through the session-bound server RPC (the only
      // legitimate token source) rather than a client-readable cookie.
      vi.mocked(getAccessTokenAction).mockResolvedValue(initialToken);
      vi.mocked(refreshAccessTokenAction).mockResolvedValue(refreshedToken);

      const localStore = new TokenStore();
      await localStore.getAccessTokenSilently();
      expect(refreshAccessTokenAction).not.toHaveBeenCalled();

      // Advance past the originally scheduled fire time. If the schedule buffer
      // and the isExpiring buffer disagree, the timer's callback will see
      // isExpiring=false and silently no-op, leaving call count at 0.
      await vi.advanceTimersByTimeAsync(300_000);

      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(1);

      localStore.reset();
    });
  });

  describe('does not trust client-readable cookies (SEC-1348)', () => {
    afterEach(() => {
      document.cookie
        .split(';')
        .map((c) => c.split('=')[0].trim())
        .filter(Boolean)
        .forEach((name) => {
          document.cookie = `${name}=; Path=/; Max-Age=0`;
          document.cookie = `${name}=; Max-Age=0`;
        });
    });

    it('ignores a planted workos-access-token cookie and uses the session-bound RPC instead', async () => {
      const now = Math.floor(Date.now() / 1000);
      const makeToken = (sub: string) =>
        `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(
          JSON.stringify({ sub, sid: `session_${sub}`, iat: now, exp: now + 3600 }),
        )}.mock-signature`;

      const victimToken = makeToken('victim');
      const attackerToken = makeToken('attacker');

      // Attacker plants their own token via a cookie-write primitive.
      document.cookie = `workos-access-token=${encodeURIComponent(attackerToken)}; Path=/`;

      // The legitimate, session-bound token source returns the victim's token.
      vi.mocked(getAccessTokenAction).mockResolvedValue(victimToken);
      vi.mocked(refreshAccessTokenAction).mockResolvedValue(victimToken);

      const localStore = new TokenStore();
      // Construction must not adopt the cookie.
      expect(localStore.getSnapshot().token).toBeUndefined();

      const served = await localStore.getAccessToken();
      expect(served).toBe(victimToken);
      expect(served).not.toBe(attackerToken);

      localStore.reset();
    });
  });

  // https://github.com/workos/authkit-tanstack-start/issues/128
  // Browser clock = the faked Date.now(). WorkOS clock = Date.now() - skew.
  describe('refresh loop when the browser clock is skewed (#128)', () => {
    const START = Date.UTC(2025, 9, 18, 12, 0, 0);
    const LATENCY_MS = 150;
    const TEN_MINUTES_MS = 10 * 60_000;

    const makeToken = (payload: Record<string, unknown>) =>
      `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(JSON.stringify(payload))}.sig`;
    const workosNowSeconds = (skew: number) => Math.floor((Date.now() - skew * 1000) / 1000);

    function workosToken(skew: number, { lifetime = 300, ageSeconds = 0 } = {}) {
      const iat = workosNowSeconds(skew) - ageSeconds;
      return makeToken({ sub: 'user_123', sid: 'session_123', iat, exp: iat + lifetime });
    }

    // The server action: a ~150 ms round trip that mints a fresh token on WorkOS's clock.
    function mintOnWorkosClock(skew: number, { lifetime = 300, mintAfterMs = LATENCY_MS, respondAfterMs = 0 } = {}) {
      vi.mocked(refreshAccessTokenAction).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, mintAfterMs));
        const token = workosToken(skew, { lifetime });
        if (respondAfterMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, respondAfterMs));
        }
        return token;
      });
    }

    // How long the store thinks a token minted right now on WorkOS's clock has left.
    // 300 means the store's clock offset matches `skew`.
    const perceivedLifetime = (skew: number) => store.parseToken(workosToken(skew))?.timeUntilExpiry;

    beforeEach(() => {
      vi.setSystemTime(START);
      store.subscribe(() => {});
    });

    afterEach(() => {
      store.reset();
    });

    describe.each([0, 269, 271, 400, 1620, -600])('skew %i s', (skew) => {
      it('makes exactly one refresh call in the first 5 s', async () => {
        mintOnWorkosClock(skew);
        void store.refreshToken();
        await vi.advanceTimersByTimeAsync(5_000);
        expect(refreshAccessTokenAction).toHaveBeenCalledTimes(1);
      });

      it('refreshes once per 270 s over 10 minutes', async () => {
        mintOnWorkosClock(skew);
        void store.refreshToken();
        await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS);
        // t = 0, ~270 s, ~540 s
        expect(refreshAccessTokenAction).toHaveBeenCalledTimes(3);
      });

      it("judges expiry on WorkOS's clock after a refresh", async () => {
        mintOnWorkosClock(skew);
        void store.refreshToken();
        await vi.advanceTimersByTimeAsync(LATENCY_MS);
        expect(perceivedLifetime(skew)).toBe(300);
        expect(store.parseToken(store.getSnapshot().token)?.isExpiring).toBe(false);
      });
    });

    it('measures from the request start, so a slow response cannot push refreshes later', async () => {
      // Minted 100 ms after the request, delivered 2.4 s later.
      mintOnWorkosClock(1620, { mintAfterMs: 100, respondAfterMs: 2_400 });
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(2_500);
      // Measuring on arrival would count the 2.4 s as skew and report 302.
      expect(perceivedLifetime(1620)).toBe(300);
    });

    it('refreshes a token shorter than the buffer every 15 s instead of looping', async () => {
      mintOnWorkosClock(0, { lifetime: 20 });
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(55_000);
      // t = 0, ~15 s, ~30 s, ~45 s
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(4);
    });

    it('startup on a correct clock makes no extra refresh calls', async () => {
      mintOnWorkosClock(0);
      vi.mocked(getAccessTokenAction).mockResolvedValue(workosToken(0));
      void store.getAccessTokenSilently();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(refreshAccessTokenAction).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS - 5_000);
      // Scheduled refreshes at ~270 s and ~540 s only.
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(2);
    });

    it.each([271, 1620])('startup on a clock %i s ahead costs one refresh, then the normal cadence', async (skew) => {
      mintOnWorkosClock(skew);
      vi.mocked(getAccessTokenAction).mockResolvedValue(workosToken(skew));
      void store.getAccessTokenSilently();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(getAccessTokenAction).toHaveBeenCalledTimes(1);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(TEN_MINUTES_MS - 5_000);
      // t = 0, ~270 s, ~540 s
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(3);
    });

    it('does not measure skew from tokens served by getAccessTokenAction', async () => {
      mintOnWorkosClock(0);
      // Correct clock; the session's current token was minted 120 s ago.
      vi.mocked(getAccessTokenAction).mockResolvedValue(workosToken(0, { ageSeconds: 120 }));
      await store.getAccessTokenSilently();
      expect(perceivedLifetime(0)).toBe(300);

      // 180 s left, so the refresh is due at 150 s (not 270 s, as it would be if its age counted as skew).
      await vi.advanceTimersByTimeAsync(149_000);
      expect(refreshAccessTokenAction).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(1);
    });

    it.each<[string, () => string]>([
      ['no iat', () => makeToken({ sub: 'user_123', sid: 'session_123', exp: workosNowSeconds(1620) + 300 })],
      [
        'a string iat',
        () => makeToken({ sub: 'user_123', sid: 'session_123', iat: 'soon', exp: workosNowSeconds(1620) + 300 }),
      ],
      [
        'a null iat',
        () => makeToken({ sub: 'user_123', sid: 'session_123', iat: null, exp: workosNowSeconds(1620) + 300 }),
      ],
      ['an undecodable payload', () => 'header.not-base64-json.sig'],
      ['an opaque token', () => 'opaque-token'],
    ])('a minted token with %s leaves the offset unchanged', async (_label, mint) => {
      mintOnWorkosClock(1620);
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(LATENCY_MS);
      expect(perceivedLifetime(1620)).toBe(300);

      vi.mocked(refreshAccessTokenAction).mockImplementation(async () => mint());
      await store.refreshToken();
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(2);
      expect(perceivedLifetime(1620)).toBe(300);
    });

    it('with no iat to measure, a skewed clock falls back to the 15 s floor instead of looping', async () => {
      vi.mocked(refreshAccessTokenAction).mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
        return makeToken({ sub: 'user_123', sid: 'session_123', exp: workosNowSeconds(1620) + 300 });
      });
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(60_000);
      // t = 0, ~15 s, ~30 s, ~45 s
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(4);
      expect(perceivedLifetime(0)).toBe(300);
    });

    it("refreshes right away on getAccessToken() when the token is already expired on WorkOS's clock", async () => {
      // A minted token that expires the moment it is issued (e.g. at the end of its session).
      mintOnWorkosClock(1620, { lifetime: 0 });
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(LATENCY_MS);
      expect(store.parseToken(store.getSnapshot().token)?.timeUntilExpiry).toBe(0);

      // The scheduled timer waits for the 15 s floor; an explicit caller does not.
      mintOnWorkosClock(1620);
      const pending = store.getAccessToken();
      await vi.advanceTimersByTimeAsync(LATENCY_MS);
      await pending;
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(2);
      expect(store.parseToken(store.getSnapshot().token)?.timeUntilExpiry).toBe(300);
    });

    it('a late timer (hidden-tab throttling) that finds the token expired refreshes once, then resumes the cadence', async () => {
      mintOnWorkosClock(1620);
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(LATENCY_MS);

      // Throttling holds the 270 s timer for an extra minute: the clock moves, the timer doesn't fire.
      vi.setSystemTime(Date.now() + 60_000);
      expect(store.parseToken(store.getSnapshot().token)?.timeUntilExpiry).toBe(240);
      await vi.advanceTimersByTimeAsync(270_000);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(5_000);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(270_000);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(3);
    });

    it('dedupes concurrent refreshes into one call', async () => {
      mintOnWorkosClock(1620);
      const results = Promise.all([store.refreshToken(), store.getAccessToken(), store.getAccessTokenSilently()]);
      await vi.advanceTimersByTimeAsync(LATENCY_MS);
      const [a, b, c] = await results;
      expect(a).toBe(b);
      expect(b).toBe(c);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(1);
      expect(perceivedLifetime(1620)).toBe(300);
    });

    it("keeps the offset across clearToken() and judges the next session's startup token with it", async () => {
      mintOnWorkosClock(1620);
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(LATENCY_MS);

      store.clearToken();
      expect(perceivedLifetime(1620)).toBe(300);

      // Next sign-in: the session's token is 100 s old, with 200 s left on WorkOS's clock.
      vi.mocked(getAccessTokenAction).mockResolvedValue(workosToken(1620, { ageSeconds: 100 }));
      await store.getAccessTokenSilently();
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(1);
      expect(perceivedLifetime(1620)).toBe(300);
    });

    it('re-measures when the OS corrects the clock mid-session instead of stalling on a stale offset', async () => {
      mintOnWorkosClock(1620);
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(LATENCY_MS);

      // NTP fixes the 27-minute skew: the browser clock now matches WorkOS's.
      vi.setSystemTime(Date.now() - 1620 * 1000);
      mintOnWorkosClock(0);

      // The 270 s timer fires while the stale offset still makes the token look fresh.
      await vi.advanceTimersByTimeAsync(270_000);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(LATENCY_MS);
      expect(perceivedLifetime(0)).toBe(300);

      // Back to the normal cadence on the corrected clock.
      await vi.advanceTimersByTimeAsync(270_000);
      expect(refreshAccessTokenAction).toHaveBeenCalledTimes(3);
    });

    it('keeps the last offset when a refresh fails', async () => {
      mintOnWorkosClock(1620);
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(LATENCY_MS);

      vi.mocked(refreshAccessTokenAction).mockRejectedValue(new Error('Network error'));
      await expect(store.refreshToken()).rejects.toThrow('Network error');
      expect(perceivedLifetime(1620)).toBe(300);
    });

    it('reset() forgets the offset', async () => {
      mintOnWorkosClock(1620);
      void store.refreshToken();
      await vi.advanceTimersByTimeAsync(LATENCY_MS);
      expect(perceivedLifetime(1620)).toBe(300);

      store.reset();
      expect(perceivedLifetime(0)).toBe(300);
    });
  });
});
