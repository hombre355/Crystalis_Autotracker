/**
 * Wire protocol between the Mesen 2 Lua bridge script and the app.
 * Transport: newline-delimited JSON over TCP (app hosts, Lua connects).
 */

export const PROTOCOL_VERSION = 1;
export const DEFAULT_PORT = 32275;

/** RAM region snapshot keyed by lowercase hex start address, bytes base64-encoded. */
export interface RamRegionsWire {
  [startHex: string]: string;
}

export interface HelloMessage {
  t: 'hello';
  proto: number;
  emu: string;
  script: string;
}

export interface GameStateMessage {
  t: 'gamestate';
  /** Value of CPU address 0x0040: 1 = in game, 3 = in menu. */
  v: number;
}

export interface RamMessage {
  t: 'ram';
  seq: number;
  regions: RamRegionsWire;
}

export interface SeedMessage {
  t: 'seed';
  /** 8 bytes at 0xB885 as 16 lowercase hex chars. */
  checksum: string;
}

export interface FlagsMessage {
  t: 'flags';
  /** Raw flag string scraped from menu ROM bank, e.g. "Ds Ecdrstux Rt Vds!mw". */
  raw: string;
}

export interface PongMessage {
  t: 'pong';
  seq: number;
}

export type LuaMessage =
  | HelloMessage
  | GameStateMessage
  | RamMessage
  | SeedMessage
  | FlagsMessage
  | PongMessage;

export interface WelcomeMessage {
  t: 'welcome';
  proto: number;
  pollHz: number;
}

export interface PingMessage {
  t: 'ping';
  seq: number;
}

export interface ResyncMessage {
  t: 'resync';
}

export type AppMessage = WelcomeMessage | PingMessage | ResyncMessage;

const LUA_MESSAGE_TYPES = new Set(['hello', 'gamestate', 'ram', 'seed', 'flags', 'pong']);

/**
 * Parse one line from the Lua bridge. Tolerant: returns null for anything
 * malformed or unknown rather than throwing (forward compatibility).
 */
export function parseLuaLine(line: string): LuaMessage | null {
  const trimmed = line.trim();
  if (trimmed === '') return null;
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const msg = obj as Record<string, unknown>;
  if (typeof msg.t !== 'string' || !LUA_MESSAGE_TYPES.has(msg.t)) return null;
  switch (msg.t) {
    case 'hello':
      if (typeof msg.proto !== 'number') return null;
      return {
        t: 'hello',
        proto: msg.proto,
        emu: typeof msg.emu === 'string' ? msg.emu : 'unknown',
        script: typeof msg.script === 'string' ? msg.script : 'unknown'
      };
    case 'gamestate':
      if (typeof msg.v !== 'number') return null;
      return { t: 'gamestate', v: msg.v };
    case 'ram': {
      if (typeof msg.regions !== 'object' || msg.regions === null) return null;
      const regions: RamRegionsWire = {};
      for (const [k, v] of Object.entries(msg.regions as Record<string, unknown>)) {
        if (typeof v !== 'string' || !/^[0-9a-f]+$/.test(k)) return null;
        regions[k] = v;
      }
      return { t: 'ram', seq: typeof msg.seq === 'number' ? msg.seq : 0, regions };
    }
    case 'seed':
      if (typeof msg.checksum !== 'string' || !/^[0-9a-f]{16}$/.test(msg.checksum)) return null;
      return { t: 'seed', checksum: msg.checksum };
    case 'flags':
      if (typeof msg.raw !== 'string') return null;
      return { t: 'flags', raw: msg.raw };
    case 'pong':
      return { t: 'pong', seq: typeof msg.seq === 'number' ? msg.seq : 0 };
    default:
      return null;
  }
}

/** Serialize an app→Lua message, newline-terminated. */
export function encodeAppMessage(msg: AppMessage): string {
  return JSON.stringify(msg) + '\n';
}

/**
 * Decode a base64 region payload to bytes. Returns null on malformed input.
 * Works in both Node (main process, tests) and the browser renderer.
 */
export function decodeRegion(b64: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 !== 0) return null;
  try {
    if (typeof Buffer !== 'undefined') {
      const buf = Buffer.from(b64, 'base64');
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Decoded RAM regions keyed by numeric start address. */
export type RamRegions = Map<number, Uint8Array>;

/** Decode all regions of a RamMessage. Malformed regions are skipped. */
export function decodeRamRegions(msg: RamMessage): RamRegions {
  const out: RamRegions = new Map();
  for (const [hex, b64] of Object.entries(msg.regions)) {
    const bytes = decodeRegion(b64);
    if (bytes !== null) out.set(parseInt(hex, 16), bytes);
  }
  return out;
}
