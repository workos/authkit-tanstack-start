import { describe, it, expect } from 'vitest';
import { parseCookies, readPKCECookie } from './cookie-utils';

describe('parseCookies', () => {
  it('parses a single cookie', () => {
    expect(parseCookies('a=1')).toEqual({ a: '1' });
  });

  it('parses multiple cookies', () => {
    expect(parseCookies('a=1; b=2; c=3')).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('preserves = characters within cookie values', () => {
    expect(parseCookies('token=base64==padding==')).toEqual({ token: 'base64==padding==' });
  });

  it('returns an empty entry for an empty header', () => {
    expect(parseCookies('')).toEqual({ '': '' });
  });

  it('trims whitespace around each pair', () => {
    expect(parseCookies('a=1 ;   b=2')).toEqual({ a: '1', b: '2' });
  });
});

describe('readPKCECookie', () => {
  it('returns the PKCE cookie value from a request', () => {
    const request = new Request('http://example.com', {
      headers: { cookie: 'wos-auth-verifier=sealed-value' },
    });
    expect(readPKCECookie(request)).toBe('sealed-value');
  });

  it('returns the PKCE cookie when mixed with other cookies', () => {
    const request = new Request('http://example.com', {
      headers: { cookie: 'other=x; wos-auth-verifier=target; another=y' },
    });
    expect(readPKCECookie(request)).toBe('target');
  });

  it('URI-decodes the cookie value', () => {
    const encoded = encodeURIComponent('value with spaces & symbols');
    const request = new Request('http://example.com', {
      headers: { cookie: `wos-auth-verifier=${encoded}` },
    });
    expect(readPKCECookie(request)).toBe('value with spaces & symbols');
  });

  it('returns undefined when no cookie header is present', () => {
    const request = new Request('http://example.com');
    expect(readPKCECookie(request)).toBeUndefined();
  });

  it('returns undefined when the PKCE cookie is absent', () => {
    const request = new Request('http://example.com', {
      headers: { cookie: 'other=value' },
    });
    expect(readPKCECookie(request)).toBeUndefined();
  });

  it('returns undefined on malformed percent-encoding instead of throwing', () => {
    const request = new Request('http://example.com', {
      headers: { cookie: 'wos-auth-verifier=%E0%A4%A' },
    });
    expect(readPKCECookie(request)).toBeUndefined();
  });

  it('preserves = padding inside a sealed cookie value', () => {
    const sealed = 'abc==';
    const request = new Request('http://example.com', {
      headers: { cookie: `wos-auth-verifier=${sealed}` },
    });
    expect(readPKCECookie(request)).toBe(sealed);
  });
});
