import { useEffect, useState } from 'react';
import type { AppSettings } from '../window';

interface Xb1StatusEvent {
  kind: string;
  running?: boolean;
  error?: string;
}

/**
 * Xbox controller bridge settings + status, shown inside the Launcher's
 * Settings card. Handles the one-time setup affordances (sudoers rule text,
 * Accessibility prompt) and a live running/stopped/error indicator.
 */
export function ControllerSettings({
  settings,
  onSettings
}: {
  settings: AppSettings | null;
  onSettings: (s: AppSettings) => void;
}): React.JSX.Element {
  const [running, setRunning] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [sudoers, setSudoers] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void window.tracker.xb1Running().then(setRunning);
    return window.tracker.onBridgeEvent((raw) => {
      const event = raw as Xb1StatusEvent;
      if (event.kind !== 'xb1-status') return;
      setRunning(event.running === true);
      setStatusError(event.error ?? null);
    });
  }, []);

  const enabled = settings?.xb1Enabled ?? false;

  const toggleEnabled = async () => {
    const next = await window.tracker.setSettings({ xb1Enabled: !enabled });
    onSettings(next);
  };

  const showSudoers = async () => {
    if (sudoers) {
      setSudoers(null);
      return;
    }
    setSudoers(await window.tracker.xb1SudoersLine());
  };

  const copySudoers = async () => {
    if (!sudoers) return;
    await navigator.clipboard.writeText(sudoers);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="controller-settings">
      <div className="settings-row">
        <span className="muted">Xbox controller</span>
        <span className="mono small">{settings?.xb1ProjectPath || '(not set)'}</span>
        <button onClick={() => void window.tracker.pickXb1().then((s) => s && onSettings(s))}>
          Change
        </button>
      </div>

      <div className="settings-row">
        <span className="muted">Auto-start with game</span>
        <span className="controller-status">
          {running ? (
            <span className="status-on">● bridge running</span>
          ) : statusError ? (
            <span className="status-err" title={statusError}>
              ● {statusError}
            </span>
          ) : (
            <span className="muted">stopped</span>
          )}
        </span>
        <button
          className={enabled ? 'toggle on' : 'toggle'}
          onClick={() => void toggleEnabled()}
          disabled={!settings}
        >
          {enabled ? 'On' : 'Off'}
        </button>
      </div>

      <div className="controller-setup">
        <button onClick={() => void showSudoers()}>
          {sudoers ? 'Hide sudoers rule' : 'Show sudoers rule'}
        </button>
        <button onClick={() => void window.tracker.xb1RequestAccess()}>
          Grant keyboard access
        </button>
      </div>

      {sudoers && (
        <div className="sudoers-box">
          <p className="muted small">
            One-time setup. Run <code className="mono">sudo visudo -f /etc/sudoers.d/xb1-autotracker</code>{' '}
            and paste this line (see <code>docs/xb1-controller-setup.md</code>):
          </p>
          <pre className="mono sudoers-line">{sudoers}</pre>
          <button onClick={() => void copySudoers()}>{copied ? 'Copied!' : 'Copy'}</button>
        </div>
      )}
    </div>
  );
}
