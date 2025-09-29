import { vi } from 'vitest';

// Create a test context that mimics TanStack Start's runtime
export function createTestContext() {
  const testContext = {
    functionMiddleware: [],
    request: null as Request | null,
    response: null as Response | null,
  };

  // Mock the global context that TanStack Start expects
  (globalThis as any).__tsr__ = {
    functionContext: testContext,
  };

  return testContext;
}

// Helper to execute server functions with proper context
export async function executeServerFunction<T>(
  fn: (...args: any[]) => Promise<T>,
  options: {
    request?: Request;
    data?: any;
  } = {},
) {
  const context = createTestContext();
  context.request = options.request || new Request('http://test.local');

  // Set up the execution context
  const originalContext = (globalThis as any).__tsr__;
  (globalThis as any).__tsr__ = {
    functionContext: context,
  };

  try {
    // Execute with the data wrapper that server functions expect
    if (options.data !== undefined) {
      return await fn({ data: options.data });
    }
    return await fn();
  } finally {
    // Restore original context
    (globalThis as any).__tsr__ = originalContext;
  }
}

// Helper to create mock middleware
export function createMockMiddleware(name: string, handler?: Function) {
  return {
    name,
    handler: handler || vi.fn(),
  };
}

// Helper to setup request with cookies
export function createRequestWithCookies(url: string, cookies: Record<string, string>) {
  const cookieString = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');

  return new Request(url, {
    headers: {
      cookie: cookieString,
    },
  });
}

// Helper to setup request with auth headers
export function createAuthenticatedRequest(url: string, token?: string) {
  return new Request(url, {
    headers: {
      authorization: token ? `Bearer ${token}` : '',
      cookie: 'wos_session=test-session',
    },
  });
}
