/**
 * Crystalis randomizer flag-string parsing.
 *
 * A flag string is space-separated groups like "Gt Mr Ps Rlpt Sct Tab Wmtuw".
 * Each group: one uppercase category letter followed by option letters.
 * Modifiers apply to the NEXT option letter:  '!' = hard/forced variant,
 * '?' = mystery (randomly decided, hidden from the player).
 *
 * Flag codes are category+option lowercased ("Wu" -> "wu"), matching the
 * reference pack's flag_<code> item codes.
 */

export interface ParsedFlags {
  /** Flags definitely on (includes strict ones). */
  on: Set<string>;
  /** Subset of `on` requested with '!' (hard variant). */
  strict: Set<string>;
  /** Flags marked '?': state unknown at parse time. */
  mystery: Set<string>;
}

const GROUP_RE = /[A-Z][a-z!?]*/g;

export function parseFlagString(raw: string): ParsedFlags {
  const on = new Set<string>();
  const strict = new Set<string>();
  const mystery = new Set<string>();

  for (const group of raw.match(GROUP_RE) ?? []) {
    const category = group[0]!.toLowerCase();
    let mod: '!' | '?' | null = null;
    for (const ch of group.slice(1)) {
      if (ch === '!' || ch === '?') {
        mod = ch;
        continue;
      }
      const code = category + ch;
      if (mod === '?') {
        mystery.add(code);
      } else {
        on.add(code);
        if (mod === '!') strict.add(code);
      }
      mod = null;
    }
  }

  return { on, strict, mystery };
}

/** True when the given flag code is on (mystery flags count as off). */
export function hasFlag(flags: ParsedFlags | null, code: string): boolean {
  return flags?.on.has(code) ?? false;
}
