import { describe, it, expect, vi, beforeEach } from 'vitest';

// Store original mock state
let mockContext: any = undefined;
let shouldThrow = false;

vi.mock('@tanstack/react-start', () => ({
  getGlobalStartContext: () => {
    if (shouldThrow) {
      throw new Error('Context not available');
    }
    return mockContext;
  },
}));

import { getAuthKitContext, getAuthKitContextOrNull } from './context';

describe('Context Functions', () => {
  beforeEach(() => {
    mockContext = undefined;
    shouldThrow = false;
    vi.clearAllMocks();
  });

  describe('getAuthKitContext', () => {
    it('returns context when auth and request are present', () => {
      const mockAuth = () => ({ user: { id: 'user_123' } });
      const mockRequest = new Request('http://test.local');
      mockContext = { auth: mockAuth, request: mockRequest, __setPendingHeader: vi.fn() };

      const result = getAuthKitContext();

      expect(result).toBe(mockContext);
      expect(result.auth).toBe(mockAuth);
      expect(result.request).toBe(mockRequest);
    });

    it('throws when context is undefined', () => {
      mockContext = undefined;

      expect(() => getAuthKitContext()).toThrow('AuthKit middleware is not configured');
    });

    it('throws when auth is missing', () => {
      mockContext = { request: new Request('http://test.local') };

      expect(() => getAuthKitContext()).toThrow('AuthKit middleware is not configured');
    });

    it('throws when request is missing', () => {
      mockContext = { auth: () => ({ user: null }) };

      expect(() => getAuthKitContext()).toThrow('AuthKit middleware is not configured');
    });

    it('throws when auth is null', () => {
      mockContext = { auth: null, request: new Request('http://test.local') };

      expect(() => getAuthKitContext()).toThrow('AuthKit middleware is not configured');
    });
  });

  describe('getAuthKitContextOrNull', () => {
    it('returns context when auth and request are present', () => {
      const mockAuth = () => ({ user: { id: 'user_123' } });
      const mockRequest = new Request('http://test.local');
      mockContext = { auth: mockAuth, request: mockRequest, __setPendingHeader: vi.fn() };

      const result = getAuthKitContextOrNull();

      expect(result).toBe(mockContext);
    });

    it('returns null when context is undefined', () => {
      mockContext = undefined;

      const result = getAuthKitContextOrNull();

      expect(result).toBeNull();
    });

    it('returns null when auth is missing', () => {
      mockContext = { request: new Request('http://test.local') };

      const result = getAuthKitContextOrNull();

      expect(result).toBeNull();
    });

    it('returns null when request is missing', () => {
      mockContext = { auth: () => ({ user: null }) };

      const result = getAuthKitContextOrNull();

      expect(result).toBeNull();
    });

    it('returns null when getGlobalStartContext throws', () => {
      shouldThrow = true;

      const result = getAuthKitContextOrNull();

      expect(result).toBeNull();
    });

    it('handles context with null auth gracefully', () => {
      mockContext = { auth: null, request: new Request('http://test.local') };

      const result = getAuthKitContextOrNull();

      expect(result).toBeNull();
    });
  });

  describe('__setPendingHeader integration', () => {
    it('allows setting headers via context callback', () => {
      const pendingHeaders: Record<string, string> = {};
      const setPendingHeader = (key: string, value: string) => {
        pendingHeaders[key] = value;
      };

      mockContext = {
        auth: () => ({ user: { id: 'user_123' } }),
        request: new Request('http://test.local'),
        __setPendingHeader: setPendingHeader,
      };

      const ctx = getAuthKitContext();
      ctx.__setPendingHeader('Set-Cookie', 'session=abc123');
      ctx.__setPendingHeader('X-Custom', 'value');

      expect(pendingHeaders).toEqual({
        'Set-Cookie': 'session=abc123',
        'X-Custom': 'value',
      });
    });
  });
});
