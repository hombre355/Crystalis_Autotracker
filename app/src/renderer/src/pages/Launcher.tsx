import { useEffect, useState } from 'react';
import type { AppSettings as Settings, PresetInfo, SeedRecord } from '../window';

export function Launcher({ onLaunched }: { onLaunched: () => void }): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const [history, setHistory] = useState<SeedRecord[]>([]);
  const [presetName, setPresetName] = useState<string>('Casual');
  const [flagString, setFlagString] = useState<string>('');
  const [useCustomFlags, setUseCustomFlags] = useState(false);
  const [seed, setSeed] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void window.tracker.getSettings().then(setSettings);
    void window.tracker.listPresets().then((list) => {
      setPresets(list);
      const casual = list.find((p) => p.name === 'Casual');
      if (casual) setFlagString(casual.flagString);
    });
    void window.tracker.historyList().then(setHistory);
  }, []);

  const launchRom = async (romPath: string) => {
    setError(null);
    setBusy('Launching Mesen…');
    try {
      await window.tracker.launch(romPath);
      onLaunched();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(null);
    }
  };

  const generateAndLaunch = async () => {
    setError(null);
    setBusy('Generating seed…');
    try {
      const record = await window.tracker.generate(
        useCustomFlags ? { flagString, seed } : { presetName, seed }
      );
      setHistory(await window.tracker.historyList());
      setBusy('Launching Mesen…');
      await window.tracker.launch(record.romPath);
      onLaunched();
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setBusy(null);
    }
  };

  const pickAndLaunch = async () => {
    const rom = await window.tracker.pickRom();
    if (rom) await launchRom(rom);
  };

  const selectedPreset = presets.find((p) => p.name === presetName);

  return (
    <div className="launcher-page">
      <header className="tracker-header">
        <h1>Crystalis Autotracker</h1>
      </header>

      {error && <div className="error-banner">{error}</div>}
      {busy && <div className="busy-banner">{busy}</div>}

      <div className="launcher-cards">
        <section className="card">
          <h2>Play existing ROM</h2>
          <p className="muted">
            Launch Mesen with any Crystalis ROM — the tracking script attaches automatically.
          </p>
          <button className="primary" onClick={() => void pickAndLaunch()} disabled={busy !== null}>
            Choose ROM &amp; Launch
          </button>
        </section>

        <section className="card">
          <h2>New randomized seed</h2>
          <label className="field">
            <span>Preset</span>
            <select
              value={useCustomFlags ? '__custom__' : presetName}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setUseCustomFlags(true);
                } else {
                  setUseCustomFlags(false);
                  setPresetName(e.target.value);
                  const p = presets.find((x) => x.name === e.target.value);
                  if (p) setFlagString(p.flagString);
                }
              }}
            >
              {presets.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
              <option value="__custom__">Custom flags…</option>
            </select>
          </label>
          {!useCustomFlags && selectedPreset?.description && (
            <p className="muted small">{selectedPreset.description}</p>
          )}
          <label className="field">
            <span>Flags</span>
            <input
              className="mono"
              value={flagString}
              readOnly={!useCustomFlags}
              onChange={(e) => setFlagString(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Seed (optional)</span>
            <input
              className="mono"
              placeholder="random"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </label>
          <button className="primary" onClick={() => void generateAndLaunch()} disabled={busy !== null}>
            Generate &amp; Launch
          </button>
        </section>
      </div>

      <section className="card">
        <h2>Seed history</h2>
        {history.length === 0 && <p className="muted">No generated seeds yet.</p>}
        <ul className="history-list">
          {history.map((r) => (
            <li key={r.id}>
              <div className="history-info">
                <span className="mono">{r.seed}</span>
                <span className="mono muted">{r.flagString}</span>
                <span className="muted small">{new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <div className="history-actions">
                <button onClick={() => void launchRom(r.romPath)} disabled={busy !== null}>
                  Play
                </button>
                <button
                  className="danger"
                  onClick={() => void window.tracker.historyRemove(r.id).then(setHistory)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card settings-card">
        <h2>Settings</h2>
        <div className="settings-row">
          <span className="muted">Mesen.app</span>
          <span className="mono small">{settings?.mesenAppPath || '(not set)'}</span>
          <button
            onClick={() => void window.tracker.pickMesen().then((s) => s && setSettings(s))}
          >
            Change
          </button>
        </div>
        <div className="settings-row">
          <span className="muted">Vanilla ROM</span>
          <span className="mono small">{settings?.vanillaRomPath || '(not set)'}</span>
          <button
            onClick={() =>
              void window.tracker.pickRom().then(async (rom) => {
                if (rom) setSettings(await window.tracker.setSettings({ vanillaRomPath: rom }));
              })
            }
          >
            Change
          </button>
        </div>
      </section>
    </div>
  );
}
