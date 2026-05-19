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

const ms20808 = resolveSynthVoiceSpec('808', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const acid909 = resolveSynthVoiceSpec('909', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const industrial = resolveSynthVoiceSpec('reznor', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const vintage = resolveSynthVoiceSpec('aphex', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const fallback = resolveSynthVoiceSpec('mystery', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });

assert.strictEqual(ms20808.personality, 'ms20-bass', '808 maps to gritty MS-20-inspired bass personality');
assert(['sawtooth', 'square'].includes(ms20808.oscType), '808 uses a buzzy oscillator character');
assert.notStrictEqual(ms20808.oscType, 'sine', '808 is no longer the glassy sine default');
assert.strictEqual(ms20808.filterType, 'lowpass', '808 uses resonant lowpass shaping');
assert(ms20808.driveAmount >= 0.45, '808 has strong drive/saturation for gritty bass lead');
assert(ms20808.filterQ >= 9.0, '808 has a meaningfully resonant filter');
assert(ms20808.filterEnvAmount >= 1.5, '808 has a trigger-routed resonant filter envelope');
assert(ms20808.filterEndRatio <= 0.38, '808 trigger filter envelope decays back down after each hit');
assert(ms20808.filterTriggerHz > ms20808.filterRestHz * 2.5, '808 trigger opens the filter well above rest cutoff');
assert(ms20808.attackSec >= 0.0045, '808 attack reflects requested 0.005 softened onset');
assert(ms20808.attackSec <= 0.0065, '808 attack is less pronounced than the old slower 0.010 setting');
assert(ms20808.attackSec < 0.008, '808 synth attack is faster/less pronounced than before');
assert(ms20808.attackSec > acid909.attackSec, '808 synth attack is softer/slower than the sharper 909 acid voice');
assert.strictEqual(ms20808.modIndex, 0, '808 avoids the old high glass-FM modulation');
assert(ms20808.bodyGain > vintage.bodyGain, '808 carries more bass body than aphex fallback voice');
assert(ms20808.subGain > acid909.subGain, '808 carries stronger sub support than 909 acid voice');
assert.strictEqual(acid909.personality, 'acid-bass', '909 maps to acid bass personality');
assert.strictEqual(acid909.oscType, 'sawtooth', '909 acid voice keeps the 303-style sawtooth source');
assert.strictEqual(acid909.filterType, 'lowpass', '909 acid voice keeps the 303-style lowpass filter');
assert(acid909.driveAmount >= 0.60, '909 acid voice has very aggressive drive bite');
assert(acid909.filterQ >= 13.0, '909 acid voice has very aggressive 303-style squelchy resonance');
assert(acid909.filterEnvAmount >= 2.5, '909 acid voice has a hard trigger filter envelope sweep');
assert(acid909.filterEndRatio <= 0.24, '909 acid voice snaps back to a low cutoff for acid pluck');
assert(acid909.filterTriggerHz > acid909.filterRestHz * 10, '909 acid sweep opens dramatically from rest cutoff');
assert(acid909.glideSec >= 0.040, '909 acid voice has audible 303-style glide');
assert(acid909.filterQ > ms20808.filterQ, '909 acid voice has sharper squelchy resonance than 808');
assert(acid909.noiseGain > 0.010, '909 acid voice has a touch more edge/noise texture');
assert.strictEqual(industrial.personality, 'industrial-mono', 'reznor maps to industrial mono personality');
assert.strictEqual(vintage.personality, 'mono-fm-glass', 'aphex maps to glassy IDM FM personality');
assert(vintage.modIndex >= 120, 'aphex has audible FM index for glassy digital tone');
assert(vintage.modIndex <= 260, 'aphex FM index remains bounded for mobile-safe synthesis');
assert(vintage.modRatio >= 3 && vintage.modRatio <= 5, 'aphex FM ratio stays in a musical inharmonic range');
assert(vintage.filterEnvAmount >= 1.0, 'aphex gets a clear trigger filter sweep for IDM plucks');
assert(vintage.filterQ >= 4.0, 'aphex has more resonant glass than the old mild vintage voice');
assert(vintage.filterTriggerHz > vintage.filterRestHz * 3, 'aphex trigger opens far above rest cutoff for metallic motion');
assert.strictEqual(fallback.engine, 'aphex', 'unknown engine safely falls back to aphex');
assert.strictEqual(fallback.fallbackEngine, true, 'fallback is documented in spec');
assert.notStrictEqual(ms20808.pitchHz, acid909.pitchHz, '808 and 909 synth pitch/body character differs');
assert.notStrictEqual(ms20808.filterType, industrial.filterType, '808 remains distinct from reznor bandpass industrial voice');
assert(ms20808.driveAmount > vintage.driveAmount, '808 stays grittier than aphex glass voice');
assert(vintage.modIndex > acid909.modIndex, 'aphex FM motion is more digital than 909 acid');
assert(vintage.filterHz !== acid909.filterHz, 'aphex glass tone differs from 909 acid');

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
