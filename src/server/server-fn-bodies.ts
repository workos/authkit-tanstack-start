import type {
  AuthService,
  CreateAuthorizationResult,
  GetAuthorizationUrlOptions as GetAuthURLOptions,
} from '@workos/authkit-session';
import { selectStalePKCEVerifierCookieNames } from '@workos/authkit-session';
import { getRawAuthFromContext, mapAuthToBaseInfo, refreshSession, getRedirectUriFromContext } from './auth-helpers.js';
import { getAuthkit } from './authkit-loader.js';
import type { AuthKitServerContext } from './context.js';
import { getInternalAuthKitContextOrNull } from './context.js';
import { parseCookieNames } from './cookie-utils.js';
import { emitHeadersFrom, forEachHeaderBagEntry } from './headers-bag.js';
import type { NoUserInfo, UserInfo } from './server-functions.js';

type AuthorizationResult = CreateAuthorizationResult<Response>;

/**
 * Run the full authorization-URL pipeline: resolve the AuthKit service, invoke
 * `create` to mint the URL + its PKCE verifier cookie, forward every emitted
 * `Set-Cookie` through middleware's pending-header channel, evict stale verifier
 * cookies, and return the URL.
 *
 * `create` names which flow to start (sign-in / sign-up / generic). The three
 * URL server-function bodies differ only in that callback, so this pipeline
 * lives here once. Each `Set-Cookie` is appended as its own header — never
 * comma-joined — so a multi-cookie emission survives as distinct HTTP headers.
 */
async function authorizationUrl(
  create: (authkit: AuthService<Request, Response>) => Promise<AuthorizationResult>,
): Promise<string> {
  const authkit = await getAuthkit();
  const result = await create(authkit);

  const ctx = getInternalAuthKitContextOrNull();
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

  await evictStalePendingVerifiers(ctx, authkit, result.cookieName);

  return result.url;
}

/**
 * Bound the number of pending PKCE verifier cookies.
 *
 * Each authorization-URL call mints a uniquely-named `wos-auth-verifier-*`
 * cookie that never overwrites prior ones — per-flow naming exists so
 * concurrent sign-ins (e.g. multiple tabs) don't clobber each other. The cost
 * is that generating URLs without navigating to them (the `getSignInUrl()`-in-
 * a-loader antipattern from issue #76) accumulates orphan cookies until their
 * 10-minute TTL, eventually bloating the `Cookie` header into an HTTP 431.
 *
 * On the request that mints `keepCookieName`, evict every *other* verifier
 * cookie once the running total would exceed the cap, keeping only the one
 * just created. Best-effort: a cleanup failure must never break URL generation,
 * so storage errors are swallowed. Deletes are emitted through middleware's
 * pending-header channel via `clearPendingVerifierByName` — the same path the
 * new cookie itself uses.
 */
async function evictStalePendingVerifiers(
  ctx: AuthKitServerContext,
  authkit: AuthService<Request, Response>,
  keepCookieName: string,
): Promise<void> {
  const cookieHeader = ctx.request.headers.get('cookie');
  if (!cookieHeader) return;

  const stale = selectStalePKCEVerifierCookieNames(parseCookieNames(cookieHeader), { keep: keepCookieName });
  if (stale.length === 0) return;

  // Each delete is independent, so fire them together and isolate per-cookie
  // failures with allSettled — a rejected clear just leaves an orphan to expire
  // on its TTL and must never block URL generation. (In this adapter each clear
  // only appends a Set-Cookie to the pending-header channel, so this is about
  // error isolation more than latency.)
  await Promise.allSettled(
    stale.map((cookieName) =>
      authkit.clearPendingVerifierByName(undefined, { cookieName, redirectUri: ctx.redirectUri }),
    ),
  );
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
  if (!auth.user) return { user: null };
  return { ...mapAuthToBaseInfo(auth), accessToken: auth.accessToken };
}

/**
 * Plan returned by `signOutBody`. The shell turns this into a `redirect(...)`
 * throw. Keeping `redirect` out of this file lets the shell own the only value
 * import of `@tanstack/react-router` and keeps the body file's static graph
 * confined to server-only modules (which the lazy-import boundary already
 * isolates from the client).
 */
export type SignOutPlan = { kind: 'returnTo'; to: string } | { kind: 'logoutUrl'; href: string; headers: Headers };

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

/** Normalize the sign-in/sign-up data arg: a bare string is the returnPathname. */
function toAuthOptions(
  data?: string | Omit<GetAuthURLOptions, 'screenHint'>,
): Omit<GetAuthURLOptions, 'screenHint'> | undefined {
  return typeof data === 'string' ? { returnPathname: data } : data;
}

export function getAuthorizationUrlBody(options?: GetAuthURLOptions): Promise<string> {
  return authorizationUrl((authkit) => authkit.createAuthorization(undefined, applyContextRedirectUri(options ?? {})));
}

export function getSignInUrlBody(data?: string | Omit<GetAuthURLOptions, 'screenHint'>): Promise<string> {
  return authorizationUrl((authkit) =>
    authkit.createSignIn(undefined, applyContextRedirectUri(toAuthOptions(data) ?? {})),
  );
}

export function getSignUpUrlBody(data?: string | Omit<GetAuthURLOptions, 'screenHint'>): Promise<string> {
  return authorizationUrl((authkit) =>
    authkit.createSignUp(undefined, applyContextRedirectUri(toAuthOptions(data) ?? {})),
  );
}

export type SwitchToOrganizationPlan = { kind: 'redirect'; to: string } | { kind: 'user'; user: UserInfo };

export async function switchToOrganizationBody(data: {
  organizationId: string;
  returnTo?: string;
}): Promise<SwitchToOrganizationPlan> {
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
    user: { ...mapAuthToBaseInfo(result), accessToken: result.accessToken },
  };
}
