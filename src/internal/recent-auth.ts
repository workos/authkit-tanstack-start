type EvaluateRecentAuthParameters = {
  authTime: unknown;
  maxAgeSeconds: number;
  nowSeconds: number;
};

/**
 * Evaluate whether an authentication is recent enough.
 */
export function evaluateRecentAuth({ authTime, maxAgeSeconds, nowSeconds }: EvaluateRecentAuthParameters) {
  if (typeof authTime !== 'number' || !Number.isFinite(authTime)) {
    return {
      authenticatedAt: null,
      isStale: true,
    } as const;
  }

  return {
    authenticatedAt: new Date(authTime * 1000),
    isStale: nowSeconds - authTime > maxAgeSeconds,
  } as const;
}
