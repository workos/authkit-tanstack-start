import { createServerFn } from '@tanstack/react-start';
import type { ClientUserInfo, NoUserInfo, UserInfo } from './server-functions.js';
import type { OrganizationInfo } from './action-bodies.js';

export type { OrganizationInfo };

/**
 * Check if a session exists. Used by client to detect session expiration.
 */
export const checkSessionAction = createServerFn({ method: 'GET' }).handler(async (): Promise<boolean> => {
  const { checkSessionBody } = await import('./action-bodies.js');
  return checkSessionBody();
});

/**
 * Get authentication context. Sanitized for client use (no access token).
 * Can be used to seed the AuthKitProvider with the initial authentication state.
 */
export const getAuthAction = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ClientUserInfo | NoUserInfo> => {
    const { getAuthBody } = await import('./action-bodies.js');
    return getAuthBody();
  },
);

/**
 * Refresh authentication session. Sanitized for client use (no access token).
 */
export const refreshAuthAction = createServerFn({ method: 'POST' })
  .inputValidator((options?: { organizationId?: string }) => options)
  .handler(async ({ data: options }): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> => {
    const { refreshAuthBody } = await import('./action-bodies.js');
    return refreshAuthBody(options);
  });

/**
 * Get access token for the current session.
 */
export const getAccessTokenAction = createServerFn({ method: 'GET' }).handler(async (): Promise<string | undefined> => {
  const { getAccessTokenBody } = await import('./action-bodies.js');
  return getAccessTokenBody();
});

/**
 * Refresh and get a new access token.
 */
export const refreshAccessTokenAction = createServerFn({ method: 'POST' }).handler(
  async (): Promise<string | undefined> => {
    const { refreshAccessTokenBody } = await import('./action-bodies.js');
    return refreshAccessTokenBody();
  },
);

/**
 * Switch to a different organization. Sanitized for client use (no access token).
 */
export const switchToOrganizationAction = createServerFn({ method: 'POST' })
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data }): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> => {
    const { switchToOrganizationBody } = await import('./action-bodies.js');
    return switchToOrganizationBody(data);
  });

/**
 * Fetch organization details by ID.
 */
export const getOrganizationAction = createServerFn({ method: 'GET' })
  .inputValidator((organizationId: string) => organizationId)
  .handler(async ({ data: organizationId }): Promise<OrganizationInfo | null> => {
    const { getOrganizationBody } = await import('./action-bodies.js');
    return getOrganizationBody(organizationId);
  });
