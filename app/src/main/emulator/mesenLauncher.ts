import { app } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Launching Mesen 2 with a ROM + our bridge script.
 * Verified in spike 0.1: `Mesen.app/Contents/MacOS/Mesen <rom> <script.lua>`
 * loads the ROM and auto-starts the script, provided script settings allow
 * network + io access.
 */

function mesenBinary(mesenAppPath: string): string {
  return join(mesenAppPath, 'Contents', 'MacOS', 'Mesen');
}

function mesenSettingsPath(mesenAppPath: string): string {
  return join(mesenAppPath, 'Contents', 'MacOS', 'settings.json');
}

/**
 * Ensure the Mesen script-window permissions our bridge needs. Mesen writes
 * its settings.json with a UTF-8 BOM; preserve valid JSON on rewrite.
 * Returns true if the file was modified.
 */
export function ensureMesenScriptSettings(mesenAppPath: string): boolean {
  const path = mesenSettingsPath(mesenAppPath);
  if (!existsSync(path)) return false;
  const raw = readFileSync(path, 'utf8').replace(/^﻿/, '');
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return false;
  }
  const debug = (settings.Debug ??= {}) as Record<string, unknown>;
  const script = (debug.ScriptWindow ??= {}) as Record<string, unknown>;
  const wanted: Record<string, unknown> = {
    AllowNetworkAccess: true,
    AllowIoOsAccess: true,
    AutoStartScriptOnLoad: true
  };
  let changed = false;
  for (const [key, value] of Object.entries(wanted)) {
    if (script[key] !== value) {
      script[key] = value;
      changed = true;
    }
  }
  if (changed) writeFileSync(path, JSON.stringify(settings, null, 2));
  return changed;
}

/**
 * Materialize bridge.lua into userData with the configured port templated in.
 * The pristine copy ships with the app (app path in dev, resources when packaged).
 */
export function writeBridgeScript(port: number): string {
  const source = join(app.getAppPath(), 'lua', 'bridge.lua');
  const fallback = join(process.resourcesPath ?? '', 'lua', 'bridge.lua');
  const luaSource = existsSync(source) ? source : fallback;
  const lua = readFileSync(luaSource, 'utf8').replace(
    /^local PORT = \d+$/m,
    `local PORT = ${port}`
  );
  const outDir = join(app.getPath('userData'), 'lua');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'bridge.lua');
  writeFileSync(outPath, lua);
  return outPath;
}

export interface LaunchHandle {
  child: ChildProcess;
  scriptPath: string;
}

export function launchMesen(
  mesenAppPath: string,
  romPath: string,
  bridgePort: number,
  onExit: (code: number | null) => void
): LaunchHandle {
  const binary = mesenBinary(mesenAppPath);
  if (!existsSync(binary)) {
    throw new Error(`Mesen binary not found at ${binary} — set the Mesen.app path in Settings`);
  }
  if (!existsSync(romPath)) {
    throw new Error(`ROM not found: ${romPath}`);
  }
  ensureMesenScriptSettings(mesenAppPath);
  const scriptPath = writeBridgeScript(bridgePort);
  const child = spawn(binary, [romPath, scriptPath], {
    detached: false,
    stdio: 'ignore'
  });
  child.on('exit', (code) => onExit(code));
  return { child, scriptPath };
}
