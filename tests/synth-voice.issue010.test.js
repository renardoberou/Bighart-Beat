#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const synthVoice = require(path.join(root, 'src', 'rhythm', 'synth-voice.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const { resolveSynthVoiceSpec, SYNTH_ENGINE_PROFILES } = synthVoice;

assert.strictEqual(typeof resolveSynthVoiceSpec, 'function', 'resolveSynthVoiceSpec is exported');
assert(SYNTH_ENGINE_PROFILES && SYNTH_ENGINE_PROFILES['808'] && SYNTH_ENGINE_PROFILES.aphex, 'synth engine profiles are exported');

function assertFiniteBounded(spec, label) {
  assert(spec && typeof spec === 'object', `${label}: spec object returned`);
  [
    'pitchHz', 'decaySec', 'attackSec', 'releaseTau', 'filterHz', 'filterTriggerHz', 'filterRestHz',
    'filterEnvAmount', 'filterEndRatio', 'filterAttackSec', 'filterQ', 'driveAmount',
    'bodyGain', 'subGain', 'noiseGain', 'glideSec', 'stopSec', 'chokeTau', 'shape', 'tone'
  ].forEach(k => assert(Number.isFinite(spec[k]), `${label}: ${k} is finite`));
  assert(spec.pitchHz >= 40 && spec.pitchHz <= 1600, `${label}: pitchHz bounded`);
  assert(spec.decaySec >= 0.04 && spec.decaySec <= 2.5, `${label}: decaySec bounded`);
  assert(spec.attackSec >= 0.001 && spec.attackSec <= 0.03, `${label}: attackSec bounded`);
  assert(spec.releaseTau >= 0.003 && spec.releaseTau <= 0.20, `${label}: releaseTau bounded`);
  assert(spec.filterHz >= 120 && spec.filterHz <= 12000, `${label}: filterHz bounded`);
  assert(spec.filterTriggerHz >= 120 && spec.filterTriggerHz <= 12000, `${label}: filterTriggerHz bounded`);
  assert(spec.filterRestHz >= 80 && spec.filterRestHz <= 12000, `${label}: filterRestHz bounded`);
  assert(spec.filterTriggerHz > spec.filterRestHz, `${label}: trigger filter opens above rest cutoff`);
  assert(spec.filterEnvAmount >= 0 && spec.filterEnvAmount <= 4.5, `${label}: filterEnvAmount bounded`);
  assert(spec.filterEndRatio >= 0.12 && spec.filterEndRatio <= 0.62, `${label}: filterEndRatio bounded`);
  assert(spec.filterAttackSec >= 0.0005 && spec.filterAttackSec <= 0.012, `${label}: filterAttackSec bounded`);
  assert(spec.filterQ >= 0.2 && spec.filterQ <= 18, `${label}: filterQ bounded`);
  assert(spec.driveAmount >= 0 && spec.driveAmount <= 0.75, `${label}: driveAmount bounded`);
  assert(spec.bodyGain >= 0 && spec.bodyGain <= 0.7, `${label}: bodyGain bounded`);
  assert(spec.subGain >= 0 && spec.subGain <= 0.35, `${label}: subGain bounded`);
  assert(spec.noiseGain >= 0 && spec.noiseGain <= 0.16, `${label}: noiseGain bounded`);
  assert(spec.stopSec > spec.decaySec, `${label}: stopSec leaves release padding`);
  assert(['sine', 'triangle', 'sawtooth', 'square'].includes(spec.oscType), `${label}: oscillator type safe`);
  assert(['lowpass', 'bandpass'].includes(spec.filterType), `${label}: filter type safe`);
  assert(['ms20-bass', 'mono-fm-glass', 'acid-bass', 'industrial-mono', 'vintage-sh'].includes(spec.personality), `${label}: personality known`);
}

for (const engine of ['808', '909', 'reznor', 'aphex', 'unknown']) {
  assertFiniteBounded(resolveSynthVoiceSpec(engine, { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 }), engine);
}

