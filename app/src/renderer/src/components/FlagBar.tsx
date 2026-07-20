import { useState } from 'react';
import type { TrackerApi } from '../state/useTracker';

/**
 * Shows the active randomizer flags. Auto-populated when the flag string is
 * scraped from the in-game menu; a manual entry field covers ROMs the app
 * didn't generate (before the player has opened the menu).
 */
export function FlagBar({ tracker }: { tracker: TrackerApi }): React.JSX.Element {
  const { state } = tracker;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = () => {
    tracker.setFlags(draft.trim());
    setEditing(false);
  };

  return (
    <div className="flag-strip mono" title="Randomizer flags (auto-detected from the in-game menu)">
      {editing ? (
        <span className="flag-edit">
          <input
            autoFocus
            value={draft}
            placeholder="e.g. Ds Ecdrstux Rt Vds!mw"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
          <button onClick={submit}>set</button>
        </span>
      ) : (
        <>
          <span>{state.rawFlags ?? '(flags unknown — open the in-game menu, or set manually)'}</span>
          <button
            className="flag-edit-btn"
            onClick={() => {
              setDraft(state.rawFlags ?? '');
              setEditing(true);
            }}
          >
            edit
          </button>
        </>
      )}
    </div>
  );
}
