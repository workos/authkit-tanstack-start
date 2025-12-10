import { ClientUserInfo, NoUserInfo } from '../server/server-functions.js';
import type { User, Impersonator } from '../types.js';

export interface AuthContextType {
  user: User | null;
  sessionId: string | undefined;
  organizationId: string | undefined;
  role: string | undefined;
  roles: string[] | undefined;
  permissions: string[] | undefined;
  entitlements: string[] | undefined;
  featureFlags: string[] | undefined;
  impersonator: Impersonator | undefined;
  loading: boolean;
  getAuth: (options?: { ensureSignedIn?: boolean }) => Promise<void>;
  refreshAuth: (options?: { ensureSignedIn?: boolean; organizationId?: string }) => Promise<void | { error: string }>;
  signOut: (options?: { returnTo?: string }) => Promise<void>;
  switchToOrganization: (organizationId: string) => Promise<void | { error: string }>;
}

export interface AuthKitProviderProps {
  children: React.ReactNode;
  /**
   * Customize what happens when a session is expired. By default, the entire page will be reloaded.
   * You can also pass this as `false` to disable the expired session checks.
   */
  onSessionExpired?: false | (() => void);
  /**
   * Initial authentication state to use for the provider.
   * This is useful for pre-loading the authentication state for the provider
   * in a loader to avoid loading state flickering.
   */
  initialAuth?: ClientUserInfo | NoUserInfo;
}

export interface UseAccessTokenReturn {
  /**
   * Current access token. May be stale when tab is inactive.
   * Use this for display purposes or where eventual consistency is acceptable.
   */
  accessToken: string | undefined;
  /**
   * Loading state for initial token fetch
   */
  loading: boolean;
  /**
   * Error from the last token operation
   */
  error: Error | null;
  /**
   * Manually trigger a token refresh
   */
  refresh: () => Promise<string | undefined>;
  /**
   * Get a guaranteed fresh access token. Automatically refreshes if needed.
   * Use this for API calls where token freshness is critical.
   * @returns Promise resolving to fresh token or undefined if not authenticated
   * @throws Error if refresh fails
   */
  getAccessToken: () => Promise<string | undefined>;
}
