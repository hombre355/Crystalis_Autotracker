/**
 * Builds the PopTracker-style provider-count function from tracker state.
 * An item "provides" every code in its pack codes list; counts are additive
 * across providers, matching Tracker:ProviderCountForCode semantics.
 */
import commonJson from '../../data/items/common.json';
import simpleJson from '../../data/items/simple_items.json';
import miscJson from '../../data/items/miscellaneous_items.json';
import wallsJson from '../../data/items/dungeon_walls.json';
import { hasFlag } from '../flags/flagString';
import type { TrackerState } from '../tracker/store';
import { effectiveValue } from '../tracker/store';
import { ITEMS, BOSSES, UNKNOWN_COUNTERS } from '../tracker/detectors';
import { GOA_FLOOR_WIDGETS } from '../tracker/goaFloors';

interface PackStage {
  codes?: string;
}
interface PackItem {
  name?: string;
  codes?: string;
  stages?: PackStage[];
}

const splitCodes = (codes: string | undefined): string[] =>
  (codes ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

/** detector code -> full provider code list, resolved from the pack JSON once. */
const PROVIDES: ReadonlyMap<string, readonly string[]> = (() => {
  const byCode = new Map<string, string[]>();
  const register = (codes: string[]) => {
    for (const code of codes) if (!byCode.has(code)) byCode.set(code, codes);
  };
  for (const source of [simpleJson, commonJson, miscJson] as PackItem[][]) {
    for (const item of source) {
      if (item.codes) register(splitCodes(item.codes));
      // For staged items (thunder sword), stage 0 is the plain item.
      const stage0 = item.stages?.[0];
      if (stage0?.codes) register(splitCodes(stage0.codes));
    }
  }
  const map = new Map<string, readonly string[]>();
  for (const item of ITEMS) {
    map.set(item.code, byCode.get(item.code) ?? [item.code]);
  }
  return map;
})();

/** Wall widget defs: stage index -> codes provided at that stage. */
const WALL_STAGES: readonly { code: string; stages: string[][] }[] = (wallsJson as PackItem[]).map(
  (wall) => {
    const stages = (wall.stages ?? []).map((s) => splitCodes(s.codes));
    return { code: stages[0]?.[0] ?? wall.name ?? 'wall', stages };
  }
);

export function buildProviderCounts(state: TrackerState): (code: string) => number {
  const counts = new Map<string, number>();
  const add = (code: string, n = 1) => counts.set(code, (counts.get(code) ?? 0) + n);

  // Items: provide all pack codes when effectively owned.
  for (const item of ITEMS) {
    if (!effectiveValue(state, item.code)) continue;
    for (const code of PROVIDES.get(item.code) ?? []) add(code);
  }

  // Thunder-sword warp target: Rt flag pins the warp to Shyron. Without Rt the
  // pack lets the user pick manually (manualStages 'thunderwarp', future UI).
  if (effectiveValue(state, 'thundersword') && hasFlag(state.flags, 'rt')) {
    add('thundershyron');
  }

  // Unknown-item class counters (identified or not, straight from RAM).
  for (const counter of UNKNOWN_COUNTERS) {
    const n = state.auto.counts[counter.code] ?? 0;
    if (n > 0) add(counter.code, n);
  }

  // Bosses: cleared (auto/override) + tested (manual second stage).
  for (const boss of BOSSES) {
    if (effectiveValue(state, boss.code)) add(boss.code);
    if ((state.manualStages[boss.code] ?? 0) === 1) {
      add(boss.code.replace('_cleared', '_tested'));
    }
  }

  // Walls: provide the codes of the current manual stage.
  for (const wall of WALL_STAGES) {
    const stage = state.manualStages[wall.code] ?? 0;
    for (const code of wall.stages[stage] ?? wall.stages[0] ?? []) add(code);
  }

  // Goa floor widgets: provide the codes of the current manual stage
  // (goa<floor><boss>, goa<boss>, goa<boss>_r, goa<floor>unknown).
  for (const widget of GOA_FLOOR_WIDGETS) {
    const stage = state.manualStages[widget.code] ?? 0;
    for (const code of widget.stages[stage]?.codes ?? []) add(code);
  }

  // Flags from the parsed flag string (mystery flags stay off).
  if (state.flags) {
    for (const code of state.flags.on) add('flag_' + code);
  }

  return (code) => counts.get(code) ?? 0;
}
