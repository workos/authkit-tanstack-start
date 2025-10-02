import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAccessToken } from './useAccessToken';
import { useAuth } from './AuthKitProvider';
import { tokenStore } from './tokenStore';
import type { User } from '@workos/authkit-session';

vi.mock('./AuthKitProvider');
vi.mock('./tokenStore', () => ({
  tokenStore: {
    subscribe: vi.fn(),
    getSnapshot: vi.fn(),
    getServerSnapshot: vi.fn(),
    clearToken: vi.fn(),
    parseToken: vi.fn(),
    getAccessTokenSilently: vi.fn(),
    getAccessToken: vi.fn(),
    refreshToken: vi.fn(),
  },
}));

describe('useAccessToken', () => {
  const mockUser: User = {
    id: 'user_123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    emailVerified: true,
    profilePictureUrl: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lastSignInAt: '2024-01-01T00:00:00.000Z',
    externalId: null,
    metadata: {},
    object: 'user',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(tokenStore.subscribe).mockImplementation((listener) => {
      return () => {};
    });

    vi.mocked(tokenStore.getSnapshot).mockReturnValue({
      token: undefined,
      loading: false,
      error: null,
    });

    vi.mocked(tokenStore.getServerSnapshot).mockReturnValue({
      token: undefined,
      loading: false,
      error: null,
    });

    vi.mocked(useAuth).mockReturnValue({
      user: null,
      sessionId: undefined,
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it('returns undefined token when no user', () => {
    const { result } = renderHook(() => useAccessToken());

    expect(result.current.accessToken).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns token from store when user exists', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    vi.mocked(tokenStore.getSnapshot).mockReturnValue({
      token: 'test-token',
      loading: false,
      error: null,
    });

    vi.mocked(tokenStore.parseToken).mockReturnValue({
      payload: {} as any,
      expiresAt: 9999999999,
      isExpiring: false,
      timeUntilExpiry: 3600,
    });

    vi.mocked(tokenStore.getAccessTokenSilently).mockResolvedValue('test-token');

    const { result } = renderHook(() => useAccessToken());

    await waitFor(() => {
      expect(result.current.accessToken).toBe('test-token');
    });
  });

  it('shows loading state', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    vi.mocked(tokenStore.getSnapshot).mockReturnValue({
      token: undefined,
      loading: true,
      error: null,
    });

    vi.mocked(tokenStore.parseToken).mockReturnValue(null);
    vi.mocked(tokenStore.getAccessTokenSilently).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAccessToken());

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });
  });

  it('shows error state', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    const error = new Error('Token fetch failed');
    vi.mocked(tokenStore.getSnapshot).mockReturnValue({
      token: undefined,
      loading: false,
      error,
    });

    vi.mocked(tokenStore.parseToken).mockReturnValue(null);
    vi.mocked(tokenStore.getAccessTokenSilently).mockRejectedValue(error);

    const { result } = renderHook(() => useAccessToken());

    await waitFor(() => {
      expect(result.current.error).toBe(error);
    });
  });

  it('calls getAccessTokenSilently when user exists', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    vi.mocked(tokenStore.getAccessTokenSilently).mockResolvedValue('token');
    vi.mocked(tokenStore.parseToken).mockReturnValue(null);

    renderHook(() => useAccessToken());

    await waitFor(() => {
      expect(tokenStore.getAccessTokenSilently).toHaveBeenCalled();
    });
  });

  it('clears token when user logs out', async () => {
    vi.mocked(tokenStore.getAccessTokenSilently).mockResolvedValue(undefined);

    const { rerender } = renderHook(() => useAccessToken());

    // Initially has user
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    rerender();

    // Wait for initial effects to settle
    await waitFor(() => {
      expect(tokenStore.getAccessTokenSilently).toHaveBeenCalled();
    });

    // User logs out
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      sessionId: undefined,
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    rerender();

    await waitFor(() => {
      expect(tokenStore.clearToken).toHaveBeenCalled();
    });
  });

  it('provides refresh function', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    vi.mocked(tokenStore.getAccessTokenSilently).mockResolvedValue(undefined);
    vi.mocked(tokenStore.refreshToken).mockResolvedValue('new-token');

    const { result } = renderHook(() => useAccessToken());

    // Wait for initial effect to complete
    await waitFor(() => {
      expect(tokenStore.getAccessTokenSilently).toHaveBeenCalled();
    });

    const token = await result.current.refresh();

    expect(tokenStore.refreshToken).toHaveBeenCalled();
    expect(token).toBe('new-token');
  });

  it('provides getAccessToken function', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    vi.mocked(tokenStore.getAccessTokenSilently).mockResolvedValue(undefined);
    vi.mocked(tokenStore.getAccessToken).mockResolvedValue('fresh-token');

    const { result } = renderHook(() => useAccessToken());

    // Wait for initial effect to complete
    await waitFor(() => {
      expect(tokenStore.getAccessTokenSilently).toHaveBeenCalled();
    });

    const token = await result.current.getAccessToken();

    expect(tokenStore.getAccessToken).toHaveBeenCalled();
    expect(token).toBe('fresh-token');
  });

  it('returns undefined from refresh when no user', async () => {
    const { result } = renderHook(() => useAccessToken());

    const token = await result.current.refresh();

    expect(token).toBeUndefined();
    expect(tokenStore.refreshToken).not.toHaveBeenCalled();
  });

  it('returns undefined from getAccessToken when no user', async () => {
    const { result } = renderHook(() => useAccessToken());

    const token = await result.current.getAccessToken();

    expect(token).toBeUndefined();
    expect(tokenStore.getAccessToken).not.toHaveBeenCalled();
  });

  it('clears token when session changes', async () => {
    vi.mocked(tokenStore.getAccessTokenSilently).mockResolvedValue(undefined);

    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    const { rerender } = renderHook(() => useAccessToken());

    // Wait for initial effects to settle
    await waitFor(() => {
      expect(tokenStore.getAccessTokenSilently).toHaveBeenCalled();
    });

    // Session changes
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_456',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    rerender();

    await waitFor(() => {
      expect(tokenStore.clearToken).toHaveBeenCalled();
    });
  });

  it('shows initial loading when fetching first token', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: undefined,
      role: undefined,
      roles: undefined,
      permissions: undefined,
      entitlements: undefined,
      featureFlags: undefined,
      impersonator: undefined,
      loading: false,
      getAuth: vi.fn(),
      refreshAuth: vi.fn(),
      signOut: vi.fn(),
    });

    vi.mocked(tokenStore.getSnapshot).mockReturnValue({
      token: undefined,
      loading: false,
      error: null,
    });

    vi.mocked(tokenStore.parseToken).mockReturnValue(null);
    vi.mocked(tokenStore.getAccessTokenSilently).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAccessToken());

    // Should show loading on initial mount when user exists but no token
    expect(result.current.loading).toBe(true);

    // Wait for effects to settle
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });
  });
});
