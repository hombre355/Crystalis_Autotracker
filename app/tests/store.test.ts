import { describe, expect, it } from 'vitest';
import {
  applyMessage,
  clearOverride,
  cycleManualStage,
  effectiveValue,
  initialTrackerState,
  toggleOverride,
  type TrackerState
} from '../src/shared/tracker/store';
import type { RamMessage } from '../src/shared/protocol/messages';

function ramMsg(regions: Record<string, Uint8Array>): RamMessage {
  const wire: Record<string, string> = {};
  for (const [k, v] of Object.entries(regions)) wire[k] = Buffer.from(v).toString('base64');
  return { t: 'ram', seq: 1, regions: wire };
}

function withWindSword(state: TrackerState): TrackerState {
  const items = new Uint8Array(0x30).fill(0xff);
  items[0] = 0x00; // wind sword slot
  return applyMessage(state, ramMsg({ '6430': items }));
}

describe('tracker store', () => {
  it('applies ram messages and decodes auto state', () => {
    const state = withWindSword(initialTrackerState());
    expect(state.auto.items.windsword).toBe(true);
    expect(effectiveValue(state, 'windsword')).toBe(true);
    expect(effectiveValue(state, 'firesword')).toBe(false);
  });

  it('override beats auto until auto changes', () => {
    let state = withWindSword(initialTrackerState());
    state = toggleOverride(state, 'windsword'); // user says: not obtained
    expect(effectiveValue(state, 'windsword')).toBe(false);

    // Same auto value again: override survives.
    state = withWindSword(state);
    expect(effectiveValue(state, 'windsword')).toBe(false);

    // Auto value changes (sword lost): override dropped, auto wins.
    const empty = new Uint8Array(0x30).fill(0xff);
    state = applyMessage(state, ramMsg({ '6430': empty }));
    expect(effectiveValue(state, 'windsword')).toBe(false);
    // ...and when it re-appears, auto wins again (no stale override).
    state = withWindSword(state);
    expect(effectiveValue(state, 'windsword')).toBe(true);
  });

  it('clearOverride returns to auto', () => {
    let state = withWindSword(initialTrackerState());
    state = toggleOverride(state, 'windsword');
    expect(effectiveValue(state, 'windsword')).toBe(false);
    state = clearOverride(state, 'windsword');
    expect(effectiveValue(state, 'windsword')).toBe(true);
  });

  it('seed change resets accumulated state', () => {
    let state = withWindSword(initialTrackerState());
    state = applyMessage(state, { t: 'seed', checksum: 'aaaaaaaaaaaaaaaa' });
    expect(state.auto.items.windsword).toBe(true); // first seed: no reset
    state = applyMessage(state, { t: 'seed', checksum: 'bbbbbbbbbbbbbbbb' });
    expect(state.seed).toBe('bbbbbbbbbbbbbbbb');
    expect(state.auto.items.windsword ?? false).toBe(false);
    expect(state.regions.size).toBe(0);
  });

  it('flags message switches Wu-mode detection', () => {
    let state = initialTrackerState();
    const progress = new Uint8Array(0x60);
    progress[0x6481 - 0x6480] = 0x40; // moon statue destroyed
    state = applyMessage(state, ramMsg({ '6480': progress }));
    expect(state.auto.items.graybow).toBe(false);
    state = applyMessage(state, { t: 'flags', raw: 'Wu Gt' });
    expect(state.auto.items.graybow).toBe(true);
  });

  it('cycleManualStage wraps in both directions', () => {
    let state = initialTrackerState();
    state = cycleManualStage(state, 'ecw', 5, 1);
    expect(state.manualStages.ecw).toBe(1);
    state = cycleManualStage(state, 'ecw', 5, -1);
    state = cycleManualStage(state, 'ecw', 5, -1);
    expect(state.manualStages.ecw).toBe(4);
  });
});
