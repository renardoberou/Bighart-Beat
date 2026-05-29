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
assert.strictEqual(synthVoice.SYNTH_MAX_FREQUENCY_HZ, 500, 'synth voice exposes the shared 500 Hz output frequency cap');
assert.strictEqual(synthVoice.SYNTH_ROOT_MAX_HZ, 125, 'synth voice exposes the shared 125 Hz root cap');

function assertFiniteBounded(spec, label) {
  assert(spec && typeof spec === 'object', `${label}: spec object returned`);
  [
    'pitchHz', 'decaySec', 'attackSec', 'releaseTau', 'filterHz', 'filterTriggerHz', 'filterRestHz',
    'filterEnvAmount', 'filterEndRatio', 'filterAttackSec', 'filterDecaySec', 'filterQ', 'driveAmount',
    'bodyGain', 'subGain', 'noiseGain', 'glideSec', 'stopSec', 'chokeTau', 'shape', 'tone',
    'modRatio', 'modIndex', 'detuneCents'
  ].forEach(k => assert(Number.isFinite(spec[k]), `${label}: ${k} is finite`));
  assert(spec.pitchHz >= 40 && spec.pitchHz <= 500, `${label}: pitchHz bounded to synth hotfix ceiling`);
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
  assert(spec.filterDecaySec > spec.filterAttackSec, `${label}: filterDecaySec closes after filter attack`);
  assert(spec.filterDecaySec <= spec.decaySec, `${label}: filterDecaySec closes no later than voice decay`);
  assert(spec.filterQ >= 0.2 && spec.filterQ <= (spec.personality === 'acid-bass' ? 28 : 18), `${label}: filterQ bounded`);
  assert(spec.driveAmount >= 0 && spec.driveAmount <= 0.75, `${label}: driveAmount bounded`);
  assert(spec.bodyGain >= 0 && spec.bodyGain <= 0.7, `${label}: bodyGain bounded`);
  assert(spec.subGain >= 0 && spec.subGain <= 0.35, `${label}: subGain bounded`);
  assert(spec.noiseGain >= 0 && spec.noiseGain <= (spec.personality === 'industrial-mono' ? 0.20 : 0.16), `${label}: noiseGain bounded`);
  assert(spec.stopSec > spec.decaySec, `${label}: stopSec leaves release padding`);
  assert(['sine', 'triangle', 'sawtooth', 'square'].includes(spec.oscType), `${label}: oscillator type safe`);
  assert(['lowpass', 'bandpass'].includes(spec.filterType), `${label}: filter type safe`);
  assert(['analog-sub-body', 'acid-bass', 'industrial-mono', 'idm-digital-alien'].includes(spec.personality), `${label}: personality known`);
  assert(spec.modRatio >= 0.5 && spec.modRatio <= 8, `${label}: FM/digital mod ratio bounded`);
  assert(spec.modIndex >= 0 && spec.modIndex <= 260, `${label}: FM/digital mod index bounded`);
  assert(spec.detuneCents >= -24 && spec.detuneCents <= 30, `${label}: digital detune bounded`);
}

for (const engine of ['808', '909', 'reznor', 'aphex', 'unknown']) {
  assertFiniteBounded(resolveSynthVoiceSpec(engine, { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 }), engine);
}

