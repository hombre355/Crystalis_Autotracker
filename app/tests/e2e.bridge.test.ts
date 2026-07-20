/**
 * Live end-to-end test: real Mesen 2 (headless --testrunner) running bridge.lua,
 * streaming to a real LuaBridgeServer. Requires Mesen + a Crystalis ROM, so it
 * only runs when E2E=1:
 *
 *   E2E=1 npx vitest run tests/e2e.bridge.test.ts
 */
import { afterAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { LuaBridgeServer } from '../src/main/server/tcpServer';
import { DEFAULT_PORT, type LuaMessage } from '../src/shared/protocol/messages';

const MESEN = process.env.MESEN_PATH ?? '/Users/mrowe/Mesen_emu/Mesen.app/Contents/MacOS/Mesen';
const ROM = process.env.CRYSTALIS_ROM ?? '/Users/mrowe/Mesen_emu/Crystalis.nes';
const BRIDGE = new URL('../lua/bridge.lua', import.meta.url).pathname;

const enabled = process.env.E2E === '1';

let mesen: ChildProcess | null = null;
const server = new LuaBridgeServer();

afterAll(async () => {
  mesen?.kill('SIGKILL');
  await server.stop();
});

describe.skipIf(!enabled)('bridge.lua end-to-end via Mesen testrunner', () => {
  it(
    'connects, sends hello/gamestate/seed and ram snapshots',
    async () => {
      const messages: LuaMessage[] = [];
      const byType = (t: string) => messages.filter((m) => m.t === t);
      server.on('message', (m) => messages.push(m));
      await server.start(DEFAULT_PORT);

      mesen = spawn(MESEN, ['--testrunner', ROM, BRIDGE], { stdio: 'ignore' });

      // Wait until we have the essential message types or time out.
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        if (byType('hello').length > 0 && byType('seed').length > 0 && byType('ram').length > 0) {
          break;
        }
        await new Promise((r) => setTimeout(r, 200));
      }

      const hello = byType('hello')[0];
      expect(hello, 'no hello received').toBeDefined();
      if (hello?.t === 'hello') {
        expect(hello.proto).toBe(1);
        expect(hello.emu).toBe('mesen2');
      }

      expect(byType('gamestate').length, 'no gamestate received').toBeGreaterThan(0);

      const seed = byType('seed')[0];
      expect(seed, 'no seed received').toBeDefined();
      if (seed?.t === 'seed') expect(seed.checksum).toMatch(/^[0-9a-f]{16}$/);

      const ram = byType('ram')[0];
      expect(ram, 'no ram snapshot received').toBeDefined();
      if (ram?.t === 'ram') {
        // First snapshot must contain every watched region.
        expect(Object.keys(ram.regions).sort()).toEqual(['1bc0', '1f02', '6430', '6480']);
      }
    },
    45_000
  );
});
