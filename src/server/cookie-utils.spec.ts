import { describe, it, expect } from 'vitest';
import { parseCookies, parseCookieNames } from './cookie-utils';

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

  it('returns an empty object for an empty header', () => {
    expect(parseCookies('')).toEqual({});
    expect(parseCookies('   ')).toEqual({});
  });

  it('trims whitespace around each pair', () => {
    expect(parseCookies('a=1 ;   b=2')).toEqual({ a: '1', b: '2' });
  });
});

describe('parseCookieNames', () => {
  it('returns names only, ignoring values', () => {
    expect(parseCookieNames('a=1; b=2; c=3')).toEqual(['a', 'b', 'c']);
  });

  it('handles values containing = signs', () => {
    expect(parseCookieNames('token=base64==padding==')).toEqual(['token']);
  });

  it('trims whitespace around each name', () => {
    expect(parseCookieNames('a=1 ;   b=2')).toEqual(['a', 'b']);
  });

  it('returns an empty array for an empty header', () => {
    expect(parseCookieNames('')).toEqual([]);
    expect(parseCookieNames('   ')).toEqual([]);
  });

  it('tolerates a valueless cookie segment', () => {
    expect(parseCookieNames('a=1; flag; b=2')).toEqual(['a', 'flag', 'b']);
  });
});
