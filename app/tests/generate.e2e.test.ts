/**
 * Integration test for the in-process randomizer wrapper. Needs the vanilla
 * ROM on disk, so it is gated like the bridge e2e:
 *
 *   E2E=1 npx vitest run tests/generate.e2e.test.ts
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateRom, listPresets } from '../src/main/randomizer/generate';

const ROM = process.env.CRYSTALIS_ROM ?? '/Users/mrowe/Mesen_emu/Crystalis.nes';
const enabled = process.env.E2E === '1' && existsSync(ROM);

describe.skipIf(!enabled)('randomizer generation', () => {
  it('lists presets with flag strings', async () => {
    const presets = await listPresets();
    expect(presets.length).toBeGreaterThan(5);
    const casual = presets.find((p) => p.name === 'Casual');
    expect(casual?.flagString).toContain('Ds');
  }, 30_000);

  it('generates a deterministic ROM with spoiler', async () => {
    const outputDir = join(tmpdir(), 'cryr-test-out');
    rmSync(outputDir, { recursive: true, force: true });
    const result = await generateRom({
      presetName: 'Casual',
      seed: 'cafebabe',
      vanillaRomPath: ROM,
      outputDir
    });
    expect(result.seed).toBe('cafebabe');
    expect(result.crc).toMatch(/^[0-9a-f]{8}$/);
    expect(existsSync(result.romPath)).toBe(true);
    expect(readFileSync(result.romPath).length).toBe(655376);
    expect(result.spoilerPath && existsSync(result.spoilerPath)).toBe(true);
    const spoiler = JSON.parse(readFileSync(result.spoilerPath!, 'utf8'));
    expect(Array.isArray(spoiler.slots)).toBe(true);
    rmSync(outputDir, { recursive: true, force: true });
  }, 60_000);
});
