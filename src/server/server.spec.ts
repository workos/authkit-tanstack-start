import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPKCECookieNameForState } from '@workos/authkit-session';

const SEALED_STATE = 'sealed-state-fixture';
const PKCE_COOKIE_NAME = getPKCECookieNameForState(SEALED_STATE);

const mockHandleCallback = vi.fn();
const mockWithAuth = vi.fn();
const mockCreateSignIn = vi.fn();
type ClearPendingVerifierResult = { response?: Response; headers?: { 'Set-Cookie'?: string | string[] } };
const mockClearPendingVerifier = vi.fn(
  async (
    _response: Response,
    options: { state: string; redirectUri?: string },
  ): Promise<ClearPendingVerifierResult> => {
    const name = getPKCECookieNameForState(options.state);
    return {
      headers: {
        'Set-Cookie': `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      },
    };
  },
);

let mockGetAuthkitImpl: () => Promise<any>;
let mockRedirectUriFromContext: string | undefined;

vi.mock('./authkit-loader', () => ({
  getAuthkit: vi.fn(() => mockGetAuthkitImpl()),
}));

vi.mock('./auth-helpers', () => ({
  getRedirectUriFromContext: vi.fn(() => mockRedirectUriFromContext),
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((options) => {
    throw new Error(`Redirect: ${JSON.stringify(options)}`);
  }),
}));

import { handleCallbackRoute } from './server';

const baseAuthResponse = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  user: { id: 'user_123', email: 'test@example.com' },
};

const successResult = (overrides: Record<string, unknown> = {}) => ({
  response: { headers: new Map() },
  returnPathname: '/',
  state: undefined,
  authResponse: baseAuthResponse,
  ...overrides,
});

describe('handleCallbackRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedirectUriFromContext = undefined;
    mockGetAuthkitImpl = () =>
      Promise.resolve({
        withAuth: mockWithAuth,
        handleCallback: mockHandleCallback,
        createSignIn: mockCreateSignIn,
        clearPendingVerifier: mockClearPendingVerifier,
      });
  });

  describe('missing code', () => {
    it('returns 400 with generic body and state-derived delete-cookie header when state present', async () => {
      const request = new Request(`http://example.com/callback?state=${encodeURIComponent(SEALED_STATE)}`);
      const response = await handleCallbackRoute()({ request });

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.message).toBe('Authentication failed');
      expect(body.error).not.toHaveProperty('details');
      expect(response.headers.getSetCookie()).toEqual([expect.stringContaining(`${PKCE_COOKIE_NAME}=`)]);
    });

    it('calls onError hook when provided', async () => {
      const request = new Request(`http://example.com/callback?state=${encodeURIComponent(SEALED_STATE)}`);
      const onError = vi.fn().mockReturnValue(new Response('Custom error', { status: 403 }));

      const response = await handleCallbackRoute({ onError })({ request });

      expect(onError).toHaveBeenCalledWith({ error: expect.any(Error), request });
      expect(response.status).toBe(403);
      expect(await response.text()).toBe('Custom error');
      expect(response.headers.getSetCookie().some((c) => c.startsWith(`${PKCE_COOKIE_NAME}=`))).toBe(true);
    });
  });

  describe('success path', () => {
    it('returns 307 with Location from result.returnPathname', async () => {
      const request = new Request('http://example.com/callback?code=auth_123');
      mockHandleCallback.mockResolvedValue(successResult({ returnPathname: '/dashboard' }));

      const response = await handleCallbackRoute()({ request });

      expect(response.status).toBe(307);
      expect(response.headers.get('Location')).toBe('http://example.com/dashboard');
    });

    it('honors returnPathname with query params', async () => {
      const request = new Request('http://example.com/callback?code=auth_123');
      mockHandleCallback.mockResolvedValue(successResult({ returnPathname: '/search?q=test&page=2' }));

      const response = await handleCallbackRoute()({ request });

      expect(response.headers.get('Location')).toBe('http://example.com/search?q=test&page=2');
    });

    it('defaults to / when result.returnPathname is empty', async () => {
      const request = new Request('http://example.com/callback?code=auth_123');
      mockHandleCallback.mockResolvedValue(successResult({ returnPathname: undefined }));

      const response = await handleCallbackRoute()({ request });

      expect(response.headers.get('Location')).toBe('http://example.com/');
    });

    it('prefers options.returnPathname when provided', async () => {
      const request = new Request('http://example.com/callback?code=auth_123');
      mockHandleCallback.mockResolvedValue(successResult({ returnPathname: '/dashboard' }));

      const response = await handleCallbackRoute({ returnPathname: '/custom' })({ request });

      expect(response.headers.get('Location')).toBe('http://example.com/custom');
    });

    it('passes code and state to authkit.handleCallback without a cookieValue arg', async () => {
      const sealedValue = 'sealed-abc-123';
      const cookieName = getPKCECookieNameForState('s');
      const request = new Request('http://example.com/callback?code=auth_123&state=s', {
        headers: { cookie: `${cookieName}=${sealedValue}` },
      });
      mockHandleCallback.mockResolvedValue(successResult());

      await handleCallbackRoute()({ request });

      expect(mockHandleCallback).toHaveBeenCalledWith(request, expect.any(Response), { code: 'auth_123', state: 's' });
      const passedOptions = mockHandleCallback.mock.calls[0]![2];
      expect(passedOptions).not.toHaveProperty('cookieValue');
    });

    it('passes state as undefined when absent from the URL', async () => {
      const request = new Request('http://example.com/callback?code=auth_123');
      mockHandleCallback.mockResolvedValue(successResult());

      await handleCallbackRoute()({ request });

      expect(mockHandleCallback).toHaveBeenCalledWith(request, expect.any(Response), {
        code: 'auth_123',
        state: undefined,
      });
    });

    it('appends both the session cookie and the PKCE delete cookie from the library', async () => {
      const request = new Request('http://example.com/callback?code=auth_123');
      mockHandleCallback.mockResolvedValue({
        headers: {
          'Set-Cookie': ['wos-session=abc123', `${PKCE_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`],
        },
        returnPathname: '/',
        state: undefined,
        authResponse: baseAuthResponse,
      });

      const response = await handleCallbackRoute()({ request });

      const setCookies = response.headers.getSetCookie();
      expect(setCookies.some((c) => c.startsWith('wos-session=abc123'))).toBe(true);
      expect(setCookies.some((c) => c.startsWith(`${PKCE_COOKIE_NAME}=`))).toBe(true);
      expect(setCookies).toHaveLength(2);
    });

    it('extracts session headers from plain-object shape', async () => {
      const request = new Request('http://example.com/callback?code=auth_123');
      mockHandleCallback.mockResolvedValue({
        headers: {
          'Set-Cookie': 'session=abc123',
          'X-Custom': 'value',
        },
        returnPathname: '/',
        state: undefined,
        authResponse: baseAuthResponse,
      });

      const response = await handleCallbackRoute()({ request });

      expect(response.headers.get('X-Custom')).toBe('value');
      expect(response.headers.getSetCookie().some((c) => c.startsWith('session=abc123'))).toBe(true);
    });

    it('calls onSuccess with result.state (unsealed customState) and auth data', async () => {
      const request = new Request('http://example.com/callback?code=auth_123&state=encoded');
      mockHandleCallback.mockResolvedValue(
        successResult({
          state: 'user.custom.state',
          authResponse: {
            ...baseAuthResponse,
            impersonator: { email: 'admin@example.com', reason: 'Support' },
            oauthTokens: { provider: 'google', accessToken: 'google_token' },
            authenticationMethod: 'GoogleOAuth',
            organizationId: 'org_123',
          },
        }),
      );

      const onSuccess = vi.fn();
      await handleCallbackRoute({ onSuccess })({ request });

      expect(onSuccess).toHaveBeenCalledWith({
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: baseAuthResponse.user,
        impersonator: { email: 'admin@example.com', reason: 'Support' },
        oauthTokens: { provider: 'google', accessToken: 'google_token' },
        authenticationMethod: 'GoogleOAuth',
        organizationId: 'org_123',
        state: 'user.custom.state',
      });
    });

    it('passes through undefined state when core returns no customState', async () => {
      const request = new Request('http://example.com/callback?code=auth_123');
      mockHandleCallback.mockResolvedValue(successResult());

      const onSuccess = vi.fn();
      await handleCallbackRoute({ onSuccess })({ request });

      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ state: undefined }));
    });
  });

  describe('error path', () => {
    it('returns 500 with generic body on handleCallback failure', async () => {
      const request = new Request(`http://example.com/callback?code=invalid&state=${encodeURIComponent(SEALED_STATE)}`);
      mockHandleCallback.mockRejectedValue(new Error('Invalid code'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await handleCallbackRoute()({ request });

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error.message).toBe('Authentication failed');
      expect(body.error.description).toContain("Couldn't sign in");
      expect(body.error).not.toHaveProperty('details');
      expect(response.headers.getSetCookie().some((c) => c.startsWith(`${PKCE_COOKIE_NAME}=`))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('calls onError with the underlying error and appends delete-cookie', async () => {
      const request = new Request(`http://example.com/callback?code=invalid&state=${encodeURIComponent(SEALED_STATE)}`);
      const err = new Error('Auth failed');
      mockHandleCallback.mockRejectedValue(err);
      const onError = vi.fn().mockReturnValue(
        new Response('Custom error page', {
          status: 418,
          headers: { 'X-Custom': 'preserved' },
        }),
      );
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await handleCallbackRoute({ onError })({ request });

      expect(onError).toHaveBeenCalledWith({ error: err, request });
      expect(response.status).toBe(418);
      expect(response.headers.get('X-Custom')).toBe('preserved');
      expect(await response.text()).toBe('Custom error page');
      expect(response.headers.getSetCookie().some((c) => c.startsWith(`${PKCE_COOKIE_NAME}=`))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('reads verifier-delete header from clearPendingVerifier response when headers bag is empty', async () => {
      // The real adapter's storage override returns `{ response }` with the
      // Set-Cookie attached to the response, never populating the headers
      // bag. Simulate that shape and assert the delete rides through.
      const scopedDelete = `${PKCE_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      const mutatedResponse = new Response();
      mutatedResponse.headers.append('Set-Cookie', scopedDelete);
      mockClearPendingVerifier.mockResolvedValueOnce({ response: mutatedResponse });

      const request = new Request(`http://example.com/callback?state=${encodeURIComponent(SEALED_STATE)}`);
      const response = await handleCallbackRoute()({ request });

      expect(response.status).toBe(400);
      expect(response.headers.getSetCookie()).toEqual([scopedDelete]);
    });

    it('forwards middleware-scoped redirectUri and state to clearPendingVerifier', async () => {
      // Proves we pass the per-request `redirectUri` from middleware context
      // and the OAuth `state` into upstream so the delete cookie is computed
      // for the correct per-flow name.
      mockRedirectUriFromContext = 'https://app.example.com/custom/callback';

      const request = new Request(`http://example.com/callback?state=${encodeURIComponent(SEALED_STATE)}`);
      await handleCallbackRoute()({ request });

      expect(mockClearPendingVerifier).toHaveBeenCalledWith(expect.any(Response), {
        state: SEALED_STATE,
        redirectUri: 'https://app.example.com/custom/callback',
      });
    });

    it('passes only state when middleware context has no redirectUri override', async () => {
      mockRedirectUriFromContext = undefined;

      const request = new Request(`http://example.com/callback?state=${encodeURIComponent(SEALED_STATE)}`);
      await handleCallbackRoute()({ request });

      expect(mockClearPendingVerifier).toHaveBeenCalledWith(expect.any(Response), { state: SEALED_STATE });
    });

    it('emits state-derived delete-cookies when getAuthkit() rejects and state is present', async () => {
      const request = new Request(
        `http://example.com/callback?code=auth_123&state=${encodeURIComponent(SEALED_STATE)}`,
      );
      mockGetAuthkitImpl = () => Promise.reject(new Error('Config missing'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await handleCallbackRoute()({ request });

      expect(response.status).toBe(500);
      const setCookies = response.headers.getSetCookie();
      expect(setCookies).toHaveLength(2);
      expect(setCookies.every((c) => c.startsWith(`${PKCE_COOKIE_NAME}=`))).toBe(true);
      expect(setCookies[0]).toContain('SameSite=Lax');
      expect(setCookies[1]).toContain('SameSite=None');
      expect(setCookies[1]).toContain('Secure');
      expect(setCookies.every((c) => c.includes('Max-Age=0'))).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('state-derived delete headers', () => {
    it('emits a delete header whose cookie name matches getPKCECookieNameForState(state) when state is present', async () => {
      const expected = getPKCECookieNameForState(SEALED_STATE);
      const request = new Request(`https://app.example/callback?code=bad&state=${encodeURIComponent(SEALED_STATE)}`);
      // Force the error path so errorResponse runs. `code=bad` with the mock
      // rejecting triggers the catch branch.
      mockHandleCallback.mockRejectedValue(new Error('boom'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await handleCallbackRoute()({ request });
      const setCookies = res.headers.getSetCookie();
      expect(setCookies.some((c) => c.startsWith(`${expected}=`))).toBe(true);

      consoleSpy.mockRestore();
    });

    it('emits no Set-Cookie delete when state is absent', async () => {
      const request = new Request('https://app.example/callback'); // no code, no state
      const res = await handleCallbackRoute()({ request });
      const setCookies = res.headers.getSetCookie();
      expect(setCookies.some((c) => c.includes('wos-auth-verifier'))).toBe(false);
    });
  });
});
