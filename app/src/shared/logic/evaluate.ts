/**
 * Computes reachability for every location section from tracker state.
 * Section key convention matches the RAM check refs: "@Location Name/Section Name".
 */
import type { TrackerState } from '../tracker/store';
import { buildProviderCounts } from './providers';
import { createMacros } from './macros';
import { evaluateRules } from './engine';
import { ALL_LOCATIONS, type PackLocation } from './locations';
import type { Reachability } from './types';

export interface SectionState {
  key: string;
  locationName: string;
  sectionName: string;
  reachability: Reachability;
  /** Collected via RAM check bit or manual click. */
  cleared: boolean;
  itemCount: number;
}

export interface LocationState {
  name: string;
  path: string[];
  reachability: Reachability;
  mapLocations: { map: string; x: number; y: number; size?: number }[];
  sections: SectionState[];
  /** All sections cleared. */
  cleared: boolean;
  hidden: boolean;
}

const RANK: Record<Reachability, number> = { red: 0, yellow: 1, green: 2 };

function combine(a: Reachability, b: Reachability): Reachability {
  return RANK[a] <= RANK[b] ? a : b;
}

export function computeLogic(
  state: TrackerState,
  manualClears: ReadonlySet<string>
): LocationState[] {
  const count = buildProviderCounts(state);
  const macros = createMacros({
    count,
    checkCleared: (ref) => state.auto.checks[ref] === true || manualClears.has(ref)
  });

  const results: LocationState[] = [];

  const walk = (loc: PackLocation, path: string[], parentVerdict: Reachability) => {
    const ownVerdict = evaluateRules(loc.access_rules, macros, count);
    const verdict = combine(parentVerdict, ownVerdict);
    const hidden =
      loc.force_invisibility_rules !== undefined &&
      evaluateRules(loc.force_invisibility_rules, macros, count) === 'green' &&
      loc.force_invisibility_rules.length > 0;

    const sections: SectionState[] = (loc.sections ?? []).map((section) => {
      const key = `@${loc.name}/${section.name}`;
      const sectionVerdict = evaluateRules(section.access_rules, macros, count);
      return {
        key,
        locationName: loc.name,
        sectionName: section.name,
        reachability: combine(verdict, sectionVerdict),
        cleared: state.auto.checks[key] === true || manualClears.has(key),
        itemCount: section.item_count ?? 1
      };
    });

    if (sections.length > 0 || (loc.map_locations?.length ?? 0) > 0) {
      results.push({
        name: loc.name,
        path,
        reachability: verdict,
        mapLocations: loc.map_locations ?? [],
        sections,
        cleared: sections.length > 0 && sections.every((s) => s.cleared),
        hidden
      });
    }

    for (const child of loc.children ?? []) {
      walk(child, [...path, loc.name], verdict);
    }
  };

  for (const loc of ALL_LOCATIONS) walk(loc, [], 'green');
  return results;
}

export { ALL_LOCATIONS };
