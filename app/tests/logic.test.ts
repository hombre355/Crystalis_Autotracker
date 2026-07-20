import { describe, expect, it } from 'vitest';
import { createMacros } from '../src/shared/logic/macros';
import { evaluateRule, evaluateRules } from '../src/shared/logic/engine';
import { computeLogic } from '../src/shared/logic/evaluate';
import { buildProviderCounts } from '../src/shared/logic/providers';
import { applyMessage, initialTrackerState, type TrackerState } from '../src/shared/tracker/store';
import type { MacroTable } from '../src/shared/logic/types';

/** Build macros straight from a code->count record (no tracker state needed). */
function macrosFrom(counts: Record<string, number>, checks: Record<string, boolean> = {}) {
  const count = (code: string) => counts[code] ?? 0;
  return { macros: createMacros({ count, checkCleared: (ref) => checks[ref] === true }), count };
}

describe('rule evaluator', () => {
  const table: MacroTable = {
    yes: () => true,
    no: () => false,
    echo: (arg) => arg === 'ok'
  };
  const count = (code: string) => (code === 'have' ? 1 : 0);

  it('AND within a rule, OR across rules', () => {
    expect(evaluateRules(['$yes, have'], table, count)).toBe('green');
    expect(evaluateRules(['$yes, missing'], table, count)).toBe('red');
    expect(evaluateRules(['$no', '$yes'], table, count)).toBe('green');
  });

  it('macro args pass through', () => {
    expect(evaluateRules(['$echo|ok'], table, count)).toBe('green');
    expect(evaluateRules(['$echo|nope'], table, count)).toBe('red');
  });

  it('bracketed sure-checks downgrade to yellow when they fail', () => {
    expect(evaluateRule('$yes, [$no]', table, count)).toEqual({ sure: false, maybe: true });
    expect(evaluateRules(['$yes, [$no]'], table, count)).toBe('yellow');
    expect(evaluateRules(['$yes, [$yes]'], table, count)).toBe('green');
  });

  it('bracket groups spanning commas count every inner term as sure-only', () => {
    expect(evaluateRules(['$yes, [$no, $yes]'], table, count)).toBe('yellow');
  });

  it('tolerates empty rules, unknown macros, and stray braces', () => {
    expect(evaluateRules([''], table, count)).toBe('green');
    expect(evaluateRules(undefined, table, count)).toBe('green');
    expect(evaluateRules(['$doesNotExist'], table, count)).toBe('red');
    expect(evaluateRules(['{$yes'], table, count)).toBe('green');
  });
});

describe('macro port: walls and elements', () => {
  it('stone walls need wind sword + upgrade', () => {
    expect(macrosFrom({ wind: 1, sword: 1 }).macros.canBreakStoneWalls!()).toBe(false);
    expect(macrosFrom({ wind: 1, sword: 1, windball: 1 }).macros.canBreakStoneWalls!()).toBe(true);
    expect(macrosFrom({ windball: 1 }).macros.canBreakStoneWalls!()).toBe(false); // ball without sword
    // Ro flag: orbs not required
    expect(macrosFrom({ wind: 1, sword: 1, flag_ro: 1 }).macros.canBreakStoneWalls!()).toBe(true);
  });

  it('canOpenChest depends on Mg flag', () => {
    expect(macrosFrom({}).macros.canOpenChest!()).toBe(true);
    expect(macrosFrom({ flag_mg: 1 }).macros.canOpenChest!()).toBe(false);
    expect(macrosFrom({ flag_mg: 1, sword: 1 }).macros.canOpenChest!()).toBe(true);
  });
});

describe('macro port: traversal', () => {
  it('leaf is always reachable, brynmaer needs a route', () => {
    const { macros } = macrosFrom({});
    expect(macros.canReach!('leaf')).toBe(true);
    expect(macros.canReach!('brynmaer')).toBe(false);
  });

  it('windmill key + sealed cave wall break opens brynmaer', () => {
    const { macros } = macrosFrom({
      redkey: 1,
      wind: 1,
      sword: 1,
      windball: 1
    });
    expect(macros.canReach!('brynmaer')).toBe(true);
    // and from brynmaer, gas mask opens oak
    expect(macros.canReach!('oak')).toBe(false);
    const withGas = macrosFrom({ redkey: 1, wind: 1, sword: 1, windball: 1, gas: 1 }).macros;
    expect(withGas.canReach!('oak')).toBe(true);
  });

  it('vw flag opens towns as starting points', () => {
    const { macros } = macrosFrom({ flag_vw: 1 });
    for (const town of ['brynmaer', 'portoa', 'swan', 'goa', 'sahara', 'ESI']) {
      expect(macros.canReach!(town), town).toBe(true);
    }
    expect(macros.canReach!('oak')).toBe(false); // still gated by gas mask
  });

  it('thunder warp start: shyron reaches goa with river crossing', () => {
    const base = { thundershyron: 1 };
    expect(macrosFrom(base).macros.canReach!('shyron')).toBe(true);
    expect(macrosFrom(base).macros.canReach!('goa')).toBe(false);
    const withFlight = macrosFrom({ ...base, flight: 1 }).macros;
    expect(withFlight.canReach!('goa')).toBe(true);
    // flight also unlocks sahara from goa
    expect(withFlight.canReach!('sahara')).toBe(true);
  });

  it('maybe-reach is a superset of sure-reach (windmill key unknown)', () => {
    // Wu on: an unidentified key might be the windmill key
    const counts = { flag_wu: 1, unknownkey: 1, wind: 1, sword: 1, windball: 1 };
    const { macros } = macrosFrom(counts);
    expect(macros.canReach!('brynmaer')).toBe(false);
    expect(macros.canMaybeReach!('brynmaer')).toBe(true);
  });
});

