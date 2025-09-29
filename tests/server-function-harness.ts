import { vi } from 'vitest';

/**
 * Test harness for TanStack Start server functions
 * This creates the necessary context for server functions to execute properly in tests
 */

// Mock the global middleware context
export function setupServerFunctionContext() {
  // Mock getRequest to return our test request
  vi.mock('@tanstack/react-start/server', () => ({
    getRequest: vi.fn(() => testContext.request),
    getCookie: vi.fn((name: string) => {
      const cookies = testContext.request?.headers.get('cookie') || '';
      const match = cookies.match(new RegExp(`${name}=([^;]+)`));
      return match ? match[1] : undefined;
    }),
    setCookie: vi.fn(),
    deleteCookie: vi.fn(),
  }));

  // Create a test context that we can manipulate
  const testContext = {
    request: new Request('http://test.local'),
    response: new Response(),
    middleware: [],
  };

  return {
    setRequest: (request: Request) => {
      testContext.request = request;
    },
    getContext: () => testContext,
  };
}

// Helper to create a server function wrapper that bypasses middleware
export function createServerFunctionWrapper(handler: Function) {
  return async (data?: any) => {
    // Execute the handler directly with the expected structure
    return handler({ data });
  };
}

// Mock createServerFn to return a testable function
export function mockCreateServerFn() {
  return {
    inputValidator: (validator: Function) => ({
      handler: (handlerFn: Function) => {
        // Return a function that can be called directly in tests
        return async (opts?: { data?: any }) => {
          const validatedData = validator ? validator(opts?.data) : opts?.data;
          return handlerFn({ data: validatedData });
        };
      },
    }),
    handler: (handlerFn: Function) => {
      // Return a function that can be called directly in tests
      return async (opts?: { data?: any }) => {
        return handlerFn(opts || {});
      };
    },
  };
}

// Helper to test redirect behavior
export function captureRedirect(fn: Function) {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error: any) {
      if (error?.message?.includes('Redirect') || error?.redirectOptions) {
        return { redirect: error.redirectOptions || error };
      }
      throw error;
    }
  };
}

// Helper to mock authkit responses
export function mockAuthkit(responses: { withAuth?: any; getWorkOS?: any; handleCallback?: any; getSignInUrl?: any }) {
  const authkit = {
    withAuth: vi.fn().mockResolvedValue(responses.withAuth || { user: null }),
    getWorkOS: vi.fn().mockReturnValue(
      responses.getWorkOS || {
        userManagement: {
          getAuthorizationUrl: vi.fn(),
          getLogoutUrl: vi.fn(),
        },
      },
    ),
    handleCallback: vi.fn().mockResolvedValue(responses.handleCallback || {}),
    getSignInUrl: vi.fn().mockResolvedValue(responses.getSignInUrl || ''),
  };

  vi.mock('../src/server/authkit', () => ({ authkit }));

  return authkit;
}
