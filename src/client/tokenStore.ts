import { getAccessTokenAction, refreshAccessTokenAction } from '../server/actions.js';
import { decodeJwt } from './jwt.js';

interface TokenState {
  token: string | undefined;
  loading: boolean;
  error: Error | null;
}

const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
const SHORT_TOKEN_LIFETIME_SECONDS = 300;
const SHORT_TOKEN_EXPIRY_BUFFER_SECONDS = 30;
const MIN_REFRESH_DELAY_SECONDS = 15;
const MAX_REFRESH_DELAY_SECONDS = 24 * 60 * 60;
const RETRY_DELAY_SECONDS = 300;

function getExpiryBuffer(totalTokenLifetime: number): number {
  return totalTokenLifetime <= SHORT_TOKEN_LIFETIME_SECONDS
    ? SHORT_TOKEN_EXPIRY_BUFFER_SECONDS
    : TOKEN_EXPIRY_BUFFER_SECONDS;
}

export class TokenStore {
  private state: TokenState;
  private serverSnapshot: TokenState;

  constructor() {
    this.state = {
      token: undefined,
      loading: false,
      error: null,
    };

    this.serverSnapshot = {
      token: undefined,
      loading: false,
      error: null,
    };
  }

  private listeners = new Set<() => void>();
  private refreshPromise: Promise<string | undefined> | null = null;
  private refreshTimeout: ReturnType<typeof setTimeout> | undefined;
  // Browser clock minus WorkOS clock (seconds): refresh request start minus the minted token's `iat`.
  private clockOffsetSeconds = 0;
  private idleSince: number | undefined;
  // A token retained through an idle gap; the getters refresh it before handing it out.
  private unverifiedToken: string | undefined;

  subscribe = (listener: () => void) => {
    // Idle longer than the refresh floor (|gap| also counts clock jumps) leaves the offset unchecked: drop it.
    if (this.idleSince !== undefined && Math.abs(Date.now() - this.idleSince) > MIN_REFRESH_DELAY_SECONDS * 1000) {
      this.clockOffsetSeconds = 0;
      this.unverifiedToken = this.state.token;
    }
    this.idleSince = undefined;
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.idleSince = Date.now();
        if (this.refreshTimeout) {
          clearTimeout(this.refreshTimeout);
          this.refreshTimeout = undefined;
        }
      }
    };
  };

  getSnapshot = () => this.state;

  getServerSnapshot = () => this.serverSnapshot;

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private setState(updates: Partial<TokenState>) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  private scheduleRefresh(tokenData?: { timeUntilExpiry: number; totalTokenLifetime: number }) {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }

    const delay = tokenData === undefined ? RETRY_DELAY_SECONDS * 1000 : this.getRefreshDelay(tokenData);

    this.refreshTimeout = setTimeout(() => {
      // A token timer that finds its token still fresh means the wall clock jumped: refresh to re-measure.
      const current = this.parseToken(this.state.token);
      const refresh =
        tokenData && current && !current.isExpiring ? this.refreshTokenSilently() : this.getAccessTokenSilently();
      void refresh.catch(() => {});
    }, delay);
  }

  private getRefreshDelay({
    timeUntilExpiry,
    totalTokenLifetime,
  }: {
    timeUntilExpiry: number;
    totalTokenLifetime: number;
  }) {
    const bufferSeconds = getExpiryBuffer(totalTokenLifetime);
    const idealDelay = (timeUntilExpiry - bufferSeconds) * 1000;

    return Math.min(Math.max(idealDelay, MIN_REFRESH_DELAY_SECONDS * 1000), MAX_REFRESH_DELAY_SECONDS * 1000);
  }

  parseToken(token: string | undefined) {
    if (!token) return null;

    try {
      const { payload } = decodeJwt(token);
      const now = Math.floor(Date.now() / 1000) - this.clockOffsetSeconds;

      if (typeof payload.exp !== 'number') {
        return null;
      }

      const timeUntilExpiry = payload.exp - now;
      const totalTokenLifetime = payload.exp - (payload.iat || now);
      const bufferSeconds = getExpiryBuffer(totalTokenLifetime);

      const isExpiring = payload.exp <= now + bufferSeconds;

      return {
        payload,
        expiresAt: payload.exp,
        isExpiring,
        timeUntilExpiry,
        totalTokenLifetime,
      };
    } catch {
      return null;
    }
  }

  isRefreshing(): boolean {
    return this.refreshPromise !== null;
  }

  clearToken() {
    this.clockOffsetSeconds = 0;
    this.setState({ token: undefined, error: null, loading: false });
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }
  }

  private isUnverified(): boolean {
    return this.state.token !== undefined && this.state.token === this.unverifiedToken;
  }

  async getAccessToken(): Promise<string | undefined> {
    if (this.isUnverified()) {
      return this.refreshTokenSilently();
    }

    const tokenData = this.parseToken(this.state.token);

    if (tokenData && !tokenData.isExpiring) {
      return this.state.token;
    }

    if (this.state.token && !tokenData) {
      return this.state.token;
    }

    return this.refreshTokenSilently();
  }

  async getAccessTokenSilently(): Promise<string | undefined> {
    if (this.isUnverified()) {
      return this.refreshTokenSilently();
    }

    const tokenData = this.parseToken(this.state.token);

    if (tokenData && !tokenData.isExpiring) {
      return this.state.token;
    }

    if (this.state.token && !tokenData) {
      return this.state.token;
    }

    return this.refreshTokenSilently();
  }

  async refreshToken(): Promise<string | undefined> {
    return this._refreshToken(false);
  }

  private async fetchRefreshedToken(): Promise<string | undefined> {
    const requestedAt = Math.floor(Date.now() / 1000);
    const token = await refreshAccessTokenAction();
    this.unverifiedToken = undefined;
    const iat = this.parseToken(token)?.payload.iat;

    if (typeof iat === 'number' && Number.isFinite(iat)) {
      this.clockOffsetSeconds = requestedAt - iat;
    }

    return token;
  }

  private async refreshTokenSilently(): Promise<string | undefined> {
    return this._refreshToken(true);
  }

  private async _refreshToken(silent: boolean): Promise<string | undefined> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const previousToken = this.state.token;

    if (!silent) {
      this.setState({ loading: true, error: null });
    } else {
      this.setState({ error: null });
    }

    this.refreshPromise = (async () => {
      try {
        let token: string | undefined;

        if (!silent) {
          token = await this.fetchRefreshedToken();
        } else {
          if (!previousToken) {
            token = await getAccessTokenAction();
            const tokenData = this.parseToken(token);

            if (token && token !== previousToken) {
              this.setState({
                token,
                loading: false,
                error: null,
              });
            }

            if (!token || (tokenData && tokenData.isExpiring)) {
              const refreshedToken = await this.fetchRefreshedToken();
              if (refreshedToken) {
                token = refreshedToken;
              }
            }
          } else {
            token = await this.fetchRefreshedToken();
          }
        }

        if (token !== previousToken || !silent) {
          this.setState({
            token,
            loading: false,
            error: null,
          });
        }

        const tokenData = this.parseToken(token);
        if (tokenData) {
          this.scheduleRefresh(tokenData);
        }

        return token;
      } catch (error) {
        this.setState({
          loading: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });

        this.scheduleRefresh();

        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  reset() {
    this.state = { token: undefined, loading: false, error: null };
    this.refreshPromise = null;
    this.clockOffsetSeconds = 0;
    this.idleSince = undefined;
    this.unverifiedToken = undefined;
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }
    this.listeners.clear();
  }
}

export const tokenStore = new TokenStore();
