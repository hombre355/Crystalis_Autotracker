# Spike 0.1 — Mesen 2 Lua capabilities (RESOLVED 2026-07-20)

Tested against `/Users/mrowe/Mesen_emu/Mesen.app` (Mesen 2, macOS arm64, Jun 2025 build) with `/Users/mrowe/Mesen_emu/Crystalis.nes`.

## Verdict: original TCP design works. No file-tail fallback needed.

## Findings

1. **Lua runtime**: Lua **5.4** (not 5.3). Full stdlib: `io`, `os`, `package`, `require`, `print` all present.
2. **Sockets**: Mesen 2 bundles LuaSocket core, gated by a settings flag.
   - `Debug.ScriptWindow.AllowNetworkAccess` must be `true` in `Mesen.app/Contents/MacOS/settings.json` (default was false).
   - With it enabled: `require('socket.core')` → works. Raw core API only (no `socket.lua` wrapper module) — use `socket.core` directly: `local core = require('socket.core'); local t = core.tcp(); t:connect(host, port); t:send(...)`. Verified end-to-end: TCP connect + newline-JSON send captured by an external listener.
   - `Debug.ScriptWindow.AllowIoOsAccess` gates `io`/`os` (was already `true` on this install).
   - **The app's Mesen launcher must ensure both flags are true in settings.json before launch** (JSON has UTF-8 BOM — read with BOM tolerance; PascalCase keys).
3. **`io.popen`: NOT supported** (compiled out). `os.execute` works. Plain file `io.open` read/write works — file bridge remains a viable emergency fallback but is not needed.
4. **CLI autoload (GUI mode)**: `Mesen.app/Contents/MacOS/Mesen <rom.nes> <script.lua>` loads the ROM **and auto-starts the script** (with `Debug.ScriptWindow.AutoStartScriptOnLoad=true`, the default). Verified: script top-level ran at load, `emu.addEventCallback(fn, emu.eventType.endFrame)` fired per frame, `emu.read(0x0040, emu.memType.nesDebug)` returned live values.
5. **Headless testrunner**: `Mesen --testrunner <rom> <script>` runs without a window; script must call `emu.stop(code)` to exit. Useful for automated bridge testing in CI/dev.
6. **Relevant API surface** (from introspection): `emu.read/read16/read32/readWord`, `emu.addEventCallback`/`removeEventCallback`, `eventType`: `startFrame,endFrame,reset,scriptEnded,nmi,irq,inputPolled,codeBreak,stateLoaded,stateSaved`; `memType.nesDebug` (CPU bus, side-effect-free), `nesInternalRam`, `nesWorkRam`, etc. `emu.getScriptDataFolder()` → `Mesen.app/Contents/MacOS/LuaScriptData/<scriptname>`.
7. **Caution**: `Debug.ScriptWindow.ScriptTimeout = 1` (seconds) — keep per-frame callbacks tiny; batched reads at ~6 Hz are far below this.
8. `AutoReloadScriptWhenFileChanges=true` and `AutoRestartScriptAfterPowerCycle=true` were already set — helpful during development.

## Settings changed on this machine during the spike
- `AllowNetworkAccess`: false → **true** (required by the bridge; backup saved at `Mesen.app/Contents/MacOS/settings.json.bak-autotracker-spike`).
