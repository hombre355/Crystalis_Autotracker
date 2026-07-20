import { app } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

function historyPath(): string {
  return join(app.getPath('userData'), 'seed-history.json');
}

export function listHistory(): SeedRecord[] {
  try {
    const raw = JSON.parse(readFileSync(historyPath(), 'utf8'));
    return Array.isArray(raw) ? (raw as SeedRecord[]) : [];
  } catch {
    return [];
  }
}

export function addHistory(record: SeedRecord): SeedRecord[] {
  const next = [record, ...listHistory()].slice(0, 200);
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(historyPath(), JSON.stringify(next, null, 2));
  return next;
}

export function removeHistory(id: string): SeedRecord[] {
  const next = listHistory().filter((r) => r.id !== id);
  writeFileSync(historyPath(), JSON.stringify(next, null, 2));
  return next;
}
