import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTokenClaims } from './useTokenClaims';
import { useAccessToken } from './useAccessToken';
import { vi } from 'vitest';

vi.mock('./useAccessToken');

describe('useTokenClaims', () => {
  it('returns empty object when no token', () => {
    vi.mocked(useAccessToken).mockReturnValue({
      accessToken: undefined,
      loading: false,
      error: null,
      refresh: vi.fn(),
      getAccessToken: vi.fn(),
    });

    const { result } = renderHook(() => useTokenClaims());
    expect(result.current).toEqual({});
  });

  it('decodes token claims', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOiJzZXNzaW9uXzEyMyIsImlzcyI6Imh0dHBzOi8vYXBpLndvcmtvcy5jb20iLCJzdWIiOiJ1c2VyXzEyMyIsImV4cCI6MTczMjkwMDAwMCwiaWF0IjoxNzMyODk2NDAwLCJqdGkiOiJ0b2tlbl8xMjMifQ.signature';

    vi.mocked(useAccessToken).mockReturnValue({
      accessToken: token,
      loading: false,
      error: null,
      refresh: vi.fn(),
      getAccessToken: vi.fn(),
    });

    const { result } = renderHook(() => useTokenClaims());

    expect(result.current.sid).toBe('session_123');
    expect(result.current.sub).toBe('user_123');
  });

  it('returns empty object for invalid token', () => {
    vi.mocked(useAccessToken).mockReturnValue({
      accessToken: 'invalid-token',
      loading: false,
      error: null,
      refresh: vi.fn(),
      getAccessToken: vi.fn(),
    });

    const { result } = renderHook(() => useTokenClaims());
    expect(result.current).toEqual({});
  });
});