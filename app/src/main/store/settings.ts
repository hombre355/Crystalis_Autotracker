import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface Settings {
  /** Path to Mesen.app (macOS bundle). */
  mesenAppPath: string;
  /** Path to the vanilla Crystalis ROM. */
  vanillaRomPath: string;
  /** Directory where generated ROMs + spoilers are written. */
  outputDir: string;
  /** TCP port the bridge server listens on. */
  bridgePort: number;
}

function defaults(): Settings {
  const guessMesen = join(homedir(), 'Mesen_emu', 'Mesen.app');
  const guessRom = join(homedir(), 'Mesen_emu', 'Crystalis.nes');
  return {
    mesenAppPath: existsSync(guessMesen) ? guessMesen : '',
    vanillaRomPath: existsSync(guessRom) ? guessRom : '',
    outputDir: join(app.getPath('userData'), 'seeds'),
    bridgePort: 32275
  };
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf8')) as Partial<Settings>;
    return { ...defaults(), ...raw };
  } catch {
    return defaults();
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
  return next;
}
