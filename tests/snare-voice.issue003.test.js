#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const snareVoicePath = path.join(root, 'src', 'rhythm', 'snare-voice.js');
assert(fs.existsSync(snareVoicePath), 'snare voice resolver module exists');

const { resolveSnareVoiceSpec } = require(snareVoicePath);
assert.strictEqual(typeof resolveSnareVoiceSpec, 'function', 'resolveSnareVoiceSpec is exported');

const baseParams = {
  tone: 180,
  body: 0.72,
  snap: 0.82,
  decay: 0.22,
};

function assertFiniteBounded(spec, label) {
  assert(spec && typeof spec === 'object', `${label}: spec object returned`);
  assert(['808', '909', 'reznor', 'aphex'].includes(spec.engine), `${label}: safe engine id`);
  [
    'noiseBandpassHz',
    'noiseHighpassHz',
    'noisePeakGain',
    'noiseDecaySec',
    'shellFundHz',
    'shellOvertoneHz',
    'shellPeakGain',
    'shellDecaySec',
    'crackHighpassHz',
    'crackPeakGain',
    'crackDecaySec',
    'noiseStopSec',
    'shellStopSec',
    'crackStopSec',
    'digitalCrackGain',
    'digitalCrackHz',
  ].forEach(key => {
    assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`);
    assert(spec[key] >= 0, `${label}: ${key} is non-negative`);
  });
  assert(spec.noiseBandpassHz >= 900 && spec.noiseBandpassHz <= 6500, `${label}: noise bandpass bounded`);
  assert(spec.noiseHighpassHz >= 300 && spec.noiseHighpassHz <= 3000, `${label}: noise highpass bounded`);
  assert(spec.noisePeakGain <= 0.75, `${label}: noise peak leaves headroom`);
  assert(spec.noiseDecaySec >= 0.035 && spec.noiseDecaySec <= 0.75, `${label}: noise decay bounded`);
  assert(spec.shellFundHz >= 60 && spec.shellFundHz <= 900, `${label}: shell fundamental bounded`);
  assert(spec.shellOvertoneHz >= 90 && spec.shellOvertoneHz <= 1400, `${label}: shell overtone bounded`);
  assert(spec.shellPeakGain <= 0.75, `${label}: shell peak leaves headroom`);
  assert(spec.shellDecaySec >= 0.018 && spec.shellDecaySec <= 0.45, `${label}: shell decay bounded`);
  assert(spec.crackHighpassHz >= 2500 && spec.crackHighpassHz <= 9500, `${label}: crack highpass bounded`);
  assert(spec.crackPeakGain <= 0.75, `${label}: crack peak leaves headroom`);
  assert(spec.crackDecaySec >= 0.006 && spec.crackDecaySec <= 0.04, `${label}: crack decay bounded`);
  assert(spec.noiseStopSec > spec.noiseDecaySec, `${label}: noise stop outlives envelope`);
  assert(spec.shellStopSec > spec.shellDecaySec, `${label}: shell stop outlives envelope`);
  assert(spec.crackStopSec > spec.crackDecaySec, `${label}: crack stop outlives envelope`);
}

for (const engine of ['808', '909', 'reznor', 'aphex', 'mystery']) {
  assertFiniteBounded(resolveSnareVoiceSpec(engine, baseParams, 1), engine);
}

const snare808 = resolveSnareVoiceSpec('808', baseParams, 1);
const snare909 = resolveSnareVoiceSpec('909', baseParams, 1);
const reznor = resolveSnareVoiceSpec('reznor', baseParams, 1);
const aphex = resolveSnareVoiceSpec('aphex', baseParams, 1);
const fallback = resolveSnareVoiceSpec('unknown-engine', baseParams, 1);

assert.strictEqual(fallback.engine, 'aphex', 'unknown engine safely falls back to aphex/default');
assert.strictEqual(fallback.fallbackEngine, true, 'unknown engine reports fallback');
assert(snare808.shellPeakGain > snare909.shellPeakGain, '808 snare resolves more shell body than 909');
assert(snare808.shellDecaySec > snare909.shellDecaySec, '808 snare shell resolves longer than 909');
assert(snare909.noiseBandpassHz > snare808.noiseBandpassHz, '909 snare resolves brighter noise body than 808');
assert(snare909.crackPeakGain > snare808.crackPeakGain, '909 snare has stronger snap transient than 808');
assert(reznor.noisePeakGain > snare909.noisePeakGain * 0.95, 'Reznor snare noise gain stays competitive with 909 after headroom trim');
assert(reznor.noiseBandpassHz < snare909.noiseBandpassHz, 'Reznor-inspired snare is darker/noisier than 909');
assert(aphex.crackHighpassHz > snare808.crackHighpassHz, 'Aphex-inspired snare has a brighter crack than 808');
assert(aphex.shellDecaySec < snare808.shellDecaySec, 'Aphex-inspired snare is tighter than 808');

// digital crack personality differentiation
assert(aphex.digitalCrackGain > 0, 'Aphex snare has digitalCrackGain > 0 at full velocity');
assert.strictEqual(snare808.digitalCrackGain, 0, '808 snare has no digital crack (gain is 0)');
assert(aphex.digitalCrackHz >= snare808.digitalCrackHz, 'Aphex digitalCrackHz >= 808 digitalCrackHz');

const hostile = resolveSnareVoiceSpec('reznor', {
  tone: Infinity,
  body: -5,
  snap: 99,
  decay: NaN,
}, Infinity);
assertFiniteBounded(hostile, 'hostile params');
assert(hostile.crackPeakGain <= 0.75, 'hostile params cannot overdrive crack gain');
assert(hostile.noisePeakGain <= 0.75, 'hostile params cannot overdrive noise gain');

console.log('Issue 003 snare voice resolver checks passed.');
