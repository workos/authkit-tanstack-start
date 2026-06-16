# Changelog

## [0.9.1](https://github.com/workos/authkit-tanstack-start/compare/v0.9.0...v0.9.1) (2026-06-16)


### Bug Fixes

* evict stale PKCE verifier cookies to prevent HTTP 431 ([#76](https://github.com/workos/authkit-tanstack-start/issues/76)) ([#104](https://github.com/workos/authkit-tanstack-start/issues/104)) ([1c77259](https://github.com/workos/authkit-tanstack-start/commit/1c7725926085d70514ec29e27eb48c51fcb22f2d))
* lazy-import @workos/authkit-session in authkit-loader ([#93](https://github.com/workos/authkit-tanstack-start/issues/93)) ([c66a2bc](https://github.com/workos/authkit-tanstack-start/commit/c66a2bcdf3e071178e7d62efbae1644de9c8b4bb))

## [0.9.0](https://github.com/workos/authkit-tanstack-start/compare/v0.8.6...v0.9.0) (2026-06-15)


### ⚠ BREAKING CHANGES

* requires @tanstack/react-start >=1.168.25, where createServerFn().validator() exists. Consumers on older TanStack Start versions must upgrade.

### Bug Fixes

* use createServerFn().validator() instead of deprecated inputValidator ([#101](https://github.com/workos/authkit-tanstack-start/issues/101)) ([f74fb28](https://github.com/workos/authkit-tanstack-start/commit/f74fb283ed754793d2bb1f45683b87e93c9bcef1))

## [0.8.6](https://github.com/workos/authkit-tanstack-start/compare/v0.8.5...v0.8.6) (2026-06-11)


### Bug Fixes

* export getAuthKitContext as the public auth context accessor ([#98](https://github.com/workos/authkit-tanstack-start/issues/98)) ([ab38565](https://github.com/workos/authkit-tanstack-start/commit/ab3856527b5f916da985aaf3e8a7f2d485b703eb))

## [0.8.5](https://github.com/workos/authkit-tanstack-start/compare/v0.8.4...v0.8.5) (2026-06-04)


### Bug Fixes

* update to authkit-session@0.5.3 ([#96](https://github.com/workos/authkit-tanstack-start/issues/96)) ([d8acfc0](https://github.com/workos/authkit-tanstack-start/commit/d8acfc097698f1cc8ce787b75c5bd7c19095676c))

## [0.8.4](https://github.com/workos/authkit-tanstack-start/compare/v0.8.3...v0.8.4) (2026-06-02)


### Bug Fixes

* **client:** remove useNavigate from AuthKitProvider to avoid SSR warning ([#59](https://github.com/workos/authkit-tanstack-start/issues/59)) ([85a288e](https://github.com/workos/authkit-tanstack-start/commit/85a288ea631925b8d67d14a9ddfd384d913dd83e)), closes [#57](https://github.com/workos/authkit-tanstack-start/issues/57)

## [0.8.3](https://github.com/workos/authkit-tanstack-start/compare/v0.8.2...v0.8.3) (2026-05-15)


### Bug Fixes

* eliminate middleware bundle leak via lazy dynamic import ([#85](https://github.com/workos/authkit-tanstack-start/issues/85)) ([b9a9592](https://github.com/workos/authkit-tanstack-start/commit/b9a95926d20d486b6db3dda2d64a9ea4d8b22660))

## [0.8.2](https://github.com/workos/authkit-tanstack-start/compare/v0.8.1...v0.8.2) (2026-05-08)


### Bug Fixes

* align scheduled refresh buffer with isExpiring buffer ([#80](https://github.com/workos/authkit-tanstack-start/issues/80)) ([de3ea6e](https://github.com/workos/authkit-tanstack-start/commit/de3ea6e6c4430f58196a2382ebbf733c99630ca5))

## [0.8.1](https://github.com/workos/authkit-tanstack-start/compare/v0.8.0...v0.8.1) (2026-05-04)


### Bug Fixes

* add explicit types to implicit any params in server spec ([#78](https://github.com/workos/authkit-tanstack-start/issues/78)) ([92526e8](https://github.com/workos/authkit-tanstack-start/commit/92526e8a6ba4bea7e7c6f2ddc3e9b01aad570301))

## [0.8.0](https://github.com/workos/authkit-tanstack-start/compare/v0.7.0...v0.8.0) (2026-05-01)


### Features

* **callback:** centralize logging and add errorRedirectUrl option ([dcc9788](https://github.com/workos/authkit-tanstack-start/commit/dcc97882957fca41178d789e737f6ed987bebaef))


### Bug Fixes

* eliminate server-side bundle leak via lazy handler bodies ([#75](https://github.com/workos/authkit-tanstack-start/issues/75)) ([df41d22](https://github.com/workos/authkit-tanstack-start/commit/df41d221204e255f91838e6d33ee594a10abf8b6))

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
