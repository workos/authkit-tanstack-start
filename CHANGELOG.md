# Changelog

## [0.7.0](https://github.com/workos/authkit-tanstack-start/compare/v0.6.0...v0.7.0) (2026-04-24)


### ⚠ BREAKING CHANGES

* **pkce:** each OAuth flow now requires a per-flow verifier cookie set at sign-in time, bound to the URL `state` parameter. Flows that reach the callback without first passing through this adapter's sign-in route fail with PKCECookieMissingError (500).

### Features

* **pkce:** per-flow PKCE verifier cookies ([7716182](https://github.com/workos/authkit-tanstack-start/commit/771618240e57817ed295f8aa295ca549b06c32aa))


### Bug Fixes

* use WORKOS_REDIRECT_URI from env when option not provided ([#52](https://github.com/workos/authkit-tanstack-start/issues/52)) ([d249d00](https://github.com/workos/authkit-tanstack-start/commit/d249d0051426c29e19ec7dc89c8b7eb50afabdc0)), closes [#51](https://github.com/workos/authkit-tanstack-start/issues/51)

## [0.6.0](https://github.com/workos/authkit-tanstack-start/compare/v0.5.0...v0.6.0) (2026-04-09)


### Features

* add Impersonation component ([#54](https://github.com/workos/authkit-tanstack-start/issues/54)) ([c6a48b8](https://github.com/workos/authkit-tanstack-start/commit/c6a48b837486352a71254b891f9174294195560b))


### Bug Fixes

* **session:** use auth context refresh token instead of stale request cookie ([#55](https://github.com/workos/authkit-tanstack-start/issues/55)) ([b2f0397](https://github.com/workos/authkit-tanstack-start/commit/b2f0397e15966c43a602770e2bdbc4dfe19ebe71)), closes [#53](https://github.com/workos/authkit-tanstack-start/issues/53)
