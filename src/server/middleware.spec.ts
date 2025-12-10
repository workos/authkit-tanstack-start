import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
const mockAuthkit = {
  withAuth: vi.fn(),
  saveSession: vi.fn(),
};

vi.mock('./authkit-loader', () => ({
  getAuthkit: vi.fn(() => Promise.resolve(mockAuthkit)),
  validateConfig: vi.fn(() => Promise.resolve()),
}));

let middlewareServerCallback: any = null;

vi.mock('@tanstack/react-start', () => ({
  createMiddleware: () => ({
    server: (callback: any) => {
      middlewareServerCallback = callback;
      return callback;
    },
  }),
}));

import { authkitMiddleware } from './middleware';

describe('authkitMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    middlewareServerCallback = null;
  });

  describe('header merging', () => {
    it('uses Headers API for pendingHeaders', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      authkitMiddleware();

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });

      const args = {
        request: mockRequest,
        next: vi.fn().mockResolvedValue({ response: mockResponse }),
      };

      const result = await middlewareServerCallback(args);

      // No headers to add, should return original result
      expect(result.response).toBe(mockResponse);
    });

    it('appends Set-Cookie headers correctly', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      authkitMiddleware();

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      let capturedContext: any = null;
      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          capturedContext = context;
          // Simulate action setting cookie via context
          context.__setPendingHeader('Set-Cookie', 'session=abc123; Path=/');
          return { response: mockResponse };
        }),
      };

      const result = await middlewareServerCallback(args);

      expect(result.response.headers.get('Set-Cookie')).toBe('session=abc123; Path=/');
    });

    it('supports multiple Set-Cookie headers via append', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      authkitMiddleware();

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          // Simulate multiple cookies being set
          context.__setPendingHeader('Set-Cookie', 'cookie1=value1; Path=/');
          context.__setPendingHeader('Set-Cookie', 'cookie2=value2; Path=/');
          return { response: mockResponse };
        }),
      };

      const result = await middlewareServerCallback(args);

      // Headers API getAll or iterate to check multiple values
      const cookies = result.response.headers.get('Set-Cookie');
      // Note: Headers.get() concatenates multiple values with ", "
      expect(cookies).toContain('cookie1=value1');
      expect(cookies).toContain('cookie2=value2');
    });

    it('uses set() for non-cookie headers', async () => {
      mockAuthkit.withAuth.mockResolvedValue({
        auth: { user: null },
        refreshedSessionData: null,
      });

      authkitMiddleware();

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      const args = {
        request: mockRequest,
        next: vi.fn(async ({ context }: any) => {
          context.__setPendingHeader('X-Custom', 'value1');
          context.__setPendingHeader('X-Custom', 'value2'); // Should overwrite
          return { response: mockResponse };
        }),
      };

      const result = await middlewareServerCallback(args);

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

      authkitMiddleware();

      const mockRequest = new Request('http://test.local');
      const mockResponse = new Response('OK', { status: 200 });

      const args = {
        request: mockRequest,
        next: vi.fn(async () => ({ response: mockResponse })),
      };

      await middlewareServerCallback(args);

      expect(mockAuthkit.saveSession).toHaveBeenCalledWith(undefined, refreshedData);
    });

    it('provides correct context shape to downstream handlers', async () => {
      const mockAuth = { user: { id: 'user_123' }, sessionId: 'session_123' };
      mockAuthkit.withAuth.mockResolvedValue({
        auth: mockAuth,
        refreshedSessionData: null,
      });

      authkitMiddleware();

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

      await middlewareServerCallback(args);

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

      authkitMiddleware();

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

      const result = await middlewareServerCallback(args);

      expect(result.response.headers.get('X-Existing')).toBe('preserved');
      expect(result.response.headers.get('X-New')).toBe('added');
    });
  });
});
