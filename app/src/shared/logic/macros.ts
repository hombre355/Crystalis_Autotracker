/**
 * Faithful TypeScript port of the reference pack's logic scripts:
 * logic_common.lua, key_item_logic.lua, wall_logic.lua, boss_logic.lua,
 * traversal.lua, goa_logic.lua.
 *
 * Every function closes over `c` (ProviderCountForCode) and `checkCleared`.
 * Build a fresh table per snapshot via createMacros(); results are memoized
 * internally, so throw the table away when state changes.
 */
import type { LogicInputs, MacroTable } from './types';

type Town =
  | 'leaf' | 'brynmaer' | 'oak' | 'nadares' | 'portoa' | 'amazones'
  | 'joel' | 'zombie' | 'swan' | 'shyron' | 'goa' | 'sahara' | 'ESI';

const THUNDER_WARPS: readonly [string, Town][] = [
  ['thundershyron', 'shyron'],
  ['thunderbrynmaer', 'brynmaer'],
  ['thunderoak', 'oak'],
  ['thundernadares', 'nadares'],
  ['thunderportoa', 'portoa'],
  ['thunderamazones', 'amazones'],
  ['thunderjoel', 'joel'],
  ['thunderzombie', 'zombie'],
  ['thunderswan', 'swan'],
  ['thundergoa', 'goa'],
  ['thundersahara', 'sahara']
];

