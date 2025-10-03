# AuthKit TanStack Start

Authentication and session management for TanStack Start applications using WorkOS AuthKit.

> [!NOTE]
> This library is designed for TanStack Start v1.0+. TanStack Start is currently in beta - expect some API changes as the framework evolves.

## Installation

```bash
npm install @workos/authkit-tanstack-start
```

```bash
pnpm add @workos/authkit-tanstack-start
```

## Quickstart

### Environment Variables

Create a `.env` file in your project root with the following required variables:

```bash
WORKOS_CLIENT_ID="client_..."      # Get from WorkOS dashboard
WORKOS_API_KEY="sk_test_..."       # Get from WorkOS dashboard
WORKOS_REDIRECT_URI="http://localhost:3000/api/auth/callback"
WORKOS_COOKIE_PASSWORD="..."       # Min 32 characters
```

Generate a secure cookie password (32+ characters):

```bash
openssl rand -base64 24
```

#### Optional Configuration

| Variable                 | Default               | Description                                  |
| ------------------------ | --------------------- | -------------------------------------------- |
| `WORKOS_COOKIE_MAX_AGE`  | `34560000` (400 days) | Cookie lifetime in seconds                   |
| `WORKOS_COOKIE_NAME`     | `wos-session`         | Session cookie name                          |
| `WORKOS_COOKIE_DOMAIN`   | None                  | Cookie domain (for multi-domain sessions)    |
| `WORKOS_COOKIE_SAMESITE` | `lax`                 | SameSite attribute (`lax`, `strict`, `none`) |
| `WORKOS_API_HOSTNAME`    | `api.workos.com`      | WorkOS API hostname                          |

### Setup (3 Steps)

#### 1. Configure Middleware

Create or update `src/start.ts`:

```typescript
import { createStart } from '@tanstack/react-start';
import { authkitMiddleware } from '@workos/authkit-tanstack-start';

export const startInstance = createStart(() => ({
  requestMiddleware: [authkitMiddleware()],
}));
```

#### 2. Create Callback Route

Create `src/routes/api/auth/callback.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { handleCallbackRoute } from '@workos/authkit-tanstack-start';

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: handleCallbackRoute,
    },
  },
});
```

Make sure this matches your `WORKOS_REDIRECT_URI` environment variable.

#### 3. Add Provider (Optional - only needed for client hooks)

If you want to use `useAuth()` or other client hooks, wrap your app with `AuthKitProvider` in `src/routes/__root.tsx`:

```typescript
import { AuthKitProvider } from '@workos/authkit-tanstack-start/client';
import { Outlet, createRootRoute } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthKitProvider>
      <Outlet />
    </AuthKitProvider>
  );
}
```

If you're only using server-side authentication (`getAuth()` in loaders), you can skip this step.

### WorkOS Dashboard Configuration

1. Go to [WorkOS Dashboard](https://dashboard.workos.com)
2. Navigate to **Redirects** and add your callback URL: `http://localhost:3000/api/auth/callback`
3. (Optional) Set a default **Logout URI** under Redirects for sign-out redirects

## Usage

### Server-Side Authentication

Use `getAuth()` in route loaders or server functions to access the current session:

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth, getSignInUrl } from '@workos/authkit-tanstack-start';

