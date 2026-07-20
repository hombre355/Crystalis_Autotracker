/**
 * One-shot converter: reference tracker pack (JSON5-ish: BOM, // comments,
 * trailing commas) -> strict JSON under src/data/.
 *
 * Run from app/:  node scripts/convert-pack-data.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import JSON5 from 'json5';

const PACK = resolve(import.meta.dirname, '../../crystalis-randomizer-tracker-main');
const OUT = resolve(import.meta.dirname, '../src/data');

function convertFile(srcPath, outPath, transform = (x) => x) {
  const raw = readFileSync(srcPath, 'utf8').replace(/^﻿/, '');
  const data = transform(JSON5.parse(raw));
  writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`${srcPath} -> ${outPath}`);
}

/** Pack image refs are relative to the pack root ("images/..."); our copy lives at /pack-images. */
function fixImagePaths(value) {
  if (typeof value === 'string') {
    // Handles both plain refs ("images/x.png") and embedded refs ("overlay|images/x.png").
    return value.replace(/(^|\|)images[\\/]/g, '$1pack-images/').replaceAll('\\', '/');
  }
  if (Array.isArray(value)) return value.map(fixImagePaths);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fixImagePaths(v)]));
  }
  return value;
}

mkdirSync(join(OUT, 'items'), { recursive: true });
mkdirSync(join(OUT, 'locations'), { recursive: true });

for (const file of readdirSync(join(PACK, 'items'))) {
  if (!file.endsWith('.json')) continue;
  convertFile(join(PACK, 'items', file), join(OUT, 'items', file), fixImagePaths);
}

for (const file of readdirSync(join(PACK, 'locations'))) {
  if (!file.endsWith('.json')) continue;
  convertFile(join(PACK, 'locations', file), join(OUT, 'locations', file), fixImagePaths);
}

// sub_maps.json is the authoritative map list (maps.json references missing files).
convertFile(join(PACK, 'maps', 'sub_maps.json'), join(OUT, 'maps.json'), (maps) =>
  fixImagePaths(maps).map((m) => ({
    ...m,
    img: typeof m.img === 'string' ? m.img.replace(/^maps[\\/]/, 'maps/') : m.img
  }))
);

console.log('done');
