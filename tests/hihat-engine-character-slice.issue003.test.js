#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { resolveHihatVoiceSpec, HIHAT_ENGINE_PROFILES } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));

function specFor(engine, open, velocity, metal) {
  return resolveHihatVoiceSpec(
    engine,
    { decay: 0.04, open: open, metal: metal ?? 0.5 },
    () => 0.5,
    velocity ?? 0.75
  );
}

const ENGINES = ['808', '909', 'reznor', 'aphex'];

// ── Profile existence and compulsory fields ──
for (const eng of ENGINES) {
  const p = HIHAT_ENGINE_PROFILES[eng];
  assert(p, `HIHAT_ENGINE_PROFILES has ${eng}`);
  assert.strictEqual(Array.isArray(p.ratios), true, `${eng} ratios isArray`);
  assert(p.ratios.length === 6, `${eng} has 6 ratios`);
  assert(typeof p.chokeClosedTau === 'number' && p.chokeClosedTau > 0, `${eng} chokeClosedTau > 0`);
  assert(typeof p.chokeOpenTau === 'number' && p.chokeOpenTau > p.chokeClosedTau, `${eng} chokeOpenTau > chokeClosedTau`);
}

const open808 = specFor('808', 1.0, 0.75);
const open909 = specFor('909', 1.0, 0.75);
const openReznor = specFor('reznor', 1.0, 0.75);
const openAphex = specFor('aphex', 1.0, 0.75);

// ── 808 vs 909 open-tail character ──
assert(
  open808.noiseTailSec > open909.noiseTailSec,
  `808 open hat tail (${open808.noiseTailSec.toFixed(4)}s) should be longer than 909 (${open909.noiseTailSec.toFixed(4)}s)`
);
assert(
  open808.decaySec > open909.decaySec,
  `808 open decay (${open808.decaySec.toFixed(4)}s) longer than 909 (${open909.decaySec.toFixed(4)}s)`
);

// ── 909 is brighter than 808 on open hat ──
assert(
  open909.highpassHz >= open808.highpassHz,
  `909 highpass (${open909.highpassHz}) >= 808 (${open808.highpassHz})`
);

// ── Reznor open hat tail is comparable to or exceeds aphex (industrial sustain) ──
assert(
  openReznor.noiseTailSec >= openAphex.noiseTailSec * 0.90,
  `Reznor open tail (${openReznor.noiseTailSec.toFixed(4)}s) >= Aphex (${openAphex.noiseTailSec.toFixed(4)}s) within 10% tolerance`
);

// ── Aphex has higher brightness (highpass) than 808 ──
assert(
  openAphex.highpassHz > open808.highpassHz,
  `Aphex highpass (${openAphex.highpassHz}) > 808 (${open808.highpassHz}) for IDM cutting edge`
);

// ── Choke: 909 chokes faster than 808 when open ──
assert(
  open909.chokeOpenTau < open808.chokeOpenTau,
  `909 chokeOpenTau (${open909.chokeOpenTau.toFixed(4)}) < 808 (${open808.chokeOpenTau.toFixed(4)}) for tighter choke`
);

// ── All choke floors are within bounds ──
for (const eng of ENGINES) {
  const s = specFor(eng, 0.3, 0.75);
  assert(s.chokeFloor >= 0.0008, `${eng} chokeFloor >= 0.0008`);
  assert(s.chokeFloor <= 0.004, `${eng} chokeFloor <= 0.004`);
}

// ── Closed hat choke tau is always <= open hat choke tau ──
for (const eng of ENGINES) {
  const closed = specFor(eng, 0, 0.75);
  const open = specFor(eng, 1.0, 0.75);
  assert(
    closed.chokeOpenTau <= open.chokeOpenTau + 0.001,
    `${eng}: closed chokeOpenTau (${closed.chokeOpenTau.toFixed(4)}) <= open (${open.chokeOpenTau.toFixed(4)})`
  );
}

// ── Profile-specific field validation ──
assert(HIHAT_ENGINE_PROFILES['808'].decay > HIHAT_ENGINE_PROFILES['909'].decay, '808 base decay > 909');
assert(HIHAT_ENGINE_PROFILES['909'].bright > HIHAT_ENGINE_PROFILES['808'].bright, '909 bright > 808');
assert(HIHAT_ENGINE_PROFILES['aphex'].instability >= HIHAT_ENGINE_PROFILES['808'].instability, 'aphex instability >= 808');
assert(HIHAT_ENGINE_PROFILES['reznor'].decay >= HIHAT_ENGINE_PROFILES['aphex'].decay, 'reznor decay >= aphex for industrial sustain');

// ── Open hihat produces open-splash in all engines ──
for (const eng of ENGINES) {
  const s = specFor(eng, 1.0, 0.75);
  assert(s.openSplashGain > 0, `${eng}: openSplashGain > 0 for full open hat`);
}

// ── Closed hat produces no open-splash ──
for (const eng of ENGINES) {
  const s = specFor(eng, 0, 0.75);
  assert.strictEqual(s.openSplashGain, 0, `${eng}: closed hat produces no open splashes`);
}

console.log('Issue 003 hihat engine character slice checks passed.');