export const Route = createFileRoute('/dashboard')({
  loader: async () => {
    const { user } = await getAuth();

    if (!user) {
      const signInUrl = await getSignInUrl();
      throw redirect({ href: signInUrl });
    }

    return { user };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useLoaderData();
  return <div>Welcome, {user.firstName}!</div>;
}
```

### Client-Side Hooks

For client components that need reactive auth state, use the `useAuth()` hook:

```typescript
'use client'; // Not actually needed in TanStack Start, but shows intent

import { useAuth } from '@workos/authkit-tanstack-start/client';

function ProfileButton() {
  const { user, loading, signOut } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) return <a href="/signin">Sign In</a>;

  return (
    <div>
      <span>{user.email}</span>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

### Signing Out

**Server-side (in route loader):**

```typescript
import { signOut } from '@workos/authkit-tanstack-start';

export const Route = createFileRoute('/logout')({
  loader: async () => {
    await signOut(); // Redirects to WorkOS logout, then back to '/'
  },
});
```

**Client-side (from useAuth hook):**

```typescript
const { signOut } = useAuth();

await signOut({ returnTo: '/goodbye' });
```

### Organization Switching

Switch the active organization for multi-org users:

**Server-side:**

```typescript
import { switchToOrganization } from '@workos/authkit-tanstack-start';

// In a server function or loader
const auth = await switchToOrganization({
  data: { organizationId: 'org_456' },
});

// Session now has org_456's role, permissions, etc.
```

**Client-side:**

```typescript
const { switchToOrganization, organizationId } = useAuth();

await switchToOrganization('org_456');
// Auth state updates automatically
```

### Protected Routes

Use layout routes to protect multiple pages:

```typescript
// src/routes/_authenticated.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth, getSignInUrl } from '@workos/authkit-tanstack-start';

export const Route = createFileRoute('/_authenticated')({
  loader: async ({ location }) => {
    const { user } = await getAuth();

    if (!user) {
      const signInUrl = await getSignInUrl({
        data: { returnPathname: location.pathname },
      });
      throw redirect({ href: signInUrl });
    }

    return { user };
  },
});

// Now all routes under _authenticated require auth:
// - _authenticated/dashboard.tsx
// - _authenticated/profile.tsx
// etc.
```

## API Reference

### Server Functions

These functions can be called from route loaders, server functions, or server route handlers.

#### `getAuth()`

Retrieves the current user session.

```typescript
const { user } = await getAuth();

if (user) {
  console.log(user.email);
  console.log(user.firstName);
}
```

**Returns:** `UserInfo | NoUserInfo`

**UserInfo fields:**

- `user` - The authenticated user object
- `sessionId` - WorkOS session ID
- `organizationId` - Active organization (if in org context)
- `role` - User's role in the organization
- `roles` - Array of role strings
- `permissions` - Array of permission strings
- `entitlements` - Array of entitlement strings
- `featureFlags` - Array of feature flag strings
- `impersonator` - Impersonator details (if being impersonated)
- `accessToken` - JWT access token

#### `signOut(options?)`

Signs out the current user and redirects to WorkOS logout.

```typescript
await signOut();
await signOut({ data: { returnTo: '/goodbye' } });
```

**Options:**

- `returnTo` - Path to redirect to after logout (default: `/`)

#### `switchToOrganization(options)`

Switches to a different organization and refreshes the session with new claims.

```typescript
const auth = await switchToOrganization({
  data: {
    organizationId: 'org_123',
    returnTo: '/dashboard', // optional
  },
});
```

**Options:**

- `organizationId` - The organization ID to switch to (required)
- `returnTo` - Path to redirect to if auth fails

**Returns:** `UserInfo` with updated organization claims

#### `getSignInUrl(options?)`

Generates a sign-in URL for redirecting to AuthKit.

```typescript
// Basic usage
const url = await getSignInUrl();

// With return path
const url = await getSignInUrl({
  data: { returnPathname: '/dashboard' },
});
```

**Options:**

- `returnPathname` - Path to return to after sign-in

#### `getSignUpUrl(options?)`

Generates a sign-up URL for redirecting to AuthKit.

```typescript
const url = await getSignUpUrl();
const url = await getSignUpUrl({
  data: { returnPathname: '/onboarding' },
});
```

**Options:**

- `returnPathname` - Path to return to after sign-up

#### `getAuthorizationUrl(options)`

Advanced: Generate a custom authorization URL with full control.

```typescript
const url = await getAuthorizationUrl({
  data: {
    screenHint: 'sign-in',
    returnPathname: '/dashboard',
    redirectUri: 'https://example.com/callback', // override default
  },
});
```

**Options:**

- `screenHint` - `'sign-in'` or `'sign-up'`
- `returnPathname` - Return path after authentication
- `redirectUri` - Override the default redirect URI

### Route Handlers

#### `handleCallbackRoute`

Handles the OAuth callback from WorkOS. Use this in your callback route.

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { handleCallbackRoute } from '@workos/authkit-tanstack-start';

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: handleCallbackRoute,
    },
  },
});
```

### Client Hooks

Available from `@workos/authkit-tanstack-start/client`. Requires `<AuthKitProvider>` wrapper.

#### `useAuth(options?)`

Access authentication state and methods in client components.

```typescript
import { useAuth } from '@workos/authkit-tanstack-start/client';

