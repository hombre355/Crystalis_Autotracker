/** Single source of truth for the preload-exposed API. */
export interface AppSettings {
  mesenAppPath: string;
  vanillaRomPath: string;
  outputDir: string;
  bridgePort: number;
}

export interface PresetInfo {
  name: string;
  description: string;
  flagString: string;
}

export interface SeedRecord {
  id: string;
  createdAt: string;
  seed: string;
  flagString: string;
  presetName?: string;
  romPath: string;
  crc: string;
  spoilerPath?: string;
}

declare global {
  interface Window {
    tracker: {
      onBridgeEvent(cb: (event: unknown) => void): () => void;
      getSettings(): Promise<AppSettings>;
      setSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
      pickMesen(): Promise<AppSettings | null>;
      pickRom(): Promise<string | null>;
      listPresets(): Promise<PresetInfo[]>;
      generate(opts: {
        flagString?: string;
        presetName?: string;
        seed?: string;
      }): Promise<SeedRecord>;
      launch(romPath: string): Promise<{ pid: number }>;
      emulatorRunning(): Promise<boolean>;
      historyList(): Promise<SeedRecord[]>;
      historyRemove(id: string): Promise<SeedRecord[]>;
      readSpoiler(path: string): Promise<unknown>;
    };
  }
}
