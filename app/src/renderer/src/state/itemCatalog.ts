/**
 * Builds a code -> image index from the converted pack item JSON, and defines
 * the tracker grid layout in terms of detector codes (see shared/tracker/detectors).
 */
import common from '../../../data/items/common.json';
import simple from '../../../data/items/simple_items.json';
import misc from '../../../data/items/miscellaneous_items.json';
import bossesJson from '../../../data/items/bosses.json';
import wallsJson from '../../../data/items/dungeon_walls.json';

interface PackStage {
  img?: string;
  codes?: string;
  img_mods?: string;
}

interface PackItem {
  name?: string;
  type?: string;
  img?: string;
  codes?: string;
  stages?: PackStage[];
}

const imageByCode = new Map<string, string>();
const nameByCode = new Map<string, string>();

function index(items: PackItem[]): void {
  for (const item of items) {
    const register = (codes: string | undefined, img: string | undefined) => {
      if (!codes || !img) return;
      for (const code of codes.split(',').map((c) => c.trim())) {
        // Relative path: works from the dev server root AND from file:// builds.
        if (!imageByCode.has(code)) imageByCode.set(code, img);
        if (item.name && !nameByCode.has(code)) nameByCode.set(code, item.name);
      }
    };
    register(item.codes, item.img);
    for (const stage of item.stages ?? []) register(stage.codes, stage.img);
  }
}

index(common as PackItem[]);
index(simple as PackItem[]);
index(misc as PackItem[]);
index(bossesJson as PackItem[]);

export function imageFor(code: string): string {
  return imageByCode.get(code) ?? 'pack-images/blank.png';
}

export function nameFor(code: string): string {
  return nameByCode.get(code) ?? code;
}

/** Item grid layout: sections of detector codes. */
export const ITEM_SECTIONS: readonly { title: string; codes: readonly string[] }[] = [
  { title: 'Swords', codes: ['windsword', 'firesword', 'watersword', 'thundersword'] },
  { title: 'Balls', codes: ['windball', 'fireball', 'waterball', 'thunderball'] },
  {
    title: 'Bracelets',
    codes: ['tornadobracelet', 'flamebracelet', 'blizzardbracelet', 'stormbracelet']
  },
  {
    title: 'Magic',
    codes: ['refresh', 'paralysis', 'telepathy', 'teleport', 'recover', 'barrier', 'change', 'flight']
  },
  {
    title: 'Gear',
    // psychoarmor/sacredshield/fruitofrepun are detected but have no pack art;
    // they surface via logic (gomode) rather than the grid.
    codes: [
      'gasmask', 'powerring', 'warriorring', 'ironpendant',
      'deospendant', 'rabbitboots', 'speedboots', 'shieldring',
      'opel'
    ]
  },
  {
    title: 'Key Items',
    codes: [
      'graybow', 'redbow', 'bluebow',
      'redkey', 'bluekey', 'greenkey',
      'bluelamp', 'glowinglamp',
      'grayflute', 'greenflute', 'blueflute', 'redflute',
      'graystatue', 'brokenstatue', 'bluestatue', 'redstatue',
      'kirisaplant', 'love', 'eyeglasses'
    ]
  }
];

export interface WallDef {
  code: string;
  name: string;
  stages: { img: string; overlay?: string }[];
}

/** Walls are manual-cycle widgets; stage 0 is the default (unknown/wind). */
export const WALLS: readonly WallDef[] = (wallsJson as PackItem[]).map((wall) => ({
  code: (wall.stages?.[0]?.codes ?? wall.name ?? 'wall').split(',')[0]!.trim(),
  name: wall.name ?? 'Wall',
  stages: (wall.stages ?? []).map((s) => {
    const overlayRef = s.img_mods?.startsWith('overlay|') ? s.img_mods.slice('overlay|'.length) : undefined;
    return { img: (s.img ?? 'pack-images/blank.png'), overlay: overlayRef ?? undefined };
  })
}));

export interface BossDef {
  code: string;
  name: string;
  clearedImg: string;
  testedImg?: string;
}

export const BOSS_DEFS: readonly BossDef[] = (bossesJson as PackItem[]).map((boss) => {
  const cleared = boss.stages?.[0];
  const tested = boss.stages?.[1];
  const code = (cleared?.codes ?? '').split(',').map((c) => c.trim()).find((c) => c.endsWith('_cleared'))
    ?? (cleared?.codes ?? 'boss').split(',')[0]!.trim();
  return {
    code,
    name: boss.name ?? 'Boss',
    clearedImg: (cleared?.img ?? 'pack-images/blank.png'),
    testedImg: tested?.img ?? undefined
  };
});
