import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let mockAuth: any = { user: null };

vi.mock('./auth-helpers', () => ({
  getRawAuthFromContext: () => mockAuth,
}));

import { checkRecentAuthBody } from './server-fn-bodies';

const NOW_MS = 1_700_000_000_000;
const NOW_S = NOW_MS / 1000;

const authenticated = (authTime?: number) => ({
  user: { id: 'user_123' },
  sessionId: 'session_123',
  accessToken: 'token',
  claims: { sid: 'session_123', auth_time: authTime },
});

describe('checkRecentAuthBody', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports recent auth as not stale', () => {
    mockAuth = authenticated(NOW_S - 60);
    const result = checkRecentAuthBody({ maxAge: 300 });

    expect(result.isStale).toBe(false);
    expect(result.authenticatedAt).toEqual(new Date((NOW_S - 60) * 1000));
  });

  it('reports stale auth past maxAge', () => {
    mockAuth = authenticated(NOW_S - 600);
    expect(checkRecentAuthBody({ maxAge: 300 }).isStale).toBe(true);
  });

  it('fails closed when auth_time claim is missing', () => {
    mockAuth = authenticated(undefined);
    expect(checkRecentAuthBody({ maxAge: 300 })).toEqual({ authenticatedAt: null, isStale: true });
  });

  it('fails closed when there is no authenticated user', () => {
    mockAuth = { user: null };
    expect(checkRecentAuthBody({ maxAge: 300 })).toEqual({ authenticatedAt: null, isStale: true });
  });
});
