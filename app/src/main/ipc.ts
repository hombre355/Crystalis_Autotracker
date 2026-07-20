import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import { parseLuaLine, type LuaMessage } from '../shared/protocol/messages';
import type { LuaBridgeServer } from './server/tcpServer';
import { loadSettings, saveSettings, type Settings } from './store/settings';
import { addHistory, listHistory, removeHistory, type SeedRecord } from './store/seedHistory';
import { generateRom, listPresets } from './randomizer/generate';
import { launchMesen } from './emulator/mesenLauncher';

export const BRIDGE_CHANNEL = 'bridge:event';

export interface BridgeEvent {
  kind: 'connect' | 'disconnect' | 'message' | 'emulator-exit';
  message?: LuaMessage;
}

function push(getWindow: () => BrowserWindow | null, event: BridgeEvent): void {
  const win = getWindow();
  if (win && !win.isDestroyed()) win.webContents.send(BRIDGE_CHANNEL, event);
}

/** Forward bridge server events to the renderer. */
export function wireBridgeToRenderer(
  bridge: LuaBridgeServer,
  getWindow: () => BrowserWindow | null
): void {
  bridge.on('connect', () => push(getWindow, { kind: 'connect' }));
  bridge.on('disconnect', () => push(getWindow, { kind: 'disconnect' }));
  bridge.on('message', (message) => push(getWindow, { kind: 'message', message }));
  bridge.on('error', (err) => console.error('Bridge server error:', err));
}

let mesenChild: ChildProcess | null = null;

/** Register all renderer->main command handlers. */
export function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('settings:get', (): Settings => loadSettings());
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>): Settings => saveSettings(patch));

  ipcMain.handle('settings:pickMesen', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Mesen.app',
      properties: ['openFile'],
      filters: [{ name: 'Application', extensions: ['app'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return saveSettings({ mesenAppPath: result.filePaths[0] });
  });

  ipcMain.handle('settings:pickRom', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select a Crystalis ROM',
      properties: ['openFile'],
      filters: [{ name: 'NES ROM', extensions: ['nes'] }]
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('randomizer:presets', () => listPresets());

  ipcMain.handle(
    'randomizer:generate',
    async (_e, opts: { flagString?: string; presetName?: string; seed?: string }) => {
      const settings = loadSettings();
      if (!settings.vanillaRomPath) throw new Error('Set the vanilla ROM path first');
      const result = await generateRom({
        ...opts,
        vanillaRomPath: settings.vanillaRomPath,
        outputDir: settings.outputDir
      });
      const record: SeedRecord = {
        id: result.id,
        createdAt: new Date().toISOString(),
        seed: result.seed,
        flagString: result.flagString,
        presetName: opts.presetName,
        romPath: result.romPath,
        crc: result.crc,
        spoilerPath: result.spoilerPath
      };
      addHistory(record);
      return record;
    }
  );

  ipcMain.handle('emulator:launch', (_e, romPath: string) => {
    const settings = loadSettings();
    const handle = launchMesen(settings.mesenAppPath, romPath, settings.bridgePort, () => {
      mesenChild = null;
      push(getWindow, { kind: 'emulator-exit' });
    });
    mesenChild = handle.child;
    return { pid: handle.child.pid ?? -1 };
  });

  ipcMain.handle('emulator:running', () => mesenChild !== null);

  ipcMain.handle('history:list', () => listHistory());
  ipcMain.handle('history:remove', (_e, id: string) => removeHistory(id));

  ipcMain.handle('spoiler:read', (_e, path: string) => {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return null;
    }
  });
}

/**
 * Dev harness: replay a captured JSONL session file instead of listening
 * for a live emulator (--fake-lua=path).
 */
export function startFakeLuaReplay(
  path: string,
  getWindow: () => BrowserWindow | null,
  intervalMs = 150
): void {
  const lines = readFileSync(path, 'utf8').split('\n');
  const messages: LuaMessage[] = [];
  for (const line of lines) {
    const msg = parseLuaLine(line);
    if (msg) messages.push(msg);
  }
  console.log(`fake-lua: replaying ${messages.length} messages from ${path}`);
  let i = 0;
  push(getWindow, { kind: 'connect' });
  const timer = setInterval(() => {
    const msg = messages[i++];
    if (!msg) {
      clearInterval(timer);
      return;
    }
    push(getWindow, { kind: 'message', message: msg });
  }, intervalMs);
}
