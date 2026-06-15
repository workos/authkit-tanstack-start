import { beforeEach, describe, it, expect, vi } from 'vitest';

describe('authkit factory', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@workos/authkit-session');
  });

  it('exports authkit instance', async () => {
    const { getAuthkit } = await import('./authkit-loader');
    const authkit = await getAuthkit();
    expect(authkit).toBeDefined();
    expect(authkit).toHaveProperty('withAuth');
    expect(authkit).toHaveProperty('getWorkOS');
    expect(authkit).toHaveProperty('handleCallback');
  });

  it('shares initialization across concurrent callers', async () => {
    const authkit = {
      withAuth: vi.fn(),
      getWorkOS: vi.fn(),
      handleCallback: vi.fn(),
    };
    const createAuthService = vi.fn(() => authkit);

    vi.doMock('@workos/authkit-session', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@workos/authkit-session')>();
      return {
        ...actual,
        createAuthService,
      };
    });

    const { getAuthkit } = await import('./authkit-loader');
    const [first, second] = await Promise.all([getAuthkit(), getAuthkit()]);

    expect(createAuthService).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('retries initialization after a failure', async () => {
    const authkit = {
      withAuth: vi.fn(),
      getWorkOS: vi.fn(),
      handleCallback: vi.fn(),
    };
    const createAuthService = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('initialization failed');
      })
      .mockReturnValue(authkit);

    vi.doMock('@workos/authkit-session', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@workos/authkit-session')>();
      return {
        ...actual,
        createAuthService,
      };
    });

    const { getAuthkit } = await import('./authkit-loader');

    await expect(getAuthkit()).rejects.toThrow('initialization failed');
    await expect(getAuthkit()).resolves.toBe(authkit);
    expect(createAuthService).toHaveBeenCalledTimes(2);
  });
});
