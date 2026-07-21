import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Xbox controller bridge: runs the xb1-gip-probe (as root, via a passwordless
 * sudoers rule) piped into xb1-keyboard-mapper (unprivileged) so a wired XB1
 * Classic Controller drives the NES emulator's keyboard controls.
 *
 * See docs/xb1-controller-setup.md for the one-time sudoers + Accessibility setup.
 * Only the probe needs root; the mapper stays unprivileged so its macOS
 * Accessibility permission belongs to the normal user account.
 */

export const PROBE_NAME = 'xb1-gip-probe';
const MAPPER_NAME = 'xb1-keyboard-mapper';
const CONFIG_REL = ['configs', 'nes-keyboard.conf'];
const KILLALL = '/usr/bin/killall';

export interface Xb1Paths {
  probe: string;
  mapper: string;
  config: string;
}

/** Derive the probe/mapper/config paths from the xb1 project folder. */
export function xb1Paths(projectPath: string): Xb1Paths {
  return {
    probe: join(projectPath, 'build', PROBE_NAME),
    mapper: join(projectPath, 'build', MAPPER_NAME),
    config: join(projectPath, ...CONFIG_REL)
  };
}

/**
 * The exact `/etc/sudoers.d` rule text that lets the app run the probe (and reap
 * it) without a password. sudoers requires spaces in command paths to be
 * backslash-escaped; a mangled rule silently denies, so this must be precise.
 */
export function sudoersLine(projectPath: string, user: string): string {
  const probe = xb1Paths(projectPath).probe.replace(/ /g, '\\ ');
  return `${user} ALL=(root) NOPASSWD: ${probe}, ${KILLALL} ${PROBE_NAME}`;
}

/** null when the bridge can run; otherwise a human-readable reason it can't. */
export function validateXb1(projectPath: string): string | null {
  if (!projectPath) return 'Set the Xbox controller folder in Settings first.';
  const paths = xb1Paths(projectPath);
  if (!existsSync(paths.probe)) {
    return `Controller probe not found at ${paths.probe} — build it with "make" in the xb1 controller folder.`;
  }
  if (!existsSync(paths.mapper)) {
    return `Keyboard mapper not found at ${paths.mapper} — build it with "make" in the xb1 controller folder.`;
  }
  if (!existsSync(paths.config)) {
    return `Keyboard config not found at ${paths.config}.`;
  }
  return null;
}

type SpawnFn = typeof nodeSpawn;

export interface Xb1Handle {
  probe: ChildProcess;
  mapper: ChildProcess;
  stop(): void;
}

/**
 * Start the probe|mapper pipeline. `onExit` fires once with a reason when either
 * half exits or fails to start (so callers can surface a setup hint). `spawnFn`
 * is injectable for tests.
 */
export function launchXb1(
  projectPath: string,
  onExit: (why: string) => void,
  spawnFn: SpawnFn = nodeSpawn
): Xb1Handle {
  const reason = validateXb1(projectPath);
  if (reason) throw new Error(reason);
  const paths = xb1Paths(projectPath);

  // `sudo -n` = non-interactive: with the sudoers rule it runs silently; without
  // it, sudo exits immediately instead of hanging on a password prompt.
  const probe = spawnFn('sudo', ['-n', paths.probe, '--stream'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const mapper = spawnFn(paths.mapper, ['--config', paths.config], {
    stdio: ['pipe', 'ignore', 'pipe']
  });

  if (probe.stdout && mapper.stdin) probe.stdout.pipe(mapper.stdin);

  let stderrTail = '';
  probe.stderr?.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString('utf8')).slice(-500);
  });

  let done = false;
  let killalled = false;
  const finish = (why: string) => {
    if (done) return;
    done = true;
    // Tear the other half down so we never leave a half-open pipeline.
    reapProbe();
    try {
      mapper.kill();
    } catch {
      /* already gone */
    }
    onExit(why);
  };

  function reapProbe(): void {
    if (killalled) return;
    killalled = true;
    // The probe runs as root; the unprivileged app can't SIGKILL it directly,
    // so reap it via the passwordless `killall` allowed by the sudoers rule.
    try {
      spawnFn('sudo', ['-n', KILLALL, PROBE_NAME], { stdio: 'ignore' });
    } catch {
      /* best effort */
    }
    try {
      probe.kill();
    } catch {
      /* already gone */
    }
  }

  probe.on('error', (err) =>
    finish(`Could not start the controller probe: ${err.message}. See docs/xb1-controller-setup.md`)
  );
  mapper.on('error', (err) =>
    finish(`Could not start the keyboard mapper: ${err.message}. See docs/xb1-controller-setup.md`)
  );
  probe.on('exit', (code) => {
    if (code && code !== 0) {
      const hint = /password is required|not allowed/i.test(stderrTail)
        ? 'the sudoers rule is not installed — see docs/xb1-controller-setup.md'
        : stderrTail.trim() || `exit code ${code}`;
      finish(`Controller probe stopped: ${hint}`);
    } else {
      finish('Controller bridge stopped.');
    }
  });
  mapper.on('exit', () => finish('Controller bridge stopped.'));

  return {
    probe,
    mapper,
    stop() {
      finish('Controller bridge stopped.');
    }
  };
}
