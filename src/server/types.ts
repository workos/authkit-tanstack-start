import type { User, Impersonator } from '../types.js';

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
  onError?: (params: { error?: unknown; request: Request }) => Response | Promise<Response>;
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
