import { contextBridge, ipcRenderer } from 'electron';

const api = {
  onBridgeEvent(callback: (event: unknown) => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, event: unknown) => callback(event);
    ipcRenderer.on('bridge:event', listener);
    return () => ipcRenderer.removeListener('bridge:event', listener);
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),
  pickMesen: () => ipcRenderer.invoke('settings:pickMesen'),
  pickRom: () => ipcRenderer.invoke('settings:pickRom'),
  listPresets: () => ipcRenderer.invoke('randomizer:presets'),
  generate: (opts: unknown) => ipcRenderer.invoke('randomizer:generate', opts),
  launch: (romPath: string) => ipcRenderer.invoke('emulator:launch', romPath),
  emulatorRunning: () => ipcRenderer.invoke('emulator:running'),
  historyList: () => ipcRenderer.invoke('history:list'),
  historyRemove: (id: string) => ipcRenderer.invoke('history:remove', id),
  readSpoiler: (path: string) => ipcRenderer.invoke('spoiler:read', path)
};

export type TrackerApi = typeof api;

contextBridge.exposeInMainWorld('tracker', api);
