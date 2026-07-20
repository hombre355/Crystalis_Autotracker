/**
 * Goa Fortress floor widgets (Wg flag: shuffled floor order).
 * Mirrors the pack's GoaFloorItem: each of the 4 floors cycles through
 * unknown -> each boss (normal / reversed). Stage codes feed the logic
 * engine (goa_logic.lua port): goa<floor><boss>, goa<boss>, goa<boss>_r,
 * goa<floor>unknown.
 */

export const GOA_BOSSES = ['kelbesque', 'sabera', 'mado', 'karmine'] as const;
export const GOA_FLOOR_NAMES = ['1st', '2nd', '3rd', '4th'] as const;

export interface GoaStage {
  /** Provider codes active at this stage. */
  codes: string[];
  /** Icon path relative to the assets root. */
  img: string;
  label: string;
}

export interface GoaFloorWidget {
  /** manualStages key, e.g. "goa1st". */
  code: string;
  floor: (typeof GOA_FLOOR_NAMES)[number];
  stages: GoaStage[];
}

export const GOA_FLOOR_WIDGETS: readonly GoaFloorWidget[] = GOA_FLOOR_NAMES.map((floor) => {
  const stages: GoaStage[] = [
    {
      codes: [`goa${floor}unknown`],
      img: `icons/goa/${floor}_badge.png`,
      label: `${floor} floor: unknown`
    }
  ];
  for (const boss of GOA_BOSSES) {
    stages.push({
      codes: [`goa${floor}${boss}`, `goa${boss}`],
      img: `icons/goa/${floor}_${boss}.png`,
      label: `${floor} floor: ${boss}`
    });
    stages.push({
      codes: [`goa${floor}${boss}`, `goa${boss}`, `goa${boss}_r`],
      img: `icons/goa/${floor}_${boss}_r.png`,
      label: `${floor} floor: ${boss} (reversed)`
    });
  }
  return { code: `goa${floor}`, floor, stages };
});
