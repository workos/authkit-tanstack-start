import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Impersonation } from './components/impersonation';
import { useAuth } from './AuthKitProvider';
import { getOrganizationAction } from '../server/actions';

vi.mock('./AuthKitProvider', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../server/actions', () => ({
  getOrganizationAction: vi.fn(),
}));

const mockSignOut = vi.fn();

function mockAuth(overrides: Record<string, unknown> = {}) {
  vi.mocked(useAuth).mockReturnValue({
    impersonator: { email: 'admin@example.com', reason: 'testing' },
    user: { id: '123', email: 'user@example.com' },
    organizationId: undefined,
    signOut: mockSignOut,
    ...overrides,
  } as any);
}

describe('Impersonation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null if not impersonating', () => {
    mockAuth({ impersonator: undefined });
    const { container } = render(<Impersonation />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should return null if user is not present', () => {
    mockAuth({ user: null });
    const { container } = render(<Impersonation />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render impersonation banner when impersonating', () => {
    mockAuth();
    const { container } = render(<Impersonation />);
    expect(container.querySelector('[data-workos-impersonation-root]')).toBeInTheDocument();
  });

  it('should display user email in banner', () => {
    mockAuth();
    render(<Impersonation />);
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('should render with organization info when organizationId is provided', async () => {
    mockAuth({ organizationId: 'org_123' });
    vi.mocked(getOrganizationAction).mockResolvedValue({ id: 'org_123', name: 'Test Org' });

    await act(async () => {
      render(<Impersonation />);
    });

    expect(getOrganizationAction).toHaveBeenCalledWith({ data: 'org_123' });
  });

  it('should render at the bottom by default', () => {
    mockAuth();
    const { container } = render(<Impersonation />);
    const banner = container.querySelector('[data-workos-impersonation-root] > div:nth-child(2)') as HTMLElement;
    expect(banner.style.bottom).toBe('var(--wi-s)');
    expect(banner.style.top).toBe('');
  });

  it('should render at the top when side prop is "top"', () => {
    mockAuth();
    const { container } = render(<Impersonation side="top" />);
    const banner = container.querySelector('[data-workos-impersonation-root] > div:nth-child(2)') as HTMLElement;
    expect(banner.style.top).toBe('var(--wi-s)');
    expect(banner.style.bottom).toBe('');
  });

  it('should merge custom styles with default styles', () => {
    mockAuth();
    const { container } = render(<Impersonation style={{ backgroundColor: 'red' }} />);
    const root = container.querySelector('[data-workos-impersonation-root]') as HTMLElement;
    expect(root.style.backgroundColor).toBe('red');
  });

  it('should call signOut when the Stop button is clicked', async () => {
    mockAuth();
    render(<Impersonation />);
    await act(async () => {
      (await screen.findByText('Stop')).click();
    });
    expect(mockSignOut).toHaveBeenCalledWith({ returnTo: undefined });
  });

  it('should pass returnTo prop to signOut when provided', async () => {
    mockAuth();
    render(<Impersonation returnTo="/dashboard" />);
    await act(async () => {
      (await screen.findByText('Stop')).click();
    });
    expect(mockSignOut).toHaveBeenCalledWith({ returnTo: '/dashboard' });
  });

  it('should not call getOrganizationAction when organizationId is not provided', () => {
    mockAuth();
    render(<Impersonation />);
    expect(getOrganizationAction).not.toHaveBeenCalled();
  });

  it('should not call getOrganizationAction when impersonator is not present', () => {
    mockAuth({ impersonator: undefined, organizationId: 'org_123' });
    render(<Impersonation />);
    expect(getOrganizationAction).not.toHaveBeenCalled();
  });

  it('should not call getOrganizationAction when user is not present', () => {
    mockAuth({ user: null, organizationId: 'org_123' });
    render(<Impersonation />);
    expect(getOrganizationAction).not.toHaveBeenCalled();
  });

  it('should not call getOrganizationAction again when organization is already loaded with same ID', async () => {
    vi.mocked(getOrganizationAction).mockResolvedValue({ id: 'org_123', name: 'Test Org' });
    mockAuth({ organizationId: 'org_123' });

    const { rerender } = await act(async () => render(<Impersonation />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getOrganizationAction).toHaveBeenCalledTimes(1);

    await act(async () => rerender(<Impersonation />));
    expect(getOrganizationAction).toHaveBeenCalledTimes(1);
  });

  it('should call getOrganizationAction again when organizationId changes', async () => {
    vi.mocked(getOrganizationAction)
      .mockResolvedValueOnce({ id: 'org_123', name: 'Test Org 1' })
      .mockResolvedValueOnce({ id: 'org_456', name: 'Test Org 2' });

    mockAuth({ organizationId: 'org_123' });

    const { rerender } = await act(async () => render(<Impersonation />));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getOrganizationAction).toHaveBeenCalledTimes(1);
    expect(getOrganizationAction).toHaveBeenCalledWith({ data: 'org_123' });

    await act(async () => {
      mockAuth({ organizationId: 'org_456' });
      rerender(<Impersonation />);
    });

    expect(getOrganizationAction).toHaveBeenCalledTimes(2);
    expect(getOrganizationAction).toHaveBeenCalledWith({ data: 'org_456' });
  });
});
