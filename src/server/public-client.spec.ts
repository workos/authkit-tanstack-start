/**
 * Public-client (keyless) mode as surfaced by this package.
 *
 * `@workos/authkit-session` owns config validation and the PKCE flows, and is
 * mocked here. These tests check that this package's own layer (config
 * passthrough, middleware, sign-in URL server function) needs no API key and
 * never asks for one. The real keyless flow is exercised against the real
 * authkit-session in the example app.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { session, state } = vi.hoisted(() => {
  const state: { config: Record<string, unknown>; ctx: unknown } = { config: {}, ctx: undefined };
  const service = {
    withAuth: vi.fn(),
    saveSession: vi.fn(),
    createSignIn: vi.fn(),
    clearPendingVerifierByName: vi.fn(),
  };
  return {
    state,
    session: {
      service,
      createAuthService: vi.fn(() => service),
      validateConfig: vi.fn(),
      getConfig: vi.fn((key: string) => state.config[key]),
    },
  };
});

vi.mock('@workos/authkit-session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@workos/authkit-session')>()),
  createAuthService: session.createAuthService,
  validateConfig: session.validateConfig,
  getConfig: session.getConfig,
}));

vi.mock('@tanstack/react-start', () => ({
  getGlobalStartContext: () => state.ctx,
  createServerFn: () => {
    const passthrough = (handler: Function) => (opts?: { data?: unknown }) => handler(opts ?? {});
    return { validator: () => ({ handler: passthrough }), handler: passthrough };
  },
}));

const API_KEY = 'sk_test_confidential';
const baseConfig = {
  clientId: 'client_123',
  redirectUri: 'http://localhost:3000/api/auth/callback',
  cookiePassword: 'a'.repeat(32),
};
const AUTHORIZATION_URL =
  'https://api.workos.com/user_management/authorize?client_id=client_123&code_challenge=abc&code_challenge_method=S256';
const VERIFIER_COOKIE = 'wos-auth-verifier-1=sealed; Path=/; HttpOnly; SameSite=Lax; Max-Age=600';

describe.each([
  ['public client (no API key)', undefined],
  ['confidential client (API key)', API_KEY],
] as const)('%s', (_label, apiKey) => {
  beforeEach(() => {
    vi.resetModules(); // middleware-body caches its one-time config validation
    vi.clearAllMocks();
    state.ctx = undefined;
    state.config = apiKey ? { ...baseConfig, apiKey } : { ...baseConfig };
    session.validateConfig.mockReturnValue(undefined);
    session.service.withAuth.mockResolvedValue({ auth: { user: null }, refreshedSessionData: undefined });
    session.service.createSignIn.mockResolvedValue({
      url: AUTHORIZATION_URL,
      cookieName: 'wos-auth-verifier-1',
      headers: { 'Set-Cookie': VERIFIER_COOKIE },
    });
    session.service.saveSession.mockResolvedValue({
      response: new Response(null, { headers: { 'Set-Cookie': 'wos-session=refreshed; Path=/' } }),
    });
  });

  describe('config', () => {
    it('validates through authkit-session without adding a key check', async () => {
      const { validateConfig, getConfig } = await import('./authkit-loader');

      await expect(validateConfig()).resolves.toBeUndefined();
      expect(session.validateConfig).toHaveBeenCalledTimes(1);
      await expect(getConfig('apiKey')).resolves.toBe(apiKey);
    });

    it("propagates authkit-session's validation error unchanged", async () => {
      const error = new Error('AuthKit configuration error. Missing or invalid environment variables: ...');
      session.validateConfig.mockImplementation(() => {
        throw error;
      });
      const { validateConfig } = await import('./authkit-loader');

      await expect(validateConfig()).rejects.toBe(error);
    });
  });

  describe('middleware and sign-in', () => {
    async function runMiddleware(next: () => Promise<Response>) {
      const { middlewareBody } = await import('./middleware-body');
      return middlewareBody({
        request: new Request('http://localhost:3000/'),
        next: async ({ context }: { context: unknown }) => {
          state.ctx = context; // what TanStack exposes to server functions
          return { response: await next() };
        },
      });
    }

    it('starts a PKCE sign-in and forwards the verifier cookie', async () => {
      const { getSignInUrl } = await import('./server-functions');

      const result = await runMiddleware(async () => new Response(await getSignInUrl({ data: '/dashboard' })));

      expect(session.validateConfig).toHaveBeenCalledTimes(1);
      expect(session.service.createSignIn).toHaveBeenCalledWith(undefined, {
        returnPathname: '/dashboard',
        redirectUri: baseConfig.redirectUri,
      });
      expect(await result.response.text()).toBe(AUTHORIZATION_URL);
      expect(result.response.headers.get('Set-Cookie')).toBe(VERIFIER_COOKIE);
      expect(session.getConfig).not.toHaveBeenCalledWith('apiKey');
    });

    it('saves a session refreshed by withAuth', async () => {
      session.service.withAuth.mockResolvedValue({
        auth: { user: { id: 'user_123' } },
        refreshedSessionData: 'sealed-refreshed-session',
      });

      const result = await runMiddleware(async () => new Response('ok'));

      expect(session.service.saveSession).toHaveBeenCalledWith(undefined, 'sealed-refreshed-session');
      expect(result.response.headers.get('Set-Cookie')).toBe('wos-session=refreshed; Path=/');
      expect(session.getConfig).not.toHaveBeenCalledWith('apiKey');
    });
  });
});