export function createMacros(inputs: LogicInputs): MacroTable {
  const c = (code: string): number => inputs.count(code);
  const has = (code: string): boolean => c(code) > 0;
  const negate = (code: string): boolean => c(code) === 0;

  // ---------- logic_common ----------
  const hasAnySword = () => c('sword') > 0;
  const hasAllSwords = () => c('sword') >= 4;
  const hasAnyBall = () => c('ball') > 0;
  const hasAllBalls = () => c('ball') >= 4;
  const hasAnyBracelet = () => c('bracelet') > 0;
  const hasAllBracelets = () => c('bracelet') >= 4;

  const levelTwoCount = () => {
    let count = 0;
    if (has('windball') && has('wind')) count++;
    if (has('fireball') && has('fire')) count++;
    if (has('waterball') && has('water')) count++;
    if (has('thunderball') && has('thunder')) count++;
    return count;
  };
  const hasAnyLevelTwo = () => levelTwoCount() > 0;
  const hasAllLevelTwo = () => hasAllSwords() && hasAllBalls();

  const battleMagicCount = () => {
    let count = 0;
    if (has('windbracelet') && has('wind')) count++;
    if (has('firebracelet') && has('fire')) count++;
    if (has('waterbracelet') && has('water')) count++;
    if (has('thunderbracelet') && has('thunder')) count++;
    return count;
  };
  const hasAnyBattleMagic = () => battleMagicCount() > 0;
  const hasAllBattleMagic = () => hasAllSwords() && hasAllBracelets();

  const canOpenChest = () => c('flag_mg') === 0 || hasAnySword();
  const canTriggerSkip = () => has('flag_gt');

  // ---------- wall_logic ----------
  const elementalWall = (element: string, level2: string, bracelet: string) => () => {
    if (!has(element)) return false;
    return has(level2) || has(bracelet) || has('flag_ro') || (has('flag_gc') && hasAnyLevelTwo());
  };
  const canBreakStoneWalls = elementalWall('wind', 'windball', 'windbracelet');
  const canBreakIceWalls = elementalWall('fire', 'fireball', 'firebracelet');
  const canBreakEmberWalls = elementalWall('water', 'waterball', 'waterbracelet');
  const canBreakIronWalls = elementalWall('thunder', 'thunderball', 'thunderbracelet');

  const canBreakAllWalls = () => hasAllSwords() && (has('flag_ro') || hasAllLevelTwo());
  const canBreakAnyWall = () => hasAnySword() && (has('flag_ro') || hasAnyLevelTwo());

  const canBreakWallWithCode = (code: string) =>
    canBreakAllWalls() ||
    (has(code + '_wind') && canBreakStoneWalls()) ||
    (has(code + '_fire') && canBreakIceWalls()) ||
    (has(code + '_water') && canBreakEmberWalls()) ||
    (has(code + '_thunder') && canBreakIronWalls());

  const canMaybeBreakWallWithCode = (code: string) =>
    (canBreakAnyWall() && c(code) <= 0) || canBreakWallWithCode(code);

  /** Multi-element dungeon walls: We off -> fixed element, We on -> per-wall code. */
  const dungeonWall = (code: string, vanilla: () => boolean) => ({
    sure: () => (negate('flag_we') ? vanilla() : canBreakWallWithCode(code)),
    maybe: () => (negate('flag_we') ? vanilla() : canMaybeBreakWallWithCode(code))
  });
  const eastCaveWall = dungeonWall('ecw', canBreakStoneWalls);
  const sealedCaveWalls = dungeonWall('scw', canBreakStoneWalls);
  const zebusCaveWall = dungeonWall('zcw', canBreakIceWalls);
  const sabreWestWalls = dungeonWall('msww', canBreakIceWalls);
  const sabreNorthWalls = dungeonWall('msnw', canBreakIceWalls);
  const waterfallCaveWalls = dungeonWall('wcw', canBreakIceWalls);
  const fogLampCaveWalls = dungeonWall('flcw', canBreakStoneWalls);
  const kirisaPlantCaveWalls = dungeonWall('kpcw', canBreakStoneWalls);
  const evilSpiritIslandWalls = dungeonWall('esiw', canBreakStoneWalls);
  const hydraWalls = dungeonWall('mhw', canBreakStoneWalls);

  /** Goa walls are iron in vanilla; under We they're single walls with cleared/tested state. */
  const goaWall = (code: string) => ({
    sure: () =>
      negate('flag_we') ? canBreakIronWalls() : canBreakAllWalls() || has(code + '_cleared'),
    maybe: () =>
      negate('flag_we')
        ? canBreakIronWalls()
        : (canBreakAnyWall() && c(code + '_tested') === 0) ||
          canBreakAllWalls() ||
          has(code + '_cleared')
  });
  const goaEntranceWall = goaWall('goa_entrance_wall');
  const saberaChestWall = goaWall('goa_sabera_item_wall');
  const saberaBossWall = goaWall('goa_sabera_boss_wall');
  const madoWall = goaWall('goa_mado_wall');
  const karmineWall = goaWall('goa_karmine_wall');
  const powerRingWall = goaWall('goa_basement_wall');

  // ---------- logic_common (parts that need walls) ----------
  const canCrossRivers = () => has('flight') || canBreakEmberWalls();
  const canClimbSlope = () =>
    has('rabbit') || (has('speed') && negate('flag_vb')) || has('flight') || canTriggerSkip();
  const canBypassBarriers = () =>
    has('barrier') ||
    (has('refresh') && has('shield')) ||
    has('flag_nb') ||
    (has('flag_gg') && has('flight'));
  const canCrossSpikes = () =>
    (has('gas') && negate('flag_vb')) ||
    has('flight') ||
    has('rabbit') ||
    has('flag_ng') ||
    (has('speed') && has('flag_vb')) ||
    canTriggerSkip();

  // ---------- key_item_logic ----------
  /** Wu-off: identified item code. Wu-on: manual id code or class-count fallback. */
  const wuItem = (identified: string, idCode: string, classCode: string, classAll: number) => () =>
    negate('flag_wu') ? has(identified) : has(idCode) || c(classCode) >= classAll;

  const hasWindmillKey = wuItem('redkey', 'windmill', 'key', 3);
  const hasKeyToPrison = wuItem('bluekey', 'prison', 'key', 3);
  const hasKeyToStyx = wuItem('greenkey', 'styx', 'key', 3);
  const hasAlarmFlute = wuItem('grayflute', 'alarm', 'flute', 4);
  const hasInsectFlute = wuItem('greenflute', 'insect', 'flute', 4);
  const hasFluteOfLime = wuItem('blueflute', 'lime', 'flute', 4);
  const hasShellFlute = wuItem('redflute', 'shell', 'flute', 4);

  const maybeWuItem =
    (hasFn: () => boolean, identified: string, unknownCode: string, notCode: string) => () =>
      negate('flag_wu')
        ? has(identified)
        : (has(unknownCode) && c(notCode) === 0) || hasFn();

  const maybeHasWindmillKey = maybeWuItem(hasWindmillKey, 'redkey', 'unknownkey', 'notwindmill');
  const maybeHasKeyToPrison = maybeWuItem(hasKeyToPrison, 'bluekey', 'unknownkey', 'notprison');
  const maybeHasKeyToStyx = maybeWuItem(hasKeyToStyx, 'greenkey', 'unknownkey', 'notstyx');
  const maybeHasAlarmFlute = maybeWuItem(hasAlarmFlute, 'grayflute', 'unknownflute', 'notalarm');
  const maybeHasInsectFlute = maybeWuItem(hasInsectFlute, 'greenflute', 'unknownflute', 'notinsect');
  const maybeHasFluteOfLime = maybeWuItem(hasFluteOfLime, 'blueflute', 'unknownflute', 'notlime');
  const maybeHasShellFlute = maybeWuItem(hasShellFlute, 'redflute', 'unknownflute', 'notshell');

  const hasAllStatues = () => c('tradestatue') >= 2 && c('statue') >= 2;
  const hasBothLamps = () => c('foglamp') >= 1 && c('glowinglamp') >= 1;
  const hasAllTrades = () =>
    has('flag_wu')
      ? c('trade') >= 2 && hasAllStatues() && hasBothLamps()
      : c('tradestatue') >= 2 && c('foglamp') >= 1 && c('trade') >= 2;

  const tradeUnknownFallback = (notCode: string) =>
    (has('unknowntrade') || has('unknownstatue') || has('unknownlamp')) && c(notCode) === 0;

  const hasAkahanaTrade = () => {
    const wt = has('flag_wt');
    const wu = has('flag_wu');
    if (!wt && !wu) return has('redstatue');
    if (!wt && wu) return has('tradeakahana') || hasAllStatues();
    return has('tradeakahana') || hasAllTrades();
  };
  const maybeHasAkahanaTrade = () => {
    const wt = has('flag_wt');
    const wu = has('flag_wu');
    if (!wt && !wu) return has('redstatue');
    if (!wt && wu) return has('tradeakahana') || (has('unknownstatue') && c('nottradeakahana') === 0);
    if (wt && !wu) return has('tradeakahana') || (has('unknowntrade') && c('nottradeakahana') === 0);
    return has('tradeakahana') || tradeUnknownFallback('nottradeakahana');
  };

  const hasSlimeTrade = () => {
    const wt = has('flag_wt');
    const wu = has('flag_wu');
    if (!wt && !wu) return has('graystatue');
    if (!wt && wu) return has('tradeslime') || hasAllStatues();
    return has('tradeslime') || hasAllTrades();
  };
  const maybeHasSlimeTrade = () => {
    const wt = has('flag_wt');
    const wu = has('flag_wu');
    if (!wt && !wu) return has('graystatue');
    if (!wt && wu) return has('tradeslime') || (has('unknownstatue') && c('nottradeslime') === 0);
    if (wt && !wu) return has('tradeslime') || (has('unknowntrade') && c('nottradeslime') === 0);
    return has('tradeslime') || tradeUnknownFallback('nottradeslime');
  };

  const hasAryllisTrade = () =>
    negate('flag_wt') ? has('kirisa') : has('tradearyllis') || hasAllTrades();
  const maybeHasAryllisTrade = () => {
    const wt = has('flag_wt');
    const wu = has('flag_wu');
    if (!wt) return has('kirisa');
    if (!wu) return has('tradearyllis') || (has('unknowntrade') && c('nottradearyllis') === 0);
    return has('tradearyllis') || tradeUnknownFallback('nottradearyllis');
  };

  const hasKensuTrade = () =>
    negate('flag_wt') ? has('love') : has('tradekensu') || hasAllTrades();
  const maybeHasKensuTrade = () => {
    const wt = has('flag_wt');
    const wu = has('flag_wu');
    if (!wt) return has('love');
    if (!wu) return has('tradekensu') || (has('unknowntrade') && c('nottradekensu') === 0);
    return has('tradekensu') || tradeUnknownFallback('nottradekensu');
  };

  const hasFishermanTrade = () => {
    const wt = has('flag_wt');
    const wu = has('flag_wu');
    if (!wt && !wu) return has('bluelamp');
    if (!wt && wu) return has('tradefisherman') || hasBothLamps();
    return has('tradefisherman') || hasAllTrades();
  };
  const maybeHasFishermanTrade = () => {
    const wt = has('flag_wt');
    const wu = has('flag_wu');
    if (!wt && !wu) return has('bluelamp');
    if (!wt && wu)
      return has('tradefisherman') || (has('unknownlamp') && c('nottradefisherman') === 0);
    if (wt && !wu)
      return has('tradefisherman') || (has('unknowntrade') && c('nottradefisherman') === 0);
    return has('tradefisherman') || tradeUnknownFallback('nottradefisherman');
  };

  const hasRepairLamp = () =>
    negate('flag_wu') ? has('graylamp') : has('brokenlamp') || hasBothLamps();
  const maybeHasRepairLamp = () =>
    negate('flag_wu')
      ? has('graylamp')
      : has('brokenlamp') || (has('unknownlamp') && c('notbrokenlamp') === 0);

  const hasBrokenStatue = () =>
    negate('flag_wu') ? has('crackedstatue') : has('brokenstatue') || hasAllStatues();
  const maybeHasBrokenStatue = () =>
    negate('flag_wu')
      ? has('crackedstatue')
      : has('brokenstatue') || (has('unknownstatue') && c('notbrokenstatue') === 0);

  const hasWhirlpoolStatue = () =>
    negate('flag_wu') ? has('bluestatue') : has('whirlpool') || hasAllStatues();
  const maybeHasWhirlpoolStatue = () =>
    negate('flag_wu')
      ? has('bluestatue')
      : has('whirlpool') || (has('unknownstatue') && c('notwhirlpool') === 0);

  const hasTornelBracelet = () =>
    negate('flag_wt')
      ? has('windbracelet')
      : hasAllBracelets() ||
        (has('tornelwind') && has('windbracelet')) ||
        (has('tornelfire') && has('firebracelet')) ||
        (has('tornelwater') && has('waterbracelet')) ||
        (has('tornelthunder') && has('thunderbracelet'));
  const maybeHasTornelBracelet = () =>
    negate('flag_wt')
      ? has('windbracelet')
      : (hasAnyBracelet() && c('tornel') === 0) || hasTornelBracelet();

  const hasRageSword = () =>
    negate('flag_wt')
      ? has('water')
      : hasAllSwords() ||
        (has('ragewind') && has('wind')) ||
        (has('ragefire') && has('fire')) ||
        (has('ragewater') && has('water')) ||
        (has('ragethunder') && has('thunder'));
  const maybeHasRageSword = () =>
    negate('flag_wt') ? has('water') : (hasAnySword() && c('rage') === 0) || hasRageSword();

  const hasCryptAccess = () =>
    negate('flag_wu')
      ? has('graybow') && has('redbow')
      : (has('sun') && has('moon')) || c('bow') >= 3;
  const maybeHasCryptAccess = () =>
    negate('flag_wu')
      ? has('graybow') && has('redbow')
      : (c('bow') >= 2 && c('notsun') === 0 && c('notmoon') === 0) || hasCryptAccess();

  // ---------- mesia / shell flute (logic_common, needs key items) ----------
  const canMaybeTriggerMesia = () => (maybeHasRageSword() || has('flag_gr')) && canCrossRivers();
  const canTriggerMesia = () => (hasRageSword() || has('flag_gr')) && canCrossRivers();

  const canMaybeUseShellFlute = () =>
    maybeHasShellFlute()
      ? negate('flag_rd') ||
        (canMaybeTriggerMesia() &&
          canCrossRivers() &&
          (maybeHasFishermanTrade() || has('flag_vw')))
      : false;
  const canUseShellFlute = () =>
    hasShellFlute()
      ? negate('flag_rd') ||
        (canTriggerMesia() && canCrossRivers() && (hasFishermanTrade() || has('flag_vw')))
      : false;

  // ---------- boss_logic ----------
  const canKillInsect = () => {
    if (negate('flag_me')) return has('fire') || has('water') || has('thunder');
    const swordCount = c('sword');
    return has('giantinsect_cleared') || swordCount > 1 || (has('flag_ns') && swordCount > 0);
  };
  const canMaybeKillInsect = () => {
    if (negate('flag_me')) return canKillInsect();
    if (has('giantinsect_tested')) return c('sword') > 1;
    return hasAnySword() || canKillInsect();
  };

  const canKillVampire2 = () => {
    if (negate('flag_me')) return has('wind') || has('water') || has('thunder');
    return has('vampire_cleared') || c('sword') > 1 || has('flag_ns');
  };
  const canMaybeKillVampire2 = () => {
    if (negate('flag_me')) return canKillVampire2();
    if (has('vampire_tested')) return c('sword') > 1;
    return hasAnySword() || canKillVampire2();
  };

  const canMaybeKillTetrarchyMember = () =>
    hasAnySword() &&
    (has('flag_nw') || hasAnyBattleMagic()) &&
    (negate('flag_er') || has('refresh'));
  const canKillTetrarchyMember = (): boolean => {
    if (has('flag_ns')) return canMaybeKillTetrarchyMember();
    return (
      hasAllSwords() &&
      (hasAllBattleMagic() || has('flag_nw') || (has('flag_gc') && hasAnyBattleMagic())) &&
      (negate('flag_er') || has('refresh'))
    );
  };

  /** Tetrarchy boss pattern: vanilla-element check under Me-off, else cleared/tested. */
  const tetrarchyBoss = (code: string, element: string, level2: string) => {
    const kill = (): boolean => {
      if (has('flag_ns')) return canMaybeKillTetrarchyMember();
      if (negate('flag_me')) {
        return (
          has(element) &&
          (has('flag_nw') || has(level2) || (has('flag_gc') && hasAnyBattleMagic())) &&
          (negate('flag_er') || has('refresh'))
        );
      }
      return has(code + '_cleared') || canKillTetrarchyMember();
    };
    const maybe = (): boolean => {
      if (negate('flag_me')) return kill();
      if (has(code + '_tested')) return canKillTetrarchyMember();
      return canMaybeKillTetrarchyMember() || kill();
    };
    return { kill, maybe };
  };
  const kelbesque1 = tetrarchyBoss('kelbesque1', 'wind', 'windbracelet');
  const kelbesque2 = tetrarchyBoss('kelbesque2', 'wind', 'windbracelet');
  const sabera1 = tetrarchyBoss('sabera1', 'fire', 'firebracelet');
  const sabera2 = tetrarchyBoss('sabera2', 'fire', 'firebracelet');
  const mado1 = tetrarchyBoss('mado1', 'water', 'waterbracelet');
  const mado2 = tetrarchyBoss('mado2', 'water', 'waterbracelet');

  const canKillKarmine = (): boolean => {
    if (has('flag_ns')) {
      return (
        hasAnySword() &&
        (hasAnyLevelTwo() || has('flag_nw')) &&
        (negate('flag_er') || has('refresh'))
      );
    }
    if (negate('flag_me')) {
      return (
        has('thunder') &&
        (has('flag_nw') || has('thunderball') || (has('flag_gc') && hasAnyLevelTwo())) &&
        (negate('flag_er') || has('refresh'))
      );
    }
    return (
      has('karmine_cleared') ||
      (hasAllSwords() &&
        (hasAllLevelTwo() || has('flag_nw') || (has('flag_gc') && hasAnyLevelTwo())) &&
        (negate('flag_er') || has('refresh')))
    );
  };
  const canMaybeKillKarmine = () => {
    if (negate('flag_me')) return canKillKarmine();
    if (has('karmine_tested')) {
      return (
        hasAllSwords() &&
        (hasAllLevelTwo() || has('flag_nw')) &&
        (negate('flag_er') || has('refresh'))
      );
    }
    return (
      (hasAnySword() &&
        (hasAnyLevelTwo() || has('flag_nw')) &&
        (negate('flag_er') || has('refresh'))) ||
      canKillKarmine()
    );
  };

  // ---------- traversal ----------
  const getStartingPoints = (): Town[] => {
    const starts: Town[] = ['leaf'];
    if (has('flag_vw')) starts.push('brynmaer', 'portoa', 'swan', 'goa', 'sahara', 'ESI');
    for (const [code, town] of THUNDER_WARPS) if (has(code)) starts.push(town);
    return starts;
  };

  const eastCavePassage = (dest: string, maybe: boolean): boolean => {
    if (!(negate('flag_vm') && negate('flag_vbangm'))) return false;
    if (has('eastfree' + dest)) return true;
    if (has('eastwall' + dest)) return maybe ? eastCaveWall.maybe() : eastCaveWall.sure();
    return false;
  };

  const edges: Record<Town, Partial<Record<Town, () => boolean>>> = {
    leaf: {
      brynmaer: () =>
        eastCavePassage('brynmaer', false) ||
        zebusCaveWall.sure() ||
        (has('flag_wm') && has('d_zebu')) ||
        (hasWindmillKey() && sealedCaveWalls.sure()),
      portoa: () => eastCavePassage('portoa', false) || has('flag_vbangm'),
      goa: () => eastCavePassage('goa', false),
      sahara: () => eastCavePassage('sahara', false)
    },
    brynmaer: {
      leaf: () =>
        eastCavePassage('brynmaer', false) ||
        zebusCaveWall.sure() ||
        (has('flag_wm') && has('d_zebu')),
      amazones: () => canCrossRivers(),
      oak: () => has('flag_ng') || has('gas'),
      nadares: () =>
        (has('telepathy') && has('teleport')) ||
        (has('flag_gn') && (has('flight') || has('teleport'))) ||
        canTriggerSkip()
    },
    oak: { brynmaer: () => has('flag_ng') || has('gas') },
    nadares: {
      brynmaer: () => true,
      portoa: () => kelbesque1.kill() && hasKeyToPrison() && sabreNorthWalls.sure()
    },
    portoa: {
      leaf: () => eastCavePassage('portoa', false) || has('flag_vbangm'),
      nadares: () =>
        kelbesque1.kill() &&
        hasKeyToPrison() &&
        sabreNorthWalls.sure() &&
        (has('flight') || canTriggerSkip()),
      joel: () => {
        const canCrossOcean = canUseShellFlute() || has('flight');
        const fromFisherman =
          (hasFishermanTrade() && (negate('flag_rd') || (canTriggerMesia() && canCrossRivers()))) ||
          has('flag_vw');
        const fromWaterway =
          canTriggerMesia() || has('flag_gs') || canTriggerSkip() || has('paralysis');
        return canCrossOcean && (fromFisherman || fromWaterway);
      }
    },
    amazones: { brynmaer: () => canCrossRivers() },
    joel: {
      portoa: () => canUseShellFlute() || has('flight'),
      zombie: () =>
        canUseShellFlute() &&
        ((canCrossRivers() && evilSpiritIslandWalls.sure()) ||
          (has('flag_wm') && has('d_evilspirit2') && has('d_evilspirit4'))),
      swan: () =>
        has('flight') ||
        (canUseShellFlute() && (hasWhirlpoolStatue() || (has('flag_gf') && has('rabbit'))))
    },
    zombie: {
      joel: () => {
        if (has('flag_wm')) {
          return (
            ((has('d_evilspirit2') && has('d_evilspirit1')) ||
              (canCrossRivers() && evilSpiritIslandWalls.sure())) &&
            (canUseShellFlute() || has('flight'))
          );
        }
        return canCrossRivers() && (canUseShellFlute() || has('flight'));
      }
    },
    swan: {
      joel: () => canUseShellFlute() || has('flight'),
      goa: () => has('change')
    },
    shyron: { goa: () => canCrossRivers() },
    goa: {
      leaf: () => eastCavePassage('goa', false),
      shyron: () => canCrossRivers() && (has('change') || has('flag_gs')),
      swan: () => has('change'),
      sahara: () => has('flight')
    },
    sahara: {
      leaf: () => eastCavePassage('sahara', false),
      goa: () => has('flight')
    },
    ESI: {
      joel: () => has('flight') || canUseShellFlute(),
      zombie: () =>
        (canCrossRivers() && evilSpiritIslandWalls.sure()) ||
        (has('d_evilspirit2') && has('d_evilspirit4'))
    }
  };

  const maybeEdges: Record<Town, Partial<Record<Town, () => boolean>>> = {
    leaf: {
      brynmaer: () =>
        edges.leaf.brynmaer!() ||
        eastCavePassage('brynmaer', true) ||
        zebusCaveWall.maybe() ||
        (maybeHasWindmillKey() && sealedCaveWalls.maybe()),
      portoa: () => eastCavePassage('portoa', true) || edges.leaf.portoa!(),
      goa: () => eastCavePassage('goa', true) || edges.leaf.goa!(),
      sahara: () => eastCavePassage('sahara', true) || edges.leaf.sahara!()
    },
    brynmaer: {
      leaf: () =>
        eastCavePassage('brynmaer', true) || zebusCaveWall.maybe() || edges.brynmaer.leaf!(),
      amazones: () => edges.brynmaer.amazones!(),
      oak: () => edges.brynmaer.oak!(),
      nadares: () => edges.brynmaer.nadares!()
    },
    oak: { brynmaer: () => edges.oak.brynmaer!() },
    nadares: {
      brynmaer: () => true,
      portoa: () => kelbesque1.maybe() && maybeHasKeyToPrison() && sabreNorthWalls.maybe()
    },
    portoa: {
      leaf: () => eastCavePassage('portoa', true) || edges.portoa.leaf!(),
      nadares: () =>
        (kelbesque1.maybe() &&
          maybeHasKeyToPrison() &&
          sabreNorthWalls.maybe() &&
          (has('flight') || canTriggerSkip())) ||
        edges.portoa.nadares!(),
      joel: () => {
        const canMaybeCrossOcean = canMaybeUseShellFlute() || has('flight');
        const fromFisherman =
          (maybeHasFishermanTrade() &&
            (negate('flag_rd') || (canMaybeTriggerMesia() && canCrossRivers()))) ||
          has('flag_vw');
        const fromWaterway =
          canMaybeTriggerMesia() || has('flag_gs') || canTriggerSkip() || has('paralysis');
        return canMaybeCrossOcean && (fromFisherman || fromWaterway);
      }
    },
    amazones: { brynmaer: () => edges.amazones.brynmaer!() },
    joel: {
      portoa: () => canMaybeUseShellFlute() || has('flight'),
      zombie: () =>
        canMaybeUseShellFlute() &&
        ((canCrossRivers() && evilSpiritIslandWalls.maybe()) ||
          (has('flag_wm') &&
            c('d_evilspirit2_blocked') === 0 &&
            c('d_evilspirit4_blocked') === 0)),
      swan: () =>
        has('flight') ||
        (canMaybeUseShellFlute() &&
          (maybeHasWhirlpoolStatue() || (has('flag_gf') && has('rabbit'))))
    },
    zombie: {
      joel: () => {
        if (has('flag_wm')) {
          return (
            ((c('d_evilspirit2_blocked') === 0 && c('d_evilspirit1_blocked') === 0) ||
              (canCrossRivers() && evilSpiritIslandWalls.maybe())) &&
            (canMaybeUseShellFlute() || has('flight'))
          );
        }
        return canCrossRivers() && (canMaybeUseShellFlute() || has('flight'));
      }
    },
    swan: {
      joel: () => canMaybeUseShellFlute() || has('flight'),
      goa: () => edges.swan.goa!()
    },
    shyron: { goa: () => edges.shyron.goa!() },
    goa: {
      leaf: () => eastCavePassage('goa', true) || edges.goa.leaf!(),
      shyron: () => edges.goa.shyron!(),
      swan: () => edges.goa.swan!(),
      sahara: () => edges.goa.sahara!()
    },
    sahara: {
      leaf: () => eastCavePassage('sahara', true) || edges.sahara.leaf!(),
      goa: () => edges.sahara.goa!()
    },
    ESI: {
      joel: () => has('flight') || canMaybeUseShellFlute(),
      zombie: () =>
        (canCrossRivers() && evilSpiritIslandWalls.maybe()) ||
        (has('flag_wm') &&
          c('d_evilspirit2_blocked') === 0 &&
          c('d_evilspirit4_blocked') === 0)
    }
  };

  function traverse(graph: Record<Town, Partial<Record<Town, () => boolean>>>): Set<Town> {
    const reached = new Set<Town>(getStartingPoints());
    const queue = [...reached];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const [dest, test] of Object.entries(graph[current]) as [Town, () => boolean][]) {
        if (!reached.has(dest) && test()) {
          reached.add(dest);
          queue.push(dest);
        }
      }
    }
    return reached;
  }

  let reachableCache: Set<Town> | null = null;
  let maybeReachableCache: Set<Town> | null = null;
  const canReach = (town?: string): boolean => {
    if (!town) return false;
    if (!reachableCache) reachableCache = traverse(edges);
    return reachableCache.has(town as Town);
  };
  const canMaybeReach = (town?: string): boolean => {
    if (!town) return false;
    if (!maybeReachableCache) maybeReachableCache = traverse(maybeEdges);
    return maybeReachableCache.has(town as Town);
  };

  // Sabre North helpers
  const canAccessSabreNorthFront = () => canReach('nadares');
  const canMaybeAccessSabreNorthFront = () => canMaybeReach('nadares');
  const canAccessSabreNorthBack = () =>
    hasKeyToPrison() &&
    (has('flight') || canTriggerSkip()) &&
    canReach('portoa') &&
    sabreNorthWalls.sure();
  const canMaybeAccessSabreNorthBack = () =>
    maybeHasKeyToPrison() &&
    (has('flight') || canTriggerSkip()) &&
    canMaybeReach('portoa') &&
    sabreNorthWalls.maybe();

  // ---------- goa_logic ----------
  type GoaBoss = 'kelbesque' | 'sabera' | 'mado' | 'karmine';
  type GoaFloor = '1st' | '2nd' | '3rd' | '4th';
  const FLOORS: GoaFloor[] = ['1st', '2nd', '3rd', '4th'];
  const BOSSES: GoaBoss[] = ['kelbesque', 'sabera', 'mado', 'karmine'];
  const VANILLA_FLOOR_BOSS: Record<GoaFloor, GoaBoss> = {
    '1st': 'kelbesque',
    '2nd': 'sabera',
    '3rd': 'mado',
    '4th': 'karmine'
  };

  const canEnterGoaFrontEntrance = () =>
    canReach('goa') && canBypassBarriers() && goaEntranceWall.sure();
  const canMaybeEnterGoaFrontEntrance = () =>
    canMaybeReach('goa') && canBypassBarriers() && goaEntranceWall.maybe();
  const canEnterGoaBackEntrance = () =>
    c('flag_wm') === 0
      ? canReach('goa') && has('flight')
      : canReach('goa') && (has('d_oasis1') || has('flight'));
  const canMaybeEnterGoaBackEntrance = () =>
    c('flag_wm') === 0
      ? canMaybeReach('goa') && has('flight')
      : canMaybeReach('goa') && (c('d_oasis1_blocked') === 0 || has('flight'));

  const crossBossFloor: Record<GoaBoss, { sure: () => boolean; maybe: () => boolean }> = {
    kelbesque: { sure: () => kelbesque2.kill(), maybe: () => kelbesque2.maybe() },
    sabera: {
      sure: () =>
        has('flag_wm')
          ? (canCrossRivers() && saberaBossWall.sure() && saberaChestWall.sure() && sabera2.kill()) ||
            (has('d_goasabera1') && has('d_goasabera2') && sabera2.kill())
          : canCrossRivers() && saberaBossWall.sure() && sabera2.kill(),
      maybe: () =>
        has('flag_wm')
          ? c('d_goasabera1_blocked') === 0 && c('d_goasabera2_blocked') === 0 && sabera2.maybe()
          : canCrossRivers() && saberaBossWall.maybe() && sabera2.maybe()
    },
    mado: {
      sure: () =>
        has('flag_wm')
          ? (has('d_goamado1') && mado2.kill() && has('d_goamado2')) ||
            (mado2.kill() && canCrossSpikes())
          : mado2.kill() && canCrossSpikes(),
      maybe: () =>
        has('flag_wm')
          ? c('d_goamado1_blocked') === 0 && c('d_goamado2_blocked') === 0 && mado2.maybe()
          : mado2.maybe() && canCrossSpikes()
    },
    karmine: {
      sure: () =>
        has('flag_wm')
          ? (has('d_goakarmine1') && has('d_goakarmine2')) || karmineWall.sure()
          : karmineWall.sure(),
      maybe: () =>
        has('flag_wm')
          ? (c('d_goakarmine1_blocked') === 0 && c('d_goakarmine2_blocked') === 0) ||
            karmineWall.maybe()
          : karmineWall.maybe()
    }
  };

  const canFullyCrossGoa = () => BOSSES.every((b) => crossBossFloor[b].sure());
  const canMaybeFullyCrossGoa = () => BOSSES.every((b) => crossBossFloor[b].maybe());

  const getBossForFloor = (floor: GoaFloor): GoaBoss | 'unknown' => {
    if (negate('flag_wg')) return VANILLA_FLOOR_BOSS[floor];
    for (const boss of BOSSES) if (has('goa' + floor + boss)) return boss;
    return 'unknown';
  };
  const getFloorForBoss = (boss: GoaBoss): GoaFloor | 'unknown' => {
    if (negate('flag_wg')) {
      return FLOORS.find((f) => VANILLA_FLOOR_BOSS[f] === boss) ?? 'unknown';
    }
    for (const floor of FLOORS) if (has('goa' + floor + boss)) return floor;
    return 'unknown';
  };
  const isBossFloorReversed = (boss: GoaBoss) => has('goa' + boss + '_r');

  const crossNumberedFloor = (floor: GoaFloor, maybe: boolean): boolean => {
    if (negate('flag_wg')) {
      const b = VANILLA_FLOOR_BOSS[floor];
      return maybe ? crossBossFloor[b].maybe() : crossBossFloor[b].sure();
    }
    const boss = getBossForFloor(floor);
    if (boss === 'unknown') {
      if (!maybe) return canFullyCrossGoa();
      return BOSSES.some((b) => c('goa' + b) === 0 && crossBossFloor[b].maybe());
    }
    return maybe ? crossBossFloor[boss].maybe() : crossBossFloor[boss].sure();
  };

  const reachFloorEnd = (floor: GoaFloor, exit: boolean, maybe: boolean): boolean => {
    const front = maybe ? canMaybeEnterGoaFrontEntrance : canEnterGoaFrontEntrance;
    const back = maybe ? canMaybeEnterGoaBackEntrance : canEnterGoaBackEntrance;
    const idx = FLOORS.indexOf(floor);
    if (!exit) {
      // entrance: front entrance + cross all floors below
      if (!front()) return false;
      for (let i = 0; i < idx; i++) if (!crossNumberedFloor(FLOORS[i]!, maybe)) return false;
      return true;
    }
    // exit: back entrance + cross all floors above
    if (!back()) return false;
    for (let i = FLOORS.length - 1; i > idx; i--) {
      if (!crossNumberedFloor(FLOORS[i]!, maybe)) return false;
    }
    return true;
  };
  const reachFloor = (floor: GoaFloor, maybe: boolean): boolean =>
    reachFloorEnd(floor, false, maybe) || reachFloorEnd(floor, true, maybe);

  const maybeUnknownFloorFallback = (): boolean =>
    FLOORS.some((f) => reachFloor(f, true) && has('goa' + f + 'unknown'));

  /** canReach<Boss>sFloorEntrance/Exit with reversal handling (goa_logic matrix). */
  const reachBossFloorEnd = (boss: GoaBoss, wantExit: boolean, maybe: boolean): boolean => {
    const floor = getFloorForBoss(boss);
    if (floor === 'unknown') {
      if (maybe) return maybeUnknownFloorFallback();
      // Unknown floor: conservative count-based fallback from the pack.
      let crossCount = 0;
      if (canEnterGoaFrontEntrance()) crossCount++;
      if (canEnterGoaBackEntrance()) crossCount++;
      if (crossBossFloor[boss].sure()) crossCount++;
      return crossCount >= 2 && BOSSES.filter((b) => b !== boss).every((b) => crossBossFloor[b].sure());
    }
    const reversed = isBossFloorReversed(boss);
    const exit = reversed ? !wantExit : wantExit;
    return reachFloorEnd(floor, exit, maybe);
  };

  /** Kelbesque's floor uses whole-floor reach rather than entrance/exit. */
  const canReachKelbesquesFloor = (maybe: boolean): boolean => {
    const floor = getFloorForBoss('kelbesque');
    if (floor !== 'unknown') return reachFloor(floor, maybe);
    if (maybe) return maybeUnknownFloorFallback();
    let crossCount = 0;
    if (crossBossFloor.sabera.sure()) crossCount++;
    if (crossBossFloor.mado.sure()) crossCount++;
    if (crossBossFloor.karmine.sure()) crossCount++;
    if (canEnterGoaFrontEntrance()) crossCount++;
    if (canEnterGoaBackEntrance()) crossCount++;
    return crossCount >= 4;
  };

  // ---------- pyramid front cleared (logic_common) ----------
  const pyramidFrontIsCleared = () => {
    const fightPrizes =
      inputs.checkCleared('@Pyramid Front: BoT/Bow of Truth') &&
      inputs.checkCleared('@Pyramid Front: Psycho Armor/Psycho Armor');
    if (has('flag_eu')) return fightPrizes;
    return fightPrizes && inputs.checkCleared('@Pyramid Front: Magic Ring/Magic Ring');
  };

  // ---------- macro table ----------
  return {
    negate: (arg) => (arg ? negate(arg) : false),
    hasAnySword,
    hasAllSwords,
    hasAnyBall,
    hasAllBalls,
    hasAnyBracelet,
    hasAllBracelets,
    hasAnyLevelTwo,
    hasAllLevelTwo,
    hasAnyBattleMagic,
    hasAllBattleMagic,
    canOpenChest,
    canCrossRivers,
    canTriggerSkip,
    canClimbSlope,
    canBypassBarriers,
    canCrossSpikes,
    canTriggerMesia,
    canMaybeTriggerMesia,
    canUseShellFlute,
    canMaybeUseShellFlute,
    pyramidFrontIsCleared,

    // walls
    canBreakStoneWalls,
    canBreakIceWalls,
    canBreakEmberWalls,
    canBreakIronWalls,
    canBreakAllWalls,
    canBreakAnyWall,
    canBreakEastCaveWall: eastCaveWall.sure,
    canMaybeBreakEastCaveWall: eastCaveWall.maybe,
    canBreakSealedCaveWalls: sealedCaveWalls.sure,
    canMaybeBreakSealedCaveWalls: sealedCaveWalls.maybe,
    canBreakZebusCaveWall: zebusCaveWall.sure,
    canMaybeBreakZebusCaveWall: zebusCaveWall.maybe,
    canBreakSabreWestWalls: sabreWestWalls.sure,
    canMaybeBreakSabreWestWalls: sabreWestWalls.maybe,
    canBreakSabreNorthWalls: sabreNorthWalls.sure,
    canMaybeBreakSabreNorthWalls: sabreNorthWalls.maybe,
    canBreakWaterfallCaveWalls: waterfallCaveWalls.sure,
    canMaybeBreakWaterfallCaveWalls: waterfallCaveWalls.maybe,
    canBreakFogLampCaveWalls: fogLampCaveWalls.sure,
    canMaybeBreakFogLampCaveWalls: fogLampCaveWalls.maybe,
    canBreakKirisaPlantCaveWalls: kirisaPlantCaveWalls.sure,
    canMaybeBreakKirisaPlantCaveWalls: kirisaPlantCaveWalls.maybe,
    canBreakEvilSpiritIslandWalls: evilSpiritIslandWalls.sure,
    canMaybeBreakEvilSpiritIslandWalls: evilSpiritIslandWalls.maybe,
    canBreakHydraWalls: hydraWalls.sure,
    canMaybeBreakHydraWalls: hydraWalls.maybe,
    canBreakGoaEntranceWall: goaEntranceWall.sure,
    canMaybeBreakGoaEntranceWall: goaEntranceWall.maybe,
    canBreakSaberaChestWall: saberaChestWall.sure,
    canMaybeBreakSaberaChestWall: saberaChestWall.maybe,
    canBreakSaberaBossWall: saberaBossWall.sure,
    canMaybeBreakSaberaBossWall: saberaBossWall.maybe,
    canBreakMadoWall: madoWall.sure,
    canMaybeBreakMadoWall: madoWall.maybe,
    canBreakKarmineWall: karmineWall.sure,
    canMaybeBreakKarmineWall: karmineWall.maybe,
    canBreakPowerRingWall: powerRingWall.sure,
    canMaybeBreakPowerRingWall: powerRingWall.maybe,

    // key items
    hasWindmillKey,
    maybeHasWindmillKey,
    hasKeyToPrison,
    maybeHasKeyToPrison,
    hasKeyToStyx,
    maybeHasKeyToStyx,
    hasAlarmFlute,
    maybeHasAlarmFlute,
    hasInsectFlute,
    maybeHasInsectFlute,
    hasFluteOfLime,
    maybeHasFluteOfLime,
    hasShellFlute,
    maybeHasShellFlute,
    hasAkahanaTrade,
    maybeHasAkahanaTrade,
    hasSlimeTrade,
    maybeHasSlimeTrade,
    hasAryllisTrade,
    maybeHasAryllisTrade,
    hasKensuTrade,
    maybeHasKensuTrade,
    hasFishermanTrade,
    maybeHasFishermanTrade,
    hasRepairLamp,
    maybeHasRepairLamp,
    hasBrokenStatue,
    maybeHasBrokenStatue,
    hasWhirlpoolStatue,
    maybeHasWhirlpoolStatue,
    hasTornelBracelet,
    maybeHasTornelBracelet,
    hasRageSword,
    maybeHasRageSword,
    hasCryptAccess,
    maybeHasCryptAccess,

    // bosses
    canKillInsect,
    canMaybeKillInsect,
    canKillVampire2,
    canMaybeKillVampire2,
    canKillKelbesque1: kelbesque1.kill,
    canMaybeKillKelbesque1: kelbesque1.maybe,
    canKillKelbesque2: kelbesque2.kill,
    canMaybeKillKelbesque2: kelbesque2.maybe,
    canKillSabera1: sabera1.kill,
    canMaybeKillSabera1: sabera1.maybe,
    canKillSabera2: sabera2.kill,
    canMaybeKillSabera2: sabera2.maybe,
    canKillMado1: mado1.kill,
    canMaybeKillMado1: mado1.maybe,
    canKillMado2: mado2.kill,
    canMaybeKillMado2: mado2.maybe,
    canKillKarmine,
    canMaybeKillKarmine,

    // traversal
    canReach: (arg) => canReach(arg),
    canMaybeReach: (arg) => canMaybeReach(arg),
    canAccessSabreNorth: () => canAccessSabreNorthFront() || canAccessSabreNorthBack(),
    canMaybeAccessSabreNorth: () =>
      canMaybeAccessSabreNorthFront() || canMaybeAccessSabreNorthBack(),
    canAccessSabreNorthFront,
    canMaybeAccessSabreNorthFront,
    canAccessSabreNorthBack,
    canMaybeAccessSabreNorthBack,

    // goa
    canEnterGoaFrontEntrance,
    canMaybeEnterGoaFrontEntrance,
    canEnterGoaBackEntrance,
    canMaybeEnterGoaBackEntrance,
    canFullyCrossGoa,
    canMaybeFullyCrossGoa,
    canReachKelbesquesFloor: () => canReachKelbesquesFloor(false),
    canMaybeReachKelbesquesFloor: () => canReachKelbesquesFloor(true),
    canReachSaberasFloorEntrance: () => reachBossFloorEnd('sabera', false, false),
    canMaybeReachSaberasFloorEntrance: () => reachBossFloorEnd('sabera', false, true),
    canReachSaberasFloorExit: () => reachBossFloorEnd('sabera', true, false),
    canMaybeReachSaberasFloorExit: () => reachBossFloorEnd('sabera', true, true),
    canReachMadosFloorEntrance: () => reachBossFloorEnd('mado', false, false),
    canMaybeReachMadosFloorEntrance: () => reachBossFloorEnd('mado', false, true),
    canReachMadosFloorExit: () => reachBossFloorEnd('mado', true, false),
    canMaybeReachMadosFloorExit: () => reachBossFloorEnd('mado', true, true),
    canReachKarminesFloorEntrance: () => reachBossFloorEnd('karmine', false, false),
    canMaybeReachKarminesFloorEntrance: () => reachBossFloorEnd('karmine', false, true),
    canReachKarminesFloorExit: () => reachBossFloorEnd('karmine', true, false),
    canMaybeReachKarminesFloorExit: () => reachBossFloorEnd('karmine', true, true),

    // no-op in our engine (pack used it to invalidate its caches)
    invalidateCache: () => true
  };
}
