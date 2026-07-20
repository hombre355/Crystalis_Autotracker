import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

/**
 * In-process wrapper around the crystalis-randomizer npm package (pinned 2.0.0).
 * See docs/spikes/spike-0.2-randomizer-import.md for the import recipe: the
 * real module is an esbuild chunk with lazy init; use live namespace bindings.
 */

// The package has no "exports" map, so subpath resolution works.
const require_ = createRequire(import.meta.url);

interface RandomizerModule {
  init_flagset?: () => void;
  init_patch?: () => void;
  FlagSet: new (flags: string) => object;
  Preset: { all(): Iterable<{ name: string; description?: string }> };
  parseSeed: (seed: string) => number;
  shuffle: (
    rom: Uint8Array,
    seed: number,
    flags: object,
    sprites?: unknown,
    log?: { spoiler?: unknown },
    progress?: unknown
  ) => Promise<readonly [Uint8Array, number]>;
}

let modPromise: Promise<RandomizerModule> | null = null;

async function loadRandomizer(): Promise<RandomizerModule> {
  if (!modPromise) {
    modPromise = (async () => {
      const pkgJson = require_.resolve('crystalis-randomizer/package.json');
      const chunkPath = join(dirname(pkgJson), 'target/debug/js/chunk-6YEOY446.js');
      const mod = (await import(pathToFileURL(chunkPath).href)) as unknown as RandomizerModule;
      mod.init_flagset?.();
      mod.init_patch?.();
      return mod;
    })();
  }
  return modPromise;
}

export interface PresetInfo {
  name: string;
  description: string;
  flagString: string;
}

export async function listPresets(): Promise<PresetInfo[]> {
  const mod = await loadRandomizer();
  const out: PresetInfo[] = [];
  for (const preset of mod.Preset.all()) {
    let flagString = '';
    try {
      flagString = String(new mod.FlagSet('@' + preset.name.replace(/\s+/g, '')));
    } catch {
      // preset name not constructible into a flagset; still list it
    }
    out.push({
      name: preset.name,
      description: (preset as { description?: string }).description ?? '',
      flagString
    });
  }
  return out;
}

export interface GenerateOptions {
  /** Raw flag string; ignored when presetName is given. */
  flagString?: string;
  presetName?: string;
  /** Seed text (hex or free text). Empty -> random. */
  seed?: string;
  vanillaRomPath: string;
  outputDir: string;
}

export interface GenerateResult {
  id: string;
  romPath: string;
  spoilerPath?: string;
  seed: string;
  flagString: string;
  crc: string;
}

/** shuffle() logs progress noise to the console; capture it while it runs. */
async function withSilencedConsole<T>(fn: () => Promise<T>): Promise<T> {
  const saved = { log: console.log, error: console.error, warn: console.warn };
  console.log = console.error = console.warn = () => {};
  try {
    return await fn();
  } finally {
    console.log = saved.log;
    console.error = saved.error;
    console.warn = saved.warn;
  }
}

export async function generateRom(opts: GenerateOptions): Promise<GenerateResult> {
  const mod = await loadRandomizer();
  const rom = new Uint8Array(readFileSync(opts.vanillaRomPath));

  const flagSpec = opts.presetName ? '@' + opts.presetName.replace(/\s+/g, '') : (opts.flagString ?? '');
  const flags = new mod.FlagSet(flagSpec);
  const flagString = String(flags);

  const seedText = opts.seed?.trim() || Math.floor(Math.random() * 0x100000000).toString(16);
  const seed = mod.parseSeed(seedText);

  const log: { spoiler?: unknown } = {};
  const [out, crcNum] = await withSilencedConsole(() => mod.shuffle(rom, seed, flags, undefined, log));
  const crc = (crcNum >>> 0).toString(16).padStart(8, '0');

  mkdirSync(opts.outputDir, { recursive: true });
  const base = `crystalis_${seed.toString(16).padStart(8, '0')}_${crc}`;
  const romPath = join(opts.outputDir, `${base}.nes`);
  writeFileSync(romPath, out);

  let spoilerPath: string | undefined;
  if (log.spoiler) {
    const serialized = serializeSpoiler(log.spoiler);
    if (serialized) {
      spoilerPath = join(opts.outputDir, `${base}.spoiler.json`);
      writeFileSync(spoilerPath, serialized);
    }
  }

  return {
    id: randomUUID(),
    romPath,
    spoilerPath,
    seed: seed.toString(16).padStart(8, '0'),
    flagString,
    crc
  };
}

/**
 * The spoiler object contains the whole Rom graph under `.rom` (cyclic, huge).
 * Keep only the fields the viewer needs, and drop any field that still fails
 * to serialize rather than losing the whole spoiler.
 */
const SPOILER_FIELDS = [
  'slots', 'route', 'mazes', 'trades', 'walls',
  'unidentifiedItems', 'wildWarps', 'houses', 'flags'
] as const;

function serializeSpoiler(spoiler: unknown): string | null {
  if (typeof spoiler !== 'object' || spoiler === null) return null;
  const src = spoiler as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of SPOILER_FIELDS) {
    if (!(field in src)) continue;
    try {
      out[field] = JSON.parse(
        JSON.stringify(src[field], (_k, v: unknown) =>
          typeof v === 'bigint' ? v.toString() : typeof v === 'function' ? undefined : v
        )
      );
    } catch {
      // field didn't serialize (cycle/class instance) — skip it
    }
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out, null, 2) : null;
}