function MyComponent() {
  const { user, loading, signOut } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not signed in</div>;

  return (
    <div>
      <p>{user.email}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

**Options:**

- `ensureSignedIn?: boolean` - If true, automatically triggers sign-in flow for unauthenticated users

**Returns:** `AuthContextType` with:

- `user` - Current user or null
- `loading` - Loading state
- `sessionId`, `organizationId`, `role`, `roles`, `permissions`, `entitlements`, `featureFlags`, `impersonator`
- `getAuth()` - Refresh auth state
- `refreshAuth(options)` - Refresh session with optional org switch
- `signOut(options)` - Sign out
- `switchToOrganization(orgId)` - Switch organizations

#### `useAccessToken()`

Manage access tokens with automatic refresh.

```typescript
import { useAccessToken } from '@workos/authkit-tanstack-start/client';

function ApiCaller() {
  const { accessToken, loading, getAccessToken } = useAccessToken();

  const callApi = async () => {
    const token = await getAccessToken(); // Always fresh

    const response = await fetch('/api/data', {
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  return <button onClick={callApi}>Fetch Data</button>;
}
```

**Returns:**

- `accessToken` - Current token (may be stale)
- `loading` - Loading state
- `error` - Last error or null
- `refresh()` - Manually refresh token
- `getAccessToken()` - Get guaranteed fresh token

#### `useTokenClaims()`

Parse and decode JWT claims from the access token.

```typescript
import { useTokenClaims } from '@workos/authkit-tanstack-start/client';

function ClaimsDisplay() {
  const claims = useTokenClaims();

  if (!claims) return null;

  return (
    <div>
      <p>Session ID: {claims.sid}</p>
      <p>Organization: {claims.org_id}</p>
      <p>Role: {claims.role}</p>
    </div>
  );
}
```

### Middleware

#### `authkitMiddleware()`

Processes authentication on every request. Validates tokens, refreshes sessions, and provides auth context to server functions.

Already shown in setup, but can be imported separately if needed.

## TypeScript

This library is fully typed. Common types:

```typescript
import type {
  User,
  Session,
  UserInfo,
  NoUserInfo,
  Impersonator
} from '@workos/authkit-tanstack-start';

// User object from WorkOS
const user: User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
  profilePictureUrl: string | null;
  // ... more fields
};

// Auth result from getAuth()
const auth: UserInfo | NoUserInfo = await getAuth();
```

Route loaders get full type inference:

```typescript
export const Route = createFileRoute('/profile')({
  loader: async () => {
    const { user } = await getAuth();
    return { user }; // Fully typed
  },
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useLoaderData(); // user is typed!
}
```

## How It Works

### Server-Side Flow

1. **Middleware runs on every request** - validates/refreshes session, stores auth in context
2. **Route loaders call `getAuth()`** - retrieves auth from middleware context
3. **No client bundle bloat** - server functions create RPC boundaries automatically

### Client-Side Flow (with Provider)

1. **Provider wraps app** - provides auth context to hooks
2. **Hooks call server actions** - fetch auth state via RPC
3. **State updates automatically** - on tab focus, refresh, org switch

### Why the Provider is Optional

- **Server-only apps**: Just use `getAuth()` in loaders - no provider needed
- **Client hooks needed**: Add provider to use `useAuth()`, `useAccessToken()`, etc.
- **Flexibility**: Start server-only, add client hooks later

## Common Patterns

### Sign In Flow

```typescript
// Get sign-in URL in loader
export const Route = createFileRoute('/')({
  loader: async () => {
    const { user } = await getAuth();
    const signInUrl = await getSignInUrl();
    return { user, signInUrl };
  },
  component: HomePage,
});

function HomePage() {
  const { user, signInUrl } = Route.useLoaderData();

  if (!user) {
    return <a href={signInUrl}>Sign In with AuthKit</a>;
  }

  return <div>Welcome, {user.firstName}!</div>;
}
```

### Protected Route Layout

```typescript
// src/routes/_authenticated.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAuth, getSignInUrl } from '@workos/authkit-tanstack-start';

export const Route = createFileRoute('/_authenticated')({
  loader: async ({ location }) => {
    const { user } = await getAuth();

    if (!user) {
      const signInUrl = await getSignInUrl({
        data: { returnPathname: location.pathname },
      });
      throw redirect({ href: signInUrl });
    }

    return { user };
  },
});

// All child routes require authentication:
// - _authenticated/dashboard.tsx
// - _authenticated/settings.tsx
```

### Organization Switcher

```typescript
import { useAuth } from '@workos/authkit-tanstack-start/client';

function OrgSwitcher() {
  const { organizationId, switchToOrganization } = useAuth();

  return (
    <select
      value={organizationId || ''}
      onChange={(e) => switchToOrganization(e.target.value)}
    >
      <option value="org_123">Acme Corp</option>
      <option value="org_456">Other Company</option>
    </select>
  );
}
```

### Accessing User in Multiple Places

**Loader (server-side):**

```typescript
loader: async () => {
  const { user, organizationId, role } = await getAuth();
  return { user, organizationId, role };
};
```

**Component (from loader data):**

```typescript
function MyPage() {
  const { user } = Route.useLoaderData();
  // ...
}
```

**Client hook (reactive):**

```typescript
function MyClientComponent() {
  const { user, loading } = useAuth();
  // Updates on session changes
}
```

## Troubleshooting

### "AuthKit middleware is not configured"

You forgot to add `authkitMiddleware()` to `src/start.ts`. See step 1 in setup.

### "useAuth must be used within an AuthKitProvider"

You're calling `useAuth()` but haven't wrapped your app with `<AuthKitProvider>`. See step 3 in setup.

If you don't need client hooks, use `getAuth()` in loaders instead.

### Environment variable errors on startup

The middleware validates configuration on first request. If you see errors about missing variables:

1. Check your `.env` file exists
2. Verify all required variables are set
3. Ensure `WORKOS_COOKIE_PASSWORD` is 32+ characters
4. Restart your dev server after changing env vars

### Types not working / Import errors

Make sure you're importing from the right path:

```typescript
// Server functions
import { getAuth, signOut } from '@workos/authkit-tanstack-start';

// Client hooks
import { useAuth } from '@workos/authkit-tanstack-start/client';
```

Don't import client hooks in server code or vice versa.

### "can only be called on the server"

You're trying to call a server function from a `beforeLoad` hook or client component.

**Wrong:**

```typescript
beforeLoad: async () => {
  const { user } = await getAuth(); // ❌ Runs on client during hydration
};
```

**Right:**

```typescript
loader: async () => {
  const { user } = await getAuth(); // ✅ Server-only during SSR
};
```

Use `useAuth()` client hook for client components, or move logic to a loader.

## Example Application

Check the `/example` directory for a complete working application demonstrating:

- Server-side authentication in loaders
- Client-side hooks with provider
- Protected routes
- Organization switching
- Sign in/out flows
- Access token management

Run it locally:

```bash
cd example
pnpm install
pnpm dev
```

## Framework Compatibility

- **TanStack Start:** v1.132.0+
- **TanStack Router:** v1.132.0+
- **React:** 18.0+
- **Node.js:** 18+

## Related

- [WorkOS AuthKit Documentation](https://workos.com/docs/user-management/authkit)
- [TanStack Start Documentation](https://tanstack.com/start/latest)
- [WorkOS Node SDK](https://github.com/workos/workos-node)

## License

MIT
