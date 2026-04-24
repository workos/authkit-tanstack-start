# Migration Guide

See [CHANGELOG.md](./CHANGELOG.md) for the full per-release summary.

## 0.6.0 → 0.7.0

First release with PKCE state binding via `@workos/authkit-session@0.5.1`. The
callback now requires a short-lived verifier cookie that is set during sign-in
initiation. No public API changed — but the **Sign-in endpoint** in the WorkOS
dashboard becomes load-bearing.

### No public API changes

`handleCallbackRoute`, `authkitMiddleware`, `authkitLoader`, `createSignIn`,
`createSignUp`, and the session helpers keep their existing signatures.
Consumer code does not need to change.

### Required: set the Sign-in endpoint in the WorkOS dashboard

Because the callback now requires a per-flow verifier cookie, any flow that
reaches the callback URL _without_ first going through your sign-in route will
fail with `PKCECookieMissingError` and return 500.

In the [WorkOS dashboard Redirects page](https://dashboard.workos.com/redirects),
set the **Sign-in endpoint** (`initiate_login_uri`) to the URL where you call
`createSignIn()` — e.g. `https://your-app.example/api/auth/sign-in`.

This is the URL WorkOS redirects to for flows it initiates itself:

- Dashboard **impersonation**
- Some SSO scenarios (IdP-initiated)
- Session expiry requiring reauthentication
- `prompt=login`

Without it set, those flows land on your callback without a verifier cookie
and fail. See the README's [setup instructions](README.md#3-create-sign-in-endpoint)
for the full route pattern.

> If you already configured the Sign-in endpoint for a previous release, no
> action is needed — the field is unchanged.

### New cookie on the wire

Each sign-in sets a cookie named `wos-auth-verifier-<hash>`, where `<hash>` is
an 8-character FNV-1a hex suffix derived from the OAuth `state`. One cookie
per concurrent flow, so multi-tab sign-ins no longer clobber each other.

Attributes:

- `HttpOnly`
- `SameSite=Lax` by default; `SameSite=None; Secure` when `cookieSameSite` is
  configured as `'none'` (iframe / embed flows)
- `Secure` — inferred from the redirect URI's protocol; fail-closed to `true`
- `Max-Age=600` (10 minutes)
- `Path=/`
- `Domain` — set only if `cookieDomain` is configured

If an edge proxy, WAF, CDN, or cookie policy filters by name, allow the
`wos-auth-verifier-` prefix.

### Rolling-deploy caveat

During an upgrade from 0.6.0 to 0.7.0, OAuth flows that **start on an old pod**
(no verifier cookie) **and complete on a new pod** (verifier cookie required)
will fail once with 500 and need a retry.

Exposure is narrow: a user is only affected if they click sign-in on the old
pod and land back on the callback against the new pod. That window is the time
they spend on the WorkOS sign-in page — typically 10–60 seconds.

Two mitigations:

- Drain traffic before the deploy.
- Accept the retry cost. Users retry and succeed on the new pod.

A legacy-cookie-name fallback is not useful: 0.6.0 (on `authkit-session@0.3.4`)
sets no verifier cookie at all, so there is nothing to fall back to.

### Dependency change

`@workos/authkit-session` bumps from `0.3.4` to `0.5.1`. The interim `0.4.0`
was never shipped in this adapter. The upstream migration guide covers the
underlying API and cookie-naming changes:
<https://github.com/workos/authkit-session/blob/main/MIGRATION.md>.
