import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { AuthKitProvider, useAuth } from './AuthKitProvider';
import type { User } from '@workos/authkit-session';

vi.mock('../server/actions', () => ({
  getAuthAction: vi.fn(),
  refreshAuthAction: vi.fn(),
  checkSessionAction: vi.fn(),
  switchToOrganizationAction: vi.fn(),
}));

vi.mock('../server/server-functions', () => ({
  signOut: vi.fn(),
}));

// Mock TanStack Router hooks to avoid warnings
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/' }),
}));

describe('AuthKitProvider', () => {
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
  });

  it('renders children', async () => {
    const { getAuthAction } = await import('../server/actions');

    vi.mocked(getAuthAction).mockResolvedValue({
      user: null,
    });

    await act(async () => {
      render(
        <AuthKitProvider>
          <div>Test Child</div>
        </AuthKitProvider>,
      );
    });

    expect(screen.getByText('Test Child')).toBeDefined();
  });

  it('throws error when useAuth is called outside provider', () => {
    const TestComponent = () => {
      useAuth();
      return <div>Test</div>;
    };

    expect(() => render(<TestComponent />)).toThrow('useAuth must be used within an AuthKitProvider');
  });

  it('provides auth context to children', async () => {
    const { getAuthAction } = await import('../server/actions');

    vi.mocked(getAuthAction).mockResolvedValue({
      user: null,
    });

    const TestComponent = () => {
      const { loading, user } = useAuth();
      return (
        <div>
          <div>{loading ? 'Loading' : 'Not Loading'}</div>
          <div>{user ? 'Has User' : 'No User'}</div>
        </div>
      );
    };

    render(
      <AuthKitProvider>
        <TestComponent />
      </AuthKitProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Not Loading')).toBeDefined();
    });

    expect(screen.getByText('No User')).toBeDefined();
  });

  it('loads user data and provides to context', async () => {
    const { getAuthAction } = await import('../server/actions');

    vi.mocked(getAuthAction).mockResolvedValue({
      user: mockUser,
      sessionId: 'session_123',
      organizationId: 'org_123',
      role: 'admin',
      roles: ['admin', 'user'],
      permissions: ['read', 'write'],
      entitlements: ['feature_a'],
      featureFlags: ['flag_1'],
      impersonator: undefined,
    });

    const TestComponent = () => {
      const { user, sessionId, organizationId, role, roles, permissions, entitlements, featureFlags } = useAuth();
      return (
        <div>
          <div>{user?.email}</div>
          <div>{sessionId}</div>
          <div>{organizationId}</div>
          <div>{role}</div>
          <div>{roles?.join(',')}</div>
          <div>{permissions?.join(',')}</div>
          <div>{entitlements?.join(',')}</div>
          <div>{featureFlags?.join(',')}</div>
        </div>
      );
    };

    render(
      <AuthKitProvider>
        <TestComponent />
      </AuthKitProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeDefined();
    });

    expect(screen.getByText('session_123')).toBeDefined();
    expect(screen.getByText('org_123')).toBeDefined();
    expect(screen.getByText('admin')).toBeDefined();
    expect(screen.getByText('admin,user')).toBeDefined();
    expect(screen.getByText('read,write')).toBeDefined();
    expect(screen.getByText('feature_a')).toBeDefined();
    expect(screen.getByText('flag_1')).toBeDefined();
  });

  it('calls refreshAuth and updates state', async () => {
    const { getAuthAction, refreshAuthAction } = await import('../server/actions');

    vi.mocked(getAuthAction).mockResolvedValue({ user: null });

    vi.mocked(refreshAuthAction).mockResolvedValue({
      user: mockUser,
      sessionId: 'new_session',
      organizationId: 'org_456',
    });

    const TestComponent = () => {
      const { user, refreshAuth } = useAuth();
      return (
        <div>
          <div>{user?.email || 'No User'}</div>
          <button onClick={() => refreshAuth()}>Refresh</button>
        </div>
      );
    };

    render(
      <AuthKitProvider>
        <TestComponent />
      </AuthKitProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('No User')).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Refresh'));
    });

    await waitFor(() => {
      expect(screen.getByText('test@example.com')).toBeDefined();
    });
  });

  it('calls signOut', async () => {
    const { getAuthAction } = await import('../server/actions');
    const { signOut } = await import('../server/server-functions');

    vi.mocked(getAuthAction).mockResolvedValue({
      user: mockUser,
      sessionId: 'session_123',
    });

    const TestComponent = () => {
      const { signOut: handleSignOut } = useAuth();
      return <button onClick={() => handleSignOut({ returnTo: '/home' })}>Sign Out</button>;
    };

    render(
      <AuthKitProvider>
        <TestComponent />
      </AuthKitProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Sign Out'));
    });

    expect(signOut).toHaveBeenCalledWith({ data: { returnTo: '/home' } });
  });

  it('handles auth errors gracefully', async () => {
    const { getAuthAction } = await import('../server/actions');

    vi.mocked(getAuthAction).mockRejectedValue(new Error('Auth failed'));

    const TestComponent = () => {
      const { user } = useAuth();
      return <div>{user ? 'Has User' : 'No User'}</div>;
    };

    render(
      <AuthKitProvider>
        <TestComponent />
      </AuthKitProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('No User')).toBeDefined();
    });
  });

  it('handles refreshAuth errors', async () => {
    const { getAuthAction, refreshAuthAction } = await import('../server/actions');

    vi.mocked(getAuthAction).mockResolvedValue({ user: null });
    vi.mocked(refreshAuthAction).mockRejectedValue(new Error('Refresh failed'));

    const TestComponent = () => {
      const { refreshAuth } = useAuth();
      return <button onClick={() => refreshAuth()}>Refresh</button>;
    };

    render(
      <AuthKitProvider>
        <TestComponent />
      </AuthKitProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Refresh'));
    });

    await waitFor(() => {
      expect(refreshAuthAction).toHaveBeenCalled();
    });
  });

  it('disables session expiry checks when onSessionExpired is false', async () => {
    const { getAuthAction } = await import('../server/actions');

    vi.mocked(getAuthAction).mockResolvedValue({ user: null });

    await act(async () => {
      render(
        <AuthKitProvider onSessionExpired={false}>
          <div>Test</div>
        </AuthKitProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Test')).toBeDefined();
    });
  });

  it('calls ensureSignedIn when specified in useAuth', async () => {
    const { getAuthAction } = await import('../server/actions');

    let callCount = 0;
    vi.mocked(getAuthAction).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return { user: null };
      }
      return {
        user: mockUser,
        sessionId: 'session_123',
      };
    });

    const TestComponent = () => {
      const { user } = useAuth({ ensureSignedIn: true });
      return <div>{user?.email || 'No User'}</div>;
    };

    await act(async () => {
      render(
        <AuthKitProvider>
          <TestComponent />
        </AuthKitProvider>,
      );
    });

    await waitFor(() => {
      expect(callCount).toBeGreaterThan(1);
    });
  });
});
