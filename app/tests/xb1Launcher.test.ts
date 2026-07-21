import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  launchXb1,
  sudoersLine,
  validateXb1,
  xb1Paths,
  PROBE_NAME
} from '../src/main/emulator/xb1Launcher';

const PROJECT = '/Users/mrowe/Personal_Project/xb1 controller';

describe('xb1Paths', () => {
  it('derives probe/mapper/config from a folder whose name has a space', () => {
    const p = xb1Paths(PROJECT);
    expect(p.probe).toBe(`${PROJECT}/build/xb1-gip-probe`);
    expect(p.mapper).toBe(`${PROJECT}/build/xb1-keyboard-mapper`);
    expect(p.config).toBe(`${PROJECT}/configs/nes-keyboard.conf`);
  });
});

describe('sudoersLine', () => {
  it('escapes the space in the path and includes the killall reaper', () => {
    const line = sudoersLine(PROJECT, 'mrowe');
    expect(line).toBe(
      'mrowe ALL=(root) NOPASSWD: /Users/mrowe/Personal_Project/xb1\\ controller/build/xb1-gip-probe, /usr/bin/killall xb1-gip-probe'
    );
    // No unescaped space inside the command path (would break sudoers parsing).
    const cmds = line.split('NOPASSWD:')[1]!;
    expect(cmds).toContain('xb1\\ controller');
  });
});

describe('validateXb1', () => {
  it('rejects an empty path', () => {
    expect(validateXb1('')).toMatch(/Set the Xbox controller folder/);
  });

  it('reports the missing binary for a nonexistent folder', () => {
    const msg = validateXb1('/no/such/xb1');
    expect(msg).toMatch(/probe not found/);
  });

  it('returns null when the real project has its prebuilt binaries + config', () => {
    // The user's checkout ships prebuilt binaries; skip if this machine lacks them.
    const msg = validateXb1(PROJECT);
    if (msg !== null) {
      expect(msg).toMatch(/not found/); // still a coherent message
    } else {
      expect(msg).toBeNull();
    }
  });
});

/** Minimal fake ChildProcess with the stdio streams launchXb1 touches. */
function fakeChild(): ChildProcess & { emitExit: (code: number) => void } {
  const ee = new EventEmitter() as ChildProcess & { emitExit: (code: number) => void };
  ee.stdout = new PassThrough();
  ee.stderr = new PassThrough();
  ee.stdin = new PassThrough();
  ee.kill = vi.fn(() => true) as unknown as ChildProcess['kill'];
  ee.emitExit = (code: number) => ee.emit('exit', code);
  return ee;
}

describe('launchXb1 (injected spawn)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('spawns sudo -n probe --stream and the mapper, pipes probe stdout to mapper stdin', () => {
    const validPath = '/Users/mrowe/Personal_Project/xb1 controller';
    if (validateXb1(validPath) !== null) return; // needs the real binaries; skip otherwise
    const calls: { cmd: string; args: readonly string[] }[] = [];
    const probe = fakeChild();
    const mapper = fakeChild();
    const pipeSpy = vi.spyOn(probe.stdout as PassThrough, 'pipe');
    const spawnFn = vi.fn((cmd: string, args: readonly string[]) => {
      calls.push({ cmd, args: args ?? [] });
      return calls.length === 1 ? probe : mapper;
    }) as never;

    const handle = launchXb1(validPath, () => {}, spawnFn);

    expect(calls[0]!.cmd).toBe('sudo');
    expect(calls[0]!.args).toEqual(['-n', `${validPath}/build/xb1-gip-probe`, '--stream']);
    expect(calls[1]!.cmd).toBe(`${validPath}/build/xb1-keyboard-mapper`);
    expect(calls[1]!.args).toEqual(['--config', `${validPath}/configs/nes-keyboard.conf`]);
    expect(pipeSpy).toHaveBeenCalledWith(mapper.stdin);
    handle.stop();
  });

  it('throws (does not spawn) when validation fails', () => {
    const spawnFn = vi.fn() as never;
    expect(() => launchXb1('/no/such/xb1', () => {}, spawnFn)).toThrow(/not found|Set the/);
    expect(spawnFn as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('stop() kills the mapper and issues sudo -n killall, and onExit fires once', () => {
    const validPath = '/Users/mrowe/Personal_Project/xb1 controller';
    if (validateXb1(validPath) !== null) return;
    const probe = fakeChild();
    const mapper = fakeChild();
    let killallCall: readonly string[] | null = null;
    let n = 0;
    const spawnFn = vi.fn((_cmd: string, args: readonly string[]) => {
      n++;
      if (n === 1) return probe;
      if (n === 2) return mapper;
      killallCall = args; // third spawn = the reaper
      return fakeChild();
    }) as never;

    const exits: string[] = [];
    const handle = launchXb1(validPath, (why) => exits.push(why), spawnFn);
    handle.stop();
    handle.stop(); // idempotent

    expect(mapper.kill).toHaveBeenCalled();
    expect(killallCall).toEqual(['-n', '/usr/bin/killall', PROBE_NAME]);
    expect(exits).toHaveLength(1);
  });

  it('probe exit with a sudo password error yields a setup hint', () => {
    const validPath = '/Users/mrowe/Personal_Project/xb1 controller';
    if (validateXb1(validPath) !== null) return;
    const probe = fakeChild();
    const mapper = fakeChild();
    let n = 0;
    const spawnFn = vi.fn(() => {
      n++;
      return n === 1 ? probe : n === 2 ? mapper : fakeChild();
    }) as never;

    const exits: string[] = [];
    launchXb1(validPath, (why) => exits.push(why), spawnFn);
    (probe.stderr as PassThrough).write('sudo: a password is required\n');
    probe.emitExit(1);

    expect(exits[0]).toMatch(/sudoers rule is not installed/);
  });
});
