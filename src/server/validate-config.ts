import { getConfig } from '@workos/authkit-session';

/**
 * Validates that all required environment variables are properly configured.
 * Called by middleware on first request to fail fast with helpful errors.
 */
export function validateConfiguration(): void {
  const errors: string[] = [];

  // Validate required environment variables
  try {
    const clientId = getConfig('clientId');
    if (!clientId) {
      errors.push('WORKOS_CLIENT_ID is required');
    }
  } catch {
    errors.push('WORKOS_CLIENT_ID is required');
  }

  try {
    const apiKey = getConfig('apiKey');
    if (!apiKey) {
      errors.push('WORKOS_API_KEY is required');
    }
  } catch {
    errors.push('WORKOS_API_KEY is required');
  }

  try {
    const redirectUri = getConfig('redirectUri');
    if (!redirectUri) {
      errors.push('WORKOS_REDIRECT_URI is required');
    }
  } catch {
    errors.push('WORKOS_REDIRECT_URI is required');
  }

  try {
    const cookiePassword = getConfig('cookiePassword');
    if (!cookiePassword) {
      errors.push('WORKOS_COOKIE_PASSWORD is required (min 32 characters)');
    } else if (cookiePassword.length < 32) {
      errors.push(`WORKOS_COOKIE_PASSWORD must be at least 32 characters (currently ${cookiePassword.length})`);
    }
  } catch {
    errors.push('WORKOS_COOKIE_PASSWORD is required (min 32 characters)');
  }

  if (errors.length > 0) {
    throw new Error(
      'AuthKit configuration error. Missing environment variables:\n\n' +
        errors.map((e) => `  • ${e}`).join('\n') +
        '\n\nAdd these to your .env file and get values from the WorkOS dashboard.',
    );
  }
}