const body808 = resolveSynthVoiceSpec('808', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const acid909 = resolveSynthVoiceSpec('909', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const industrial = resolveSynthVoiceSpec('reznor', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const aphexIdm = resolveSynthVoiceSpec('aphex', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
const fallback = resolveSynthVoiceSpec('mystery', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });

assert.strictEqual(body808.personality, 'analog-sub-body', '808 maps to a distinct analog body/sub personality');
assert.notStrictEqual(body808.personality, 'mono-fm-glass', '808 is no longer the glassy FM personality');
assert.notStrictEqual(body808.personality, 'ms20-bass', '808 is no longer the MS-20 retune');
assert.strictEqual(body808.oscType, 'triangle', '808 uses a fuller analog body oscillator instead of a glass-FM sine lane');
assert.strictEqual(body808.filterType, 'lowpass', '808 keeps mobile-safe lowpass body shaping');
assert(body808.bodyGain > aphexIdm.bodyGain, '808 carries more bass body than aphex IDM voice');
assert(body808.subGain > aphexIdm.subGain * 3, '808 carries substantially more sub support than aphex IDM voice');
assert(body808.modIndex === 0, '808 body voice has no FM modulation overlap with aphex');
assert(body808.modIndex < aphexIdm.modIndex, '808 has substantially lower FM motion than aphex digital voice');
assert(body808.driveAmount < acid909.driveAmount && body808.driveAmount < industrial.driveAmount, '808 body voice has less drive than 909/Reznor voices');
assert(body808.filterQ < acid909.filterQ && body808.filterQ < industrial.filterQ, '808 body voice has less resonance than 909/Reznor voices');
assert(body808.filterEnvAmount >= 0.35 && body808.filterEnvAmount < 0.8, '808 has a restrained analog body filter envelope');
assert(body808.filterEndRatio >= 0.35, '808 rests at a warmer lowpass cutoff for body instead of a glassy snap-down');
assert(body808.filterTriggerHz < aphexIdm.filterTriggerHz, '808 body lowpass opens below aphex glass/digital color');
assert(body808.attackSec >= 0.007, '808 attack is softer/slower than the sharper 909 acid voice');
assert(body808.attackSec > acid909.attackSec, '808 synth attack is softer/slower than the sharper 909 acid voice');
assert.strictEqual(acid909.personality, 'acid-bass', '909 maps to acid bass personality');
assert.strictEqual(acid909.oscType, 'sawtooth', '909 acid voice keeps the 303-style sawtooth source');
assert.strictEqual(acid909.filterType, 'lowpass', '909 acid voice keeps the 303-style lowpass filter');
assert(acid909.driveAmount >= 0.68, '909 acid voice has even more aggressive drive bite');
assert(acid909.filterQ >= 16.0, '909 acid voice has very aggressive 303-style squelchy resonance');
assert(acid909.filterEnvAmount >= 3.0, '909 acid voice has a hard throaty trigger filter sweep');
assert(acid909.filterEndRatio <= 0.20, '909 acid voice snaps back to a low cutoff for acid pluck');
assert(acid909.filterTriggerHz > acid909.filterRestHz * 20, '909 acid sweep opens dramatically from rest cutoff');
assert(acid909.glideSec >= 0.050, '909 acid voice has audible 303-style glide');
assert(acid909.filterQ > body808.filterQ, '909 acid voice has sharper squelchy resonance than 808');
assert(acid909.noiseGain >= 0.020, '909 acid voice has added gritty noise texture');
assert.strictEqual(industrial.personality, 'industrial-mono', 'reznor maps to industrial mono personality');
assert.strictEqual(industrial.filterType, 'bandpass', 'reznor uses a bandpass filter for wah-like focus');
assert(industrial.driveAmount >= 0.70, 'reznor has a distorted industrial drive level');
assert(industrial.filterEnvAmount >= 2.0, 'reznor gets a pronounced wah-like trigger filter envelope');
assert(industrial.filterTriggerHz > industrial.filterRestHz * 10, 'reznor wah sweep opens far above rest cutoff');
assert(industrial.filterQ < acid909.filterQ, 'reznor remains distinct from the 909 acid resonance peak');
assert.strictEqual(aphexIdm.personality, 'idm-digital-alien', 'aphex maps to an original digital/IDM alien personality');
assert.strictEqual(aphexIdm.oscType, 'sine', 'aphex uses a clean sine carrier for glassy digital FM motion');
assert.strictEqual(aphexIdm.filterType, 'bandpass', 'aphex uses focused bandpass color distinct from 808/909 lowpass voices');
assert(aphexIdm.modIndex > 45, 'aphex has audible bounded FM/digital motion instead of the old non-FM SH voice');
assert(aphexIdm.modIndex > body808.modIndex, 'aphex keeps the digital/FM lane while 808 stays analog/body');
assert(aphexIdm.modRatio > 2.5 && aphexIdm.modRatio < 6.5, 'aphex uses inharmonic IDM-style FM ratios within safe bounds');
assert(aphexIdm.detuneCents !== 0, 'aphex center shape keeps a small alien detune offset');
assert(aphexIdm.noiseGain >= 0.030, 'aphex adds a bounded digital dust/noise layer');
assert(aphexIdm.noiseGain < industrial.noiseGain, 'aphex digital dust remains below Reznor industrial noise');
assert(aphexIdm.driveAmount < acid909.driveAmount && aphexIdm.driveAmount < industrial.driveAmount, 'aphex is digital/glassy rather than acid/industrial driven');
assert(body808.detuneCents !== 0 || body808.shape === 0.5, '808 at non-center shape gets analog detune drift');
assert(acid909.detuneCents !== 0 || acid909.shape === 0.5, '909 at non-center shape gets acid detune');
assert(industrial.detuneCents !== 0 || industrial.shape === 0.5, 'reznor at non-center shape gets industrial detune');
const body808Sharp = resolveSynthVoiceSpec('808', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.9 });
const acid909Sharp = resolveSynthVoiceSpec('909', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.9 });
const industrialSharp = resolveSynthVoiceSpec('reznor', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.9 });
assert(body808Sharp.detuneCents !== 0, '808 at sharp shape gets analog detune drift');
assert(body808Sharp.detuneCents === 9, '808 sharp shape gets +9 cents warm drift');
assert(acid909Sharp.detuneCents !== 0, '909 at sharp shape gets acid detune');
assert(acid909Sharp.detuneCents === 10, '909 sharp shape gets +10 cents acid detune');
assert(industrialSharp.detuneCents !== 0, 'reznor at sharp shape gets industrial detune');
assert(industrialSharp.detuneCents === 22, 'reznor sharp shape gets +22 cents industrial detune');
assert(body808Sharp.detuneCents >= -10 && body808Sharp.detuneCents <= 15, '808 detune stays within analog drift bounds');
assert(acid909Sharp.detuneCents >= -18 && acid909Sharp.detuneCents <= 15, '909 detune stays within acid bounds');
assert(industrialSharp.detuneCents >= -20 && industrialSharp.detuneCents <= 30, 'reznor detune stays within industrial bounds');
assert(aphexIdm.filterQ >= 5.0, 'aphex keeps a narrow glass/resonant focus');
assert.notStrictEqual(aphexIdm.oscType, acid909.oscType, 'aphex oscillator differs from 909 acid');
assert.notStrictEqual(aphexIdm.oscType, industrial.oscType, 'aphex oscillator differs from Reznor industrial square');
assert.strictEqual(fallback.engine, 'aphex', 'unknown engine safely falls back to aphex');
assert.strictEqual(fallback.fallbackEngine, true, 'fallback is documented in spec');
assert.strictEqual(fallback.personality, 'idm-digital-alien', 'fallback uses the bounded aphex digital/IDM voice');
assert(fallback.modIndex > 0, 'fallback aphex voice keeps finite digital FM motion');
assert.notStrictEqual(body808.pitchHz, acid909.pitchHz, '808 and 909 synth pitch/body character differs');
assert.notStrictEqual(body808.filterType, industrial.filterType, '808 remains distinct from reznor bandpass industrial voice');
assert(body808.modIndex < aphexIdm.modIndex, '808 body voice does not compete with aphex IDM shimmer');
assert(aphexIdm.filterHz !== acid909.filterHz, 'aphex digital tone differs from 909 acid');
assert(acid909.filterDecaySec < body808.filterDecaySec, '909 acid filter closes faster than sustained 808 body lowpass motion');
assert(acid909.filterDecaySec < aphexIdm.filterDecaySec, '909 acid filter closes faster than sustained aphex IDM color');
assert(industrial.filterDecaySec < body808.filterDecaySec, 'reznor industrial filter closes faster than sustained 808 body lowpass motion');
assert(industrial.filterDecaySec < aphexIdm.filterDecaySec, 'reznor industrial filter closes faster than sustained aphex IDM color');

