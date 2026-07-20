import { useMemo, useState } from 'react';
import mapsJson from '../../../data/maps.json';
import { computeLogic, type LocationState } from '@shared/logic/evaluate';
import type { TrackerApi } from '../state/useTracker';

interface MapDef {
  name: string;
  img: string;
  location_size?: number;
}

const MAPS = mapsJson as MapDef[];
const DEFAULT_PIN_SIZE = 24;

function pinColor(loc: LocationState): string {
  if (loc.cleared) return 'var(--muted)';
  switch (loc.reachability) {
    case 'green':
      return 'var(--good)';
    case 'yellow':
      return '#facc15';
    default:
      return 'var(--bad)';
  }
}

function sectionGlyph(reachability: string, cleared: boolean): string {
  if (cleared) return '✓';
  if (reachability === 'green') return '●';
  if (reachability === 'yellow') return '◐';
  return '○';
}

export function MapView({ tracker }: { tracker: TrackerApi }): React.JSX.Element {
  const [mapName, setMapName] = useState('map_overworld');
  const [zoom, setZoom] = useState(0.5);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const manualClears = useMemo(
    () => new Set(Object.keys(tracker.state.manualClears)),
    [tracker.state.manualClears]
  );
  const locations = useMemo(
    () => computeLogic(tracker.state, manualClears),
    [tracker.state, manualClears]
  );

  const map = MAPS.find((m) => m.name === mapName) ?? MAPS[0]!;
  const pinSize = map.location_size ?? DEFAULT_PIN_SIZE;

  const pins = locations.flatMap((loc) =>
    loc.hidden
      ? []
      : loc.mapLocations
          .filter((ml) => ml.map === map.name)
          .map((ml) => ({ loc, x: ml.x, y: ml.y, size: ml.size ?? pinSize }))
  );

  const toggle = (loc: LocationState) => {
    const allCleared = loc.sections.every((s) => s.cleared);
    for (const section of loc.sections) {
      const manuallyCleared = tracker.state.manualClears[section.key] === true;
      // Clearing: mark every un-cleared section. Unclearing: only lift manual marks.
      if (allCleared ? manuallyCleared : !section.cleared) {
        tracker.toggleClear(section.key);
      }
    }
  };

  return (
    <div className="map-view">
      <div className="map-toolbar">
        <select value={map.name} onChange={(e) => { setMapName(e.target.value); setImgSize(null); }}>
          {MAPS.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name.replace(/^map_/, '').replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <div className="zoom-controls">
          <button onClick={() => setZoom((z) => Math.max(0.2, Math.round((z - 0.1) * 10) / 10))}>−</button>
          <span className="mono">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, Math.round((z + 0.1) * 10) / 10))}>+</button>
        </div>
        <span className="map-legend">
          <span className="legend-dot" style={{ background: 'var(--good)' }} /> reachable
          <span className="legend-dot" style={{ background: '#facc15' }} /> maybe
          <span className="legend-dot" style={{ background: 'var(--bad)' }} /> blocked
        </span>
      </div>
      <div className="map-scroll">
        <div
          className="map-canvas"
          style={
            imgSize
              ? { width: imgSize.w * zoom, height: imgSize.h * zoom }
              : undefined
          }
        >
          <div className="map-inner" style={{ transform: `scale(${zoom})` }}>
            <img
              src={map.img}
              alt={map.name}
              draggable={false}
              onLoad={(e) =>
                setImgSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
              }
            />
            {pins.map((pin, i) => (
              <button
                key={`${pin.loc.name}-${i}`}
                className={`map-pin ${pin.loc.cleared ? 'cleared' : ''}`}
                style={{
                  left: pin.x,
                  top: pin.y,
                  width: Math.max(12, pin.size),
                  height: Math.max(12, pin.size),
                  background: pinColor(pin.loc)
                }}
                title={`${pin.loc.name}\n${pin.loc.sections
                  .map((s) => `${sectionGlyph(s.reachability, s.cleared)} ${s.sectionName}`)
                  .join('\n')}`}
                onClick={() => toggle(pin.loc)}
              >
                {!pin.loc.cleared && pin.loc.sections.length > 1
                  ? pin.loc.sections.filter((s) => !s.cleared).length
                  : ''}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
