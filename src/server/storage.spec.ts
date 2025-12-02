import { describe, it, expect } from 'vitest';
import { TanStackStartCookieSessionStorage } from './storage';

const mockConfig = {
  clientId: 'test-client-id',
  apiKey: 'test-api-key',
  redirectUri: 'https://example.com/callback',
  cookiePassword: 'test-password-that-is-32-chars-long!!',
  cookieName: 'wos_session',
  cookieSameSite: 'lax' as const,
  apiHttps: true,
  cookieMaxAge: 60 * 60 * 24 * 400,
};

describe('TanStackStartCookieSessionStorage', () => {
  const storage = new TanStackStartCookieSessionStorage(mockConfig);

  describe('getSession', () => {
    it('extracts session from cookies', async () => {
      const request = new Request('http://example.com', {
        headers: { cookie: 'wos_session=test-value' },
      });

      const result = await storage.getSession(request);
      expect(result).toBe('test-value');
    });

    it('returns null without cookies', async () => {
      const request = new Request('http://example.com');

      const result = await storage.getSession(request);
      expect(result).toBeNull();
    });

    it('handles URL encoded values', async () => {
      const encoded = encodeURIComponent('value with spaces');
      const request = new Request('http://example.com', {
        headers: { cookie: `wos_session=${encoded}` },
      });

      const result = await storage.getSession(request);
      expect(result).toBe('value with spaces');
    });

    it('handles multiple cookies', async () => {
      const request = new Request('http://example.com', {
        headers: { cookie: 'other=value; wos_session=target; third=data' },
      });

      const result = await storage.getSession(request);
      expect(result).toBe('target');
    });

    it('handles cookies with equals in value', async () => {
      const request = new Request('http://example.com', {
        headers: { cookie: 'wos_session=base64==encoded==' },
      });

      const result = await storage.getSession(request);
      expect(result).toBe('base64==encoded==');
    });
  });

  describe('applyHeaders', () => {
    it('creates new response with headers', async () => {
      const headers = { 'Set-Cookie': 'session=abc123' };
      // Call the protected method using type assertion
      const result = await (storage as any).applyHeaders(undefined, headers);

      expect(result.response).toBeInstanceOf(Response);
      expect(result.response.headers.get('Set-Cookie')).toBe('session=abc123');
    });

    it('preserves existing response properties', async () => {
      const originalResponse = new Response('body content', {
        status: 201,
        statusText: 'Created',
        headers: { 'Content-Type': 'text/plain' },
      });

      const headers = { 'Set-Cookie': 'session=xyz' };
      const result = await (storage as any).applyHeaders(originalResponse, headers);

      expect(result.response.status).toBe(201);
      expect(result.response.statusText).toBe('Created');
      expect(result.response.headers.get('Content-Type')).toBe('text/plain');
      expect(result.response.headers.get('Set-Cookie')).toBe('session=xyz');
    });

    it('handles multiple headers', async () => {
      const headers = {
        'Set-Cookie': 'session=123',
        'X-Custom': 'value',
      };
      const result = await (storage as any).applyHeaders(undefined, headers);

      expect(result.response.headers.get('Set-Cookie')).toBe('session=123');
      expect(result.response.headers.get('X-Custom')).toBe('value');
    });
  });
});
