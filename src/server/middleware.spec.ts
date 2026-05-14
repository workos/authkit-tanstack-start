import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMiddlewareBody = vi.fn();

vi.mock('./middleware-body', () => ({
  middlewareBody: (...args: unknown[]) => mockMiddlewareBody(...args),
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

  it('delegates to middlewareBody via dynamic import', async () => {
    mockMiddlewareBody.mockResolvedValue({ response: new Response() });

    authkitMiddleware();

    const mockArgs = { request: new Request('http://test.local'), next: vi.fn() };
    await middlewareServerCallback(mockArgs);

    expect(mockMiddlewareBody).toHaveBeenCalledWith(mockArgs, undefined);
  });

  it('passes options through to middlewareBody', async () => {
    mockMiddlewareBody.mockResolvedValue({ response: new Response() });

    const options = { redirectUri: 'https://custom.example.com/callback' };
    authkitMiddleware(options);

    const mockArgs = { request: new Request('http://test.local'), next: vi.fn() };
    await middlewareServerCallback(mockArgs);

    expect(mockMiddlewareBody).toHaveBeenCalledWith(mockArgs, options);
  });
});
