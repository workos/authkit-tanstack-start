import { describe, it, expect } from 'vitest';
import { decodeJwt } from './jwt';

describe('decodeJwt', () => {
  it('decodes a valid JWT', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzaWQiOiJzZXNzaW9uXzEyMyIsImlzcyI6Imh0dHBzOi8vYXBpLndvcmtvcy5jb20iLCJzdWIiOiJ1c2VyXzEyMyIsImV4cCI6MTczMjkwMDAwMCwiaWF0IjoxNzMyODk2NDAwLCJqdGkiOiJ0b2tlbl8xMjMifQ.signature';

    const result = decodeJwt(token);

    expect(result.header.alg).toBe('HS256');
    expect(result.header.typ).toBe('JWT');
    expect(result.payload.sid).toBe('session_123');
    expect(result.payload.sub).toBe('user_123');
  });

  it('throws error for invalid JWT format', () => {
    expect(() => decodeJwt('invalid')).toThrow('Invalid JWT format');
  });

  it('throws error for malformed JWT', () => {
    expect(() => decodeJwt('a.b.c')).toThrow('Failed to decode JWT');
  });
});
