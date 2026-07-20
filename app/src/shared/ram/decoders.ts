import type { RamRegions } from '../protocol/messages';
import { REGIONS, STAT_ADDR } from './addresses';

export interface Stats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  exp: number;
  expToNext: number;
}

function byteAt(regions: RamRegions, addr: number): number | null {
  for (const [start, bytes] of regions) {
    const off = addr - start;
    if (off >= 0 && off < bytes.length) return bytes[off] ?? null;
    }
  return null;
}

function u16At(regions: RamRegions, addr: number): number | null {
  const lo = byteAt(regions, addr);
  const hi = byteAt(regions, addr + 1);
  if (lo === null || hi === null) return null;
  return lo | (hi << 8);
}

/**
 * Decode the stats bar values from streamed regions.
 * Returns null unless both the HP and STATS regions are present in full.
 */
export function decodeStats(regions: RamRegions): Stats | null {
  const hp = byteAt(regions, STAT_ADDR.CUR_HP);
  const maxHp = byteAt(regions, STAT_ADDR.MAX_HP);
  const mp = byteAt(regions, STAT_ADDR.CUR_MP);
  const maxMp = byteAt(regions, STAT_ADDR.MAX_MP);
  const gold = u16At(regions, STAT_ADDR.GOLD);
  const exp = u16At(regions, STAT_ADDR.CUR_EXP);
  const expToNext = u16At(regions, STAT_ADDR.EXP_TO_NEXT);
  if (
    hp === null || maxHp === null || mp === null || maxMp === null ||
    gold === null || exp === null || expToNext === null
  ) {
    return null;
  }
  return { hp, maxHp, mp, maxMp, gold, exp, expToNext };
}

/**
 * Merge freshly streamed regions into an accumulated region store.
 * The bridge only sends regions whose bytes changed, so the app keeps
 * the latest copy of every region it has ever received.
 */
export function mergeRegions(acc: RamRegions, incoming: RamRegions): RamRegions {
  const merged: RamRegions = new Map(acc);
  for (const [start, bytes] of incoming) merged.set(start, bytes);
  return merged;
}

export { REGIONS };
