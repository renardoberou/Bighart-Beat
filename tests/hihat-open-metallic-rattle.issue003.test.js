#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { resolveHihatVoiceSpec, resolveHihatRenderBudget } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const stableRand = () => 0.5;
const base = { freq: 9400, decay: 0.055 };

function assertFiniteRattle(spec, label) {
  ['metallicRattleGain', 'metallicRattleTailSec', 'metallicRattleHz', 'metallicRattleQ'].forEach((key) => {
    assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`);
  });
  assert(spec.metallicRattleGain >= 0 && spec.metallicRattleGain <= 0.052, `${label}: metallic rattle gain is bounded/headroom-safe`);
  assert(spec.metallicRattleTailSec >= 0.004 && spec.metallicRattleTailSec <= 0.18, `${label}: metallic rattle tail is bounded/mobile-safe`);
  assert(spec.metallicRattleHz >= 7600 && spec.metallicRattleHz <= 18000, `${label}: metallic rattle frequency stays high and bounded`);
  assert(spec.metallicRattleQ >= 2.2 && spec.metallicRattleQ <= 12, `${label}: metallic rattle Q is focused but bounded`);
}

const closedHighMetalAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 0.08, metal: 0.96 }, stableRand, 1.0);
const lowMetalOpenAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 0.95, metal: 0.22 }, stableRand, 1.0);
const normalOpenAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 0.82, metal: 0.70 }, stableRand, 0.75);
const heroOpenAphex = resolveHihatVoiceSpec('aphex', { ...base, open: 0.96, metal: 0.96 }, stableRand, 1.0);
const classic808 = resolveHihatVoiceSpec('808', { ...base, open: 0.96, metal: 0.96 }, stableRand, 1.0);
const classic909 = resolveHihatVoiceSpec('909', { ...base, open: 0.96, metal: 0.96 }, stableRand, 1.0);
const reznorOpen = resolveHihatVoiceSpec('reznor', { ...base, open: 0.96, metal: 0.96 }, stableRand, 1.0);

[closedHighMetalAphex, lowMetalOpenAphex, normalOpenAphex, heroOpenAphex, classic808, classic909, reznorOpen].forEach((spec, i) => assertFiniteRattle(spec, `metallic rattle fixture ${i}`));

assert(heroOpenAphex.metallicRattleGain >= 0.036, 'accented high-open/high-metal aphex reaches a playable metallic rattle gain');
assert(heroOpenAphex.metallicRattleTailSec >= 0.060, 'accented high-open/high-metal aphex gets an audible open rattle tail');
assert(heroOpenAphex.metallicRattleGain > normalOpenAphex.metallicRattleGain * 1.8, 'hero aphex rattle is clearly stronger than normal/medium-metal open aphex');
assert(heroOpenAphex.metallicRattleGain > lowMetalOpenAphex.metallicRattleGain * 12, 'hero aphex rattle is much stronger than low-metal open aphex');
assert(heroOpenAphex.metallicRattleGain > closedHighMetalAphex.metallicRattleGain * 12, 'hero aphex rattle is much stronger than closed high-metal aphex');
assert(lowMetalOpenAphex.metallicRattleGain <= 0.001, 'low-metal open aphex keeps metallic rattle effectively silent');
assert(closedHighMetalAphex.metallicRattleGain <= 0.001, 'closed aphex keeps metallic rattle effectively silent');
assert.strictEqual(classic808.metallicRattleGain, 0, '808 does not gain the Aphex/IDM metallic rattle layer');
assert.strictEqual(classic909.metallicRattleGain, 0, '909 does not gain the Aphex/IDM metallic rattle layer');
assert(reznorOpen.metallicRattleGain > 0.001, 'reznor may receive a subtle metallic rattle layer');
assert(reznorOpen.metallicRattleGain < heroOpenAphex.metallicRattleGain * 0.45, 'reznor rattle remains subtler than aphex');

const mobileHeroBudget = resolveHihatRenderBudget(heroOpenAphex, { mobile: true });
assert.strictEqual(mobileHeroBudget.maxOptionalSources, 3, 'mobile hihat budget still defaults to three optional noise layers');
assert(mobileHeroBudget.availableOptionalSourceCount >= 3, 'hero aphex exposes competing optional layers for budget coverage');
assert(mobileHeroBudget.optionalSourceCount <= mobileHeroBudget.maxOptionalSources, 'mobile aphex rattle budget stays inside optional-source cap');
assert.strictEqual(mobileHeroBudget.useMetallicRattle, true, 'mobile budget preserves the strong open metallic rattle gesture');
assert(mobileHeroBudget.useIdmSpark || mobileHeroBudget.useOpenSplash || mobileHeroBudget.useOpenFlutter, 'mobile budget keeps a core Aphex identity layer alongside rattle');
assert(mobileHeroBudget.totalSourceEstimate <= 1 + mobileHeroBudget.maxOptionalSources + mobileHeroBudget.maxMetallicSources, 'mobile budget total estimate remains bounded by selected caps');

const alwaysFireRand = () => 0;
const contestedStrongGlitchAphex = resolveHihatVoiceSpec('aphex', { freq: 9000, decay: 0.04, open: 0.65, metal: 0.95 }, alwaysFireRand, 1.0);
assert.strictEqual(contestedStrongGlitchAphex.glitchWillFire, true, 'contested medium-open/high-metal aphex fires the strong glitch fixture deterministically');
assert(contestedStrongGlitchAphex.metallicRattleGain > 0.001, 'contested fixture exposes an audible but low-level metallic rattle candidate');
assert(contestedStrongGlitchAphex.metallicRattleGain < contestedStrongGlitchAphex.openSplashGain * 0.25, 'contested fixture rattle is much weaker than open splash');
assert(contestedStrongGlitchAphex.metallicRattleGain < contestedStrongGlitchAphex.openFlutterGain * 0.25, 'contested fixture rattle is much weaker than open flutter');
assert(contestedStrongGlitchAphex.openSplashGain >= 0.04, 'contested fixture has a strong open splash layer');
assert(contestedStrongGlitchAphex.openFlutterGain >= 0.04, 'contested fixture has a strong open flutter layer');
const contestedMobileBudget = resolveHihatRenderBudget(contestedStrongGlitchAphex, { mobile: true });
assert.strictEqual(contestedMobileBudget.maxOptionalSources, 3, 'contested mobile aphex budget uses the default three optional-source cap');
assert.strictEqual(contestedMobileBudget.useGlitch, true, 'contested mobile aphex still preserves the strong glitch gesture');
assert.strictEqual(contestedMobileBudget.useMetallicRattle, false, 'contested mobile aphex does not let low-level rattle spend a capped optional source');
assert.strictEqual(contestedMobileBudget.useOpenSplash, true, 'contested mobile aphex keeps stronger open splash ahead of low-level rattle');
assert(contestedMobileBudget.optionalSourceCount <= contestedMobileBudget.maxOptionalSources, 'contested mobile aphex budget stays inside optional-source cap');
const contestedFourLayerBudget = resolveHihatRenderBudget(contestedStrongGlitchAphex, { mobile: true, maxOptionalSources: 4 });
assert.strictEqual(contestedFourLayerBudget.useMetallicRattle, false, 'contested four-layer mobile aphex still avoids spending budget on low-level rattle');
assert.strictEqual(contestedFourLayerBudget.useOpenSplash, true, 'contested four-layer mobile aphex keeps stronger open splash');
assert.strictEqual(contestedFourLayerBudget.useOpenFlutter, true, 'contested four-layer mobile aphex keeps stronger open flutter before low-level rattle');

const classicBudget = resolveHihatRenderBudget(classic909, { mobile: true });
assert.strictEqual(classicBudget.useMetallicRattle, false, 'classic hats do not spend mobile budget on metallic rattle');

assert(/Math\.max\([\s\S]*hihatBudget\.useMetallicRattle\s*&&\s*spec\.metallicRattleGain\s*>\s*0\.001\s*\?\s*spec\.metallicRattleTailSec\s*\+\s*spec\.tailReleaseTau/.test(main), 'hihat tail budget includes metallic rattle only when render-budgeted and enabled');
assert(/if\s*\(\s*hihatBudget\.useMetallicRattle\s*&&\s*spec\.metallicRattleGain\s*>\s*0\.001\s*\)\s*\{[\s\S]*const\s+metallicRattle\s*=\s*A\.createBufferSource\(\)[\s\S]*metallicRattle\.buffer\s*=\s*nz[\s\S]*const\s+metallicRattleFilter\s*=\s*A\.createBiquadFilter\(\)[\s\S]*metallicRattleFilter\.type\s*=\s*'bandpass'[\s\S]*metallicRattleFilter\.frequency\.value\s*=\s*spec\.metallicRattleHz[\s\S]*metallicRattleFilter\.Q\.value\s*=\s*spec\.metallicRattleQ[\s\S]*metallicRattleGain\.gain\.linearRampToValueAtTime\(clamp\(v \* spec\.metallicRattleGain,\s*0,\s*\.052\),\s*t \+ Math\.min\(\.002,\s*spec\.attackSec\)\)[\s\S]*metallicRattle\.connect\(metallicRattleFilter\);\s*metallicRattleFilter\.connect\(metallicRattleGain\);\s*metallicRattleGain\.connect\(choke\);[\s\S]*metallicRattle\.stop\(t \+ spec\.metallicRattleTailSec \+ spec\.tailReleaseTau \* 3\)/.test(main), 'synthHihat wires budget-gated metallic rattle through choke/polish path with resolver bandpass, bounded gain, and stop time');

console.log('Issue 003 hihat open metallic rattle checks passed.');
