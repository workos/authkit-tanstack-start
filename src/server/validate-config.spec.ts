import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create hoisted mock to avoid reference errors
const mockGetConfig = vi.hoisted(() => vi.fn());

vi.mock('@workos/authkit-session', () => ({
  getConfig: mockGetConfig,
}));

import { validateConfiguration } from './validate-config';

describe('validateConfiguration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes when all required config is valid', () => {
    mockGetConfig.mockImplementation((key: string) => {
      const config: Record<string, string> = {
        clientId: 'client_123',
        apiKey: 'sk_test_123',
        redirectUri: 'http://localhost:3000/callback',
        cookiePassword: 'a'.repeat(32), // 32 characters
      };
      return config[key];
    });

    expect(() => validateConfiguration()).not.toThrow();
  });

  it('throws when WORKOS_CLIENT_ID is missing', () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === 'clientId') return undefined;
      if (key === 'apiKey') return 'sk_test_123';
      if (key === 'redirectUri') return 'http://localhost:3000/callback';
      if (key === 'cookiePassword') return 'a'.repeat(32);
    });

    expect(() => validateConfiguration()).toThrow(/WORKOS_CLIENT_ID is required/);
  });

  it('throws when WORKOS_API_KEY is missing', () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === 'clientId') return 'client_123';
      if (key === 'apiKey') return undefined;
      if (key === 'redirectUri') return 'http://localhost:3000/callback';
      if (key === 'cookiePassword') return 'a'.repeat(32);
    });

    expect(() => validateConfiguration()).toThrow(/WORKOS_API_KEY is required/);
  });

  it('throws when WORKOS_REDIRECT_URI is missing', () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === 'clientId') return 'client_123';
      if (key === 'apiKey') return 'sk_test_123';
      if (key === 'redirectUri') return undefined;
      if (key === 'cookiePassword') return 'a'.repeat(32);
    });

    expect(() => validateConfiguration()).toThrow(/WORKOS_REDIRECT_URI is required/);
  });

  it('throws when WORKOS_COOKIE_PASSWORD is missing', () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === 'clientId') return 'client_123';
      if (key === 'apiKey') return 'sk_test_123';
      if (key === 'redirectUri') return 'http://localhost:3000/callback';
      if (key === 'cookiePassword') return undefined;
    });

    expect(() => validateConfiguration()).toThrow(/WORKOS_COOKIE_PASSWORD is required/);
  });

  it('throws when WORKOS_COOKIE_PASSWORD is too short', () => {
    mockGetConfig.mockImplementation((key: string) => {
      if (key === 'clientId') return 'client_123';
      if (key === 'apiKey') return 'sk_test_123';
      if (key === 'redirectUri') return 'http://localhost:3000/callback';
      if (key === 'cookiePassword') return 'short'; // Only 5 characters
    });

    expect(() => validateConfiguration()).toThrow(/must be at least 32 characters.*currently 5/);
  });

  it('lists all missing configuration at once', () => {
    mockGetConfig.mockImplementation(() => undefined);

    expect(() => validateConfiguration()).toThrow(/WORKOS_CLIENT_ID is required/);
    expect(() => validateConfiguration()).toThrow(/WORKOS_API_KEY is required/);
    expect(() => validateConfiguration()).toThrow(/WORKOS_REDIRECT_URI is required/);
    expect(() => validateConfiguration()).toThrow(/WORKOS_COOKIE_PASSWORD is required/);
  });

  it('handles getConfig throwing errors', () => {
    mockGetConfig.mockImplementation(() => {
      throw new Error('Config error');
    });

    expect(() => validateConfiguration()).toThrow(/Missing environment variables/);
  });
});
