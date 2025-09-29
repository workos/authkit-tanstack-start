import { getAccessTokenAction, refreshAccessTokenAction } from '../server/actions.js';
import { decodeJwt } from './jwt.js';

interface TokenState {
  token: string | undefined;
  loading: boolean;
  error: Error | null;
}

const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
const MIN_REFRESH_DELAY_SECONDS = 15;
const MAX_REFRESH_DELAY_SECONDS = 24 * 60 * 60;
const RETRY_DELAY_SECONDS = 300;
const jwtCookieName = 'workos-access-token';

export class TokenStore {
  private state: TokenState;
  private serverSnapshot: TokenState;

  constructor() {
    const initialToken = typeof window !== 'undefined' ? this.getInitialTokenFromCookie() : undefined;
    this.state = {
      token: initialToken,
      loading: false,
      error: null,
    };

    this.serverSnapshot = {
      token: undefined,
      loading: false,
      error: null,
    };

    if (initialToken) {
      this.fastCookieConsumed = true;
      const tokenData = this.parseToken(initialToken);
      if (tokenData) {
        this.scheduleRefresh(tokenData.timeUntilExpiry);
      }
    }
  }

  private listeners = new Set<() => void>();
  private refreshPromise: Promise<string | undefined> | null = null;
  private refreshTimeout: ReturnType<typeof setTimeout> | undefined;
  private fastCookieConsumed = false;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.refreshTimeout) {
        clearTimeout(this.refreshTimeout);
        this.refreshTimeout = undefined;
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

  private scheduleRefresh(timeUntilExpiry?: number) {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }

    const delay =
      typeof timeUntilExpiry === 'undefined' ? RETRY_DELAY_SECONDS * 1000 : this.getRefreshDelay(timeUntilExpiry);

    this.refreshTimeout = setTimeout(() => {
      void this.getAccessTokenSilently().catch(() => {});
    }, delay);
  }

  private getRefreshDelay(timeUntilExpiry: number) {
    if (timeUntilExpiry <= TOKEN_EXPIRY_BUFFER_SECONDS) {
      return 0;
    }

    const idealDelay = (timeUntilExpiry - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000;

    return Math.min(Math.max(idealDelay, MIN_REFRESH_DELAY_SECONDS * 1000), MAX_REFRESH_DELAY_SECONDS * 1000);
  }

  private deleteCookie() {
    const isSecure = window.location.protocol === 'https:';

    const deletionString = isSecure
      ? `${jwtCookieName}=; SameSite=Lax; Max-Age=0; Secure`
      : `${jwtCookieName}=; SameSite=Lax; Max-Age=0`;

    document.cookie = deletionString;
  }

  private getInitialTokenFromCookie(): string | undefined {
    if (typeof document === 'undefined' || typeof document.cookie === 'undefined') {
      return;
    }

    const cookies = document.cookie.split(';').reduce(
      (acc, cookie) => {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name && valueParts.length > 0) {
          const value = valueParts.join('=');
          acc[name.trim()] = decodeURIComponent(value);
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    const token = cookies[jwtCookieName];
    if (!token) {
      return;
    }

    this.deleteCookie();

    return token;
  }

  private consumeFastCookie(): string | undefined {
    if (this.fastCookieConsumed) {
      return;
    }

    if (typeof document === 'undefined' || typeof document.cookie === 'undefined') {
      return;
    }

    const cookies = document.cookie.split(';').reduce(
      (acc, cookie) => {
        const [name, ...valueParts] = cookie.trim().split('=');
        if (name && valueParts.length > 0) {
          const value = valueParts.join('=');
          acc[name.trim()] = decodeURIComponent(value);
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    const newToken = cookies[jwtCookieName];
    if (!newToken) {
      this.fastCookieConsumed = true;
      return;
    }

    this.fastCookieConsumed = true;

    this.deleteCookie();

    if (newToken !== this.state.token) {
      return newToken;
    }
  }

  parseToken(token: string | undefined) {
    if (!token) return null;

    try {
      const { payload } = decodeJwt(token);
      const now = Math.floor(Date.now() / 1000);

      if (typeof payload.exp !== 'number') {
        return null;
      }

      const timeUntilExpiry = payload.exp - now;

      let bufferSeconds = TOKEN_EXPIRY_BUFFER_SECONDS;
      const totalTokenLifetime = payload.exp - (payload.iat || now);

      if (totalTokenLifetime <= 300) {
        bufferSeconds = 30;
      }

      const isExpiring = payload.exp < now + bufferSeconds;

      return {
        payload,
        expiresAt: payload.exp,
        isExpiring,
        timeUntilExpiry,
      };
    } catch {
      return null;
    }
  }

  isRefreshing(): boolean {
    return this.refreshPromise !== null;
  }

  clearToken() {
    this.setState({ token: undefined, error: null, loading: false });
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }
  }

  async getAccessToken(): Promise<string | undefined> {
    const fastToken = this.consumeFastCookie();

    if (fastToken) {
      this.setState({ token: fastToken, loading: false, error: null });
      return fastToken;
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
    const fastToken = this.consumeFastCookie();

    if (fastToken) {
      this.setState({ token: fastToken, loading: false, error: null });

      const tokenData = this.parseToken(fastToken);
      if (tokenData) {
        this.scheduleRefresh(tokenData.timeUntilExpiry);
      }

      return fastToken;
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
          token = await refreshAccessTokenAction();
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
              const refreshedToken = await refreshAccessTokenAction();
              if (refreshedToken) {
                token = refreshedToken;
              }
            }
          } else {
            token = await refreshAccessTokenAction();
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
          this.scheduleRefresh(tokenData.timeUntilExpiry);
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
    this.fastCookieConsumed = false;
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = undefined;
    }
    this.listeners.clear();
  }
}

export const tokenStore = new TokenStore();
