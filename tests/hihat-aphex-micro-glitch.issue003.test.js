#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { resolveHihatVoiceSpec, resolveHihatRenderBudget } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const rand = () => 0.5;
const alwaysFireRand = () => 0;
const base = { freq: 9000, decay: 0.04 };

function assertBoundedGlitch(spec, label) {
  ['glitchChance', 'glitchGain', 'glitchBandpassHz', 'idmEdge'].forEach((key) => {
    assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`);
  });
  assert(spec.glitchChance >= 0 && spec.glitchChance <= 0.30, `${label}: glitchChance remains bounded`);
  assert(spec.glitchGain >= 0 && spec.glitchGain <= 0.06, `${label}: glitchGain remains headroom-safe`);
  assert(spec.glitchBandpassHz >= 3500 && spec.glitchBandpassHz <= 14000, `${label}: glitch filter stays bounded`);
  assert(spec.idmEdge >= 0 && spec.idmEdge <= 1, `${label}: idmEdge is normalized`);
}

const lowMetalNormalAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 0, metal: 0.10 }, rand, 0.75);
const highMetalAccentedPartOpenAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 0.65, metal: 0.95 }, rand, 1.0);
const highMetalAccentedOpenAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 1, metal: 0.95 }, rand, 1.0);
const verySoftClosedAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 0, metal: 0.95, decay: 0.32 }, rand, 0.10);

[lowMetalNormalAphex, highMetalAccentedPartOpenAphex, highMetalAccentedOpenAphex, verySoftClosedAphex].forEach((spec, i) => assertBoundedGlitch(spec, `aphex micro glitch fixture ${i}`));

assert(highMetalAccentedPartOpenAphex.glitchChance > lowMetalNormalAphex.glitchChance * 2.2, 'high-metal accented partly-open aphex has much higher glitch probability than low-metal normal closed hat');
assert(highMetalAccentedPartOpenAphex.glitchGain > lowMetalNormalAphex.glitchGain * 3.2, 'high-metal accented partly-open aphex has an audibly stronger but bounded glitch tick');
assert(highMetalAccentedPartOpenAphex.idmEdge > lowMetalNormalAphex.idmEdge + 0.55, 'high-metal accented partly-open aphex exposes a clearly stronger IDM edge');
assert(highMetalAccentedPartOpenAphex.glitchChance >= 0.26, 'accented high-metal partly-open aphex reaches a playable micro-glitch probability');
assert(highMetalAccentedPartOpenAphex.glitchGain >= 0.052, 'accented high-metal partly-open aphex reaches a playable micro-glitch gain');
assert(highMetalAccentedPartOpenAphex.glitchGain <= 0.06, 'accented high-metal partly-open aphex micro-glitch stays headroom-safe');
assert(highMetalAccentedOpenAphex.glitchChance >= highMetalAccentedPartOpenAphex.glitchChance * 0.98, 'fully-open high-metal accented aphex keeps the micro-glitch personality');

const contestedMobileAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 0.45, metal: 0.95 }, alwaysFireRand, 1.0);
assert.strictEqual(contestedMobileAphex.glitchWillFire, true, 'deterministic medium-open high-metal accented aphex fires the micro-glitch fixture');
assert(contestedMobileAphex.ghostTickGain > 0.001, 'contested mobile fixture has an audible ghost tick competing for budget');
assert(contestedMobileAphex.idmSparkGain > 0.001, 'contested mobile fixture has an audible IDM spark competing for budget');
assert(contestedMobileAphex.openSplashGain > 0.001, 'contested mobile fixture has an audible open splash competing for budget');
assert(contestedMobileAphex.glitchGain > 0.001, 'contested mobile fixture has an audible micro-glitch competing for budget');
const contestedMobileBudget = resolveHihatRenderBudget(contestedMobileAphex, { mobile: true });
assert.strictEqual(contestedMobileBudget.maxOptionalSources, 3, 'mobile aphex budget uses the default three optional-source cap');
assert(contestedMobileBudget.optionalSourceCount <= contestedMobileBudget.maxOptionalSources, 'contested mobile aphex budget stays inside optional source cap');
assert.strictEqual(contestedMobileBudget.useGlitch, true, 'mobile aphex budget preserves a strong micro-glitch even when ghost, spark, and splash are all audible');
assert(contestedMobileBudget.useIdmSpark || contestedMobileBudget.useOpenSplash, 'contested mobile aphex budget still keeps a core Aphex layer with the glitch');

const liveMobileHighMetalAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 0.65, metal: 0.95 }, alwaysFireRand, 1.0);
assert.strictEqual(liveMobileHighMetalAphex.glitchWillFire, true, 'deterministic high-metal accented partly-open aphex fires the micro-glitch fixture');
const liveMobileBudget = resolveHihatRenderBudget(liveMobileHighMetalAphex, { mobile: true });
assert.strictEqual(liveMobileBudget.useGlitch, true, 'mobile aphex budget preserves an audible strong micro-glitch gesture under the optional-source cap');
assert(liveMobileBudget.optionalSourceCount <= liveMobileBudget.maxOptionalSources, 'mobile aphex budget stays inside optional source cap');
assert(liveMobileBudget.totalSourceEstimate <= 1 + liveMobileBudget.maxOptionalSources + liveMobileBudget.maxMetallicSources, 'mobile aphex budget total estimate remains bounded by selected caps');
assert(liveMobileBudget.useIdmSpark || liveMobileBudget.useOpenSplash, 'mobile aphex budget still keeps a core Aphex layer with the glitch');

const lowCoreMobileAphexBudget = resolveHihatRenderBudget({
  ...highMetalAccentedPartOpenAphex,
  glitchWillFire: true,
  glitchChance: 0.10,
  glitchGain: 0.012,
  idmEdge: 0.50,
}, { mobile: true });
assert.strictEqual(lowCoreMobileAphexBudget.useGlitch, false, 'low-glitch mobile aphex does not force glitch ahead of core layers');

assert(lowMetalNormalAphex.glitchChance <= 0.14, 'normal low-metal aphex does not over-spend glitch probability');
assert(lowMetalNormalAphex.glitchGain <= 0.018, 'normal low-metal aphex glitch tick stays subtle');
assert(verySoftClosedAphex.glitchChance <= 0.10, 'very-soft closed aphex keeps glitch probability restrained');
assert(verySoftClosedAphex.glitchGain <= 0.012, 'very-soft closed aphex does not become a loud/noisy glitch hat');
assert(verySoftClosedAphex.idmSparkTailSec <= 0.045, 'very-soft closed aphex IDM spark remains a short tick');
assert(verySoftClosedAphex.openFlutterGain <= 0.001, 'very-soft closed aphex does not add open flutter/noise');

const classic808 = resolveHihatVoiceSpec('808', { ...base, open: 0.65, metal: 0.95 }, rand, 1.0);
const classic909 = resolveHihatVoiceSpec('909', { ...base, open: 0.65, metal: 0.95 }, rand, 1.0);
assert.strictEqual(classic808.glitchChance, 0, '808 does not gain IDM glitch personality');
assert.strictEqual(classic808.glitchGain, 0, '808 glitch gain remains silent');
assert.strictEqual(classic808.idmEdge, 0, '808 IDM edge remains disabled');
assert.strictEqual(classic909.glitchChance, 0, '909 does not gain IDM glitch personality');
assert.strictEqual(classic909.glitchGain, 0, '909 glitch gain remains silent');
assert.strictEqual(classic909.idmEdge, 0, '909 IDM edge remains disabled');

const highMetalAccentedPartOpenReznor = resolveHihatVoiceSpec('reznor', { ...base, open: 0.65, metal: 0.95 }, rand, 1.0);
assertBoundedGlitch(highMetalAccentedPartOpenReznor, 'reznor subtle dirt fixture');
assert(highMetalAccentedPartOpenReznor.glitchChance > 0, 'reznor may keep a subtle dirt/glitch probability');
assert(highMetalAccentedPartOpenReznor.glitchChance < highMetalAccentedPartOpenAphex.glitchChance * 0.55, 'reznor remains less glitch-forward than aphex');
assert(highMetalAccentedPartOpenReznor.glitchGain < highMetalAccentedPartOpenAphex.glitchGain * 0.45, 'reznor glitch gain is subtler than aphex');
assert(highMetalAccentedPartOpenReznor.idmEdge < highMetalAccentedPartOpenAphex.idmEdge * 0.25, 'reznor IDM edge remains far below aphex');

assert(/if\s*\(\s*hihatBudget\.useGlitch\s*&&\s*spec\.glitchWillFire\s*\)/.test(main), 'synthHihat gates micro-glitch through render budget and resolver decision');
assert(/tf\.frequency\.value\s*=\s*spec\.glitchBandpassHz/.test(main), 'synthHihat routes micro-glitch through resolver bandpass frequency');
assert(/tg\.gain\.linearRampToValueAtTime\(clamp\(v \* spec\.glitchGain,\s*0,\s*\.06\),\s*t \+ \.0008\)/.test(main), 'synthHihat routes micro-glitch through resolver gain with headroom cap');
assert(/tick\.stop\(t \+ \.010\)/.test(main), 'synthHihat stops micro-glitch source quickly');

console.log('Issue 003 Aphex hihat micro-glitch personality checks passed.');
