import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { GOA_FLOOR_WIDGETS } from '../src/shared/tracker/goaFloors';
import { buildProviderCounts } from '../src/shared/logic/providers';
import { createMacros } from '../src/shared/logic/macros';
import {
  applyMessage,
  cycleManualStage,
  initialTrackerState,
  type TrackerState
} from '../src/shared/tracker/store';

const ASSETS = resolve(__dirname, '../assets');

describe('goa floor widgets', () => {
  it('defines 4 floors x 9 stages with existing icons', () => {
    expect(GOA_FLOOR_WIDGETS.length).toBe(4);
    for (const widget of GOA_FLOOR_WIDGETS) {
      expect(widget.stages.length).toBe(9);
      for (const stage of widget.stages) {
        expect(existsSync(resolve(ASSETS, stage.img)), stage.img).toBe(true);
      }
    }
  });

  it('default state provides the unknown code for every floor', () => {
    const count = buildProviderCounts(initialTrackerState());
    for (const floor of ['1st', '2nd', '3rd', '4th']) {
      expect(count(`goa${floor}unknown`), floor).toBe(1);
      expect(count(`goa${floor}kelbesque`)).toBe(0);
    }
    expect(count('goakelbesque')).toBe(0);
  });

  it('assigning a boss provides floor, aggregate, and reversed codes', () => {
    let state = initialTrackerState();
    // goa1st: stage 1 = kelbesque, stage 2 = kelbesque reversed
    state = cycleManualStage(state, 'goa1st', 9, 2);
    const count = buildProviderCounts(state);
    expect(count('goa1stkelbesque')).toBe(1);
    expect(count('goakelbesque')).toBe(1);
    expect(count('goakelbesque_r')).toBe(1);
    expect(count('goa1stunknown')).toBe(0);
  });
});

describe('Wg-flag goa logic responds to floor assignments', () => {
  /** Fully-kitted state so only floor knowledge gates the answer. */
  function kittedState(): TrackerState {
    let state = initialTrackerState();
    const items = new Uint8Array(0x30).fill(0xff);
    items[0] = 0x00; // wind sword
    items[1] = 0x01; // fire sword
    items[2] = 0x02; // water sword
    items[3] = 0x03; // thunder sword
    items[0x0c] = 6; // tornado bracelet
    items[0x0d] = 8; // flame bracelet
    items[0x0e] = 10; // blizzard bracelet
    items[0x0f] = 12; // storm bracelet
    items[0x28] = 0x41; // refresh
    items[0x29] = 0x46; // barrier
    items[0x2a] = 0x48; // flight
    state = applyMessage(state, {
      t: 'ram',
      seq: 1,
      regions: { '6430': Buffer.from(items).toString('base64') }
    });
    // Vw makes Goa town itself reachable so only floor knowledge is under test.
    return applyMessage(state, { t: 'flags', raw: 'Wg Vw' });
  }

  function macrosFor(state: TrackerState) {
    const count = buildProviderCounts(state);
    return createMacros({ count, checkCleared: () => false });
  }

  it('kelbesque floor known -> sure reach; unknown -> not sure but maybe', () => {
    const unknown = macrosFor(kittedState());
    // All floors unknown: fully kitted player can cross everything, so even
    // the conservative fallback answers true...
    expect(unknown.canReachKelbesquesFloor!()).toBe(true);
    // ...and the maybe-path flows through the goaXXunknown codes (regression
    // guard: this returned false before the widget codes existed).
    expect(unknown.canMaybeReachKelbesquesFloor!()).toBe(true);

    // Assign kelbesque to the 3rd floor: reach requires crossing 1st+2nd
    // (still possible fully kitted) — exercises the floor-specific path.
    let state = kittedState();
    state = cycleManualStage(state, 'goa3rd', 9, 1); // 3rd floor = kelbesque
    const known = macrosFor(state);
    expect(known.canReachKelbesquesFloor!()).toBe(true);
  });

  it('under-kitted player: unknown floors are yellow at best, never sure', () => {
    // Only a wind kit: cannot cross sabera/mado/karmine floors for sure.
    let state = initialTrackerState();
    const items = new Uint8Array(0x30).fill(0xff);
    items[0] = 0x00; // wind sword
    items[0x0c] = 6; // tornado bracelet
    items[0x28] = 0x41; // refresh
    items[0x29] = 0x46; // barrier
    items[0x2a] = 0x48; // flight (reach goa via swan? no — flight helps back door)
    state = applyMessage(state, {
      t: 'ram',
      seq: 1,
      regions: { '6430': Buffer.from(items).toString('base64') }
    });
    state = applyMessage(state, { t: 'flags', raw: 'Wg Vw' }); // Vw: goa town reachable
    const m = macrosFor(state);
    expect(m.canReachKelbesquesFloor!()).toBe(false);
    // maybe-path: unknown floors + front entrance reachable -> maybe
    expect(m.canMaybeReachKelbesquesFloor!()).toBe(true);
  });
});
