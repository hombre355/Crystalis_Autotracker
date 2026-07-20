# Spike 0.2 — crystalis-randomizer in-process import (RESOLVED 2026-07-20)

Package: `crystalis-randomizer@2.0.0` (npm, Apr 2025, ISC license). Verified on Node v26 against `/Users/mrowe/Mesen_emu/Crystalis.nes` (accepted by checksum validation — the ROM is a good vanilla dump).

## Verdict: in-process import works. Pin `crystalis-randomizer@2.0.0`.

## How to use it in-process (exact recipe)

```js
// The package main (target/debug/js/patch.js) is an ESM shim; the real module is the chunk.
// esbuild lazy-init: call the init fns, then use LIVE bindings off the namespace object —
// do NOT destructure before init (exports are undefined until init runs).
const mod = await import('crystalis-randomizer/target/debug/js/chunk-6YEOY446.js');
// (or import the package main, which calls init_patch() itself, then reach exports via the chunk)
mod.init_flagset(); mod.init_patch();

const flags = new mod.FlagSet('@Casual');          // '@Name' = preset; or raw string 'Ds Ecdrstux Rt Vds!mw'
const seed  = mod.parseSeed('cafebabe');           // hex or arbitrary text; '' → random
const log   = {};                                  // spoiler receiver
const [out, crc] = await mod.shuffle(romU8, seed, flags, /*spriteReplacements*/ undefined, log);
// out: Uint8Array (640KB expanded ROM), crc: number (>>>0 for hex display)
// log.spoiler: { rom, slots, route, mazes, trades, walls, unidentifiedItems, wildWarps, houses, flags }
//   slots[i] = { slot, slotName, item, itemName, originalItem }  ← the spoiler viewer's data
```

Signature confirmed from the bundle: `async function shuffle(rom, seed, originalFlags, spriteReplacements, log, progress)`.

## Key facts

- **Presets**: `mod.Preset.all()` enumerates ~13 presets (Casual, Classic, Standard, No Bow Mode, Advanced, Wild Warp, Mystery, Hardcore, The Full Stupid, Tournament 2023/2022...). A preset's canonical flag string renders via `String(new FlagSet('@Name'))` (e.g. Casual → `Ds Ecdrstux Rt Vds!mw`). Preset objects' `.flags` is structured (flag-object pairs) — use for a rich flag editor later.
- **Performance**: full shuffle ≈ 0.9 s in-process. Fine to run in Electron main (or a worker if UI jank matters).
- **Console noise**: `shuffle` writes progress/debug lines ("Failed to fill location …: N remaining" retry lines, `Free(...)`, `Placement(...)`) to console.log/console.error. Capture or silence both around the call.
- **CLI fallback works too**: `node <pkg>/target/release/bin/cryr --flags=... --seed=... --output="%n_%c" rom.nes`. NOTE: the shebang is `#!/usr/bin/env -S node --inspect` — always invoke via `node <path>` to avoid opening a debugger port.
- **Input ROM**: 393,232-byte iNES vanilla dump required; CRC-checked (`--force` to override in CLI).
- **Electron/asar caveat** (for packaging phase): the package has no `exports` map and no `"type": "module"` (Node reparses chunks as ESM with a warning — harmless). Import via absolute path with `pathToFileURL`; put the package in `asarUnpack`.
