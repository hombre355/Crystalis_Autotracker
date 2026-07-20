/**
 * Pure tracker-state reducer shared by the renderer (and tests).
 * Combines auto-tracked RAM state with manual click overrides.
 *
 * Override semantics ("auto wins on change"): a manual override sticks until
 * the underlying auto value CHANGES, at which point live game data wins and
 * the override is dropped.
 */
import type { LuaMessage, RamRegions } from '../protocol/messages';
import { decodeRamRegions } from '../protocol/messages';
import { decodeStats, mergeRegions, type Stats } from '../ram/decoders';
import { parseFlagString, hasFlag, type ParsedFlags } from '../flags/flagString';
import { decodeAutoTracked, type AutoTrackedState } from './decode';

export interface TrackerState {
  connected: boolean;
  gameState: number | null;
  seed: string | null;
  rawFlags: string | null;
  flags: ParsedFlags | null;
  regions: RamRegions;
  stats: Stats | null;
  auto: AutoTrackedState;
  /** Manual override per code (items/bosses). Cleared when auto changes. */
  overrides: Record<string, boolean>;
  /** Manual stage per code for purely manual widgets (walls, boss "tested"). */
  manualStages: Record<string, number>;
  /** Manually cleared location sections (by "@Location/Section" key). */
  manualClears: Record<string, boolean>;
  messageCount: number;
}

const EMPTY_AUTO: AutoTrackedState = { items: {}, bosses: {}, checks: {}, counts: {} };

export function initialTrackerState(): TrackerState {
  return {
    connected: false,
    gameState: null,
    seed: null,
    rawFlags: null,
    flags: null,
    regions: new Map(),
    stats: null,
    auto: EMPTY_AUTO,
    overrides: {},
    manualStages: {},
    manualClears: {},
    messageCount: 0
  };
}

/** Reset game-derived state, keeping connection status. */
function resetForNewSeed(state: TrackerState, seed: string | null): TrackerState {
  return {
    ...initialTrackerState(),
    connected: state.connected,
    gameState: state.gameState,
    messageCount: state.messageCount,
    seed
  };
}

function recomputeAuto(state: TrackerState): TrackerState {
  const wuMode = hasFlag(state.flags, 'wu');
  const auto = decodeAutoTracked(state.regions, wuMode);
  // Auto wins on change: drop overrides whose auto value flipped.
  const overrides: Record<string, boolean> = {};
  for (const [code, value] of Object.entries(state.overrides)) {
    const prev = state.auto.items[code] ?? state.auto.bosses[code];
    const next = auto.items[code] ?? auto.bosses[code];
    if (prev === next) overrides[code] = value;
  }
  return { ...state, auto, overrides };
}

export function applyConnection(state: TrackerState, connected: boolean): TrackerState {
  return { ...state, connected };
}

export function applyMessage(state: TrackerState, msg: LuaMessage): TrackerState {
  const next = { ...state, messageCount: state.messageCount + 1 };
  switch (msg.t) {
    case 'gamestate':
      return { ...next, gameState: msg.v };
    case 'seed':
      if (state.seed !== null && state.seed !== msg.checksum) {
        return resetForNewSeed(next, msg.checksum);
      }
      return { ...next, seed: msg.checksum };
    case 'flags': {
      const withFlags = { ...next, rawFlags: msg.raw, flags: parseFlagString(msg.raw) };
      return recomputeAuto(withFlags);
    }
    case 'ram': {
      const regions = mergeRegions(state.regions, decodeRamRegions(msg));
      const withRegions = {
        ...next,
        regions,
        stats: decodeStats(regions) ?? state.stats
      };
      return recomputeAuto(withRegions);
    }
    default:
      return next;
  }
}

/** Effective on/off for an item or boss code (override beats auto). */
export function effectiveValue(state: TrackerState, code: string): boolean {
  if (code in state.overrides) return state.overrides[code]!;
  return state.auto.items[code] ?? state.auto.bosses[code] ?? false;
}

/** Toggle a manual override for an item/boss code. */
export function toggleOverride(state: TrackerState, code: string): TrackerState {
  const current = effectiveValue(state, code);
  return { ...state, overrides: { ...state.overrides, [code]: !current } };
}

/** Remove an override, returning the code to pure auto-tracking. */
export function clearOverride(state: TrackerState, code: string): TrackerState {
  const overrides = { ...state.overrides };
  delete overrides[code];
  return { ...state, overrides };
}

/** Toggle a manually-cleared mark on a location section. */
export function toggleManualClear(state: TrackerState, sectionKey: string): TrackerState {
  const manualClears = { ...state.manualClears };
  if (manualClears[sectionKey]) delete manualClears[sectionKey];
  else manualClears[sectionKey] = true;
  return { ...state, manualClears };
}

/** Cycle a purely manual widget (walls etc.) through stageCount stages. */
export function cycleManualStage(
  state: TrackerState,
  code: string,
  stageCount: number,
  delta = 1
): TrackerState {
  const current = state.manualStages[code] ?? 0;
  const nextStage = (current + delta + stageCount) % stageCount;
  return { ...state, manualStages: { ...state.manualStages, [code]: nextStage } };
}
