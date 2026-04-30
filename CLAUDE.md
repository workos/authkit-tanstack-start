# CLAUDE.md

Guidance for Claude Code working in this repository.

## CRITICAL: File Organization and Import Boundaries

**DO NOT reorganize server-side code that works.** File structure matters for bundling.

### Lessons Learned

**Broken commits:**

- `5bd4367` — Reorganized `src/server/` → `src/auth/`, `src/core/`, `src/middleware/`
- `8058974` — Added `'use server'` directives

**Why it broke:**

1. Moving files changed import paths.
2. TanStack Start's bundler includes all imported modules at evaluation time.
3. When `authkit` was imported (even transitively), it immediately evaluated `@workos/authkit-session` and `iron-session`.
4. Server deps leaked into the client bundle → runtime errors.

**Why the original `src/server/` structure works:**

- Clear boundaries for the bundler to tree-shake on.
- The directory convention signals server-only intent to Vite.

**About `'use server'`:**

- NOT documented in TanStack Start.
- But works in practice when files are in `src/server/` (Vite bundler picks it up).
- Removing it causes crypto / iron-session to leak into client bundles.

**Lesson:** leave `src/server/` alone.

## CRITICAL: Lazy handler bodies (`actions.ts`, `server-functions.ts`)

`src/server/actions.ts` and `src/server/server-functions.ts` are reachable from `src/client/**` via type-only / RPC edges. Static value imports of server-only modules from these two files re-open the issue [#72](https://github.com/workos/authkit-tanstack-start/issues/72) class of leaks (e.g. `eventemitter3` SyntaxError in Vite dev once `@workos-inc/node` ships an awkward CJS dep).

**The pattern.** Each `createServerFn(...).handler(...)` body MUST be a thin shell that dynamically imports its real logic from the sibling bodies file:

```ts
// src/server/actions.ts
export const getAuthAction = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ClientUserInfo | NoUserInfo> => {
    const { getAuthBody } = await import('./action-bodies.js');
    return getAuthBody();
  },
);
```

The actual logic lives in `src/server/action-bodies.ts` / `src/server/server-fn-bodies.ts`, which CAN statically import server-only modules.

**Why it works.** TanStack Start's compiler (`/\.[cm]?[tj]sx?($|\?)/`, no `node_modules` exclusion) transforms our installed `dist/server/*.js` in the consumer's client bundle, replacing each `.handler(fn)` with `createClientRpc(id)`. The shell's dynamic import then has no value reference in the client graph and is dead-code-eliminated. The bodies file is never reached from the client.

**Load-bearing assumption.** The TanStack compiler must keep transforming our installed dist. If a future Vite or TanStack release excludes `node_modules` from the transform pipeline, this approach degrades silently — the leak fires the first time client middleware invokes a handler. Re-verify by inspecting the served module after upgrades:

```bash
cd example && pnpm dev
# In another terminal:
curl -s 'http://localhost:3000/@fs/<absolute>/dist/server/actions.js' | grep -c 'createClientRpc'
# Expect non-zero. If zero, the compiler is no longer transforming the SDK's dist —
# stop and pivot to HTTP-RPC.
```

**Regression guard.** `.oxlintrc.json` configures `no-restricted-imports` (with `allowTypeImports: true`) on these two files, blocking static value imports of `./auth-helpers*`, `./authkit-loader*`, `./context*`, `./headers-bag*`, `./action-bodies*`, `./server-fn-bodies*`, `@workos/authkit-session`, and `@workos-inc/node`. Do NOT bypass the rule. If you need a new server module, add it to the bodies file and dynamic-import from the shell.

**Bundle check.** `pnpm run build:check` runs `scripts/check-bundle-leak.sh` against the example's built client bundle, looking for fingerprints (`@workos-inc/node`, `iron-session`, `iron-webcrypto`, `FeatureFlagsRuntimeClient`, `The listener must be a function`, `ERR_JWT_CLAIM_VALIDATION_FAILED`). Run after any change touching the `actions.ts` / `server-functions.ts` boundary or after upgrading `@workos/authkit-session`.

## CRITICAL: Server Function Execution Context

`createServerFn` creates automatic RPC boundaries — no directive needed.

Server functions can ONLY be called from server contexts:

| Context                 | Runs On                   | Can call server functions?  |
| ----------------------- | ------------------------- | --------------------------- |
| `loader`                | Server (SSR), then cached | Yes                         |
| `beforeLoad`            | Server AND client         | No                          |
| Server function handler | Server only               | Yes                         |
| Component render        | Server AND client         | No (use `useServerFn` hook) |
| Route server handlers   | Server only               | Yes                         |

### Correct: call from loader

```typescript
export const Route = createRootRoute({
  loader: async () => {
    const { user } = await getAuth();
    const url = await getSignInUrl({});
    return { user, url };
  },
});
```

### Wrong: call from beforeLoad

```typescript
export const Route = createRootRoute({
  beforeLoad: async () => {
    // beforeLoad runs on BOTH server and client (during hydration).
    const { user } = await getAuth(); // Throws: "can only be called on the server"
  },
});
```

## Project Overview

First-class SDK for WorkOS AuthKit + TanStack Start. Cookie-based session management using standard Web API Request/Response.

- **Reference example:** https://github.com/tanstack/router/tree/main/examples/react/start-workos
- **Built on:** `@workos/authkit-session` (sibling workspace at `../authkit-session`)
- **Reference SDK:** `@workos-inc/authkit-nextjs` (sibling workspace at `../authkit-nextjs`)

## Development Commands

```bash
pnpm install
pnpm dev       # port 3000
pnpm build     # includes typecheck
pnpm start     # production
```

## Architecture

Key files in `src/server/`:

- `storage.ts` — `ImperativeSessionStorage` adapter wrapping `@workos/authkit-session`
- `authkit-loader.ts` — creates the `AuthService` instance
- `server-functions.ts` — `createServerFn`-wrapped functions (safe cross-boundary: compiler rewrites to RPC on client)
- `actions.ts` — `createServerFn`-wrapped actions used by provider
- `middleware.ts` — TanStack middleware for auth
- `auth-helpers.ts` — server context helpers
- `context.ts` — `getGlobalStartContext` wrapper

Client-side:

- `src/client/AuthKitProvider.tsx`, `src/client/tokenStore.ts` — import from `server/actions.ts` (safe; rewritten to RPC)

Example app callback handler: `example/src/routes/api/auth/callback.tsx`.

Session encryption: iron-session (sealed cookies). JWT verification: jose (JWKS).

### Key Dependencies

- `@workos-inc/node` — WorkOS SDK
- `@workos/authkit-session` — framework-agnostic session primitives
- `@tanstack/react-start` — full-stack framework
- `iron-session` — sealed cookie encryption
- `jose` — JWT + JWKS

## Environment Configuration

```env
WORKOS_CLIENT_ID=<your_client_id>
WORKOS_API_KEY=<your_api_key>
WORKOS_REDIRECT_URI=http://localhost:3000/callback
WORKOS_COOKIE_PASSWORD=<min_32_chars>
```

## TypeScript Configuration

- Module resolution: Bundler
- Target: ES2022
- `strictNullChecks` + `noUncheckedIndexedAccess` enabled
- JSX: react-jsx

## Documentation Resources

- TanStack Start: https://tanstack.com/start/latest
- Context7: `/tanstack/start` or `/tanstack/router`
- TanStack Start is still in beta — APIs change often. Check latest docs on type errors.

## Do / Don't

**Do:**

- Keep server-only code in `src/server/` — the directory convention matters
- Call server functions from route `loader`, not `beforeLoad`
- Follow patterns in `src/server/server-functions.ts` for new server functions
- Check `src/server/storage.ts` for the storage adapter pattern
- Verify client bundle after changes to `@workos/authkit-session` — run `cd example && pnpm build` and watch for `node:crypto` / other Node-only externalization warnings

**Don't:**

- Reorganize `src/server/` — see "Lessons Learned" (commits `5bd4367`, `8058974`)
- Add `'use server'` directives outside `src/server/` — undocumented in TanStack Start
- Call server functions from `beforeLoad` — runs on both server and client

## PR Checklist

- [ ] `pnpm build` passes (includes typecheck)
- [ ] `cd example && pnpm build` passes — no Node-only module warnings in the client chunk
- [ ] Server functions called from `loader`, not `beforeLoad`

## Not Currently Enforced

Older versions of this doc described TanStack Start's **Import Protection** plugin with `server-only` markers and an `example/vite.config.ts` deny list. None of that is currently active:

- No `import '@tanstack/react-start/server-only'` markers exist in `src/` or in `@workos/authkit-session/dist/`.
- `example/vite.config.ts` uses `tanstackStart()` with default options — no `importProtection` config.

The only defense today is:

1. The `src/server/` directory convention (relies on developer discipline).
2. Rollup's browser-externalization errors at build time (catches Node-only imports, but only after they reach the client graph — and only for modules with specific externalization errors like `node:crypto`'s `timingSafeEqual`).

If you want real build-time enforcement, options are:

1. Add `server-only` markers to pure-server files in `src/server/` and consume them via explicit subpath imports.
2. Add `specifiers: ['@workos/authkit-session', 'iron-session']` to `importProtection.client` in `example/vite.config.ts`.
3. Split the SDK barrel so server-only exports come from a subpath (e.g. `@workos/authkit-session/server`) rather than the main entry.

None of these are blocking; they're hardening work.
