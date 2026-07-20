/**
 * Declarative RAM detectors for every tracked item, boss, and check.
 * Ported exhaustively from crystalis-randomizer-tracker-main/scripts/autotracker.lua
 * (updateKeyItemsFromMemorySegment + updateChestsFromMemorySegmentCorridor).
 *
 * Item codes match the reference pack's tracker codes so its items/locations
 * JSON can be reused unchanged in later phases.
 */

/** Inventory slot ranges (CPU addresses). A slot holds an item ID, 0xFF when empty. */
export const SLOT_RANGES = {
  /** Sword slots: fixed per element; byte equals element ID when owned. */
  swords: [0x6430, 0x6431, 0x6432, 0x6433],
  armor: [0x6434, 0x6435, 0x6436, 0x6437],
  shields: [0x6438, 0x6439, 0x643a, 0x643b],
  /** Ball/bracelet level bytes, one per element. */
  orbs: [0x643c, 0x643d, 0x643e, 0x643f],
  consumables: [
    0x6440, 0x6441, 0x6442, 0x6443, 0x6444, 0x6445, 0x6446, 0x6447,
    // second row is also scanned for consumable-class key items (opel, fruit of repun)
    0x64b8, 0x64b9, 0x64ba, 0x64bb, 0x64bc, 0x64bd, 0x64be, 0x64bf
  ],
  wear: [0x6448, 0x6449, 0x644a, 0x644b, 0x644c, 0x644d, 0x644e, 0x644f],
  keyItems: [
    0x6450, 0x6451, 0x6452, 0x6453, 0x6454, 0x6455, 0x6456, 0x6457,
    0x64b8, 0x64b9, 0x64ba, 0x64bb, 0x64bc, 0x64bd, 0x64be, 0x64bf
  ],
  spells: [0x6458, 0x6459, 0x645a, 0x645b, 0x645c, 0x645d, 0x645e, 0x645f]
} as const;

export type SlotClass = keyof typeof SLOT_RANGES;

export interface BitRef {
  addr: number;
  mask: number;
}

export type ItemDetector =
  /** Byte at addr equals value (sword element bytes). */
  | { kind: 'byteEquals'; addr: number; value: number }
  /** Byte at addr is one of values (ball/bracelet levels). */
  | { kind: 'byteIn'; addr: number; values: readonly number[] }
  /** Item ID appears in any slot of the class. */
  | { kind: 'slotScan'; slots: SlotClass; id: number }
  /** Bit set (bosses, event flags). */
  | { kind: 'bit'; addr: number; mask: number };

export interface TrackedItem {
  code: string;
  detect: ItemDetector;
  /**
   * Alternate detector used while the Wu flag (unidentified key items) is ON:
   * the inventory shows scrambled names, so the pack instead watches the
   * world-event bit proving the item was USED (statue destroyed, door opened…).
   */
  wuDetect?: ItemDetector;
}

// ---------------------------------------------------------------------------
// Items (codes and constants line up 1:1 with updateKeyItemsFromMemorySegment)
// ---------------------------------------------------------------------------

