import { describe, expect, it } from 'vitest';
import { decodeAutoTracked } from '../src/shared/tracker/decode';
import { CHECKS, ITEMS } from '../src/shared/tracker/detectors';
import type { RamRegions } from '../src/shared/protocol/messages';

/** Build a fixture with the two live regions the bridge streams, all 0xFF/0x00. */
function baseRegions(): { regions: RamRegions; items: Uint8Array; progress: Uint8Array } {
  const items = new Uint8Array(0x30).fill(0xff);
  const progress = new Uint8Array(0x60).fill(0x00);
  const regions: RamRegions = new Map([
    [0x6430, items],
    [0x6480, progress]
  ]);
  return { regions, items, progress };
}

const itemsOff = (addr: number) => addr - 0x6430;
const progOff = (addr: number) => addr - 0x6480;

describe('decodeAutoTracked items', () => {
  it('reports nothing owned on an empty inventory', () => {
    const { regions } = baseRegions();
    const state = decodeAutoTracked(regions);
    for (const item of ITEMS) {
      expect(state.items[item.code], item.code).toBe(false);
    }
    expect(Object.values(state.bosses).every((v) => !v)).toBe(true);
    expect(Object.values(state.checks).every((v) => !v)).toBe(true);
  });

  it('detects swords by element byte', () => {
    const { regions, items } = baseRegions();
    items[itemsOff(0x6430)] = 0x00; // wind sword
    items[itemsOff(0x6433)] = 0x03; // thunder sword
    const state = decodeAutoTracked(regions);
    expect(state.items.windsword).toBe(true);
    expect(state.items.firesword).toBe(false);
    expect(state.items.watersword).toBe(false);
    expect(state.items.thundersword).toBe(true);
  });

  it('detects ball vs bracelet levels', () => {
    const { regions, items } = baseRegions();
    items[itemsOff(0x643c)] = 5; // wind ball only
    items[itemsOff(0x643d)] = 8; // flame bracelet (implies ball)
    const state = decodeAutoTracked(regions);
    expect(state.items.windball).toBe(true);
    expect(state.items.tornadobracelet).toBe(false);
    expect(state.items.fireball).toBe(true);
    expect(state.items.flamebracelet).toBe(true);
    expect(state.items.waterball).toBe(false);
  });

  it('detects spells, wear items, and endgame gear via slot scans', () => {
    const { regions, items } = baseRegions();
    items[itemsOff(0x645a)] = 0x48; // flight in third spell slot
    items[itemsOff(0x644c)] = 0x2e; // rabbit boots in a wear slot
    items[itemsOff(0x6434)] = 0x1c; // psycho armor
    items[itemsOff(0x643b)] = 0x12; // sacred shield in last shield slot
    const state = decodeAutoTracked(regions);
    expect(state.items.flight).toBe(true);
    expect(state.items.refresh).toBe(false);
    expect(state.items.rabbitboots).toBe(true);
    expect(state.items.psychoarmor).toBe(true);
    expect(state.items.sacredshield).toBe(true);
  });

  it('scans both key-item rows', () => {
    const { regions, items, progress } = baseRegions();
    items[itemsOff(0x6450)] = 0x3e; // bow of moon in row 1
    progress[progOff(0x64bf)] = 0x40; // bow of truth in last row-2 slot
    const state = decodeAutoTracked(regions);
    expect(state.items.graybow).toBe(true);
    expect(state.items.bluebow).toBe(true);
    expect(state.items.redbow).toBe(false);
    expect(state.counts.bow).toBe(2);
  });

  it('uses Wu alternates only in wuMode', () => {
    const { regions, progress } = baseRegions();
    progress[progOff(0x6481)] = 0x40; // moon statue destroyed
    progress[progOff(0x64db)] = 0x01; // prison door opened
    const normal = decodeAutoTracked(regions, false);
    expect(normal.items.graybow).toBe(false);
    expect(normal.items.bluekey).toBe(false);
    const wu = decodeAutoTracked(regions, true);
    expect(wu.items.graybow).toBe(true);
    expect(wu.items.bluekey).toBe(true);
    expect(wu.items.redbow).toBe(false);
  });

  it('counts unknown item classes', () => {
    const { regions, items } = baseRegions();
    items[itemsOff(0x6450)] = 0x32; // windmill key
    items[itemsOff(0x6451)] = 0x34; // key to styx
    items[itemsOff(0x6452)] = 0x35; // fog lamp
    items[itemsOff(0x6453)] = 0x3b; // love pendant
    const state = decodeAutoTracked(regions);
    expect(state.counts.unknownkey).toBe(2);
    expect(state.counts.unknownlamp).toBe(1);
    expect(state.counts.unknowntrade).toBe(2); // fog lamp + love pendant
    expect(state.counts.unknownflute).toBe(0);
  });
});

describe('decodeAutoTracked bosses and checks', () => {
  it('decodes boss-cleared bits', () => {
    const { regions, progress } = baseRegions();
    progress[progOff(0x64a1)] = 0x01 | 0x08; // kelbesque1 + mado1
    progress[progOff(0x64ac)] = 0x02; // vampire
    const state = decodeAutoTracked(regions);
    expect(state.bosses.kelbesque1_cleared).toBe(true);
    expect(state.bosses.mado1_cleared).toBe(true);
    expect(state.bosses.vampire_cleared).toBe(true);
    expect(state.bosses.draygon_cleared).toBe(false);
  });

  it('decodes check bits against the full table', () => {
    const { regions, progress } = baseRegions();
    progress[progOff(0x64a0)] = 0x01; // Leaf Elder
    progress[progOff(0x64ae)] = 0x02; // Fog Lamp Cave Mimic 2
    const state = decodeAutoTracked(regions);
    expect(state.checks['@Leaf Village: Elder/Leaf Elder']).toBe(true);
    expect(state.checks['@Fog Lamp Cave: Mimic 2/Mimic 2']).toBe(true);
    const set = Object.values(state.checks).filter(Boolean).length;
    expect(set).toBe(2);
  });

  it('covers every check exactly once (no duplicate bits)', () => {
    const seen = new Set<string>();
    for (const c of CHECKS) {
      const key = `${c.bit.addr}:${c.bit.mask}`;
      expect(seen.has(key), `duplicate bit ${key} (${c.ref})`).toBe(false);
      seen.add(key);
    }
    expect(CHECKS.length).toBeGreaterThanOrEqual(90);
  });
});