const aphexInvalid = resolveSynthVoiceSpec('aphex', { pitch: NaN, decay: -Infinity, tone: Infinity, shape: -99 });
assertFiniteBounded(aphexInvalid, 'invalid aphex input sanitized');
assert.strictEqual(aphexInvalid.personality, 'idm-digital-alien', 'invalid aphex inputs keep aphex digital personality');
assert(Number.isFinite(aphexInvalid.modIndex) && aphexInvalid.modIndex > 0, 'invalid aphex inputs keep finite positive digital FM');

const low = resolveSynthVoiceSpec('909', { pitch: 20, decay: -1, tone: -2, shape: -3 });
const high = resolveSynthVoiceSpec('909', { pitch: Infinity, decay: 99, tone: 99, shape: 99 });
assertFiniteBounded(low, 'invalid low input sanitized');
assertFiniteBounded(high, 'invalid high input sanitized');
assert.strictEqual(resolveSynthVoiceSpec('aphex', { pitch: 900, decay: 0.35, tone: 0.5, shape: 0.5 }).pitchHz, 500, 'resolver clamps over-limit synth pitch to 500 Hz after engine scaling');
assert(low.filterHz < high.filterHz, 'tone control opens filter frequency');
assert(low.filterQ < high.filterQ, 'shape control increases acid/resonant shape');

assert(html.indexOf('src/rhythm/synth-voice.js') > -1, 'index.html loads synth voice helper');
assert(html.indexOf('src/rhythm/synth-voice.js') < html.indexOf('src/main.js'), 'synth helper loads before main.js');
assert(/BighartBeatSynth/.test(main) && /resolveSynthVoiceSpec/.test(main), 'main.js wires synth voice to pure resolver');
assert(/filter\.frequency\.setValueAtTime\(spec\.filterRestHz, t\)/.test(main), 'main.js starts synth filter at explicit trigger-envelope rest cutoff');
assert(/filter\.frequency\.exponentialRampToValueAtTime\(Math\.max\(80, spec\.filterTriggerHz\), t \+ spec\.filterAttackSec\)/.test(main), 'main.js opens synth filter with explicit trigger cutoff and snap time');
assert(/filter\.frequency\.exponentialRampToValueAtTime\(Math\.max\(80, spec\.filterRestHz\), t \+ spec\.filterDecaySec\)/.test(main), 'main.js decays synth filter envelope back to rest cutoff using explicit filter decay articulation');
assert(/const\s+SYNTH_ROOT_MAX_HZ\s*=\s*State\.SYNTH_ROOT_MAX_HZ\s*\|\|\s*SynthVoice\.SYNTH_ROOT_MAX_HZ\s*\|\|\s*125/.test(main), 'main.js uses the shared synth root cap constant from state/synth voice');

console.log('Issue 010 synth voice resolver checks passed.');
