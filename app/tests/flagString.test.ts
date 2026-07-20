import { describe, expect, it } from 'vitest';
import { hasFlag, parseFlagString } from '../src/shared/flags/flagString';

describe('parseFlagString', () => {
  it('parses the Casual preset string', () => {
    const f = parseFlagString('Ds Ecdrstux Rt Vds!mw');
    expect(f.on.has('ds')).toBe(true);
    for (const c of ['ec', 'ed', 'er', 'es', 'et', 'eu', 'ex']) {
      expect(f.on.has(c), c).toBe(true);
    }
    expect(f.on.has('rt')).toBe(true);
    expect(f.on.has('vd')).toBe(true);
    expect(f.on.has('vs')).toBe(true);
    expect(f.on.has('vm')).toBe(true);
    expect(f.strict.has('vm')).toBe(true);
    expect(f.strict.has('vw')).toBe(false);
    expect(f.on.has('vw')).toBe(true);
  });

  it('parses mystery flags as unknown, not on', () => {
    const f = parseFlagString('W?u Gt');
    expect(f.on.has('wu')).toBe(false);
    expect(f.mystery.has('wu')).toBe(true);
    expect(f.on.has('gt')).toBe(true);
  });

  it('handles junk around groups (scraped from ROM)', () => {
    const f = parseFlagString('  2.0.0  Gt Mr   Ps!x  ');
    expect(f.on.has('gt')).toBe(true);
    expect(f.on.has('mr')).toBe(true);
    expect(f.on.has('px')).toBe(true);
    expect(f.strict.has('px')).toBe(true);
  });

  it('empty and garbage strings parse to nothing', () => {
    expect(parseFlagString('').on.size).toBe(0);
    expect(parseFlagString('12345 ---').on.size).toBe(0);
  });

  it('hasFlag helper', () => {
    const f = parseFlagString('Wu');
    expect(hasFlag(f, 'wu')).toBe(true);
    expect(hasFlag(f, 'wm')).toBe(false);
    expect(hasFlag(null, 'wu')).toBe(false);
  });
});
