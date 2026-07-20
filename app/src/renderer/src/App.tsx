import { useState } from 'react';
import { Launcher } from './pages/Launcher';
import { Tracker } from './pages/Tracker';

export function App(): React.JSX.Element {
  // A location hash (#items / #map, set by dev flags) opens the tracker directly.
  const [page, setPage] = useState<'launcher' | 'tracker'>(
    window.location.hash ? 'tracker' : 'launcher'
  );

  return (
    <div>
      <nav className="app-nav">
        <button className={page === 'launcher' ? 'tab active' : 'tab'} onClick={() => setPage('launcher')}>
          Launcher
        </button>
        <button className={page === 'tracker' ? 'tab active' : 'tab'} onClick={() => setPage('tracker')}>
          Tracker
        </button>
      </nav>
      {page === 'launcher' ? <Launcher onLaunched={() => setPage('tracker')} /> : <Tracker />}
    </div>
  );
}