export const ITEMS: readonly TrackedItem[] = [
  // Swords — slot byte equals element ID when owned (empty = 0xFF).
  { code: 'windsword', detect: { kind: 'byteEquals', addr: 0x6430, value: 0x00 } },
  { code: 'firesword', detect: { kind: 'byteEquals', addr: 0x6431, value: 0x01 } },
  { code: 'watersword', detect: { kind: 'byteEquals', addr: 0x6432, value: 0x02 } },
  { code: 'thundersword', detect: { kind: 'byteEquals', addr: 0x6433, value: 0x03 } },

  // Balls & bracelets — level byte per element: [ball, bracelet] values.
  { code: 'windball', detect: { kind: 'byteIn', addr: 0x643c, values: [5, 6] } },
  { code: 'tornadobracelet', detect: { kind: 'byteEquals', addr: 0x643c, value: 6 } },
  { code: 'fireball', detect: { kind: 'byteIn', addr: 0x643d, values: [7, 8] } },
  { code: 'flamebracelet', detect: { kind: 'byteEquals', addr: 0x643d, value: 8 } },
  { code: 'waterball', detect: { kind: 'byteIn', addr: 0x643e, values: [9, 10] } },
  { code: 'blizzardbracelet', detect: { kind: 'byteEquals', addr: 0x643e, value: 10 } },
  { code: 'thunderball', detect: { kind: 'byteIn', addr: 0x643f, values: [11, 12] } },
  { code: 'stormbracelet', detect: { kind: 'byteEquals', addr: 0x643f, value: 12 } },

  // Spells — ID scan over spell slots.
  { code: 'refresh', detect: { kind: 'slotScan', slots: 'spells', id: 0x41 } },
  { code: 'paralysis', detect: { kind: 'slotScan', slots: 'spells', id: 0x42 } },
  { code: 'telepathy', detect: { kind: 'slotScan', slots: 'spells', id: 0x43 } },
  { code: 'teleport', detect: { kind: 'slotScan', slots: 'spells', id: 0x44 } },
  { code: 'recover', detect: { kind: 'slotScan', slots: 'spells', id: 0x45 } },
  { code: 'barrier', detect: { kind: 'slotScan', slots: 'spells', id: 0x46 } },
  { code: 'change', detect: { kind: 'slotScan', slots: 'spells', id: 0x47 } },
  { code: 'flight', detect: { kind: 'slotScan', slots: 'spells', id: 0x48 } },

  // Worn accessories — ID scan over wear slots.
  { code: 'gasmask', detect: { kind: 'slotScan', slots: 'wear', id: 0x29 } },
  { code: 'powerring', detect: { kind: 'slotScan', slots: 'wear', id: 0x2a } },
  { code: 'warriorring', detect: { kind: 'slotScan', slots: 'wear', id: 0x2b } },
  { code: 'ironpendant', detect: { kind: 'slotScan', slots: 'wear', id: 0x2c } },
  { code: 'deospendant', detect: { kind: 'slotScan', slots: 'wear', id: 0x2d } },
  { code: 'rabbitboots', detect: { kind: 'slotScan', slots: 'wear', id: 0x2e } },
  { code: 'speedboots', detect: { kind: 'slotScan', slots: 'wear', id: 0x2f } },
  { code: 'shieldring', detect: { kind: 'slotScan', slots: 'wear', id: 0x30 } },

  // Bows (pack color codes: gray=moon, red=sun, blue=truth).
  {
    code: 'graybow',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x3e },
    wuDetect: { kind: 'bit', addr: 0x6481, mask: 0x40 } // moon statue destroyed
  },
  {
    code: 'redbow',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x3f },
    wuDetect: { kind: 'bit', addr: 0x6481, mask: 0x08 } // sun statue destroyed
  },
  {
    code: 'bluebow',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x40 },
    wuDetect: { kind: 'bit', addr: 0x6485, mask: 0x80 } // draygon 2 spawned
  },

  // Keys (red=windmill, blue=prison, green=styx).
  {
    code: 'redkey',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x32 },
    wuDetect: { kind: 'bit', addr: 0x6481, mask: 0x04 } // windmill started
  },
  {
    code: 'bluekey',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x33 },
    wuDetect: { kind: 'bit', addr: 0x64db, mask: 0x01 } // prison door opened
  },
  {
    code: 'greenkey',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x34 },
    wuDetect: { kind: 'bit', addr: 0x64d6, mask: 0x01 } // styx door opened
  },

  // Lamps (blue=fog lamp, glowing lamp).
  {
    code: 'bluelamp',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x35 },
    wuDetect: { kind: 'bit', addr: 0x6484, mask: 0x02 } // boat launched
  },
  {
    code: 'glowinglamp',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x39 },
    wuDetect: { kind: 'bit', addr: 0x64a7, mask: 0x04 } // items combined
  },

  // Flutes (gray=alarm, green=insect, blue=lime, red=shell).
  {
    code: 'grayflute',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x31 },
    wuDetect: { kind: 'bit', addr: 0x64a6, mask: 0x04 } // windmill guard woken
  },
  {
    code: 'greenflute',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x27 },
    wuDetect: { kind: 'bit', addr: 0x64a0, mask: 0x80 } // insect boss called
  },
  {
    code: 'blueflute',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x28 },
    wuDetect: { kind: 'bit', addr: 0x64a6, mask: 0x01 } // akahana rescued
  },
  {
    code: 'redflute',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x36 },
    wuDetect: { kind: 'bit', addr: 0x64a7, mask: 0x08 } // underwater item / dolphin
  },

  // Statues (gray=ivory, broken, blue=gold, red=onyx).
  {
    code: 'graystatue',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x3d },
    wuDetect: { kind: 'bit', addr: 0x64a9, mask: 0x01 } // slimed kensu freed
  },
  {
    code: 'brokenstatue',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x38 },
    wuDetect: { kind: 'bit', addr: 0x64a7, mask: 0x04 } // items combined
  },
  {
    code: 'bluestatue',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x3a },
    wuDetect: { kind: 'bit', addr: 0x64a8, mask: 0x40 } // sea calmed
  },
  {
    code: 'redstatue',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x25 },
    wuDetect: { kind: 'bit', addr: 0x64a5, mask: 0x02 } // akahana trade-in
  },

  // Trade-in & misc key items.
  {
    code: 'kirisaplant',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x3c },
    wuDetect: { kind: 'bit', addr: 0x64a7, mask: 0x40 } // amazones trade-in
  },
  {
    code: 'love',
    detect: { kind: 'slotScan', slots: 'keyItems', id: 0x3b },
    wuDetect: { kind: 'bit', addr: 0x64a8, mask: 0x80 } // kensu tag
  },
  { code: 'eyeglasses', detect: { kind: 'slotScan', slots: 'keyItems', id: 0x37 } },

  // Consumable-class trackables.
  { code: 'opel', detect: { kind: 'slotScan', slots: 'consumables', id: 0x26 } },
  { code: 'fruitofrepun', detect: { kind: 'slotScan', slots: 'consumables', id: 0x23 } },

  // Endgame gear.
  { code: 'psychoarmor', detect: { kind: 'slotScan', slots: 'armor', id: 0x1c } },
  { code: 'sacredshield', detect: { kind: 'slotScan', slots: 'shields', id: 0x12 } }
] as const;

