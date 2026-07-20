import { describe, expect, it } from 'vitest';
import {
  decodeRamRegions,
  decodeRegion,
  encodeAppMessage,
  parseLuaLine
} from '../src/shared/protocol/messages';

describe('parseLuaLine', () => {
  it('parses a hello message', () => {
    const msg = parseLuaLine('{"t":"hello","proto":1,"emu":"mesen2","script":"bridge.lua/0.1.0"}');
    expect(msg).toEqual({ t: 'hello', proto: 1, emu: 'mesen2', script: 'bridge.lua/0.1.0' });
  });

  it('parses gamestate', () => {
    expect(parseLuaLine('{"t":"gamestate","v":3}')).toEqual({ t: 'gamestate', v: 3 });
  });

  it('parses a ram message with base64 regions', () => {
    const msg = parseLuaLine('{"t":"ram","seq":7,"regions":{"6430":"AAECAw=="}}');
    expect(msg).toEqual({ t: 'ram', seq: 7, regions: { '6430': 'AAECAw==' } });
  });

  it('parses seed and flags', () => {
    expect(parseLuaLine('{"t":"seed","checksum":"a1b2c3d4e5f60708"}')).toEqual({
      t: 'seed',
      checksum: 'a1b2c3d4e5f60708'
    });
    expect(parseLuaLine('{"t":"flags","raw":"Ds Ecdrstux Rt Vds!mw"}')).toEqual({
      t: 'flags',
      raw: 'Ds Ecdrstux Rt Vds!mw'
    });
  });

  it('rejects garbage without throwing', () => {
    expect(parseLuaLine('')).toBeNull();
    expect(parseLuaLine('   ')).toBeNull();
    expect(parseLuaLine('not json at all')).toBeNull();
    expect(parseLuaLine('{"almost":')).toBeNull();
    expect(parseLuaLine('[1,2,3]')).toBeNull();
    expect(parseLuaLine('42')).toBeNull();
    expect(parseLuaLine('null')).toBeNull();
  });

  it('rejects unknown or malformed message types', () => {
    expect(parseLuaLine('{"t":"unknown","x":1}')).toBeNull();
    expect(parseLuaLine('{"t":"gamestate","v":"three"}')).toBeNull();
    expect(parseLuaLine('{"t":"seed","checksum":"tooshort"}')).toBeNull();
    expect(parseLuaLine('{"t":"seed","checksum":"XYZ2c3d4e5f60708"}')).toBeNull();
    expect(parseLuaLine('{"t":"ram","regions":{"NOTHEX":"AAAA"}}')).toBeNull();
    expect(parseLuaLine('{"t":"ram","regions":{"6430":42}}')).toBeNull();
  });

  it('fills defaults for optional fields', () => {
    expect(parseLuaLine('{"t":"hello","proto":1}')).toEqual({
      t: 'hello',
      proto: 1,
      emu: 'unknown',
      script: 'unknown'
    });
    expect(parseLuaLine('{"t":"ram","regions":{}}')).toEqual({ t: 'ram', seq: 0, regions: {} });
  });
});

describe('encodeAppMessage', () => {
  it('is newline-terminated JSON', () => {
    const line = encodeAppMessage({ t: 'welcome', proto: 1, pollHz: 6 });
    expect(line.endsWith('\n')).toBe(true);
    expect(JSON.parse(line)).toEqual({ t: 'welcome', proto: 1, pollHz: 6 });
  });
});

describe('decodeRegion', () => {
  it('decodes base64 to bytes', () => {
    expect(Array.from(decodeRegion('AAECAw==')!)).toEqual([0, 1, 2, 3]);
  });

  it('rejects malformed base64', () => {
    expect(decodeRegion('!!!')).toBeNull();
    expect(decodeRegion('AAA')).toBeNull(); // bad length
  });

  it('decodes empty payloads', () => {
    expect(Array.from(decodeRegion('')!)).toEqual([]);
  });
});

describe('decodeRamRegions', () => {
  it('maps hex keys to numeric addresses', () => {
    const msg = parseLuaLine('{"t":"ram","seq":1,"regions":{"6430":"AAECAw==","1bc0":"//8="}}');
    expect(msg?.t).toBe('ram');
    if (msg?.t !== 'ram') return;
    const regions = decodeRamRegions(msg);
    expect(Array.from(regions.get(0x6430)!)).toEqual([0, 1, 2, 3]);
    expect(Array.from(regions.get(0x1bc0)!)).toEqual([255, 255]);
  });
});
