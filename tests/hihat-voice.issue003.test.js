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
  ['noiseGain', 'metalGain', 'highpassHz', 'bandpassHz', 'bandpassQ', 'decaySec', 'glitchChance', 'chokeClosedTau', 'chokeOpenTau', 'noiseLevel', 'metalLevel'].forEach(k => {
    assert(Number.isFinite(spec[k]), `${label}: ${k} is finite`);
  });
  assert(spec.noiseGain >= 0 && spec.noiseGain <= 0.72, `${label}: noise gain normalized <= 0.72`);
  assert(spec.metalGain >= 0 && spec.metalGain <= 0.34, `${label}: metal gain normalized <= 0.34`);
  assert(spec.highpassHz >= 2500 && spec.highpassHz <= 17000, `${label}: highpassHz bounded`);
  assert(spec.bandpassHz >= 4500 && spec.bandpassHz <= 18000, `${label}: bandpassHz bounded`);
  assert(spec.bandpassQ >= 0.5 && spec.bandpassQ <= 2.5, `${label}: bandpassQ bounded`);
  assert(spec.decaySec >= 0.006 && spec.decaySec <= 0.70, `${label}: decaySec bounded`);
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

const closed = resolveHihatVoiceSpec('909', { ...baseParams, open: 0, decay: 0.04 }, () => 0.5);
const open = resolveHihatVoiceSpec('909', { ...baseParams, open: 1, decay: 0.04 }, () => 0.5);
assert(closed.decaySec >= 0.006 && closed.decaySec <= 0.15, 'closed hihat decay is short and bounded');
assert(open.decaySec > closed.decaySec, 'open hihat decay is longer than closed');
assert(open.decaySec <= 0.70, 'open hihat decay has safe upper bound');

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

console.log('Issue 003 hihat voice resolver checks passed.');