// ---------------------------------------------------------------------------
// Bosses (updateProgessiveItemFromByteAndFlag calls)
// ---------------------------------------------------------------------------

export const BOSSES: readonly { code: string; bit: BitRef }[] = [
  { code: 'giantinsect_cleared', bit: { addr: 0x64a0, mask: 0x80 } },
  { code: 'kelbesque1_cleared', bit: { addr: 0x64a1, mask: 0x01 } },
  { code: 'mado1_cleared', bit: { addr: 0x64a1, mask: 0x08 } },
  { code: 'mado2_cleared', bit: { addr: 0x64a2, mask: 0x04 } },
  { code: 'draygon_cleared', bit: { addr: 0x64a3, mask: 0x10 } },
  { code: 'sabera2_cleared', bit: { addr: 0x64a4, mask: 0x08 } },
  { code: 'kelbesque2_cleared', bit: { addr: 0x64a4, mask: 0x40 } },
  { code: 'sabera1_cleared', bit: { addr: 0x64a7, mask: 0x01 } },
  { code: 'karmine_cleared', bit: { addr: 0x64a7, mask: 0x20 } },
  { code: 'vampire_cleared', bit: { addr: 0x64ac, mask: 0x02 } }
] as const;

// ---------------------------------------------------------------------------
// Location checks (updateChestsFromMemorySegmentCorridor, complete table).
// `ref` is the pack's "@Location/Section" reference, reused verbatim so the
// pack's locations JSON binds to these in the map phase.
// ---------------------------------------------------------------------------

