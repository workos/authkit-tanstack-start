import { getRawAuthFromContext, isAuthConfigured, refreshSession } from './auth-helpers.js';
import type { ClientUserInfo, NoUserInfo, UserInfo } from './server-functions.js';

export interface OrganizationInfo {
  id: string;
  name: string;
}

function sanitizeAuthForClient(auth: any): Omit<UserInfo, 'accessToken'> | NoUserInfo {
  if (!auth.user) {
    return { user: null };
  }

  return {
    user: auth.user,
    sessionId: auth.sessionId,
    organizationId: auth.claims?.org_id,
    role: auth.claims?.role,
    roles: auth.claims?.roles,
    permissions: auth.claims?.permissions,
    entitlements: auth.claims?.entitlements,
    featureFlags: auth.claims?.feature_flags,
    impersonator: auth.impersonator,
  };
}

export function checkSessionBody(): boolean {
  if (!isAuthConfigured()) {
    return false;
  }

  try {
    const auth = getRawAuthFromContext();
    return auth.user !== null;
  } catch {
    return false;
  }
}

export function getAuthBody(): ClientUserInfo | NoUserInfo {
  return sanitizeAuthForClient(getRawAuthFromContext());
}

export async function refreshAuthBody(options?: {
  organizationId?: string;
}): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> {
  const result = await refreshSession(options?.organizationId);

  if (!result || !result.user) {
    return { user: null };
  }

  return sanitizeAuthForClient(result);
}

export function getAccessTokenBody(): string | undefined {
  if (!isAuthConfigured()) {
    return undefined;
  }

  try {
    const auth = getRawAuthFromContext();
    return auth.user ? auth.accessToken : undefined;
  } catch {
    return undefined;
  }
}

export async function refreshAccessTokenBody(): Promise<string | undefined> {
  const result = await refreshSession();
  return result?.user ? result.accessToken : undefined;
}

export async function switchToOrganizationBody(data: {
  organizationId: string;
}): Promise<Omit<UserInfo, 'accessToken'> | NoUserInfo> {
  const result = await refreshSession(data.organizationId);

  if (!result || !result.user) {
    return { user: null };
  }

  return sanitizeAuthForClient(result);
}

export async function getOrganizationBody(organizationId: string): Promise<OrganizationInfo | null> {
  try {
    const { getWorkOS } = await import('@workos/authkit-session');
    const workos = getWorkOS();
    const org = await workos.organizations.getOrganization(organizationId);
    return { id: org.id, name: org.name };
  } catch {
    return null;
  }
}
