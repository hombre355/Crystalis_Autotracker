/**
 * Evaluator for the pack's access_rules grammar:
 *  - a location has an array of rule strings; rules are OR'd together
 *  - within a rule, comma-separated terms are AND'd
 *  - `$name` / `$name|arg` calls a logic macro
 *  - `[term]` marks a term needed only for FULL (green) access — the pack
 *    convention pairs `$canMaybeX, [$canX]`: without the bracketed sure-check
 *    the rule yields "maybe" (yellow)
 *  - a bare token is a provider-count check (count > 0)
 *  - empty strings are vacuously true (used in visibility_rules)
 *  - stray `{`/`}` (pack typos) are tolerated
 */
import type { MacroTable, Reachability } from './types';

interface ParsedTerm {
  bracketed: boolean;
  macro?: { name: string; arg?: string };
  bare?: string;
  empty: boolean;
}

function parseTerm(raw: string): ParsedTerm {
  let term = raw.trim().replace(/[{}]/g, '');
  let bracketed = false;
  if (term.startsWith('[') && term.endsWith(']')) {
    bracketed = true;
    term = term.slice(1, -1).trim();
  } else if (term.startsWith('[')) {
    // bracket opened here, closes in a later comma-term; treat leniently
    bracketed = true;
    term = term.slice(1).trim();
  } else if (term.endsWith(']')) {
    bracketed = true;
    term = term.slice(0, -1).trim();
  }
  if (term === '') return { bracketed, empty: true };
  if (term.startsWith('$')) {
    const [name, arg] = term.slice(1).split('|', 2);
    return { bracketed, macro: { name: name ?? '', arg }, empty: false };
  }
  return { bracketed, bare: term, empty: false };
}

/**
 * Bracket-aware comma split: `a, [b, c], d` -> `a`, `[b`, `c]`, `d` is wrong,
 * so track bracket depth and only split at depth 0.
 */
function splitTerms(rule: string): string[] {
  const terms: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of rule) {
    if (ch === '[') depth++;
    if (ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      terms.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  terms.push(current);
  return terms;
}

const warned = new Set<string>();

function evalTerm(
  term: ParsedTerm,
  macros: MacroTable,
  count: (code: string) => number
): boolean {
  if (term.empty) return true;
  if (term.macro) {
    const fn = macros[term.macro.name];
    if (!fn) {
      if (!warned.has(term.macro.name)) {
        warned.add(term.macro.name);
        console.warn(`unknown logic macro: $${term.macro.name}`);
      }
      return false;
    }
    return fn(term.macro.arg);
  }
  return count(term.bare!) > 0;
}

export interface RuleVerdict {
  /** All terms pass, including bracketed sure-checks. */
  sure: boolean;
  /** All non-bracketed terms pass (bracketed sure-checks may fail). */
  maybe: boolean;
}

export function evaluateRule(
  rule: string,
  macros: MacroTable,
  count: (code: string) => number
): RuleVerdict {
  // `[term, term]` groups: within a bracket group every term is a sure-check.
  let sure = true;
  let maybe = true;
  let depth = 0;
  for (const raw of splitTerms(rule)) {
    const opens = (raw.match(/\[/g) ?? []).length;
    const closes = (raw.match(/\]/g) ?? []).length;
    const inBracket = depth > 0 || opens > 0;
    depth = Math.max(0, depth + opens - closes);
    const term = parseTerm(raw);
    const ok = evalTerm(term, macros, count);
    if (!ok) {
      sure = false;
      if (!(inBracket || term.bracketed)) maybe = false;
    }
    if (!sure && !maybe) break;
  }
  return { sure, maybe };
}

/** Combine a location/section's access_rules (OR semantics) into a verdict. */
export function evaluateRules(
  rules: readonly string[] | undefined,
  macros: MacroTable,
  count: (code: string) => number
): Reachability {
  if (!rules || rules.length === 0) return 'green';
  let anyMaybe = false;
  for (const rule of rules) {
    const verdict = evaluateRule(rule, macros, count);
    if (verdict.sure) return 'green';
    if (verdict.maybe) anyMaybe = true;
  }
  return anyMaybe ? 'yellow' : 'red';
}
