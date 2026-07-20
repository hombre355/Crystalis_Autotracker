import { effectiveValue } from '@shared/tracker/store';
import type { TrackerApi } from '../state/useTracker';
import { ITEM_SECTIONS, imageFor, nameFor } from '../state/itemCatalog';

function ItemCell({ code, tracker }: { code: string; tracker: TrackerApi }): React.JSX.Element {
  const active = effectiveValue(tracker.state, code);
  const overridden = code in tracker.state.overrides;
  return (
    <button
      className={`item-cell ${active ? 'active' : 'inactive'} ${overridden ? 'overridden' : ''}`}
      title={`${nameFor(code)}${overridden ? ' (manual override — right-click to reset)' : ''}`}
      onClick={() => tracker.toggle(code)}
      onContextMenu={(e) => {
        e.preventDefault();
        tracker.clear(code);
      }}
    >
      <img src={imageFor(code)} alt={nameFor(code)} draggable={false} />
    </button>
  );
}

export function ItemGrid({ tracker }: { tracker: TrackerApi }): React.JSX.Element {
  return (
    <section className="item-grid">
      {ITEM_SECTIONS.map((section) => (
        <div key={section.title} className="item-section">
          <h3>{section.title}</h3>
          <div className="item-row">
            {section.codes.map((code) => (
              <ItemCell key={code} code={code} tracker={tracker} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
