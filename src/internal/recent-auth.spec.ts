import { describe, it, expect } from 'vitest';
import { evaluateRecentAuth } from './recent-auth';

const NOW = 1_700_000_000; // fixed epoch seconds

describe('evaluateRecentAuth', () => {
  it('reports recent auth as not stale', () => {
    const authTime = NOW - 60; // 1 minute ago
    const result = evaluateRecentAuth({ authTime, maxAgeSeconds: 300, nowSeconds: NOW });

    expect(result.isStale).toBe(false);
    expect(result.authenticatedAt).toEqual(new Date(authTime * 1000));
  });

  it('reports auth older than maxAge as stale', () => {
    const authTime = NOW - 600; // 10 minutes ago
    const result = evaluateRecentAuth({ authTime, maxAgeSeconds: 300, nowSeconds: NOW });

    expect(result.isStale).toBe(true);
    expect(result.authenticatedAt).toEqual(new Date(authTime * 1000));
  });

  it('treats exactly maxAge as not stale (boundary is inclusive)', () => {
    const result = evaluateRecentAuth({ authTime: NOW - 300, maxAgeSeconds: 300, nowSeconds: NOW });
    expect(result.isStale).toBe(false);
  });

  it('fails closed when auth_time is missing', () => {
    expect(evaluateRecentAuth({ authTime: undefined, maxAgeSeconds: 300, nowSeconds: NOW })).toEqual({
      authenticatedAt: null,
      isStale: true,
    });
  });

  it('fails closed when auth_time is not a finite number', () => {
    for (const bad of ['1700000000', NaN, Infinity, null, {}]) {
      expect(evaluateRecentAuth({ authTime: bad, maxAgeSeconds: 300, nowSeconds: NOW })).toEqual({
        authenticatedAt: null,
        isStale: true,
      });
    }
  });

  it('does not treat future auth_time (clock skew) as stale', () => {
    const result = evaluateRecentAuth({ authTime: NOW + 30, maxAgeSeconds: 300, nowSeconds: NOW });
    expect(result.isStale).toBe(false);
  });
});
