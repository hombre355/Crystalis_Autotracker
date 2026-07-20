import { GOA_FLOOR_WIDGETS } from '@shared/tracker/goaFloors';
import type { TrackerApi } from '../state/useTracker';

/**
 * Goa Fortress floor order (Wg flag). Left-click cycles forward through
 * unknown -> each boss (normal/reversed); right-click cycles backward.
 * The selection drives the Goa reachability logic on the map.
 */
function FloorCell({
  widget,
  tracker
}: {
  widget: (typeof GOA_FLOOR_WIDGETS)[number];
  tracker: TrackerApi;
}): React.JSX.Element {
  const stage = tracker.state.manualStages[widget.code] ?? 0;
  const current = widget.stages[stage] ?? widget.stages[0]!;
  return (
    <button
      className={`item-cell ${stage === 0 ? 'inactive' : 'active'}`}
      title={current.label}
      onClick={() => tracker.cycle(widget.code, widget.stages.length, 1)}
      onContextMenu={(e) => {
        e.preventDefault();
        tracker.cycle(widget.code, widget.stages.length, -1);
      }}
    >
      <img src={current.img} alt={current.label} draggable={false} />
    </button>
  );
}

export function GoaFloors({ tracker }: { tracker: TrackerApi }): React.JSX.Element {
  return (
    <section className="item-section">
      <h3>Goa Floors</h3>
      <div className="item-row">
        {GOA_FLOOR_WIDGETS.map((widget) => (
          <FloorCell key={widget.code} widget={widget} tracker={tracker} />
        ))}
      </div>
    </section>
  );
}
