#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const hihatVoice = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const { resolveHihatVoiceSpec, resolveHihatRenderBudget, HIHAT_ENGINE_PROFILES } = hihatVoice;

assert(/openAccentBloom/.test(main), 'runtime consumes resolver openAccentBloom proxy without adding a new source');
assert(/spec\.openAccentBloom[\s\S]*clamp\(v \* spec\.openBodyGain/.test(main), 'runtime wires open accent bloom into the existing open body layer with clamp protection');
assert.strictEqual(typeof resolveHihatVoiceSpec, 'function', 'resolveHihatVoiceSpec is exported');
assert.strictEqual(typeof resolveHihatRenderBudget, 'function', 'resolveHihatRenderBudget is exported');
assert(HIHAT_ENGINE_PROFILES && HIHAT_ENGINE_PROFILES.aphex, 'engine hihat profiles are exported');

const baseParams = { freq: 9000, decay: 0.04, open: 0, metal: 0.7 };

function assertFiniteProfileCharacter(profile, label) {
  assert(profile && typeof profile === 'object', `${label}: hihat profile object exported`);
  ['transient', 'tailDamp', 'airDamp', 'trim'].forEach(k => {
    assert(Number.isFinite(profile[k]), `${label}: profile ${k} is finite`);
  });
  assert(profile.transient >= 0.88 && profile.transient <= 1.12, `${label}: profile transient is bounded`);
  assert(profile.tailDamp >= 0.82 && profile.tailDamp <= 1.16, `${label}: profile tailDamp is bounded`);
  assert(profile.airDamp >= 0.84 && profile.airDamp <= 1.18, `${label}: profile airDamp is bounded`);
  assert(profile.trim >= 0.82 && profile.trim <= 1, `${label}: profile trim is bounded for headroom`);
}

function seqRand(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

function assertFiniteBounded(spec, label) {
  assert(spec && typeof spec === 'object', `${label}: spec object returned`);
  ['noiseGain', 'metalGain', 'highpassHz', 'bandpassHz', 'bandpassQ', 'decaySec', 'attackSec', 'noiseTailSec', 'metalTailSec', 'tailReleaseTau', 'openTailDamp', 'tailHeadroomTrim', 'transientGain', 'outputTrim', 'airLowpassHz', 'airLowpassQ', 'openAccentBloom', 'openShimmerGain', 'openShimmerTailSec', 'openShimmerHz', 'openShimmerQ', 'openBodyGain', 'openBodyTailSec', 'openBodyHz', 'openBodyQ', 'openFlutterGain', 'openFlutterTailSec', 'openFlutterHz', 'openFlutterQ', 'idmSparkGain', 'idmSparkTailSec', 'idmSparkHz', 'idmSparkQ', 'glitchChance', 'glitchGain', 'idmEdge', 'metallicNeedlePinch', 'chokeClosedTau', 'chokeOpenTau', 'noiseLevel', 'metalLevel'].forEach(k => {
    assert(Number.isFinite(spec[k]), `${label}: ${k} is finite`);
  });
  assert(spec.noiseGain >= 0 && spec.noiseGain <= 0.72, `${label}: noise gain normalized <= 0.72`);
  assert(spec.metalGain >= 0 && spec.metalGain <= 0.34, `${label}: metal gain normalized <= 0.34`);
  assert(spec.highpassHz >= 2500 && spec.highpassHz <= 17000, `${label}: highpassHz bounded`);
  assert(spec.bandpassHz >= 4500 && spec.bandpassHz <= 18000, `${label}: bandpassHz bounded`);
  assert(spec.bandpassQ >= 0.5 && spec.bandpassQ <= 2.5, `${label}: bandpassQ bounded`);
  assert(spec.decaySec >= 0.006 && spec.decaySec <= 0.70, `${label}: decaySec bounded`);
  assert(spec.attackSec >= 0.0008 && spec.attackSec <= 0.004, `${label}: attackSec bounded for mobile-safe transient shaping`);
  assert(spec.noiseTailSec >= 0.006 && spec.noiseTailSec <= 0.70, `${label}: noiseTailSec bounded`);
  assert(spec.metalTailSec >= 0.004 && spec.metalTailSec <= 0.56, `${label}: metalTailSec bounded`);
  assert(spec.metalTailSec <= spec.noiseTailSec, `${label}: metallic tail does not outlive noise tail`);
  assert(spec.tailReleaseTau >= 0.010 && spec.tailReleaseTau <= 0.16, `${label}: tailReleaseTau bounded/mobile-safe`);
  assert(spec.openTailDamp >= 0.68 && spec.openTailDamp <= 1, `${label}: openTailDamp bounded for headroom`);
  assert(spec.tailHeadroomTrim >= 0.70 && spec.tailHeadroomTrim <= 1, `${label}: tailHeadroomTrim bounded for headroom`);
  assert(spec.transientGain >= 0.8 && spec.transientGain <= 1.18, `${label}: transientGain bounded`);
  assert(spec.outputTrim >= 0.62 && spec.outputTrim <= 1, `${label}: output trim is bounded for hihat headroom`);
  assert(spec.airLowpassHz >= 8500 && spec.airLowpassHz <= 18000, `${label}: air lowpass is bright but bounded`);
  assert(spec.airLowpassQ >= 0.2 && spec.airLowpassQ <= 0.9, `${label}: air lowpass Q is gentle and mobile-safe`);
  assert(spec.openAccentBloom >= 0 && spec.openAccentBloom <= 0.32, `${label}: open accent bloom proxy is bounded/headroom-safe`);
  assert(spec.openShimmerGain >= 0 && spec.openShimmerGain <= 0.085, `${label}: open shimmer gain remains headroom-safe`);
  assert(spec.openShimmerTailSec >= 0.006 && spec.openShimmerTailSec <= 0.72, `${label}: open shimmer tail is bounded/mobile-safe`);
  assert(spec.openShimmerHz >= 6500 && spec.openShimmerHz <= 18000, `${label}: open shimmer frequency is bright but bounded`);
  assert(spec.openShimmerQ >= 1.2 && spec.openShimmerQ <= 4.2, `${label}: open shimmer Q is focused but bounded`);
  assert(spec.openBodyGain >= 0 && spec.openBodyGain <= 0.11, `${label}: open body/bloom gain remains headroom-safe`);
  assert(spec.openBodyTailSec >= 0.004 && spec.openBodyTailSec <= 0.64, `${label}: open body/bloom tail is bounded/mobile-safe`);
  assert(spec.openBodyHz >= 2600 && spec.openBodyHz <= 12000, `${label}: open body/bloom frequency is present but bounded`);
  assert(spec.openBodyQ >= 0.45 && spec.openBodyQ <= 2.8, `${label}: open body/bloom Q is musical and bounded`);
  assert(spec.openFlutterGain >= 0 && spec.openFlutterGain <= 0.045, `${label}: open IDM flutter/rattle gain remains headroom-safe`);
  assert(spec.openFlutterTailSec >= 0.004 && spec.openFlutterTailSec <= 0.16, `${label}: open IDM flutter/rattle tail is bounded/mobile-safe`);
  assert(spec.openFlutterHz >= 5200 && spec.openFlutterHz <= 16000, `${label}: open IDM flutter/rattle frequency is metallic but bounded`);
  assert(spec.openFlutterQ >= 2.5 && spec.openFlutterQ <= 10, `${label}: open IDM flutter/rattle Q is focused but bounded`);
  assert(spec.idmSparkGain >= 0 && spec.idmSparkGain <= 0.065, `${label}: IDM spark gain remains headroom-safe`);
  assert(spec.idmSparkTailSec >= 0.003 && spec.idmSparkTailSec <= 0.045, `${label}: IDM spark tail is short/mobile-safe`);
  assert(spec.idmSparkHz >= 9000 && spec.idmSparkHz <= 18000, `${label}: IDM spark frequency is high but bounded`);
  assert(spec.idmSparkQ >= 3 && spec.idmSparkQ <= 14, `${label}: IDM spark Q is focused but bounded`);
  assert(spec.glitchChance >= 0 && spec.glitchChance <= 0.30, `${label}: glitch chance remains bounded`);
  assert(spec.glitchGain >= 0 && spec.glitchGain <= 0.06, `${label}: glitch gain remains bounded/headroom-safe`);
  assert(spec.idmEdge >= 0 && spec.idmEdge <= 1, `${label}: IDM edge normalized and bounded`);
  assert(spec.metallicNeedlePinch >= 0 && spec.metallicNeedlePinch <= 0.72, `${label}: metallic needle/pinch proxy normalized and bounded`);
  assert(spec.chokeClosedTau > 0, `${label}: closed choke tau positive`);
  assert(spec.chokeClosedTau < spec.chokeOpenTau, `${label}: closed choke tau is shorter than open`);
  assert(spec.chokeOpenTau <= 0.10, `${label}: open choke tau bounded`);
  assert(Array.isArray(spec.ratios), `${label}: ratios array`);
  assert(spec.ratios.length > 0 && spec.ratios.length <= 6, `${label}: oscillator ratio count bounded`);
  assert(spec.ratios.every(Number.isFinite), `${label}: ratios finite`);
  assert(['square', 'sawtooth', 'triangle'].includes(spec.oscType), `${label}: oscillator type safe`);
}

for (const engine of ['808', '909', 'reznor', 'aphex', 'mystery']) {
  assertFiniteBounded(resolveHihatVoiceSpec(engine, baseParams, () => 0.5), engine);
}
for (const engine of ['808', '909', 'reznor', 'aphex']) {
  assertFiniteProfileCharacter(HIHAT_ENGINE_PROFILES[engine], `${engine} hihat character profile`);
}
assert(HIHAT_ENGINE_PROFILES['909'].transient > HIHAT_ENGINE_PROFILES['808'].transient, '909 profile explicitly has more closed-hat transient punch than 808');
assert(HIHAT_ENGINE_PROFILES['909'].airDamp > HIHAT_ENGINE_PROFILES['808'].airDamp, '909 profile explicitly has brighter/less-damped air than 808');
assert(HIHAT_ENGINE_PROFILES.reznor.airDamp < HIHAT_ENGINE_PROFILES['909'].airDamp, 'reznor profile explicitly damps air more than 909');
assert(HIHAT_ENGINE_PROFILES.reznor.trim < HIHAT_ENGINE_PROFILES['909'].trim, 'reznor profile explicitly trims more output than 909');
assert(HIHAT_ENGINE_PROFILES.aphex.trim < HIHAT_ENGINE_PROFILES['909'].trim, 'aphex profile explicitly has extra headroom trim versus 909');

const lowVelocity = resolveHihatVoiceSpec('909', baseParams, () => 0.5, 0.25);
const normalVelocity = resolveHihatVoiceSpec('909', baseParams, () => 0.5, 0.75);
const accentedVelocity = resolveHihatVoiceSpec('909', baseParams, () => 0.5, 1.35);
assert(lowVelocity.noiseTailSec < normalVelocity.noiseTailSec, 'soft hihat hit has a shorter noise tail than normal velocity');
assert(lowVelocity.metalTailSec < normalVelocity.metalTailSec, 'soft hihat hit has a shorter metallic tail than normal velocity');
assert(lowVelocity.airLowpassHz < normalVelocity.airLowpassHz, 'soft hihat hit is darker than normal velocity');
assert(lowVelocity.transientGain < normalVelocity.transientGain, 'soft hihat hit has less transient than normal velocity');
assert(accentedVelocity.airLowpassHz > normalVelocity.airLowpassHz, 'accented hihat hit is brighter than normal velocity');
assert(accentedVelocity.transientGain > normalVelocity.transientGain, 'accented hihat hit has more transient than normal velocity');
assert(accentedVelocity.outputTrim < normalVelocity.outputTrim, 'accented hihat trims output for headroom');
assert(accentedVelocity.noiseGain <= normalVelocity.noiseGain, 'accented hihat does not increase raw noise gain before trim');

const softAphex = resolveHihatVoiceSpec('aphex', baseParams, () => 0.5, 0.25);
const normalAphex = resolveHihatVoiceSpec('aphex', baseParams, () => 0.5, 0.75);
const accentedAphex = resolveHihatVoiceSpec('aphex', baseParams, () => 0.5, 1.0);
assert(softAphex.idmEdge < normalAphex.idmEdge, 'soft aphex hihat has calmer IDM edge than normal velocity');
assert(accentedAphex.idmEdge > normalAphex.idmEdge, 'accented aphex hihat has stronger IDM edge than normal velocity');
assert(softAphex.glitchChance < normalAphex.glitchChance, 'soft aphex hihat has lower glitch probability than normal velocity');
assert(accentedAphex.glitchChance > normalAphex.glitchChance, 'accented aphex hihat has higher glitch probability than normal velocity');
assert(softAphex.glitchGain < normalAphex.glitchGain, 'soft aphex hihat has quieter glitch tick than normal velocity');
assert(accentedAphex.glitchGain > normalAphex.glitchGain, 'accented aphex hihat has louder-but-bounded glitch tick than normal velocity');
assert(softAphex.metalLevel < normalAphex.metalLevel, 'soft aphex hihat has calmer metallic edge than normal velocity');
assert(accentedAphex.metalLevel > normalAphex.metalLevel, 'accented aphex hihat has stronger metallic edge than normal velocity');
assert(softAphex.metallicNeedlePinch < normalAphex.metallicNeedlePinch, 'soft closed aphex hihat has less metallic needle/pinch than normal velocity');
assert(accentedAphex.metallicNeedlePinch > normalAphex.metallicNeedlePinch, 'accented closed aphex hihat has more metallic needle/pinch than normal velocity');
assert(accentedAphex.idmSparkQ > normalAphex.idmSparkQ, 'accented closed aphex hihat focuses the existing spark layer for a needle-like pinch');
assert(accentedAphex.idmSparkTailSec <= normalAphex.idmSparkTailSec, 'accented closed aphex hihat keeps the needle/pinch spark short and mobile-safe');
assertFiniteBounded(softAphex, 'soft aphex IDM edge hihat');
assertFiniteBounded(normalAphex, 'normal aphex IDM edge hihat');
assertFiniteBounded(accentedAphex, 'accented aphex IDM edge hihat');

const normalOpen909 = resolveHihatVoiceSpec('909', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5, 0.75);
const softOpen909 = resolveHihatVoiceSpec('909', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5, 0.25);
const accentedOpen909 = resolveHihatVoiceSpec('909', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5, 1.0);
const softPartOpen909 = resolveHihatVoiceSpec('909', { ...baseParams, open: 0.45, decay: 0.04 }, () => 0.5, 0.25);
const normalPartOpen909 = resolveHihatVoiceSpec('909', { ...baseParams, open: 0.45, decay: 0.04 }, () => 0.5, 0.75);
const accentedPartOpen909 = resolveHihatVoiceSpec('909', { ...baseParams, open: 0.45, decay: 0.04 }, () => 0.5, 1.0);
assert(softOpen909.chokeOpenTau > normalOpen909.chokeOpenTau, 'soft open 909 hihat keeps a slightly smoother choke/release tail');
assert(accentedOpen909.chokeOpenTau < normalOpen909.chokeOpenTau, 'accented open 909 hihat chokes/releases tighter than normal open hit');
assert(softPartOpen909.chokeOpenTau > normalPartOpen909.chokeOpenTau, 'soft partly-open 909 hihat also keeps a smoother choke/release tail');
assert(accentedPartOpen909.chokeOpenTau < normalPartOpen909.chokeOpenTau, 'accented partly-open 909 hihat chokes/releases tighter than normal');
assert.strictEqual(lowVelocity.chokeOpenTau, normalVelocity.chokeOpenTau, 'soft closed 909 hihat keeps existing choke release unchanged');
assert.strictEqual(accentedVelocity.chokeOpenTau, normalVelocity.chokeOpenTau, 'accented closed 909 hihat keeps existing choke release unchanged');
assert(softOpen909.openAccentBloom < normalOpen909.openAccentBloom, 'soft open 909 hihat keeps the accent bloom proxy restrained');
assert(accentedOpen909.openAccentBloom > normalOpen909.openAccentBloom + 0.08, 'accented open 909 hihat exposes an obvious extra bloom proxy versus normal open hit');
assert(accentedOpen909.openAccentBloom > softOpen909.openAccentBloom * 2, 'accented open 909 hihat has much more bloom proxy than soft open hit');
assert(accentedOpen909.openAccentBloom <= 0.32, 'accented open 909 hihat bloom proxy remains bounded for headroom');
assert(accentedOpen909.openBodyGain > softOpen909.openBodyGain * 1.45, 'accented open 909 hihat has clearly stronger body/bloom than soft open hit');
assert(accentedOpen909.openShimmerGain > softOpen909.openShimmerGain * 1.45, 'accented open 909 hihat has clearly stronger shimmer than soft open hit');
assert(softOpen909.openShimmerTailSec > normalOpen909.openShimmerTailSec, 'soft open 909 hihat keeps an airy shimmer tail instead of collapsing shorter than normal');
assert(softOpen909.openBodyTailSec > accentedOpen909.openBodyTailSec, 'soft open 909 hihat keeps longer body presence than the snappier accented open hit');
assert(accentedOpen909.openShimmerTailSec <= normalOpen909.openShimmerTailSec * 1.02, 'accented open 909 hihat shimmer stays snappy and does not outgrow normal open tail');
assert(accentedOpen909.openBodyTailSec < normalOpen909.openBodyTailSec, 'accented open 909 hihat body stays tighter than normal open tail');
assert(accentedOpen909.noiseTailSec < normalOpen909.noiseTailSec, 'accented open 909 hihat has a tighter noise tail than normal velocity');
assert(accentedOpen909.metalTailSec < normalOpen909.metalTailSec, 'accented open 909 hihat has a tighter metallic tail than normal velocity');
assert(accentedOpen909.tailReleaseTau < normalOpen909.tailReleaseTau, 'accented open 909 hihat has a tighter release tau than normal velocity');
assert(accentedOpen909.airLowpassHz > normalOpen909.airLowpassHz, 'accented open 909 hihat stays brighter than normal velocity');
assert(accentedOpen909.transientGain > normalOpen909.transientGain, 'accented open 909 hihat stays punchier than normal velocity');
assertFiniteBounded(accentedOpen909, 'accented open 909 hihat');

assertFiniteBounded(lowVelocity, 'low velocity hihat');
assertFiniteBounded(normalVelocity, 'normal velocity hihat');
assertFiniteBounded(accentedVelocity, 'accented velocity hihat');
assert.deepStrictEqual(
  resolveHihatVoiceSpec('909', baseParams, () => 0.5, -9),
  resolveHihatVoiceSpec('909', baseParams, () => 0.5, 0),
  'hihat velocity/accent input is clamped at the low bound'
);
assert.deepStrictEqual(
  resolveHihatVoiceSpec('909', baseParams, () => 0.5, 99),
  resolveHihatVoiceSpec('909', baseParams, () => 0.5, 1),
  'hihat velocity/accent input is clamped at the high bound'
);

const closed = resolveHihatVoiceSpec('909', { ...baseParams, open: 0, decay: 0.04 }, () => 0.5);
const tight = resolveHihatVoiceSpec('909', { ...baseParams, open: 0.45, decay: 0.04 }, () => 0.5);
const open = resolveHihatVoiceSpec('909', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5);
assert(closed.decaySec >= 0.006 && closed.decaySec <= 0.70, 'closed hihat decay has same safe upper bound as open');
assert(tight.decaySec > closed.decaySec, 'tight hihat placement is audibly longer than closed for the same base decay');
assert(open.decaySec > tight.decaySec, 'open hihat decay is longer than tight for the same base decay');
assert(open.decaySec <= 0.70, 'open hihat decay has safe upper bound');
assert(closed.attackSec < tight.attackSec, 'closed hihat has the fastest transient attack');
assert(tight.attackSec < open.attackSec, 'open hihat has the softest transient attack');
assert(tight.noiseTailSec > closed.noiseTailSec, 'tight hihat gets more noise tail than closed');
assert(open.noiseTailSec > tight.noiseTailSec, 'open hihat gets the longest noise tail');
assert(tight.metalTailSec > closed.metalTailSec, 'tight hihat gets more metallic tail than closed');
assert(tight.tailReleaseTau > closed.tailReleaseTau, 'tight hihat smooths the long-tail release more than closed');
assert(open.tailReleaseTau > tight.tailReleaseTau, 'open hihat gets the smoothest release tau for safer tails');
assert(tight.openTailDamp < closed.openTailDamp, 'tight hihat damps sustained tail more than closed');
assert(open.openTailDamp < tight.openTailDamp, 'open hihat damps sustained tail more than tight to avoid harsh buildup');
assert(tight.tailHeadroomTrim < closed.tailHeadroomTrim, 'tight hihat applies extra tail headroom trim versus closed');
assert(open.tailHeadroomTrim < tight.tailHeadroomTrim, 'open hihat applies strongest tail headroom trim');
assert(open.transientGain < closed.transientGain, 'open hihat trims transient gain to leave headroom for longer tail');
assert(tight.outputTrim < closed.outputTrim, 'tight hihat trims post-choke output more than closed for tail headroom');
assert(open.outputTrim < tight.outputTrim, 'open hihat has the strongest post-choke trim for long-tail headroom');
assert(open.airLowpassHz < closed.airLowpassHz, 'open hihat gently darkens the longest tail to avoid harsh buildup');
assert(closed.openShimmerGain <= 0.001, 'closed hihat keeps the added open shimmer effectively silent');
assert(tight.openShimmerGain > closed.openShimmerGain, 'tight hihat introduces a little open shimmer presence');
assert(open.openShimmerGain > tight.openShimmerGain, 'open hihat has the clearest shimmer presence');
assert(open.openShimmerTailSec > tight.openShimmerTailSec, 'open hihat shimmer tail blooms longer than tight hihat');
assert(accentedOpen909.openShimmerGain > normalOpen909.openShimmerGain, 'accented open 909 hihat has stronger shimmer presence than normal open hit');
assert(accentedOpen909.openShimmerHz > normalOpen909.openShimmerHz, 'accented open 909 hihat pushes shimmer brighter than normal open hit');
assert(closed.openBodyGain <= 0.001, 'closed hihat keeps the added open body/bloom effectively silent');
assert(tight.openBodyGain > closed.openBodyGain, 'tight hihat introduces less body/bloom than fully open hihat');
assert(open.openBodyGain > tight.openBodyGain, 'open hihat has the clearest body/bloom presence');
assert(open.openBodyTailSec > tight.openBodyTailSec, 'open hihat body/bloom tail grows longer than tight hihat');
assert(accentedOpen909.openBodyGain > normalOpen909.openBodyGain, 'accented open 909 hihat has stronger body/bloom than normal open hit');
assert(accentedOpen909.openBodyHz > normalOpen909.openBodyHz, 'accented open 909 hihat pushes body/bloom brighter than normal open hit');
assert(accentedOpen909.openBodyGain <= 0.11, 'accented open body/bloom remains headroom-safe');
const open808 = resolveHihatVoiceSpec('808', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5, 0.75);
const openAphex = resolveHihatVoiceSpec('aphex', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5, 0.75);
assert(open808.openBodyGain < open.openBodyGain, '808 open body/bloom stays classic-clean versus 909');
assert(openAphex.openBodyGain > open.openBodyGain, 'aphex open body/bloom can be a little more characterful than classic engines');

const closedAphex = resolveHihatVoiceSpec('aphex', { ...baseParams, open: 0, decay: 0.04 }, () => 0.5, 0.75);
const tightAphex = resolveHihatVoiceSpec('aphex', { ...baseParams, open: 0.45, decay: 0.04 }, () => 0.5, 0.75);
const accentedTightAphex = resolveHihatVoiceSpec('aphex', { ...baseParams, open: 0.45, decay: 0.04 }, () => 0.5, 1.0);
const softTightAphex = resolveHihatVoiceSpec('aphex', { ...baseParams, open: 0.45, decay: 0.04 }, () => 0.5, 0.25);
const openReznor = resolveHihatVoiceSpec('reznor', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5, 0.75);
const closedReznor = resolveHihatVoiceSpec('reznor', { ...baseParams, open: 0, decay: 0.04 }, () => 0.5, 0.75);
const accentedOpenAphex = resolveHihatVoiceSpec('aphex', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5, 1.0);
const open909Classic = resolveHihatVoiceSpec('909', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5, 0.75);
assert(softTightAphex.metallicNeedlePinch < tightAphex.metallicNeedlePinch, 'soft tight aphex hihat restrains the metallic needle/pinch character');
assert(accentedTightAphex.metallicNeedlePinch > tightAphex.metallicNeedlePinch, 'accented tight aphex hihat emphasizes the metallic needle/pinch character');
assert(accentedTightAphex.metallicNeedlePinch > accentedOpenAphex.metallicNeedlePinch * 2 + 0.08, 'accented tight aphex hihat is more needle-biased than accented open aphex');
assert(accentedOpenAphex.openAccentBloom > accentedTightAphex.openAccentBloom, 'accented open aphex hihat remains about tail/bloom rather than harsh needle');
assert(closedReznor.metallicNeedlePinch <= closedAphex.metallicNeedlePinch, 'reznor closed hihat needle/pinch stays no stronger than aphex');

function assertFiniteBudget(budget, label) {
  assert(budget && typeof budget === 'object', `${label}: budget object returned`);
  ['maxOptionalSources', 'optionalSourceCount', 'availableOptionalSourceCount', 'maxMetallicSources', 'metallicSourceCount', 'availableMetallicSourceCount', 'totalSourceEstimate'].forEach(k => {
    assert(Number.isFinite(budget[k]), `${label}: ${k} is finite`);
  });
  ['useOpenShimmer', 'useOpenBody', 'useOpenFlutter', 'useIdmSpark', 'useGlitch'].forEach(k => {
    assert.strictEqual(typeof budget[k], 'boolean', `${label}: ${k} is boolean`);
  });
  assert(budget.maxOptionalSources >= 0, `${label}: maxOptionalSources non-negative`);
  assert(budget.optionalSourceCount >= 0, `${label}: optionalSourceCount non-negative`);
  assert(budget.optionalSourceCount <= budget.maxOptionalSources, `${label}: optionalSourceCount respects cap`);
  assert(budget.optionalSourceCount <= budget.availableOptionalSourceCount, `${label}: optionalSourceCount no larger than available`);
  assert(budget.maxMetallicSources >= 0, `${label}: maxMetallicSources non-negative`);
  assert(budget.metallicSourceCount >= 0, `${label}: metallicSourceCount non-negative`);
  assert(budget.metallicSourceCount <= budget.maxMetallicSources, `${label}: metallicSourceCount respects cap`);
  assert(budget.metallicSourceCount <= budget.availableMetallicSourceCount, `${label}: metallicSourceCount no larger than available`);
  assert(Array.isArray(budget.budgetedOscillatorFrequencies), `${label}: budgetedOscillatorFrequencies array`);
  assert.strictEqual(budget.budgetedOscillatorFrequencies.length, budget.metallicSourceCount, `${label}: selected oscillator frequencies match metallicSourceCount`);
  assert(budget.budgetedOscillatorFrequencies.every(Number.isFinite), `${label}: selected oscillator frequencies are finite`);
  assert.strictEqual(budget.totalSourceEstimate, 1 + budget.optionalSourceCount + budget.metallicSourceCount, `${label}: totalSourceEstimate includes base noise, optional, and metallic sources`);
}

const desktopAphexBudget = resolveHihatRenderBudget(openAphex);
assertFiniteBudget(desktopAphexBudget, 'desktop aphex hihat render budget');
assert.strictEqual(desktopAphexBudget.availableMetallicSourceCount, openAphex.oscillatorFrequencies.length, 'desktop budget reports all audible metallic oscillators as available');
assert.strictEqual(desktopAphexBudget.maxMetallicSources, desktopAphexBudget.availableMetallicSourceCount, 'desktop budget defaults to all available metallic oscillators');
assert.strictEqual(desktopAphexBudget.metallicSourceCount, desktopAphexBudget.maxMetallicSources, 'desktop budget selects all default metallic oscillators');
assert.deepStrictEqual(desktopAphexBudget.budgetedOscillatorFrequencies, openAphex.oscillatorFrequencies, 'desktop budget preserves finite oscillator frequencies by default');
assert.strictEqual(desktopAphexBudget.useOpenShimmer, openAphex.openShimmerGain > 0.001, 'desktop budget preserves open shimmer when audible');
assert.strictEqual(desktopAphexBudget.useOpenBody, openAphex.openBodyGain > 0.001, 'desktop budget preserves open body when audible');
assert.strictEqual(desktopAphexBudget.useOpenFlutter, openAphex.openFlutterGain > 0.001, 'desktop budget preserves open flutter when audible');
assert.strictEqual(desktopAphexBudget.useIdmSpark, openAphex.idmSparkGain > 0.001, 'desktop budget preserves IDM spark when audible');
assert.strictEqual(desktopAphexBudget.useGlitch, openAphex.glitchWillFire, 'desktop budget preserves glitch tick when resolver fires it');

const mobileTightAccentedOpenAphexBudget = resolveHihatRenderBudget(accentedOpenAphex, { mobile: true, denseRatchet: true, maxOptionalSources: 1 });
assertFiniteBudget(mobileTightAccentedOpenAphexBudget, 'mobile tight accented open aphex hihat render budget');
assert.strictEqual(mobileTightAccentedOpenAphexBudget.maxOptionalSources, 1, 'explicit tight mobile budget cap is honored');
assert.strictEqual(mobileTightAccentedOpenAphexBudget.optionalSourceCount, 1, 'tight mobile budget keeps exactly one optional character source');
assert(mobileTightAccentedOpenAphexBudget.useIdmSpark || mobileTightAccentedOpenAphexBudget.useOpenFlutter, 'tight mobile accented open aphex keeps an IDM character layer');
assert.strictEqual(mobileTightAccentedOpenAphexBudget.maxMetallicSources, Math.min(3, mobileTightAccentedOpenAphexBudget.availableMetallicSourceCount), 'mobile dense default metallic budget keeps current fallback cap when explicit cap is omitted');
assert.strictEqual(mobileTightAccentedOpenAphexBudget.metallicSourceCount, mobileTightAccentedOpenAphexBudget.maxMetallicSources, 'mobile dense default metallic budget selects up to its fallback cap');
assert.strictEqual(mobileTightAccentedOpenAphexBudget.useOpenShimmer, false, 'tight mobile accented open aphex sheds open shimmer first');
assert.strictEqual(mobileTightAccentedOpenAphexBudget.useOpenBody, false, 'tight mobile accented open aphex sheds open body/bloom first');
assert.strictEqual(mobileTightAccentedOpenAphexBudget.useGlitch, false, 'tight mobile accented open aphex sheds optional glitch tick under tight cap');

assert(accentedOpenAphex.metalGain > 0.001, 'explicit metallic cap fixture has audible metal');
assert(accentedOpenAphex.oscillatorFrequencies.length >= 2, 'explicit metallic cap fixture exposes multiple oscillator frequencies');
const explicitZeroMetallicBudget = resolveHihatRenderBudget(accentedOpenAphex, { maxMetallicSources: 0 });
assertFiniteBudget(explicitZeroMetallicBudget, 'explicit zero metallic hihat render budget');
assert.strictEqual(explicitZeroMetallicBudget.availableMetallicSourceCount, accentedOpenAphex.oscillatorFrequencies.length, 'explicit zero metallic budget still reports available audible metallic oscillators');
assert.strictEqual(explicitZeroMetallicBudget.maxMetallicSources, 0, 'explicit maxMetallicSources: 0 is honored when metal is audible');
assert.strictEqual(explicitZeroMetallicBudget.metallicSourceCount, 0, 'explicit zero metallic budget selects no metallic oscillators');
assert.deepStrictEqual(explicitZeroMetallicBudget.budgetedOscillatorFrequencies, [], 'explicit zero metallic budget has no selected oscillator frequencies');

const mobileTightReznorBudget = resolveHihatRenderBudget(openReznor, { mobile: true, denseRatchet: true, maxOptionalSources: 1 });
assertFiniteBudget(mobileTightReznorBudget, 'mobile tight reznor hihat render budget');
assert.strictEqual(mobileTightReznorBudget.optionalSourceCount, 1, 'tight mobile reznor budget keeps exactly one optional character source');
assert(mobileTightReznorBudget.useOpenFlutter || mobileTightReznorBudget.useIdmSpark, 'tight mobile reznor keeps a character layer');
assert.strictEqual(mobileTightReznorBudget.useOpenShimmer, false, 'tight mobile reznor sheds open shimmer first');
assert.strictEqual(mobileTightReznorBudget.useOpenBody, false, 'tight mobile reznor sheds open body/bloom first');

assert(closedAphex.openFlutterGain <= 0.001, 'closed aphex hihat keeps IDM flutter/rattle effectively silent');
assert(tightAphex.openFlutterGain > closedAphex.openFlutterGain, 'tight aphex hihat introduces a bounded flutter/rattle layer');
assert(openAphex.openFlutterGain > tightAphex.openFlutterGain, 'open aphex hihat has stronger flutter/rattle than tight hihat');
assert(openAphex.openFlutterGain > openReznor.openFlutterGain, 'aphex open flutter/rattle is stronger than reznor');
assert(openReznor.openFlutterGain > 0.001, 'reznor open hihat gets a modest industrial flutter/rattle layer');
assert.strictEqual(open808.openFlutterGain, 0, '808 open hihat keeps classic-clean flutter/rattle disabled');
assert.strictEqual(open909Classic.openFlutterGain, 0, '909 open hihat keeps classic-clean flutter/rattle disabled');
assert(accentedOpenAphex.openFlutterGain > openAphex.openFlutterGain, 'accented open aphex hihat increases flutter/rattle intensity');
assert(accentedOpenAphex.openFlutterGain <= 0.045, 'accented open aphex flutter/rattle remains headroom-safe');
assert(accentedOpenAphex.openFlutterTailSec <= 0.16, 'accented open aphex flutter/rattle tail remains bounded/mobile-safe');

for (const engine of ['808', '909', 'reznor', 'aphex']) {
  const highClosed = resolveHihatVoiceSpec(engine, { ...baseParams, open: 0, decay: 0.40 }, () => 0.5);
  const expectedLegacyDecay = 0.40 * HIHAT_ENGINE_PROFILES[engine].decay;
  assert.strictEqual(highClosed.decaySec, expectedLegacyDecay, `${engine}: closed hihat preserves legacy decay parity without 0.15s cap`);
  assert(highClosed.decaySec > 0.15, `${engine}: high closed hihat decay is not artificially capped at 0.15s`);
  assertFiniteBounded(highClosed, `${engine} high closed decay`);
}

const hat808 = resolveHihatVoiceSpec('808', baseParams, () => 0.5);
const hat909 = resolveHihatVoiceSpec('909', baseParams, () => 0.5);
const reznor = resolveHihatVoiceSpec('reznor', baseParams, () => 0.5);
const aphex = resolveHihatVoiceSpec('aphex', baseParams, () => 0.5);
const fallback = resolveHihatVoiceSpec('unknown-engine', baseParams, () => 0.5);

assert.notDeepStrictEqual(hat808.ratios, hat909.ratios, '808 and 909 hihat ratios differ');
assert.notStrictEqual(hat808.highpassHz, hat909.highpassHz, '808 and 909 hihat tone differs');
assert.notStrictEqual(reznor.oscType, hat808.oscType, 'reznor uses non-808 oscillator character');
assert.notDeepStrictEqual(reznor.ratios, hat808.ratios, 'reznor uses non-808 ratios');
assert(aphex.glitchChance > 0, 'aphex has nonzero glitchChance');
assert.notDeepStrictEqual(aphex.ratios, hat808.ratios, 'aphex uses inharmonic/non-808 ratios');
assert(hat909.transientGain > hat808.transientGain, '909 closed hihat resolves with more transient punch than 808');
assert(hat909.airLowpassHz > hat808.airLowpassHz, '909 closed hihat resolves brighter than 808');
assert(reznor.airLowpassHz < hat909.airLowpassHz, 'reznor closed hihat resolves darker than 909');
assert(reznor.outputTrim < hat909.outputTrim, 'reznor closed hihat resolves with more headroom trim than 909');
assert(aphex.outputTrim < hat909.outputTrim, 'aphex closed hihat resolves with extra trim/headroom protection versus 909');
assert.strictEqual(hat808.glitchChance, 0, '808 has no glitch chance');
assert.strictEqual(hat909.glitchChance, 0, '909 has no glitch chance');
assert.strictEqual(fallback.engine, 'aphex', 'unknown engine safely falls back to aphex/default');
assert.strictEqual(fallback.fallbackEngine, true, 'fallback is documented in spec');

const deterministicA = resolveHihatVoiceSpec('aphex', baseParams, seqRand([0.1, 0.9, 0.2, 0.8]));
const deterministicB = resolveHihatVoiceSpec('aphex', baseParams, seqRand([0.1, 0.9, 0.2, 0.8]));
const deterministicC = resolveHihatVoiceSpec('aphex', baseParams, seqRand([0.9, 0.1, 0.8, 0.2]));
assert.deepStrictEqual(deterministicA, deterministicB, 'same inputs and same injected rand produce same spec');
assert.notDeepStrictEqual(deterministicA, deterministicC, 'injected rand affects unstable engines');

const broken = resolveHihatVoiceSpec('aphex', { freq: Infinity, decay: -1, open: 9, metal: NaN }, () => NaN);
assertFiniteBounded(broken, 'invalid input sanitized');

assert(html.indexOf('src/rhythm/hihat-voice.js') > -1, 'index.html loads hihat voice helper');
assert(html.indexOf('src/rhythm/hihat-voice.js') < html.indexOf('src/main.js'), 'hihat helper loads before main.js for GitHub Pages');
assert(/BighartBeatHihat/.test(main) && /resolveHihatVoiceSpec/.test(main), 'main.js wires synthHihat to pure resolver');
assert(/function\s+synthHihat\s*\(\s*t,\s*v,\s*p\s*\)\s*\{[\s\S]*resolveHihatVoiceSpec\(S\.engine,\s*p,\s*Math\.random,\s*v\)/.test(main), 'synthHihat passes current hihat velocity/accent into resolver');
assert(/const\s+hihatBudget\s*=\s*HihatVoice\.resolveHihatRenderBudget\(spec,\s*\{[\s\S]*mobile:/.test(main), 'synthHihat resolves a mobile-aware hihat render budget near the voice spec');
assert(/const\s+hatPolish\s*=\s*A\.createGain\(\)/.test(main), 'synthHihat adds a bounded post-choke polish gain');
assert(/hatPolish\.gain\.setValueAtTime\(spec\.outputTrim,\s*t\)/.test(main), 'hihat polish gain uses resolver outputTrim');
assert(/const\s+hatAir\s*=\s*A\.createBiquadFilter\(\)/.test(main) && /hatAir\.type\s*=\s*'lowpass'/.test(main), 'synthHihat adds a gentle post-choke air lowpass');
assert(/hatAir\.frequency\.value\s*=\s*spec\.airLowpassHz/.test(main), 'hihat air lowpass uses resolver frequency');
assert(/choke\.connect\(hatPolish\);\s*hatPolish\.connect\(hatAir\);\s*hatAir\.connect\(dest\);/.test(main), 'all hihat layers pass through choke, polish, and air filter before routeVoice destination');
assert(/choke\.gain\.setTargetAtTime\(\.0008,\s*t\s*\+\s*spec\.noiseTailSec,\s*spec\.tailReleaseTau\)/.test(main), 'hihat choke release uses resolver tailReleaseTau');
assert(/ng\.gain\.linearRampToValueAtTime\(clamp\(v \* spec\.noiseGain \* spec\.transientGain,\s*0,\s*\.72\),\s*t \+ spec\.attackSec\);\s*ng\.gain\.setTargetAtTime\(\.001,\s*t \+ spec\.noiseTailSec \* spec\.openTailDamp,\s*spec\.tailReleaseTau\)/.test(main), 'hihat noise tail uses resolver damping and release tau');
assert(/mg\.gain\.linearRampToValueAtTime\(clamp\(v \* spec\.metalGain \* spec\.tailHeadroomTrim,\s*0,\s*\.34\),\s*t \+ Math\.max\(\.0008,\s*spec\.attackSec \* \.8\)\)/.test(main), 'hihat metallic layer uses resolver tail headroom trim');
assert(/if \(hihatBudget\.useOpenShimmer && spec\.openShimmerGain > 0\.001\)/.test(main), 'synthHihat gates open-hat shimmer through render budget and resolver gain');
assert(/sf\.frequency\.value\s*=\s*spec\.openShimmerHz/.test(main), 'hihat shimmer filter uses resolver frequency');
assert(/sg\.gain\.linearRampToValueAtTime\(clamp\(v \* spec\.openShimmerGain \* openAccentBloomLift,\s*0,\s*\.085\),\s*t \+ spec\.attackSec\)/.test(main), 'hihat shimmer gain uses resolver gain, bounded accent bloom, and headroom cap');
assert(/shimmer\.connect\(sf\);\s*sf\.connect\(sg\);\s*sg\.connect\(choke\);/.test(main), 'open hihat shimmer routes through hihat choke');
assert(/if \(hihatBudget\.useOpenBody && spec\.openBodyGain > 0\.001\)/.test(main), 'synthHihat gates open-hat body/bloom through render budget and resolver gain');
assert(/bf\.frequency\.value\s*=\s*spec\.openBodyHz/.test(main), 'hihat body/bloom filter uses resolver frequency');
assert(/bg\.gain\.linearRampToValueAtTime\(clamp\(v \* spec\.openBodyGain \* openAccentBloomLift,\s*0,\s*\.11\),\s*t \+ spec\.attackSec\)/.test(main), 'hihat body/bloom gain uses resolver gain, bounded accent bloom, and headroom cap');
assert(/body\.connect\(bf\);\s*bf\.connect\(bg\);\s*bg\.connect\(choke\);/.test(main), 'open hihat body/bloom routes through hihat choke');
assert(/Math\.max\([\s\S]*hihatBudget\.useOpenFlutter\s*&&\s*spec\.openFlutterGain\s*>\s*0\.001\s*\?\s*spec\.openFlutterTailSec\s*\+\s*spec\.tailReleaseTau/.test(main), 'hihat tail budget includes open IDM flutter/rattle when budgeted and enabled');
assert(/if \(hihatBudget\.useOpenFlutter && spec\.openFlutterGain > 0\.001\)/.test(main), 'synthHihat gates open-hat IDM flutter/rattle through render budget and resolver gain');
assert(/flutterFilter\.frequency\.value\s*=\s*spec\.openFlutterHz/.test(main), 'hihat flutter/rattle filter uses resolver frequency');
assert(/flutterGain\.gain\.linearRampToValueAtTime\(clamp\(v \* spec\.openFlutterGain,\s*0,\s*\.045\),\s*t \+ Math\.min\(\.002,\s*spec\.attackSec\)\)/.test(main), 'hihat flutter/rattle gain uses resolver gain and headroom cap');
assert(/flutter\.connect\(flutterFilter\);\s*flutterFilter\.connect\(flutterGain\);\s*flutterGain\.connect\(choke\);/.test(main), 'open hihat flutter/rattle routes through hihat choke');
assert(/flutter\.stop\(t \+ spec\.openFlutterTailSec \+ spec\.tailReleaseTau\)/.test(main), 'open hihat flutter/rattle stops safely after its bounded tail');
assert(/if \(hihatBudget\.useIdmSpark && spec\.idmSparkGain > 0\.001\)/.test(main), 'synthHihat gates IDM spark through render budget and resolver gain');
assert(/if \(hihatBudget\.useGlitch && spec\.glitchWillFire\)/.test(main), 'synthHihat gates optional glitch tick through render budget and resolver decision');

console.log('Issue 003 hihat voice resolver checks passed.');
