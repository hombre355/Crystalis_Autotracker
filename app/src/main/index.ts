import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { LuaBridgeServer } from './server/tcpServer';
import { DEFAULT_PORT } from '../shared/protocol/messages';
import { registerIpcHandlers, startFakeLuaReplay, wireBridgeToRenderer } from './ipc';

let mainWindow: BrowserWindow | null = null;
const bridge = new LuaBridgeServer();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    title: 'Crystalis Autotracker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const hash = process.argv.includes('--show-map')
    ? 'map'
    : process.argv.includes('--show-tracker')
      ? 'items'
      : undefined;
  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(
      process.env.ELECTRON_RENDERER_URL + (hash ? `#${hash}` : '')
    );
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : {});
  }
}

app.whenReady().then(async () => {
  createWindow();
  wireBridgeToRenderer(bridge, () => mainWindow);
  registerIpcHandlers(() => mainWindow);

  // Dev utility: --screenshot=path captures the window a few seconds after
  // launch and exits. Pairs with --fake-lua for automated UI verification.
  const shotArg = process.argv.find((a) => a.startsWith('--screenshot='));
  if (shotArg && mainWindow) {
    const outPath = shotArg.slice('--screenshot='.length);
    setTimeout(async () => {
      try {
        const image = await mainWindow?.webContents.capturePage();
        if (image) {
          const { writeFileSync } = await import('node:fs');
          writeFileSync(outPath, image.toPNG());
          console.log(`screenshot written to ${outPath}`);
        }
      } finally {
        app.quit();
      }
    }, 4000);
  }

  const fakeArg = process.argv.find((a) => a.startsWith('--fake-lua='));
  if (fakeArg) {
    startFakeLuaReplay(fakeArg.slice('--fake-lua='.length), () => mainWindow);
  } else {
    try {
      await bridge.start(DEFAULT_PORT);
      console.log(`Lua bridge server listening on 127.0.0.1:${DEFAULT_PORT}`);
    } catch (err) {
      console.error('Failed to start bridge server:', err);
    }
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  void bridge.stop();
  app.quit();
});
