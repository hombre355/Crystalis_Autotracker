import type { RamRegions } from '../protocol/messages';
import {
  BOSSES,
  CHECKS,
  ITEMS,
  SLOT_RANGES,
  UNKNOWN_COUNTERS,
  type ItemDetector
} from './detectors';

export interface AutoTrackedState {
  /** Item code -> owned (per identified detection; Wu alternates applied when wuMode). */
  items: Record<string, boolean>;
  /** Boss code -> cleared. */
  bosses: Record<string, boolean>;
  /** Check ref -> collected. */
  checks: Record<string, boolean>;
  /** Counter code -> count of class items held (used by the Wu-flag UI). */
  counts: Record<string, number>;
}

function byteAt(regions: RamRegions, addr: number): number | null {
  for (const [start, bytes] of regions) {
    const off = addr - start;
    if (off >= 0 && off < bytes.length) return bytes[off] ?? null;
  }
  return null;
}

function slotValues(regions: RamRegions, slots: readonly number[]): number[] {
  const out: number[] = [];
  for (const addr of slots) {
    const v = byteAt(regions, addr);
    if (v !== null) out.push(v);
  }
  return out;
}

function evalDetector(regions: RamRegions, d: ItemDetector): boolean {
  switch (d.kind) {
    case 'byteEquals':
      return byteAt(regions, d.addr) === d.value;
    case 'byteIn': {
      const v = byteAt(regions, d.addr);
      return v !== null && d.values.includes(v);
    }
    case 'slotScan':
      return slotValues(regions, SLOT_RANGES[d.slots]).includes(d.id);
    case 'bit': {
      const v = byteAt(regions, d.addr);
      return v !== null && (v & d.mask) !== 0;
    }
  }
}

/**
 * Decode the full auto-tracked state from accumulated RAM regions.
 *
 * @param wuMode when the Wu randomizer flag is active, key items with a
 * world-event alternate detector use it instead of the (scrambled) inventory ID.
 */
export function decodeAutoTracked(regions: RamRegions, wuMode = false): AutoTrackedState {
  const items: Record<string, boolean> = {};
  for (const item of ITEMS) {
    const detector = wuMode && item.wuDetect ? item.wuDetect : item.detect;
    items[item.code] = evalDetector(regions, detector);
  }

  const bosses: Record<string, boolean> = {};
  for (const boss of BOSSES) {
    bosses[boss.code] = evalDetector(regions, { kind: 'bit', ...boss.bit });
  }

  const checks: Record<string, boolean> = {};
  for (const check of CHECKS) {
    checks[check.ref] = evalDetector(regions, { kind: 'bit', ...check.bit });
  }

  const counts: Record<string, number> = {};
  for (const counter of UNKNOWN_COUNTERS) {
    const values = slotValues(regions, SLOT_RANGES[counter.slots]);
    counts[counter.code] = counter.ids.filter((id) => values.includes(id)).length;
  }

  return { items, bosses, checks, counts };
}
