import { spawn } from 'node:child_process';
import { userInfo } from 'node:os';
import { dialog, ipcMain, type BrowserWindow } from 'electron';
import { readFileSync } from 'node:fs';
import type { ChildProcess } from 'node:child_process';
import { parseLuaLine, type LuaMessage } from '../shared/protocol/messages';
import type { LuaBridgeServer } from './server/tcpServer';
import { loadSettings, saveSettings, type Settings } from './store/settings';
import { addHistory, listHistory, removeHistory, type SeedRecord } from './store/seedHistory';
import { generateRom, listPresets } from './randomizer/generate';
import { launchMesen } from './emulator/mesenLauncher';
import {
  launchXb1,
  sudoersLine,
  validateXb1,
  xb1Paths,
  type Xb1Handle
} from './emulator/xb1Launcher';

export const BRIDGE_CHANNEL = 'bridge:event';

export interface BridgeEvent {
  kind: 'connect' | 'disconnect' | 'message' | 'emulator-exit' | 'xb1-status';
  message?: LuaMessage;
  /** For xb1-status: whether the controller bridge is currently running. */
  running?: boolean;
  /** For xb1-status: a failure/stop reason to show the user. */
  error?: string;
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
let xb1Handle: Xb1Handle | null = null;

/**
 * Start the controller bridge if enabled + configured. Non-fatal: a failure is
 * pushed to the renderer as an xb1-status error, never blocking the game launch.
 */
function startXb1IfEnabled(getWindow: () => BrowserWindow | null): void {
  const settings = loadSettings();
  if (!settings.xb1Enabled || xb1Handle) return;
  try {
    xb1Handle = launchXb1(settings.xb1ProjectPath, (why) => {
      xb1Handle = null;
      push(getWindow, { kind: 'xb1-status', running: false, error: why });
    });
    push(getWindow, { kind: 'xb1-status', running: true });
  } catch (err) {
    push(getWindow, {
      kind: 'xb1-status',
      running: false,
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

/** Stop the controller bridge if running. Exported for app-quit cleanup. */
export function stopXb1(): void {
  xb1Handle?.stop();
  xb1Handle = null;
}

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
      // Controller is only claimed while playing: release it when Mesen exits.
      stopXb1();
      push(getWindow, { kind: 'xb1-status', running: false });
    });
    mesenChild = handle.child;
    // Start the controller bridge alongside the game (if enabled).
    startXb1IfEnabled(getWindow);
    return { pid: handle.child.pid ?? -1 };
  });

  ipcMain.handle('emulator:running', () => mesenChild !== null);

  // --- Xbox controller bridge ---
  ipcMain.handle('settings:pickXb1', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select the "xb1 controller" folder',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return saveSettings({ xb1ProjectPath: result.filePaths[0] });
  });

  ipcMain.handle('xb1:start', () => {
    const settings = loadSettings();
    const reason = validateXb1(settings.xb1ProjectPath);
    if (reason) throw new Error(reason);
    if (xb1Handle) return { running: true };
    xb1Handle = launchXb1(settings.xb1ProjectPath, (why) => {
      xb1Handle = null;
      push(getWindow, { kind: 'xb1-status', running: false, error: why });
    });
    push(getWindow, { kind: 'xb1-status', running: true });
    return { running: true };
  });

  ipcMain.handle('xb1:stop', () => {
    stopXb1();
    push(getWindow, { kind: 'xb1-status', running: false });
    return { running: false };
  });

  ipcMain.handle('xb1:running', () => xb1Handle !== null);

  ipcMain.handle('xb1:sudoersLine', () => {
    const settings = loadSettings();
    if (!settings.xb1ProjectPath) return '';
    return sudoersLine(settings.xb1ProjectPath, userInfo().username);
  });

  ipcMain.handle('xb1:requestAccess', () => {
    const settings = loadSettings();
    const reason = validateXb1(settings.xb1ProjectPath);
    if (reason) throw new Error(reason);
    // Unprivileged: triggers the macOS Accessibility prompt for the mapper.
    spawn(xb1Paths(settings.xb1ProjectPath).mapper, ['--request-access'], {
      stdio: 'ignore',
      detached: true
    }).unref();
    return { requested: true };
  });

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
