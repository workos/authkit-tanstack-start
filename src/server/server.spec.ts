import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup mocks before imports
const mockHandleCallback = vi.fn();
const mockWithAuth = vi.fn();
const mockGetSignInUrl = vi.fn();

vi.mock('./authkit-loader', () => ({
  getAuthkit: vi.fn(() =>
    Promise.resolve({
      withAuth: mockWithAuth,
      handleCallback: mockHandleCallback,
      getSignInUrl: mockGetSignInUrl,
    }),
  ),
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((options) => {
    throw new Error(`Redirect: ${JSON.stringify(options)}`);
  }),
}));

import { handleCallbackRoute } from './server';
import { getAuthkit } from './authkit-loader';

describe('handleCallbackRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing code', async () => {
    const request = new Request('http://example.com/callback');
    const handler = handleCallbackRoute();
    const response = await handler({ request });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toBe('Missing authorization code');
  });

  it('processes valid callback', async () => {
    const request = new Request('http://example.com/callback?code=auth_123');
    mockHandleCallback.mockResolvedValue({
      response: { headers: new Map() },
      authResponse: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: { id: 'user_123', email: 'test@example.com' },
      },
    });

    const handler = handleCallbackRoute();
    const response = await handler({ request });

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://example.com/');
  });

  it('decodes state for return path', async () => {
    const state = btoa(JSON.stringify({ returnPathname: '/dashboard' }));
    const request = new Request(`http://example.com/callback?code=auth_123&state=${state}`);
    mockHandleCallback.mockResolvedValue({
      response: { headers: new Map() },
      authResponse: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: { id: 'user_123', email: 'test@example.com' },
      },
    });

    const handler = handleCallbackRoute();
    const response = await handler({ request });

    expect(response.headers.get('Location')).toBe('http://example.com/dashboard');
  });

  it('handles state with query params in return path', async () => {
    const state = btoa(JSON.stringify({ returnPathname: '/search?q=test&page=2' }));
    const request = new Request(`http://example.com/callback?code=auth_123&state=${state}`);
    mockHandleCallback.mockResolvedValue({
      response: { headers: new Map() },
      authResponse: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: { id: 'user_123', email: 'test@example.com' },
      },
    });

    const handler = handleCallbackRoute();
    const response = await handler({ request });

    expect(response.headers.get('Location')).toBe('http://example.com/search?q=test&page=2');
  });

  it('handles invalid state gracefully', async () => {
    const request = new Request('http://example.com/callback?code=auth_123&state=invalid_base64');
    mockHandleCallback.mockResolvedValue({
      response: { headers: new Map() },
      authResponse: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: { id: 'user_123', email: 'test@example.com' },
      },
    });

    const handler = handleCallbackRoute();
    const response = await handler({ request });

    // Should default to root path
    expect(response.headers.get('Location')).toBe('http://example.com/');
  });

  it('handles null state', async () => {
    const request = new Request('http://example.com/callback?code=auth_123&state=null');
    mockHandleCallback.mockResolvedValue({
      response: { headers: new Map() },
      authResponse: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: { id: 'user_123', email: 'test@example.com' },
      },
    });

    const handler = handleCallbackRoute();
    const response = await handler({ request });

    expect(response.headers.get('Location')).toBe('http://example.com/');
  });

  it('extracts session headers from response', async () => {
    const request = new Request('http://example.com/callback?code=auth_123');
    mockHandleCallback.mockResolvedValue({
      headers: {
        'Set-Cookie': 'session=abc123',
        'X-Custom': 'value',
      },
      authResponse: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: { id: 'user_123', email: 'test@example.com' },
      },
    });

    const handler = handleCallbackRoute();
    const response = await handler({ request });

    expect(response.headers.get('Set-Cookie')).toBe('session=abc123');
    expect(response.headers.get('X-Custom')).toBe('value');
  });

  it('handles callback errors', async () => {
    const request = new Request('http://example.com/callback?code=invalid');
    mockHandleCallback.mockRejectedValue(new Error('Invalid code'));

    // Suppress expected error log
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = handleCallbackRoute();
    const response = await handler({ request });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).toBe('Authentication failed');
    expect(body.error.description).toContain("Couldn't sign in");

    consoleErrorSpy.mockRestore();
  });

  it('calls onSuccess hook with auth data', async () => {
    const request = new Request('http://example.com/callback?code=auth_123');
    const mockAuthResponse = {
      accessToken: 'access_token_123',
      refreshToken: 'refresh_token_123',
      user: { id: 'user_123', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
      impersonator: { email: 'admin@example.com', reason: 'Support' },
      oauthTokens: { provider: 'google', accessToken: 'google_token' },
      authenticationMethod: 'GoogleOAuth',
      organizationId: 'org_123',
    };

    mockHandleCallback.mockResolvedValue({
      response: { headers: new Map() },
      authResponse: mockAuthResponse,
    });

    const onSuccess = vi.fn();
    const handler = handleCallbackRoute({ onSuccess });
    await handler({ request });

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess).toHaveBeenCalledWith({
      accessToken: 'access_token_123',
      refreshToken: 'refresh_token_123',
      user: mockAuthResponse.user,
      impersonator: mockAuthResponse.impersonator,
      oauthTokens: mockAuthResponse.oauthTokens,
      authenticationMethod: 'GoogleOAuth',
      organizationId: 'org_123',
      state: undefined,
    });
  });

  it('calls onSuccess with custom state', async () => {
    const customState = 'custom.user.state';
    const request = new Request(`http://example.com/callback?code=auth_123&state=${customState}`);
    mockHandleCallback.mockResolvedValue({
      response: { headers: new Map() },
      authResponse: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: { id: 'user_123', email: 'test@example.com' },
      },
    });

    const onSuccess = vi.fn();
    const handler = handleCallbackRoute({ onSuccess });
    await handler({ request });

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'user.state',
      }),
    );
  });

  it('uses custom returnPathname from options', async () => {
    const request = new Request('http://example.com/callback?code=auth_123');
    mockHandleCallback.mockResolvedValue({
      response: { headers: new Map() },
      authResponse: {
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        user: { id: 'user_123', email: 'test@example.com' },
      },
    });

    const handler = handleCallbackRoute({ returnPathname: '/custom-redirect' });
    const response = await handler({ request });

    expect(response.headers.get('Location')).toBe('http://example.com/custom-redirect');
  });

  it('calls onError hook on missing code', async () => {
    const request = new Request('http://example.com/callback');
    const onError = vi.fn().mockReturnValue(new Response('Custom error', { status: 403 }));

    const handler = handleCallbackRoute({ onError });
    const response = await handler({ request });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith({
      error: expect.any(Error),
      request,
    });
    expect(response.status).toBe(403);
    expect(await response.text()).toBe('Custom error');
  });

  it('calls onError hook on callback failure', async () => {
    const request = new Request('http://example.com/callback?code=invalid');
    const error = new Error('Auth failed');
    mockHandleCallback.mockRejectedValue(error);

    const onError = vi.fn().mockReturnValue(new Response('Custom error page', { status: 500 }));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handler = handleCallbackRoute({ onError });
    const response = await handler({ request });

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith({
      error,
      request,
    });
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Custom error page');

    consoleErrorSpy.mockRestore();
  });
});
