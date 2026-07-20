import { describe, expect, it } from 'vitest';
import { decodeStats, mergeRegions } from '../src/shared/ram/decoders';
import type { RamRegions } from '../src/shared/protocol/messages';

/** Build the two stat regions the bridge streams. */
function statRegions(opts: {
  maxHp: number;
  hp: number;
  gold: number;
  exp: number;
  expToNext: number;
  mp: number;
  maxMp: number;
}): RamRegions {
  const regions: RamRegions = new Map();
  regions.set(0x1bc0, new Uint8Array([opts.maxHp, opts.hp]));
  regions.set(
    0x1f02,
    new Uint8Array([
      opts.gold & 0xff,
      opts.gold >> 8,
      opts.exp & 0xff,
      opts.exp >> 8,
      opts.expToNext & 0xff,
      opts.expToNext >> 8,
      opts.mp,
      opts.maxMp
    ])
  );
  return regions;
}

describe('decodeStats', () => {
  it('decodes a full stat snapshot', () => {
    const stats = decodeStats(
      statRegions({ maxHp: 96, hp: 51, gold: 1234, exp: 5678, expToNext: 900, mp: 12, maxMp: 40 })
    );
    expect(stats).toEqual({
      hp: 51,
      maxHp: 96,
      mp: 12,
      maxMp: 40,
      gold: 1234,
      exp: 5678,
      expToNext: 900
    });
  });

  it('decodes 16-bit little-endian values across byte boundaries', () => {
    const stats = decodeStats(
      statRegions({ maxHp: 1, hp: 1, gold: 0xabcd, exp: 0x0100, expToNext: 0xff, mp: 0, maxMp: 0 })
    );
    expect(stats?.gold).toBe(0xabcd);
    expect(stats?.exp).toBe(0x0100);
    expect(stats?.expToNext).toBe(0xff);
  });

  it('returns null when a region is missing', () => {
    const partial: RamRegions = new Map([[0x1bc0, new Uint8Array([10, 20])]]);
    expect(decodeStats(partial)).toBeNull();
    expect(decodeStats(new Map())).toBeNull();
  });
});

describe('mergeRegions', () => {
  it('overlays incoming regions and keeps unrelated ones', () => {
    const acc: RamRegions = new Map([
      [0x6430, new Uint8Array([1])],
      [0x1bc0, new Uint8Array([2])]
    ]);
    const incoming: RamRegions = new Map([[0x1bc0, new Uint8Array([9])]]);
    const merged = mergeRegions(acc, incoming);
    expect(Array.from(merged.get(0x6430)!)).toEqual([1]);
    expect(Array.from(merged.get(0x1bc0)!)).toEqual([9]);
    // original not mutated
    expect(Array.from(acc.get(0x1bc0)!)).toEqual([2]);
  });
});
