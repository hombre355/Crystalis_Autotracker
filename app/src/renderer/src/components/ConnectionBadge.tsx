export function ConnectionBadge({ connected }: { connected: boolean }): React.JSX.Element {
  return (
    <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
      <span className="dot" />
      {connected ? 'Mesen connected' : 'Not connected'}
    </span>
  );
}
