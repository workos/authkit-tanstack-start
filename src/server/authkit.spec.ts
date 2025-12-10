import { describe, it, expect } from 'vitest';
import { getAuthkit } from './authkit-loader';

describe('authkit factory', () => {
  it('exports authkit instance', async () => {
    const authkit = await getAuthkit();
    expect(authkit).toBeDefined();
    expect(authkit).toHaveProperty('withAuth');
    expect(authkit).toHaveProperty('getWorkOS');
    expect(authkit).toHaveProperty('handleCallback');
  });
});