export const CHECKS: readonly { ref: string; bit: BitRef }[] = [
  { ref: '@Leaf Village: Elder/Leaf Elder', bit: { addr: 0x64a0, mask: 0x01 } },
  { ref: '@Save the child or kill the boss/Oak Elder', bit: { addr: 0x64a0, mask: 0x02 } },
  { ref: '@Waterfall Cave: Sword of Water/Sword of Water', bit: { addr: 0x64a0, mask: 0x04 } },
  { ref: '@Styx: Sword of Thunder/Sword of Thunder', bit: { addr: 0x64a0, mask: 0x08 } },
  { ref: '@Sealed Cave: Ball of Wind/Ball of Wind', bit: { addr: 0x64a0, mask: 0x20 } },
  { ref: '@Mt. Sabre West: Tornado Bracelet/Tornado Bracelet', bit: { addr: 0x64a0, mask: 0x40 } },
  { ref: '@Insect Boss/Use Insect Flute', bit: { addr: 0x64a0, mask: 0x80 } },

  { ref: '@Mt. Sabre North: Kelbesque1/Kelbesque 1 Reward', bit: { addr: 0x64a1, mask: 0x01 } },
  { ref: '@Lime Tree/Rage', bit: { addr: 0x64a1, mask: 0x02 } },
  { ref: '@Amazones Basement/Storage Room', bit: { addr: 0x64a1, mask: 0x04 } },
  { ref: '@Mado 1/Trigger Massacre first', bit: { addr: 0x64a1, mask: 0x08 } },
  { ref: "@Goa: Karmine's Floor: Karmine Reward 2/Karmine Reward 2", bit: { addr: 0x64a1, mask: 0x10 } },

  { ref: '@Waterfall Cave: Flute of Lime/Flute of Lime', bit: { addr: 0x64a2, mask: 0x01 } },
  { ref: "@Goa: Mado's Floor: Mado2/Mado 2 Reward", bit: { addr: 0x64a2, mask: 0x04 } },
  { ref: '@Styx: Psycho Shield/Psycho Shield', bit: { addr: 0x64a2, mask: 0x10 } },

  { ref: '@Oasis Cave: Battle Armor/Battle Armor', bit: { addr: 0x64a3, mask: 0x08 } },
  { ref: '@Pyramid Front: BoT/Bow of Truth', bit: { addr: 0x64a3, mask: 0x10 } },
  { ref: '@Sealed Cave: Medical Herb 2/Medical Herb 2', bit: { addr: 0x64a3, mask: 0x20 } },
  { ref: '@Sealed Cave: Antidote/Antidote', bit: { addr: 0x64a3, mask: 0x40 } },
  { ref: '@Fog Lamp Cave: Lysis/Lysis Plant', bit: { addr: 0x64a3, mask: 0x80 } },

  { ref: '@Mt. Hydra: Fruit of Lime/Fruit of Lime', bit: { addr: 0x64a4, mask: 0x01 } },
  { ref: "@Sabera's Fortress: Fruit of Power/Fruit of Power", bit: { addr: 0x64a4, mask: 0x02 } },
  { ref: '@Evil Spirit Island: Magic Ring/Magic Ring', bit: { addr: 0x64a4, mask: 0x04 } },
  { ref: "@Goa: Sabera's Floor: Sabera 2/Sabera 2 Reward", bit: { addr: 0x64a4, mask: 0x08 } },
  { ref: '@Sealed Cave: Warp Boots/Warp Boots', bit: { addr: 0x64a4, mask: 0x10 } },
  { ref: '@Item in grass/Walk on bridge first', bit: { addr: 0x64a4, mask: 0x20 } },
  { ref: "@Goa: Kelbesque's Floor/Kelbesque 2", bit: { addr: 0x64a4, mask: 0x40 } },
  { ref: '@Save the child or kill the boss/Mom', bit: { addr: 0x64a4, mask: 0x80 } },

  { ref: '@Queen 1/Queen 1', bit: { addr: 0x64a5, mask: 0x01 } },
  { ref: '@Akahana Trade-In/Give him item', bit: { addr: 0x64a5, mask: 0x02 } },
  { ref: '@Oasis Cave: Power Ring/Power Ring', bit: { addr: 0x64a5, mask: 0x04 } },
  { ref: '@Brokahana/Change into Akahana', bit: { addr: 0x64a5, mask: 0x08 } },
  { ref: '@Evil Spirit Island: Iron Necklace/Iron Necklace', bit: { addr: 0x64a5, mask: 0x10 } },
  { ref: '@Meadow/Console the Bunny', bit: { addr: 0x64a5, mask: 0x20 } },
  { ref: '@Sealed Cave: Vampire/Vampire Reward', bit: { addr: 0x64a5, mask: 0x40 } },
  { ref: '@Oasis Cave: Leather Boots/Leather Boots', bit: { addr: 0x64a5, mask: 0x80 } },

  { ref: '@Waterfall Cave: Akahana/Rescue Akahana', bit: { addr: 0x64a6, mask: 0x01 } },
  { ref: '@Leaf Village: Student/Student', bit: { addr: 0x64a6, mask: 0x02 } },
  { ref: '@Windmill Guard/Wake him up', bit: { addr: 0x64a6, mask: 0x04 } },
  { ref: '@Mt. Sabre North: Prison Key/Key to Prison', bit: { addr: 0x64a6, mask: 0x08 } },
  { ref: '@Shyron/Zebu in the Temple', bit: { addr: 0x64a6, mask: 0x10 } },
  { ref: '@Fog Lamp Cave: Fog Lamp/Fog Lamp', bit: { addr: 0x64a6, mask: 0x20 } },
  { ref: '@Dolphin/Heal them', bit: { addr: 0x64a6, mask: 0x40 } },
  { ref: '@Clark/Kill Sabera first', bit: { addr: 0x64a6, mask: 0x80 } },

  { ref: "@Sabera's Fortress: Sabera1/Sabera Reward", bit: { addr: 0x64a7, mask: 0x01 } },
  { ref: '@Lighthouse/Wake Up Kensu', bit: { addr: 0x64a7, mask: 0x02 } },
  { ref: '@Combine the Items/Combine them!', bit: { addr: 0x64a7, mask: 0x04 } },
  { ref: '@Portoa Waterway/Underwater Item', bit: { addr: 0x64a7, mask: 0x08 } },
  { ref: '@Kirisa Plant Cave: Kirisa/Kirisa Plant', bit: { addr: 0x64a7, mask: 0x10 } },
  { ref: "@Goa: Karmine's Floor: Karmine Reward 1/Karmine Reward 1", bit: { addr: 0x64a7, mask: 0x20 } },
  { ref: '@Amazones/Trade In Kirisa Plant', bit: { addr: 0x64a7, mask: 0x40 } },
  { ref: '@Mt. Hydra: Bow of Sun/Bow of Sun', bit: { addr: 0x64a7, mask: 0x80 } },

  { ref: '@Pyramid Front: Psycho Armor/Psycho Armor', bit: { addr: 0x64a8, mask: 0x01 } },
  { ref: '@Windmill Reward/Activate Windmill', bit: { addr: 0x64a8, mask: 0x02 } },
  { ref: '@Mt. Sabre North: Prison Break Reward/Prison Break Reward', bit: { addr: 0x64a8, mask: 0x04 } },
  { ref: '@Stom Fight/Visit Oak first', bit: { addr: 0x64a8, mask: 0x08 } },
  { ref: '@Mt. Sabre West: Tornel Reward/Tornel - Show him Tornado Bracelet', bit: { addr: 0x64a8, mask: 0x10 } },
  { ref: '@Queen 2/Queen 2 (Talk to Mesia first)', bit: { addr: 0x64a8, mask: 0x20 } },
  { ref: '@Altar/Calm the Sea', bit: { addr: 0x64a8, mask: 0x40 } },
  { ref: '@Kensu Tag/Turn-in Love Pendant', bit: { addr: 0x64a8, mask: 0x80 } },

  { ref: "@Goa: Karmine's Floor: Slimed Kensu/Slimed Kensu", bit: { addr: 0x64a9, mask: 0x01 } },

  { ref: '@Sealed Cave: Medical Herb 1/Medical Herb 1', bit: { addr: 0x64aa, mask: 0x01 } },
  { ref: '@Mt. Sabre West: Medical Herb/Medical Herb', bit: { addr: 0x64aa, mask: 0x04 } },
  { ref: '@Mt. Sabre North: Medical Herb/Medical Herb', bit: { addr: 0x64aa, mask: 0x08 } },
  { ref: "@Goa: Mado's Floor: Magic Ring 3/Magic Ring 3", bit: { addr: 0x64aa, mask: 0x10 } },
  { ref: "@Sabera's Fortress: Medical Herb/Medical Herb", bit: { addr: 0x64aa, mask: 0x20 } },
  { ref: '@Mt. Hydra: Medical Herb/Medical Herb', bit: { addr: 0x64aa, mask: 0x40 } },
  { ref: '@Styx: Medical Herb/Medical Herb', bit: { addr: 0x64aa, mask: 0x80 } },

  { ref: "@Goa: Karmine's Floor: Magic Ring/Magic Ring", bit: { addr: 0x64ab, mask: 0x01 } },
  { ref: '@East Cave: Key Item/Key Item', bit: { addr: 0x64ab, mask: 0x02 } },
  { ref: '@Oasis Cave: Fruit of Power 1/Fruit of Power 1', bit: { addr: 0x64ab, mask: 0x04 } },
  { ref: '@Evil Spirit Island: Lysis/Lysis Plant', bit: { addr: 0x64ab, mask: 0x10 } },
  { ref: "@Goa: Sabera's Floor: Lysis/Lysis Plant", bit: { addr: 0x64ab, mask: 0x20 } },
  { ref: '@Mt. Sabre North: Antidote/Antidote', bit: { addr: 0x64ab, mask: 0x40 } },
  { ref: '@Kirisa Plant Cave: Antidote/Antidote', bit: { addr: 0x64ab, mask: 0x80 } },

  { ref: "@Goa: Mado's Floor: Antidote/Antidote", bit: { addr: 0x64ac, mask: 0x01 } },
  { ref: "@Sabera's Fortress: Vampire2/Vampire Reward", bit: { addr: 0x64ac, mask: 0x02 } },
  { ref: "@Goa: Sabera's Floor: Fruit of Power/Fruit of Power", bit: { addr: 0x64ac, mask: 0x04 } },
  { ref: "@Goa: Mado's Floor: Opel/Opel Statue", bit: { addr: 0x64ac, mask: 0x08 } },
  { ref: '@Oasis Cave: Fruit of Power 2/Fruit of Power 2', bit: { addr: 0x64ac, mask: 0x10 } },
  { ref: '@Mt. Hydra: Magic Ring/Magic Ring', bit: { addr: 0x64ac, mask: 0x20 } },
  { ref: "@Goa: Sabera's Floor: Fruit of Repun/Fruit of Repun", bit: { addr: 0x64ac, mask: 0x40 } },
  { ref: "@Kensu's Beach House/Take the boat", bit: { addr: 0x64ac, mask: 0x80 } },

  { ref: '@Mt. Sabre West: Magic Ring/Magic Ring', bit: { addr: 0x64ad, mask: 0x02 } },
  { ref: '@Mt. Sabre West: Warp Boots/Warp Boots', bit: { addr: 0x64ad, mask: 0x04 } },
  { ref: "@Goa: Mado's Floor: Magic Ring 2/Magic Ring 2", bit: { addr: 0x64ad, mask: 0x08 } },
  { ref: '@Pyramid Front: Magic Ring/Magic Ring', bit: { addr: 0x64ad, mask: 0x10 } },
  { ref: '@Pyramid Back: Opel Statue/Opel Statue', bit: { addr: 0x64ad, mask: 0x20 } },
  { ref: "@Goa: Karmine's Floor: Warp Boots/Warp Boots", bit: { addr: 0x64ad, mask: 0x40 } },
  { ref: "@Goa: Mado's Floor: Magic Ring 1/Magic Ring 1", bit: { addr: 0x64ad, mask: 0x80 } },

  { ref: '@Fog Lamp Cave: Mimic 1/Mimic 1', bit: { addr: 0x64ae, mask: 0x01 } },
  { ref: '@Fog Lamp Cave: Mimic 2/Mimic 2', bit: { addr: 0x64ae, mask: 0x02 } },
  { ref: '@Waterfall Cave: Mimic/Mimic', bit: { addr: 0x64ae, mask: 0x04 } },
  { ref: '@Evil Spirit Island: Mimic/Mimic', bit: { addr: 0x64ae, mask: 0x08 } },
  { ref: '@Mt. Hydra: Mimic/Mimic', bit: { addr: 0x64ae, mask: 0x10 } },
  { ref: '@Styx: Mimic 1/Mimic 1', bit: { addr: 0x64ae, mask: 0x20 } },
  { ref: '@Styx: Mimic 3/Mimic 3', bit: { addr: 0x64ae, mask: 0x80 } },

  { ref: '@Pyramid Back: Mimic/Mimic', bit: { addr: 0x64af, mask: 0x01 } },
  { ref: "@Goa: Karmine's Floor: Mimic 1/Mimic 1", bit: { addr: 0x64af, mask: 0x02 } },
  { ref: "@Goa: Karmine's Floor: Mimic 2/Mimic 2", bit: { addr: 0x64af, mask: 0x04 } },
  { ref: "@Goa: Karmine's Floor: Mimic 3/Mimic 3", bit: { addr: 0x64af, mask: 0x08 } },
  { ref: '@East Cave: Consumable/Consumable Item', bit: { addr: 0x64af, mask: 0x10 } },
  { ref: '@Styx: Mimic 2/Mimic 2', bit: { addr: 0x64af, mask: 0x20 } }
] as const;

// ---------------------------------------------------------------------------
// "Unknown item" counters (Wu flag): count how many of the class are held,
// identified or not. Codes match the pack's count items.
// ---------------------------------------------------------------------------

export const UNKNOWN_COUNTERS: readonly { code: string; slots: SlotClass; ids: readonly number[] }[] = [
  { code: 'bow', slots: 'keyItems', ids: [0x3e, 0x3f, 0x40] },
  { code: 'unknownkey', slots: 'keyItems', ids: [0x32, 0x33, 0x34] },
  { code: 'unknownlamp', slots: 'keyItems', ids: [0x35, 0x39] },
  { code: 'unknownflute', slots: 'keyItems', ids: [0x27, 0x28, 0x31, 0x36] },
  { code: 'unknownstatue', slots: 'keyItems', ids: [0x25, 0x38, 0x3a, 0x3d] },
  { code: 'unknowntrade', slots: 'keyItems', ids: [0x25, 0x35, 0x38, 0x39, 0x3a, 0x3b, 0x3c, 0x3d] }
] as const;
