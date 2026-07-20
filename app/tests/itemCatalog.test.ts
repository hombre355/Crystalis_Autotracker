import { describe, expect, it } from 'vitest';
import { BOSS_DEFS, ITEM_SECTIONS, WALLS, imageFor } from '../src/renderer/src/state/itemCatalog';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ASSETS = resolve(__dirname, '../assets');

describe('itemCatalog', () => {
  it('resolves an image for every grid code, and the file exists', () => {
    for (const section of ITEM_SECTIONS) {
      for (const code of section.codes) {
        const img = imageFor(code);
        expect(img, code).not.toBe('pack-images/blank.png');
        expect(existsSync(resolve(ASSETS, img)), `${code} -> ${img}`).toBe(true);
      }
    }
  });

  it('derives 10 bosses with existing cleared images', () => {
    expect(BOSS_DEFS.length).toBe(10);
    for (const def of BOSS_DEFS) {
      expect(def.code.endsWith('_cleared'), def.code).toBe(true);
      expect(existsSync(resolve(ASSETS, def.clearedImg)), def.clearedImg).toBe(true);
    }
  });

  it('derives 16 walls with existing stage images', () => {
    expect(WALLS.length).toBe(16);
    for (const wall of WALLS) {
      expect(wall.stages.length).toBeGreaterThanOrEqual(2);
      for (const stage of wall.stages) {
        expect(existsSync(resolve(ASSETS, stage.img)), `${wall.code} ${stage.img}`).toBe(true);
        if (stage.overlay) {
          expect(existsSync(resolve(ASSETS, stage.overlay)), `${wall.code} ${stage.overlay}`).toBe(true);
        }
      }
    }
  });
});
