import type { Stats } from '@shared/ram/decoders';

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value mono">{value}</span>
    </div>
  );
}

export function StatsBar({ stats }: { stats: Stats | null }): React.JSX.Element {
  return (
    <section className="stats-bar">
      <Stat label="HP" value={stats ? `${stats.hp}/${stats.maxHp}` : '—'} />
      <Stat label="MP" value={stats ? `${stats.mp}/${stats.maxMp}` : '—'} />
      <Stat label="Gold" value={stats ? String(stats.gold) : '—'} />
      <Stat
        label="EXP"
        value={stats ? `${stats.exp} (${stats.expToNext} to next)` : '—'}
      />
    </section>
  );
}
