import { effectiveValue } from '@shared/tracker/store';
import type { TrackerApi } from '../state/useTracker';
import { BOSS_DEFS } from '../state/itemCatalog';

/**
 * Bosses: "cleared" comes from RAM (click to override); a second manual
 * "tested" stage (right-click) mirrors the pack's progressive boss item,
 * used to mark a boss as scouted for its element.
 */
function BossCell({ def, tracker }: { def: (typeof BOSS_DEFS)[number]; tracker: TrackerApi }): React.JSX.Element {
  const cleared = effectiveValue(tracker.state, def.code);
  const tested = (tracker.state.manualStages[def.code] ?? 0) === 1 && def.testedImg;
  return (
    <button
      className={`item-cell ${cleared || tested ? 'active' : 'inactive'}`}
      title={`${def.name}${tested ? ' (tested)' : cleared ? ' (cleared)' : ''}`}
      onClick={() => tracker.toggle(def.code)}
      onContextMenu={(e) => {
        e.preventDefault();
        if (def.testedImg) tracker.cycle(def.code, 2, 1);
      }}
    >
      <img src={tested ? def.testedImg! : def.clearedImg} alt={def.name} draggable={false} />
    </button>
  );
}

export function BossGrid({ tracker }: { tracker: TrackerApi }): React.JSX.Element {
  return (
    <section className="item-section">
      <h3>Bosses</h3>
      <div className="item-row">
        {BOSS_DEFS.map((def) => (
          <BossCell key={def.code} def={def} tracker={tracker} />
        ))}
      </div>
    </section>
  );
}
