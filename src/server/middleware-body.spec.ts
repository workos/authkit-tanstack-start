import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuthkit = {
  withAuth: vi.fn(),
  saveSession: vi.fn(),
};

const mockGetConfig = vi.fn();

vi.mock('./authkit-loader', () => ({
  getAuthkit: vi.fn(() => Promise.resolve(mockAuthkit)),
  validateConfig: vi.fn(() => Promise.resolve()),
  getConfig: () => mockGetConfig(),
}));

import { middlewareBody } from './middleware-body';

describe('middlewareBody', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('header merging', () => {
    it('uses Headers API for pendingHeaders', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });

      const args = {
        request: mockRequest,
        next: vi.fn().mockResolvedValue({ response: mockResponse }),
      };

      const result = await middlewareBody(args);

      expect(result.response).toBe(mockResponse);
    });

    it('appends Set-Cookie headers correctly', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          context.__setPendingHeader('Set-Cookie', 'session=abc123; Path=/');
          return { response: mockResponse };
        }),
      };

      const result = await middlewareBody(args);

      expect(result.response.headers.get('Set-Cookie')).toBe('session=abc123; Path=/');
    });

    it('supports multiple Set-Cookie headers via append', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          context.__setPendingHeader('Set-Cookie', 'cookie1=value1; Path=/');
          context.__setPendingHeader('Set-Cookie', 'cookie2=value2; Path=/');
          return { response: mockResponse };
        }),
      };

      const result = await middlewareBody(args);

      const cookies = result.response.headers.get('Set-Cookie');
      expect(cookies).toContain('cookie1=value1');
      expect(cookies).toContain('cookie2=value2');
    });

    it('uses set() for non-cookie headers', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          context.__setPendingHeader('X-Custom', 'value1');
          context.__setPendingHeader('X-Custom', 'value2');
          return { response: mockResponse };
        }),
      };

      const result = await middlewareBody(args);

      expect(result.response.headers.get('X-Custom')).toBe('value2');
    });

    it('handles refreshed session data via storage context', async () => {
      const refreshedData = 'encrypted_session_data';
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: { id: 'user_123' } },
        refreshedSessionData: refreshedData,
      });
      mockAuthkit.saveSession.mockResolvedValue({
        headers: { 'Set-Cookie': 'wos-session=new_value; Path=/' },
      });

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      const args = {
        request: mockRequest,
        next: vi.fn(async () => ({ response: mockResponse })),
      };

      await middlewareBody(args);

      expect(mockAuthkit.saveSession).toHaveBeenCalledWith(undefined, refreshedData);
    });

    it('provides correct context shape to downstream handlers', async () => {
      const mockAuth = { user: { id: 'user_123' }, sessionId: 'session_123' };
      mockAuthkit.withAuth.mockResolvedValue({
        auth: mockAuth,
        refreshedSessionData: null,
      });

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      let capturedContext: any = null;
      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          capturedContext = context;
          return { response: mockResponse };
        }),
      };

      await middlewareBody(args);

      expect(capturedContext.request).toBe(mockRequest);
      expect(typeof capturedContext.auth).toBe('function');
      expect(capturedContext.auth()).toBe(mockAuth);
      expect(typeof capturedContext.__setPendingHeader).toBe('function');
    });

    it('preserves existing response headers', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', {
        status: 200,
        headers: { 'X-Existing': 'preserved' },
      });

      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          context.__setPendingHeader('X-New', 'added');
          return { response: mockResponse };
        }),
      };

      const result = await middlewareBody(args);

      expect(result.response.headers.get('X-Existing')).toBe('preserved');
      expect(result.response.headers.get('X-New')).toBe('added');
    });
  });

  describe('redirectUri option', () => {
    it('passes redirectUri to context when provided', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      let capturedContext: any = null;
      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          capturedContext = context;
          return { response: mockResponse };
        }),
      };

      await middlewareBody(args, { redirectUri: 'https://custom.example.com/callback' });

      expect(capturedContext.redirectUri).toBe('https://custom.example.com/callback');
    });

    it('passes undefined redirectUri when not provided', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });
      mockGetConfig.mockResolvedValue(undefined);

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      let capturedContext: any = null;
      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          capturedContext = context;
          return { response: mockResponse };
        }),
      };

      await middlewareBody(args);

      expect(capturedContext.redirectUri).toBeUndefined();
    });

    it('uses WORKOS_REDIRECT_URI from config when option not provided', async () => {
      const envRedirectUri = 'https://env.example.com/callback';
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });
      mockGetConfig.mockResolvedValue(envRedirectUri);

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      let capturedContext: any = null;
      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          capturedContext = context;
          return { response: mockResponse };
        }),
      };

      await middlewareBody(args);

      expect(capturedContext.redirectUri).toBe(envRedirectUri);
    });

    it('prioritizes explicit option over config', async () => {
      const explicitRedirectUri = 'https://explicit.example.com/callback';
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });
      mockGetConfig.mockResolvedValue('https://env.example.com/callback');

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      let capturedContext: any = null;
      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          capturedContext = context;
          return { response: mockResponse };
        }),
      };

      await middlewareBody(args, { redirectUri: explicitRedirectUri });

      expect(capturedContext.redirectUri).toBe(explicitRedirectUri);
    });
  });
});
