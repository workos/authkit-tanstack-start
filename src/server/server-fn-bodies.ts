import type { GetAuthorizationUrlOptions as GetAuthURLOptions, HeadersBag } from '@workos/authkit-session';
import { getRawAuthFromContext, refreshSession, getRedirectUriFromContext } from './auth-helpers.js';
import { getAuthkit } from './authkit-loader.js';
import { getAuthKitContextOrNull } from './context.js';
import { emitHeadersFrom, forEachHeaderBagEntry } from './headers-bag.js';
import type { NoUserInfo, UserInfo } from './server-functions.js';

type AuthorizationResult = {
  url: string;
  response?: Response;
  headers?: HeadersBag;
};

/**
 * Forward every `Set-Cookie` (and any other header) emitted by the upstream
 * authorization-URL call through middleware's pending-header channel so the
 * PKCE verifier cookie lands on the outgoing response. Each `Set-Cookie` entry
 * is appended as its own header — never comma-joined — so multi-cookie
 * emissions survive as distinct HTTP headers.
 */
function forwardAuthorizationCookies(result: AuthorizationResult): string {
  const ctx = getAuthKitContextOrNull();
  if (!ctx?.__setPendingHeader) {
    throw new Error(
      '[authkit-tanstack-react-start] PKCE cookie could not be set: middleware context unavailable. Ensure authkitMiddleware is registered in your request middleware stack.',
    );
  }

  // Upstream contract guarantees one of `headers` or `response` is populated;
  // if neither emits, fail loudly so a dropped PKCE verifier doesn't surface
  // later as an opaque state-mismatch in the callback.
  if (!emitHeadersFrom(result, ctx.__setPendingHeader)) {
    throw new Error(
      '[authkit-tanstack-react-start] authorization result had neither headers nor response; PKCE verifier cookie could not be forwarded. This indicates a version mismatch with @workos/authkit-session.',
    );
  }

  return result.url;
}

/** Inject middleware-configured redirectUri only when caller did not provide one. */
function applyContextRedirectUri<T extends { redirectUri?: string } | undefined>(options: T): T {
  const contextRedirectUri = getRedirectUriFromContext();
  if (!contextRedirectUri || options?.redirectUri) return options;
  return { ...options, redirectUri: contextRedirectUri } as T;
}

/** Internal: project raw auth context into the public UserInfo shape. */
function getAuthFromContext(): UserInfo | NoUserInfo {
  const auth = getRawAuthFromContext();

  if (!auth.user) {
    return { user: null };
  }

  return {
    user: auth.user,
    sessionId: auth.sessionId!,
    organizationId: auth.claims?.org_id,
    role: auth.claims?.role,
    roles: auth.claims?.roles,
    permissions: auth.claims?.permissions,
    entitlements: auth.claims?.entitlements,
    featureFlags: auth.claims?.feature_flags,
    impersonator: auth.impersonator,
    accessToken: auth.accessToken!,
  };
}

/**
 * Plan returned by `signOutBody`. The shell turns this into a `redirect(...)`
 * throw. Keeping `redirect` out of this file lets the shell own the only value
 * import of `@tanstack/react-router` and keeps the body file's static graph
 * confined to server-only modules (which the lazy-import boundary already
 * isolates from the client).
 */
export type SignOutPlan =
  | { kind: 'returnTo'; to: string }
  | { kind: 'logoutUrl'; href: string; headers: Headers };

export async function getSignOutUrlBody(data?: { returnTo?: string }): Promise<{ url: string | null }> {
  const auth = getAuthFromContext();

  if (!auth.user || !auth.sessionId) {
    return { url: null };
  }

  const authkit = await getAuthkit();
  const { logoutUrl } = await authkit.signOut(auth.sessionId, { returnTo: data?.returnTo });

  return { url: logoutUrl };
}

export async function signOutBody(data?: { returnTo?: string }): Promise<SignOutPlan> {
  const auth = getAuthFromContext();

  if (!auth.user || !auth.sessionId) {
    return { kind: 'returnTo', to: data?.returnTo || '/' };
  }

  // Get authkit instance (lazy loaded)
  const authkit = await getAuthkit();

  // Get logout URL and session clear headers from storage
  const { logoutUrl, headers: headersBag } = await authkit.signOut(auth.sessionId, { returnTo: data?.returnTo });

  // Convert HeadersBag to Headers for TanStack compatibility
  const headers = new Headers();
  if (headersBag) {
    forEachHeaderBagEntry(headersBag, (key, value) => headers.append(key, value));
  }

  return { kind: 'logoutUrl', href: logoutUrl, headers };
}

export function getAuthBody(): UserInfo | NoUserInfo {
  return getAuthFromContext();
}

export async function getAuthorizationUrlBody(options?: GetAuthURLOptions): Promise<string> {
  const authkit = await getAuthkit();
  return forwardAuthorizationCookies(await authkit.createAuthorization(undefined, applyContextRedirectUri(options ?? {})));
}

export async function getSignInUrlBody(
  data?: string | Omit<GetAuthURLOptions, 'screenHint'>,
): Promise<string> {
  const options = typeof data === 'string' ? { returnPathname: data } : data;
  const authkit = await getAuthkit();
  return forwardAuthorizationCookies(await authkit.createSignIn(undefined, applyContextRedirectUri(options ?? {})));
}

export async function getSignUpUrlBody(
  data?: string | Omit<GetAuthURLOptions, 'screenHint'>,
): Promise<string> {
  const options = typeof data === 'string' ? { returnPathname: data } : data;
  const authkit = await getAuthkit();
  return forwardAuthorizationCookies(await authkit.createSignUp(undefined, applyContextRedirectUri(options ?? {})));
}

export type SwitchToOrganizationPlan =
  | { kind: 'redirect'; to: string }
  | { kind: 'user'; user: UserInfo };

export async function switchToOrganizationBody(
  data: { organizationId: string; returnTo?: string },
): Promise<SwitchToOrganizationPlan> {
  const auth = getAuthFromContext();

  if (!auth.user) {
    return { kind: 'redirect', to: data.returnTo || '/' };
  }

  const result = await refreshSession(data.organizationId);

  if (!result?.user) {
    return { kind: 'redirect', to: data.returnTo || '/' };
  }

  return {
    kind: 'user',
    user: {
      user: result.user,
      sessionId: result.sessionId,
      organizationId: result.claims?.org_id,
      role: result.claims?.role,
      roles: result.claims?.roles,
      permissions: result.claims?.permissions,
      entitlements: result.claims?.entitlements,
      featureFlags: result.claims?.feature_flags,
      impersonator: result.impersonator,
      accessToken: result.accessToken,
    },
  };
}
