# Crystalis Autotracker

Standalone desktop app that auto-tracks progress in Crystalis (NES) played in **Mesen 2**,
with a built-in copy of the [crystalis-randomizer](https://github.com/crystalis-randomizer/crystalis-randomizer)
for generating new seeds locally — no website, no PopTracker/EmoTracker host needed.

## How it works

```
Mesen 2 ──lua/bridge.lua──▶ TCP 127.0.0.1:32275 (newline JSON) ──▶ Electron main (LuaBridgeServer)
                                                                     │  IPC push
                                                                     ▼
                                renderer: tracker store ─▶ RAM decoders ─▶ items / bosses / checks
                                                                     │
                                                                     ▼
                                logic engine (providers ─▶ macros ─▶ rule evaluator) ─▶ map pins
```

When you launch a ROM from the app, it writes `bridge.lua` (with the configured port) into
the app's data folder, flips the required Mesen script permissions in Mesen's own
`settings.json` (`AllowNetworkAccess`, `AllowIoOsAccess`, `AutoStartScriptOnLoad`), and starts
`Mesen <rom> <bridge.lua>`. The script polls game RAM ~6×/second and streams only changed
regions to the app.

## Using the app

### Launcher tab

- **Play existing ROM** — file-picker, then Mesen boots with tracking attached.
- **New randomized seed** — choose a preset (enumerated live from the bundled randomizer,
  so they always match its version), or pick *Custom flags…* and edit the flag string
  directly; optionally pin a seed. *Generate & Launch* writes the ROM + spoiler log to the
  app's seeds folder, records it in history, and boots Mesen.
- **Seed history** — every generated seed with its flags; *Play* re-launches, *Remove* deletes
  the record.
- **Settings** — paths to `Mesen.app` and your vanilla ROM (auto-detected from
  `~/Mesen_emu/` when present). The randomizer CRC-checks the vanilla ROM; the app ships no
  game data.

### Tracker tab

- **Header** — game state (in game / in menu), current seed id (from the ROM checksum at
  `0xB885`), Mesen connection badge.
- **Flag bar** — the randomizer flag string. Auto-fills when you open the in-game menu
  (scraped from the menu ROM bank at `0xB7F0`); the **edit** button lets you type it manually
  for ROMs the app didn't generate. Flags drive all reachability logic (Wu, Wg, We, Me, …).
- **Stats bar** — live HP, MP, gold, EXP.
- **Items sub-tab** — swords, balls, bracelets, magic, gear, and key items auto-track from
  RAM. Click any cell to override manually (dashed outline = overridden; right-click resets;
  live data wins again the moment the real value changes). Below:
  - **Bosses** — cleared state auto-tracks; right-click marks a boss *tested* (Me flag).
  - **Goa Floors** — for Wg seeds: click each floor to record which boss you found
    (left/right-click cycles boss + reversed variants). Feeds the Goa reachability logic.
  - **Walls** — manual element cycling per dungeon wall (We flag).
- **Map sub-tab** — overworld + 21 dungeon maps with pins:
  green = in logic, yellow = maybe (sequence-break / unknown-item uncertainty),
  red = out of logic, dimmed = collected. Checks auto-clear from RAM chest/event bits;
  clicking a pin toggles the rest manually. Numbered badges show remaining checks; hover for
  the per-check breakdown. Zoom controls + map dropdown in the toolbar.
- **Spoiler sub-tab** — click-to-reveal spoiler log for app-generated seeds (filter box,
  per-check reveal, or reveal all).

**New seed = automatic reset.** The bridge watches the ROM's seed checksum; loading a
different seed clears all tracker state, overrides included.

## Requirements

- macOS (arm64) with **Mesen 2** — tested against the June 2025 build.
- Your own legally-obtained **vanilla Crystalis ROM** (393,232-byte iNES dump).

## Install / build

A packaged app lands in `release/Crystalis Autotracker-<version>-arm64.dmg` after
`npm run package`. It's unsigned, so on first launch: right-click → Open (or approve under
System Settings → Privacy & Security).

```bash
npm install
npm run dev            # development app with hot reload
npm run build          # production build into out/
npm start              # run the built output
npm run package        # mac dmg into release/
npm test               # unit tests (protocol, decoders, logic engine)
E2E=1 npm test         # + live tests: headless Mesen bridge run + real ROM generation
```

### Dev flags

- `--fake-lua=tests/fixtures/session-items.jsonl` — replay a captured session, no emulator
- `--show-tracker` / `--show-map` — open directly on a tracker view
- `--screenshot=/tmp/shot.png` — capture the window ~4s after launch and exit

### Regenerating pack data

`src/data/` (items, locations, maps JSON) is converted from the reference PopTracker pack in
`../crystalis-randomizer-tracker-main` (which is JSON5-ish — BOM, comments, trailing commas):

```bash
node scripts/convert-pack-data.mjs
```

The **split** location variant is used deliberately: its section keys match the RAM check
refs from the pack's `autotracker.lua` 1:1, which is what makes auto-check-clearing exact.

## Code map

- `lua/bridge.lua` — Mesen 2 client script (LuaSocket over `socket.core`; diff-based sends,
  reconnect with backoff, seed + flag watching).
- `src/main/` — Electron main: TCP server, Mesen launcher, randomizer wrapper
  (`randomizer/generate.ts` — see `../docs/spikes/spike-0.2-randomizer-import.md` for the
  import recipe), settings + seed history stores, IPC.
- `src/shared/` — pure TypeScript, no Electron imports, fully unit-testable:
  - `protocol/` — wire message types + tolerant parser
  - `ram/`, `tracker/` — address map, detectors (the complete RAM map ported from
    `autotracker.lua`), state store, Goa floor widget data
  - `flags/` — flag-string parser
  - `logic/` — reachability engine: provider counts → macro table (traversal graph,
    wall/boss/key-item/trade/Goa logic) → access-rule evaluator
- `src/renderer/` — React UI (launcher, tracker grids, map, spoiler viewer).
- `src/data/`, `assets/` — converted pack data, icons (yours + the pack's), map images.

## Known limitations

- Wu/Wt manual item *identification* (right-click an unknown item to name it) isn't
  implemented — same behavior as the reference pack version this is ported from, which marks
  those flags unsupported. Unknown-class counts still track.
- Sword of Thunder warp targeting is automatic only for Rt seeds (fixed Shyron warp);
  non-Rt manual warp selection has no UI yet.
- Wm (map/door shuffle) door widgets have logic support (`d_*` codes) but no UI yet.
- Port-in-use errors on the bridge port are logged to the console, not shown in the UI.
