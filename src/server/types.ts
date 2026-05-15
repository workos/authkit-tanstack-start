import type { User, Impersonator } from '../types.js';

/**
 * Options for AuthKit middleware.
 */
export interface AuthKitMiddlewareOptions {
  /**
   * Override the default redirect URI for OAuth callbacks.
   * Useful for dynamic environments like Vercel preview deployments.
   */
  redirectUri?: string;
}

/**
 * OAuth tokens from upstream identity provider (e.g., Google, Microsoft)
 * Structure varies by provider but typically includes access_token and optional refresh_token
 */
export interface OauthTokens {
  [key: string]: any;
}

export interface HandleCallbackOptions {
  returnPathname?: string;
  onSuccess?: (data: HandleAuthSuccessData) => void | Promise<void>;
  /**
   * Custom error handler. Receives the underlying error and the original
   * request, returns a Response. Errors thrown from inside `onError` are
   * NOT caught by the SDK — they propagate up to the runtime. Wrap your
   * `onError` body in a try/catch if you want different behavior.
   *
   * If both `onError` and `errorRedirectUrl` are provided, `onError` wins
   * and `errorRedirectUrl` is ignored.
   */
  onError?: (params: { error?: unknown; request: Request }) => Response | Promise<Response>;
  /**
   * Optional URL to redirect the user to when the callback fails. Accepts
   * absolute URLs (`https://example.com/sign-in`) or relative paths
   * (`/sign-in?error=auth_failed`); relative values resolve against the
   * request origin.
   *
   * When set and `onError` is not, the SDK responds with a 302 Location
   * redirect plus the verifier-delete cookies. When `onError` is also
   * set, this option is ignored.
   *
   * The redirect URL is set at route-construction time by application
   * code, not derived from request input. Do not pass user-controlled
   * values here. The SDK does not validate the URL scheme; any value the
   * URL constructor accepts is accepted (including `javascript:` and
   * `data:`).
   *
   * If the value is malformed and the URL constructor throws, the SDK
   * logs a config warning and falls back to the path-dependent JSON
   * error response (400 or 500) with delete-cookies.
   */
  errorRedirectUrl?: string;
}

export interface HandleAuthSuccessData {
  accessToken: string;
  refreshToken: string;
  user: User;
  impersonator?: Impersonator;
  oauthTokens?: OauthTokens;
  authenticationMethod?: string;
  organizationId?: string;
  state?: string;
}