describe('macro port: bosses', () => {
  it('kelbesque1 vanilla (Me off) needs wind + bracelet-or-Nw', () => {
    expect(macrosFrom({ wind: 1, sword: 1 }).macros.canKillKelbesque1!()).toBe(false);
    expect(
      macrosFrom({ wind: 1, sword: 1, windbracelet: 1, bracelet: 1 }).macros.canKillKelbesque1!()
    ).toBe(true);
    expect(macrosFrom({ wind: 1, sword: 1, flag_nw: 1 }).macros.canKillKelbesque1!()).toBe(true);
  });

  it('Me on: cleared bit or full tetrarchy kit', () => {
    expect(macrosFrom({ flag_me: 1, kelbesque1_cleared: 1 }).macros.canKillKelbesque1!()).toBe(true);
    const fullKit = {
      flag_me: 1,
      sword: 4, wind: 1, fire: 1, water: 1, thunder: 1,
      bracelet: 4, windbracelet: 1, firebracelet: 1, waterbracelet: 1, thunderbracelet: 1
    };
    expect(macrosFrom(fullKit).macros.canKillKelbesque1!()).toBe(true);
    expect(macrosFrom({ flag_me: 1, sword: 1, wind: 1 }).macros.canKillKelbesque1!()).toBe(false);
  });

  it('Er flag requires refresh', () => {
    const kit = { wind: 1, sword: 1, windbracelet: 1, bracelet: 1, flag_er: 1 };
    expect(macrosFrom(kit).macros.canKillKelbesque1!()).toBe(false);
    expect(macrosFrom({ ...kit, refresh: 1 }).macros.canKillKelbesque1!()).toBe(true);
  });
});

describe('end-to-end reachability from tracker state', () => {
  function stateWith(itemsBytes: (b: Uint8Array) => void, flags?: string): TrackerState {
    let state = initialTrackerState();
    const items = new Uint8Array(0x30).fill(0xff);
    itemsBytes(items);
    const wire = { '6430': Buffer.from(items).toString('base64') };
    state = applyMessage(state, { t: 'ram', seq: 1, regions: wire });
    if (flags) state = applyMessage(state, { t: 'flags', raw: flags });
    return state;
  }

  it('fresh game: Leaf Elder green, Sealed Cave gated red', () => {
    const state = stateWith(() => {});
    const locations = computeLogic(state, new Set());
    const leaf = locations.find((l) => l.name === 'Leaf Village: Elder');
    expect(leaf).toBeDefined();
    expect(leaf!.reachability).toBe('green'); // leaf always reachable
    // Sealed cave requires the windmill key (Zebu opens the cave) -> red with nothing
    const sealed = locations.find((l) => l.name === 'Sealed Cave: Ball of Wind');
    expect(sealed?.reachability).toBe('red');
  });

  it('windmill key alone: sealed cave green; interior wall checks need wind kit', () => {
    const keyOnly = stateWith((items) => {
      items[0x20] = 0x32; // windmill key in key-item slot
    });
    let locations = computeLogic(keyOnly, new Set());
    expect(locations.find((l) => l.name === 'Sealed Cave: Ball of Wind')?.reachability).toBe(
      'green'
    );
    // Antidote is behind a breakable wall -> red without wind kit
    expect(locations.find((l) => l.name === 'Sealed Cave: Antidote')?.reachability).toBe('red');

    const withWindKit = stateWith((items) => {
      items[0x20] = 0x32;
      items[0] = 0x00; // wind sword
      items[0x0c] = 5; // wind ball
    });
    locations = computeLogic(withWindKit, new Set());
    expect(locations.find((l) => l.name === 'Sealed Cave: Antidote')?.reachability).toBe('green');
  });

  it('provider counts aggregate pack codes', () => {
    const state = stateWith((items) => {
      items[0] = 0x00; // wind sword
      items[1] = 0x01; // fire sword
    });
    const count = buildProviderCounts(state);
    expect(count('sword')).toBe(2);
    expect(count('wind')).toBe(1);
    expect(count('fire')).toBe(1);
    expect(count('windsword')).toBe(1);
  });

  it('RAM check bits mark the matching split section cleared', () => {
    let state = stateWith(() => {});
    const progress = new Uint8Array(0x60);
    progress[0x20] = 0x01; // 0x64a0 bit 0: Leaf Elder collected
    state = applyMessage(state, {
      t: 'ram',
      seq: 2,
      regions: { '6480': Buffer.from(progress).toString('base64') }
    });
    const sections = computeLogic(state, new Set()).flatMap((l) => l.sections);
    const elder = sections.find((s) => s.key === '@Leaf Village: Elder/Leaf Elder');
    expect(elder, 'split section for Leaf Elder exists').toBeDefined();
    expect(elder!.cleared).toBe(true);
    const student = sections.find((s) => s.key.includes('Student'));
    expect(student?.cleared).toBe(false);
  });

  it('manual clears mark sections cleared', () => {
    const state = stateWith(() => {});
    const sections = computeLogic(state, new Set(['@Leaf Village: Elder/Leaf Elder'])).flatMap(
      (l) => l.sections
    );
    expect(sections.find((s) => s.key === '@Leaf Village: Elder/Leaf Elder')?.cleared).toBe(true);
  });

  it('every RAM check ref resolves to a known split section', () => {
    const state = stateWith(() => {});
    const keys = new Set(computeLogic(state, new Set()).flatMap((l) => l.sections.map((s) => s.key)));
    // Spot the full table via detectors import to keep this hermetic.
    return import('../src/shared/tracker/detectors').then(({ CHECKS }) => {
      for (const check of CHECKS) {
        expect(keys.has(check.ref), check.ref).toBe(true);
      }
    });
  });
});
