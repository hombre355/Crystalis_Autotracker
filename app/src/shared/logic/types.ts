/** Reachability verdict for a location/section, PopTracker color convention. */
export type Reachability = 'green' | 'yellow' | 'red';

/** Everything the logic layer needs to know about current tracker state. */
export interface LogicInputs {
  /** PopTracker-style provider count for a code (items, flags, walls, doors, goa floors…). */
  count(code: string): number;
  /** Whether a location check (by pack "@Location/Section" ref) is already collected. */
  checkCleared(ref: string): boolean;
}

/** A macro callable from access rules: `$name` or `$name|arg`. */
export type Macro = (arg?: string) => boolean;

export type MacroTable = Record<string, Macro>;
