/**
 * Crystalis RAM/ROM address map.
 * Primary source: crystalis-randomizer-tracker-main/scripts/autotracker.lua
 * Cross-check: python/hex_addresses.py (legacy prototype).
 * All addresses are CPU-bus addresses read via emu.read(addr, emu.memType.nesDebug).
 */

/** Game state byte: 1 = in game, 3 = in menu. */
export const GAME_STATE = 0x0040;
export const GAME_STATE_IN_GAME = 1;
export const GAME_STATE_IN_MENU = 3;

/** Regions the Lua bridge watches and streams. */
export const REGIONS = {
  /** Sword/ball/bracelet element bytes, armor, shields, consumables, wear slots, key items row 1, spells: 0x6430–0x645F. */
  ITEMS: { start: 0x6430, length: 0x30 },
  /** Event bits (0x6480+), boss-kill/chest bitmasks (0x64A0+), key items row 2 (0x64B8–0x64BF),
   *  door-opened bits used as Wu-mode key alternates (0x64D6, 0x64DB): 0x6480–0x64DF. */
  PROGRESS: { start: 0x6480, length: 0x60 },
  /** HP: 0x1BC0 max, 0x1BC1 current. */
  HP: { start: 0x1bc0, length: 2 },
  /** 0x1F02–03 gold (LE16), 0x1F04–05 current EXP (LE16), 0x1F06–07 EXP to next (LE16), 0x1F08 current MP, 0x1F09 max MP. */
  STATS: { start: 0x1f02, length: 8 }
} as const;

/** 8-byte seed checksum stamped into ROM (visible via CPU bus). */
export const SEED_CHECKSUM = { start: 0xb885, length: 8 } as const;

/** ASCII flag string stamped into the menu ROM bank; readable while in menu (gamestate 3). */
export const FLAG_STRING = { start: 0xb7f0, length: 0xa0 } as const;

/** Individual stat addresses (documentation + decoder offsets). */
export const STAT_ADDR = {
  MAX_HP: 0x1bc0,
  CUR_HP: 0x1bc1,
  GOLD: 0x1f02,
  CUR_EXP: 0x1f04,
  EXP_TO_NEXT: 0x1f06,
  CUR_MP: 0x1f08,
  MAX_MP: 0x1f09
} as const;
