import type { TrackerApi } from '../state/useTracker';
import { WALLS } from '../state/itemCatalog';

/**
 * Dungeon walls are manual-cycle widgets (their element isn't stored in RAM):
 * left-click cycles forward through the wall's stages, right-click backward.
 */
function WallCell({ def, tracker }: { def: (typeof WALLS)[number]; tracker: TrackerApi }): React.JSX.Element {
  const stage = tracker.state.manualStages[def.code] ?? 0;
  const current = def.stages[stage] ?? def.stages[0];
  if (!current) return <span />;
  return (
    <button
      className="item-cell active wall-cell"
      title={def.name}
      onClick={() => tracker.cycle(def.code, def.stages.length, 1)}
      onContextMenu={(e) => {
        e.preventDefault();
        tracker.cycle(def.code, def.stages.length, -1);
      }}
    >
      <img src={current.img} alt={def.name} draggable={false} />
      {current.overlay && <img className="wall-overlay" src={current.overlay} alt="" draggable={false} />}
    </button>
  );
}

export function WallGrid({ tracker }: { tracker: TrackerApi }): React.JSX.Element {
  return (
    <section className="item-section">
      <h3>Walls</h3>
      <div className="item-row wall-row">
        {WALLS.map((def) => (
          <WallCell key={def.code} def={def} tracker={tracker} />
        ))}
      </div>
    </section>
  );
}
