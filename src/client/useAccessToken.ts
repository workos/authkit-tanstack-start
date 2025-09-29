import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from './AuthKitProvider.js';
import { tokenStore } from './tokenStore.js';
import type { UseAccessTokenReturn } from './types.js';

/**
 * A hook that manages access tokens with automatic refresh.
 */
export function useAccessToken(): UseAccessTokenReturn {
  const { user, sessionId } = useAuth();
  const userId = user?.id;
  const userRef = useRef(user);
  userRef.current = user;
  const prevSessionRef = useRef(sessionId);
  const prevUserIdRef = useRef(userId);

  const tokenState = useSyncExternalStore(tokenStore.subscribe, tokenStore.getSnapshot, tokenStore.getServerSnapshot);

  const [isInitialTokenLoading, setIsInitialTokenLoading] = useState(() => {
    return Boolean(user && !tokenState.token && !tokenState.error);
  });

  useEffect(() => {
    if (!user) {
      setIsInitialTokenLoading(false);
      if (prevUserIdRef.current !== undefined) {
        tokenStore.clearToken();
      }
      prevUserIdRef.current = undefined;
      prevSessionRef.current = undefined;
      return;
    }

    const sessionChanged = prevSessionRef.current !== undefined && prevSessionRef.current !== sessionId;
    const userChanged = prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId;

    if (sessionChanged || userChanged) {
      tokenStore.clearToken();
    }

    prevSessionRef.current = sessionId;
    prevUserIdRef.current = userId;

    const currentToken = tokenStore.getSnapshot().token;
    const tokenData = currentToken ? tokenStore.parseToken(currentToken) : null;
    const willActuallyFetch = !currentToken || (tokenData && tokenData.isExpiring);

    if (willActuallyFetch) {
      setIsInitialTokenLoading(true);
    }

    tokenStore
      .getAccessTokenSilently()
      .catch(() => {})
      .finally(() => {
        if (willActuallyFetch) {
          setIsInitialTokenLoading(false);
        }
      });
  }, [userId, sessionId, user]);

  useEffect(() => {
    if (!user || typeof document === 'undefined') {
      return;
    }

    const refreshIfNeeded = () => {
      tokenStore.getAccessTokenSilently().catch(() => {});
    };

    const handleWake = (event: Event) => {
      if (event.type !== 'visibilitychange' || document.visibilityState === 'visible') {
        refreshIfNeeded();
      }
    };

    document.addEventListener('visibilitychange', handleWake);
    window.addEventListener('focus', handleWake);
    window.addEventListener('online', handleWake);
    window.addEventListener('pageshow', handleWake);

    return () => {
      document.removeEventListener('visibilitychange', handleWake);
      window.removeEventListener('focus', handleWake);
      window.removeEventListener('online', handleWake);
      window.removeEventListener('pageshow', handleWake);
    };
  }, [userId, sessionId, user]);

  const getAccessToken = useCallback(async (): Promise<string | undefined> => {
    if (!userRef.current) {
      return undefined;
    }
    return tokenStore.getAccessToken();
  }, []);

  const refresh = useCallback(async (): Promise<string | undefined> => {
    if (!userRef.current) {
      return undefined;
    }
    return tokenStore.refreshToken();
  }, []);

  const isLoading = isInitialTokenLoading || tokenState.loading;

  return {
    accessToken: tokenState.token,
    loading: isLoading,
    error: tokenState.error,
    refresh,
    getAccessToken,
  };
}
