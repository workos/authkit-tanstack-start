import { describe, it, expect } from 'vitest';
import { authkit } from './authkit';

describe('authkit factory', () => {
  it('exports authkit instance', () => {
    expect(authkit).toBeDefined();
    expect(authkit).toHaveProperty('withAuth');
    expect(authkit).toHaveProperty('getWorkOS');
    expect(authkit).toHaveProperty('handleCallback');
  });
});