const glass808 = resolveSynthVoiceSpec('808', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const acid909 = resolveSynthVoiceSpec('909', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const industrial = resolveSynthVoiceSpec('reznor', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const vintage = resolveSynthVoiceSpec('aphex', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const fallback = resolveSynthVoiceSpec('mystery', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });

assert.strictEqual(glass808.personality, 'mono-fm-glass', '808 restores the earlier glassy FM personality');
assert.strictEqual(glass808.oscType, 'sine', '808 restores the sine carrier for FM/glass tone');
assert.notStrictEqual(glass808.personality, 'ms20-bass', '808 is no longer the MS-20 retune');
assert.strictEqual(glass808.filterType, 'lowpass', '808 keeps mobile-safe lowpass shaping');
assert(glass808.driveAmount < 0.25, '808 FM/glass voice is not a heavily driven bass lead');
assert(glass808.filterQ < 4.0, '808 FM/glass voice keeps resonance moderate');
assert(glass808.filterEnvAmount >= 0.65 && glass808.filterEnvAmount < 1.0, '808 has a restrained plucky filter envelope');
assert(glass808.filterEndRatio <= 0.42, '808 trigger filter envelope decays back down after each hit');
assert(glass808.filterTriggerHz > glass808.filterRestHz * 4, '808 trigger opens the filter for glassy pluck motion');
assert(glass808.attackSec >= 0.005 && glass808.attackSec <= 0.007, '808 attack restores the earlier FM onset');
assert(glass808.attackSec > acid909.attackSec, '808 synth attack is softer/slower than the sharper 909 acid voice');
assert(glass808.modIndex > 100, '808 restores audible glass-FM modulation');
assert(glass808.modIndex <= 260, '808 FM index remains bounded for mobile-safe synthesis');
assert(glass808.bodyGain > vintage.bodyGain, '808 carries more bass body than aphex SH voice');
assert.strictEqual(acid909.personality, 'acid-bass', '909 maps to acid bass personality');
assert.strictEqual(acid909.oscType, 'sawtooth', '909 acid voice keeps the 303-style sawtooth source');
assert.strictEqual(acid909.filterType, 'lowpass', '909 acid voice keeps the 303-style lowpass filter');
assert(acid909.driveAmount >= 0.68, '909 acid voice has even more aggressive drive bite');
assert(acid909.filterQ >= 16.0, '909 acid voice has very aggressive 303-style squelchy resonance');
assert(acid909.filterEnvAmount >= 3.0, '909 acid voice has a hard throaty trigger filter sweep');
assert(acid909.filterEndRatio <= 0.20, '909 acid voice snaps back to a low cutoff for acid pluck');
assert(acid909.filterTriggerHz > acid909.filterRestHz * 20, '909 acid sweep opens dramatically from rest cutoff');
assert(acid909.glideSec >= 0.050, '909 acid voice has audible 303-style glide');
assert(acid909.filterQ > glass808.filterQ, '909 acid voice has sharper squelchy resonance than 808');
assert(acid909.noiseGain >= 0.020, '909 acid voice has added gritty noise texture');
assert.strictEqual(industrial.personality, 'industrial-mono', 'reznor maps to industrial mono personality');
assert.strictEqual(industrial.filterType, 'bandpass', 'reznor uses a bandpass filter for wah-like focus');
assert(industrial.driveAmount >= 0.70, 'reznor has a distorted industrial drive level');
assert(industrial.filterEnvAmount >= 2.0, 'reznor gets a pronounced wah-like trigger filter envelope');
assert(industrial.filterTriggerHz > industrial.filterRestHz * 10, 'reznor wah sweep opens far above rest cutoff');
assert(industrial.filterQ < acid909.filterQ, 'reznor remains distinct from the 909 acid resonance peak');
assert.strictEqual(vintage.personality, 'vintage-sh', 'aphex maps back to SH-01/vintage-SH personality');
assert.strictEqual(vintage.oscType, 'triangle', 'aphex uses an SH-ish triangle oscillator');
assert.strictEqual(vintage.modIndex, 0, 'aphex is no longer the FM glass voice');
assert(vintage.detuneCents === 0, 'aphex vintage detune is neutral at center shape');
assert(vintage.filterEnvAmount >= 0.6 && vintage.filterEnvAmount < 1.0, 'aphex gets a mild vintage trigger filter sweep');
assert(vintage.filterQ >= 4.0, 'aphex vintage voice has SH-style resonant lowpass character');
assert(vintage.filterTriggerHz > vintage.filterRestHz * 3, 'aphex trigger opens above rest cutoff for analog motion');
assert.strictEqual(fallback.engine, 'aphex', 'unknown engine safely falls back to aphex');
assert.strictEqual(fallback.fallbackEngine, true, 'fallback is documented in spec');
assert.strictEqual(fallback.personality, 'vintage-sh', 'fallback uses the restored aphex vintage-SH voice');
assert.strictEqual(fallback.modIndex, 0, 'fallback aphex voice stays non-FM');
assert.notStrictEqual(glass808.pitchHz, acid909.pitchHz, '808 and 909 synth pitch/body character differs');
assert.notStrictEqual(glass808.filterType, industrial.filterType, '808 remains distinct from reznor bandpass industrial voice');
assert(glass808.modIndex > vintage.modIndex, '808 FM motion is more digital than aphex SH voice');
assert(vintage.filterHz !== acid909.filterHz, 'aphex vintage-SH tone differs from 909 acid');

const low = resolveSynthVoiceSpec('909', { pitch: 20, decay: -1, tone: -2, shape: -3 });
const high = resolveSynthVoiceSpec('909', { pitch: Infinity, decay: 99, tone: 99, shape: 99 });
assertFiniteBounded(low, 'invalid low input sanitized');
assertFiniteBounded(high, 'invalid high input sanitized');
assert(low.filterHz < high.filterHz, 'tone control opens filter frequency');
assert(low.filterQ < high.filterQ, 'shape control increases acid/resonant shape');

assert(html.indexOf('src/rhythm/synth-voice.js') > -1, 'index.html loads synth voice helper');
assert(html.indexOf('src/rhythm/synth-voice.js') < html.indexOf('src/main.js'), 'synth helper loads before main.js');
assert(/BighartBeatSynth/.test(main) && /resolveSynthVoiceSpec/.test(main), 'main.js wires synth voice to pure resolver');
assert(/filter\.frequency\.setValueAtTime\(spec\.filterRestHz, t\)/.test(main), 'main.js starts synth filter at explicit trigger-envelope rest cutoff');
assert(/filter\.frequency\.exponentialRampToValueAtTime\(Math\.max\(80, spec\.filterTriggerHz\), t \+ spec\.filterAttackSec\)/.test(main), 'main.js opens synth filter with explicit trigger cutoff and snap time');
assert(/filter\.frequency\.exponentialRampToValueAtTime\(Math\.max\(80, spec\.filterRestHz\), t \+ spec\.decaySec\)/.test(main), 'main.js decays synth filter envelope back to rest cutoff per trigger');

console.log('Issue 010 synth voice resolver checks passed.');
