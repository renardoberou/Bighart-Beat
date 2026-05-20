#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const hihatVoice = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const { resolveHihatVoiceSpec, HIHAT_ENGINE_PROFILES } = hihatVoice;

assert.strictEqual(typeof resolveHihatVoiceSpec, 'function', 'resolveHihatVoiceSpec is exported');
assert(HIHAT_ENGINE_PROFILES && HIHAT_ENGINE_PROFILES.aphex, 'engine hihat profiles are exported');

const baseParams = { freq: 9000, decay: 0.04, open: 0, metal: 0.7 };

function seqRand(values) {
  let i = 0;
  return () => values[i++ % values.length];
}

function assertFiniteBounded(spec, label) {
  assert(spec && typeof spec === 'object', `${label}: spec object returned`);
  ['noiseGain', 'metalGain', 'highpassHz', 'bandpassHz', 'bandpassQ', 'decaySec', 'attackSec', 'noiseTailSec', 'metalTailSec', 'transientGain', 'outputTrim', 'airLowpassHz', 'airLowpassQ', 'glitchChance', 'chokeClosedTau', 'chokeOpenTau', 'noiseLevel', 'metalLevel'].forEach(k => {
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
  assert(spec.transientGain >= 0.8 && spec.transientGain <= 1.18, `${label}: transientGain bounded`);
  assert(spec.outputTrim >= 0.62 && spec.outputTrim <= 1, `${label}: output trim is bounded for hihat headroom`);
  assert(spec.airLowpassHz >= 8500 && spec.airLowpassHz <= 18000, `${label}: air lowpass is bright but bounded`);
  assert(spec.airLowpassQ >= 0.2 && spec.airLowpassQ <= 0.9, `${label}: air lowpass Q is gentle and mobile-safe`);
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
assert(open.transientGain < closed.transientGain, 'open hihat trims transient gain to leave headroom for longer tail');
assert(tight.outputTrim < closed.outputTrim, 'tight hihat trims post-choke output more than closed for tail headroom');
assert(open.outputTrim < tight.outputTrim, 'open hihat has the strongest post-choke trim for long-tail headroom');
assert(open.airLowpassHz < closed.airLowpassHz, 'open hihat gently darkens the longest tail to avoid harsh buildup');

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
assert(/const\s+hatPolish\s*=\s*A\.createGain\(\)/.test(main), 'synthHihat adds a bounded post-choke polish gain');
assert(/hatPolish\.gain\.setValueAtTime\(spec\.outputTrim,\s*t\)/.test(main), 'hihat polish gain uses resolver outputTrim');
assert(/const\s+hatAir\s*=\s*A\.createBiquadFilter\(\)/.test(main) && /hatAir\.type\s*=\s*'lowpass'/.test(main), 'synthHihat adds a gentle post-choke air lowpass');
assert(/hatAir\.frequency\.value\s*=\s*spec\.airLowpassHz/.test(main), 'hihat air lowpass uses resolver frequency');
assert(/choke\.connect\(hatPolish\);\s*hatPolish\.connect\(hatAir\);\s*hatAir\.connect\(dest\);/.test(main), 'all hihat layers pass through choke, polish, and air filter before routeVoice destination');

console.log('Issue 003 hihat voice resolver checks passed.');
