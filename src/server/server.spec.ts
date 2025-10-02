import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup mocks before imports
vi.mock('./authkit', () => ({
  authkit: {
    withAuth: vi.fn(),
    handleCallback: vi.fn(),
    getSignInUrl: vi.fn(),
  },
}));

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((options) => {
    throw new Error(`Redirect: ${JSON.stringify(options)}`);
  }),
}));

import { handleCallbackRoute } from './server';
import { authkit } from './authkit';

describe('handleCallbackRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects missing code', async () => {
    const request = new Request('http://example.com/callback');
    const response = await handleCallbackRoute({ request });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.message).toBe('Missing authorization code');
  });

  it('processes valid callback', async () => {
    const request = new Request('http://example.com/callback?code=auth_123');
    (authkit.handleCallback as any).mockResolvedValue({
      response: { headers: new Map() },
    });

    const response = await handleCallbackRoute({ request });

    expect(response.status).toBe(307);
    expect(response.headers.get('Location')).toBe('http://example.com/');
  });

  it('decodes state for return path', async () => {
    const state = btoa(JSON.stringify({ returnPathname: '/dashboard' }));
    const request = new Request(`http://example.com/callback?code=auth_123&state=${state}`);
    (authkit.handleCallback as any).mockResolvedValue({
      response: { headers: new Map() },
    });

    const response = await handleCallbackRoute({ request });

    expect(response.headers.get('Location')).toBe('http://example.com/dashboard');
  });

  it('handles state with query params in return path', async () => {
    const state = btoa(JSON.stringify({ returnPathname: '/search?q=test&page=2' }));
    const request = new Request(`http://example.com/callback?code=auth_123&state=${state}`);
    (authkit.handleCallback as any).mockResolvedValue({
      response: { headers: new Map() },
    });

    const response = await handleCallbackRoute({ request });

    expect(response.headers.get('Location')).toBe('http://example.com/search?q=test&page=2');
  });

  it('handles invalid state gracefully', async () => {
    const request = new Request('http://example.com/callback?code=auth_123&state=invalid_base64');
    (authkit.handleCallback as any).mockResolvedValue({
      response: { headers: new Map() },
    });

    const response = await handleCallbackRoute({ request });

    // Should default to root path
    expect(response.headers.get('Location')).toBe('http://example.com/');
  });

  it('handles null state', async () => {
    const request = new Request('http://example.com/callback?code=auth_123&state=null');
    (authkit.handleCallback as any).mockResolvedValue({
      response: { headers: new Map() },
    });

    const response = await handleCallbackRoute({ request });

    expect(response.headers.get('Location')).toBe('http://example.com/');
  });

  it('extracts session headers from response', async () => {
    const request = new Request('http://example.com/callback?code=auth_123');
    const sessionHeaders = new Map([
      ['Set-Cookie', 'session=abc123'],
      ['X-Custom', 'value'],
    ]);
    (authkit.handleCallback as any).mockResolvedValue({
      response: { headers: sessionHeaders },
    });

    const response = await handleCallbackRoute({ request });

    expect(response.headers.get('Set-Cookie')).toBe('session=abc123');
    expect(response.headers.get('X-Custom')).toBe('value');
  });

  it('handles callback errors', async () => {
    const request = new Request('http://example.com/callback?code=invalid');
    (authkit.handleCallback as any).mockRejectedValue(new Error('Invalid code'));

    const response = await handleCallbackRoute({ request });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.message).toBe('Authentication failed');
    expect(body.error.description).toContain("Couldn't sign in");
  });
});
