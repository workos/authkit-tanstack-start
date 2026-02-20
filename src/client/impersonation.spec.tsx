import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Impersonation } from './components/impersonation';
import { useAuth } from './AuthKitProvider';
import { getOrganizationAction } from '../server/actions';
import * as React from 'react';

// Mock useAuth hook
vi.mock('./AuthKitProvider', () => ({
  useAuth: vi.fn(),
}));

// Mock getOrganizationAction
vi.mock('../server/actions', () => ({
  getOrganizationAction: vi.fn(),
}));

describe('Impersonation', () => {
  const mockSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null if not impersonating', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: undefined,
      user: { id: '123', email: 'user@example.com' },
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    const { container } = render(<Impersonation />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should return null if user is not present', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: null,
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    const { container } = render(<Impersonation />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render impersonation banner when impersonating', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    const { container } = render(<Impersonation />);
    expect(container.querySelector('[data-workos-impersonation-root]')).toBeInTheDocument();
  });

  it('should display user email in banner', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    render(<Impersonation />);
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('should render with organization info when organizationId is provided', async () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: 'org_123',
      signOut: mockSignOut,
    } as any);

    vi.mocked(getOrganizationAction).mockResolvedValue({
      id: 'org_123',
      name: 'Test Org',
    });

    await act(async () => {
      render(<Impersonation />);
    });

    expect(getOrganizationAction).toHaveBeenCalledWith({ data: 'org_123' });
  });

  it('should render at the bottom by default', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    const { container } = render(<Impersonation />);
    const banner = container.querySelector('[data-workos-impersonation-root] > div:nth-child(2)') as HTMLElement;
    expect(banner.style.bottom).toBe('var(--wi-s)');
    expect(banner.style.top).toBe('');
  });

  it('should render at the top when side prop is "top"', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    const { container } = render(<Impersonation side="top" />);
    const banner = container.querySelector('[data-workos-impersonation-root] > div:nth-child(2)') as HTMLElement;
    expect(banner.style.top).toBe('var(--wi-s)');
    expect(banner.style.bottom).toBe('');
  });

  it('should merge custom styles with default styles', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    const customStyle = { backgroundColor: 'red' };
    const { container } = render(<Impersonation style={customStyle} />);
    const root = container.querySelector('[data-workos-impersonation-root]');
    expect((root as HTMLElement).style.backgroundColor).toBe('red');
  });

  it('should call signOut when the Stop button is clicked', async () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    render(<Impersonation />);
    const stopButton = await screen.findByText('Stop');
    await act(async () => {
      stopButton.click();
    });
    expect(mockSignOut).toHaveBeenCalledWith({ returnTo: undefined });
  });

  it('should pass returnTo prop to signOut when provided', async () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    const returnTo = '/dashboard';
    render(<Impersonation returnTo={returnTo} />);
    const stopButton = await screen.findByText('Stop');
    await act(async () => {
      stopButton.click();
    });
    expect(mockSignOut).toHaveBeenCalledWith({ returnTo: '/dashboard' });
  });

  it('should not call getOrganizationAction when organizationId is not provided', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: undefined,
      signOut: mockSignOut,
    } as any);

    render(<Impersonation />);
    expect(getOrganizationAction).not.toHaveBeenCalled();
  });

  it('should not call getOrganizationAction when impersonator is not present', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: undefined,
      user: { id: '123', email: 'user@example.com' },
      organizationId: 'org_123',
      signOut: mockSignOut,
    } as any);

    render(<Impersonation />);
    expect(getOrganizationAction).not.toHaveBeenCalled();
  });

  it('should not call getOrganizationAction when user is not present', () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: null,
      organizationId: 'org_123',
      signOut: mockSignOut,
    } as any);

    render(<Impersonation />);
    expect(getOrganizationAction).not.toHaveBeenCalled();
  });

  it('should not call getOrganizationAction again when organization is already loaded with same ID', async () => {
    const mockOrg = { id: 'org_123', name: 'Test Org' };
    vi.mocked(getOrganizationAction).mockResolvedValue(mockOrg);

    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: 'org_123',
      signOut: mockSignOut,
    } as any);

    const { rerender } = await act(async () => {
      return render(<Impersonation />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getOrganizationAction).toHaveBeenCalledTimes(1);

    // Rerender with the same organizationId
    await act(async () => {
      rerender(<Impersonation />);
    });

    expect(getOrganizationAction).toHaveBeenCalledTimes(1);
  });

  it('should call getOrganizationAction again when organizationId changes', async () => {
    const mockOrg1 = { id: 'org_123', name: 'Test Org 1' };
    const mockOrg2 = { id: 'org_456', name: 'Test Org 2' };

    vi.mocked(getOrganizationAction).mockResolvedValueOnce(mockOrg1).mockResolvedValueOnce(mockOrg2);

    vi.mocked(useAuth).mockReturnValue({
      impersonator: { email: 'admin@example.com', reason: 'testing' },
      user: { id: '123', email: 'user@example.com' },
      organizationId: 'org_123',
      signOut: mockSignOut,
    } as any);

    const { rerender } = await act(async () => {
      return render(<Impersonation />);
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(getOrganizationAction).toHaveBeenCalledTimes(1);
    expect(getOrganizationAction).toHaveBeenCalledWith({ data: 'org_123' });

    // Rerender with a different organizationId
    await act(async () => {
      vi.mocked(useAuth).mockReturnValue({
        impersonator: { email: 'admin@example.com', reason: 'testing' },
        user: { id: '123', email: 'user@example.com' },
        organizationId: 'org_456',
        signOut: mockSignOut,
      } as any);

      rerender(<Impersonation />);
    });

    expect(getOrganizationAction).toHaveBeenCalledTimes(2);
    expect(getOrganizationAction).toHaveBeenCalledWith({ data: 'org_456' });
  });
});
