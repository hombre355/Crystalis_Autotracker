import { useEffect, useState } from 'react';
import type { SeedRecord } from '../window';

interface SpoilerSlot {
  slot: number;
  slotName: string;
  item: number;
  itemName: string;
  originalItem?: string;
}

interface SpoilerData {
  slots?: (SpoilerSlot | null)[];
  wildWarps?: unknown;
  flags?: unknown;
}

/**
 * Click-to-reveal spoiler viewer for app-generated seeds. Every row starts
 * hidden; reveal one at a time (or all) when you're truly stuck.
 */
export function SpoilerViewer(): React.JSX.Element {
  const [records, setRecords] = useState<SeedRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [spoiler, setSpoiler] = useState<SpoilerData | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [revealAll, setRevealAll] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    void window.tracker.historyList().then((list) => {
      const withSpoilers = list.filter((r) => r.spoilerPath);
      setRecords(withSpoilers);
      if (withSpoilers[0]) setSelectedId(withSpoilers[0].id);
    });
  }, []);

  useEffect(() => {
    const record = records.find((r) => r.id === selectedId);
    if (!record?.spoilerPath) {
      setSpoiler(null);
      return;
    }
    setRevealed(new Set());
    setRevealAll(false);
    void window.tracker.readSpoiler(record.spoilerPath).then((data) => {
      setSpoiler((data as SpoilerData) ?? null);
    });
  }, [selectedId, records]);

  const slots = (spoiler?.slots ?? []).filter(
    (s): s is SpoilerSlot =>
      s !== null && typeof s === 'object' && typeof s.slotName === 'string'
  );
  const visible = slots.filter(
    (s) => filter === '' || s.slotName.toLowerCase().includes(filter.toLowerCase())
  );

  if (records.length === 0) {
    return (
      <p className="hint">
        No spoiler logs yet — they're saved automatically for seeds generated in the app.
      </p>
    );
  }

  return (
    <div className="spoiler-view">
      <div className="map-toolbar">
        <select value={selectedId ?? ''} onChange={(e) => setSelectedId(e.target.value)}>
          {records.map((r) => (
            <option key={r.id} value={r.id}>
              {r.seed} — {new Date(r.createdAt).toLocaleDateString()}
            </option>
          ))}
        </select>
        <input
          className="spoiler-filter"
          placeholder="filter checks…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button onClick={() => setRevealAll((v) => !v)}>
          {revealAll ? 'Hide all' : 'Reveal all'}
        </button>
      </div>
      <ul className="spoiler-list">
        {visible.map((slot) => {
          const shown = revealAll || revealed.has(slot.slot);
          return (
            <li key={slot.slot}>
              <span className="spoiler-slot">{slot.slotName}</span>
              {shown ? (
                <span className="spoiler-item">{slot.itemName}</span>
              ) : (
                <button
                  className="spoiler-reveal"
                  onClick={() => setRevealed((prev) => new Set(prev).add(slot.slot))}
                >
                  reveal
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
