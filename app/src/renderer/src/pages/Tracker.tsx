import { useState } from 'react';
import { ConnectionBadge } from '../components/ConnectionBadge';
import { StatsBar } from '../components/StatsBar';
import { ItemGrid } from '../components/ItemGrid';
import { BossGrid } from '../components/BossGrid';
import { WallGrid } from '../components/WallGrid';
import { GoaFloors } from '../components/GoaFloors';
import { MapView } from '../components/MapView';
import { FlagBar } from '../components/FlagBar';
import { SpoilerViewer } from '../components/SpoilerViewer';
import { useTracker } from '../state/useTracker';

const GAME_STATE_LABEL: Record<number, string> = {
  1: 'In game',
  3: 'In menu'
};

export function Tracker(): React.JSX.Element {
  const tracker = useTracker();
  const { state } = tracker;
  const [view, setView] = useState<'items' | 'map' | 'spoiler'>(
    window.location.hash === '#map' ? 'map' : 'items'
  );

  return (
    <div className="tracker-page">
      <header className="tracker-header">
        <h1>Crystalis Autotracker</h1>
        <div className="header-status">
          {state.gameState !== null && (
            <span className="pill">{GAME_STATE_LABEL[state.gameState] ?? `state 0x${state.gameState.toString(16)}`}</span>
          )}
          {state.seed && <span className="pill mono">seed {state.seed.slice(0, 8)}</span>}
          <ConnectionBadge connected={state.connected} />
        </div>
      </header>

      <FlagBar tracker={tracker} />

      <StatsBar stats={state.stats} />

      <div className="subtabs">
        <button className={view === 'items' ? 'tab active' : 'tab'} onClick={() => setView('items')}>
          Items
        </button>
        <button className={view === 'map' ? 'tab active' : 'tab'} onClick={() => setView('map')}>
          Map
        </button>
        <button className={view === 'spoiler' ? 'tab active' : 'tab'} onClick={() => setView('spoiler')}>
          Spoiler
        </button>
      </div>

      {view === 'items' ? (
        <>
          <ItemGrid tracker={tracker} />
          <div className="grid-2col">
            <BossGrid tracker={tracker} />
            <GoaFloors tracker={tracker} />
          </div>
          <WallGrid tracker={tracker} />
        </>
      ) : view === 'map' ? (
        <MapView tracker={tracker} />
      ) : (
        <SpoilerViewer />
      )}

      {!state.connected && (
        <p className="hint">
          Waiting for Mesen… Load Crystalis with the bridge script (the launcher does this
          automatically), or run with <code>--fake-lua=&lt;session.jsonl&gt;</code> for a replay.
        </p>
      )}
    </div>
  );
}
