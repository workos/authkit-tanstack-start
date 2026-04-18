import { describe, it, expect } from 'vitest';
import { parseCookies } from './cookie-utils';

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
