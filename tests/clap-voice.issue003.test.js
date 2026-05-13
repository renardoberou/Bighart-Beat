#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const clapVoicePath = path.join(root, 'src', 'rhythm', 'clap-voice.js');
assert(fs.existsSync(clapVoicePath), 'clap voice resolver module exists');

const { resolveClapVoiceSpec } = require(clapVoicePath);
assert.strictEqual(typeof resolveClapVoiceSpec, 'function', 'resolveClapVoiceSpec is exported');

const baseParams = { spread: 10, decay: 0.14, tone: 1700 };

function assertFiniteBounded(spec, label) {
  assert(spec && typeof spec === 'object', `${label}: spec object returned`);
  assert(['808', '909', 'reznor', 'aphex'].includes(spec.engine), `${label}: safe engine id`);
  [
    'spreadSec',
    'tailOffsetSec',
    'tailDecaySec',
    'toneHz',
    'toneJitterHz',
    'highpassHz',
    'filterQ',
    'stopPaddingSec',
    'velocityGain',
  ].forEach(key => {
    assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`);
    assert(spec[key] >= 0, `${label}: ${key} is non-negative`);
  });
  assert(spec.spreadSec >= 0 && spec.spreadSec <= 0.06, `${label}: spreadSec bounded`);
  assert(spec.tailOffsetSec >= 0 && spec.tailOffsetSec <= 0.19, `${label}: tailOffsetSec bounded`);
  assert(spec.tailDecaySec >= 0.035 && spec.tailDecaySec <= 0.55, `${label}: tailDecaySec bounded`);
  assert(spec.toneHz >= 700 && spec.toneHz <= 6000, `${label}: toneHz bounded`);
  assert(spec.toneJitterHz >= 0 && spec.toneJitterHz <= 700, `${label}: toneJitterHz bounded`);
  assert(spec.highpassHz >= 300 && spec.highpassHz <= 1800, `${label}: highpassHz bounded`);
  assert(spec.filterQ >= 0.5 && spec.filterQ <= 3, `${label}: filterQ bounded`);
  assert(spec.stopPaddingSec >= 0.005 && spec.stopPaddingSec <= 0.05, `${label}: stopPaddingSec bounded`);
  assert(spec.velocityGain >= 0 && spec.velocityGain <= 1, `${label}: velocityGain clamps velocity`);
  assert(Array.isArray(spec.bursts), `${label}: bursts array exists`);
  assert.strictEqual(spec.bursts.length, 4, `${label}: clap keeps three short bursts plus tail`);
  spec.bursts.forEach((burst, index) => {
    assert(Number.isFinite(burst.offsetSec), `${label}: burst ${index} offset finite`);
    assert(Number.isFinite(burst.gain), `${label}: burst ${index} gain finite`);
    assert(Number.isFinite(burst.durationSec), `${label}: burst ${index} duration finite`);
    assert(burst.offsetSec >= 0 && burst.offsetSec <= 0.19, `${label}: burst ${index} offset bounded`);
    assert(burst.gain >= 0 && burst.gain <= 0.55, `${label}: burst ${index} gain leaves headroom`);
    assert(burst.durationSec >= 0.006 && burst.durationSec <= 0.55, `${label}: burst ${index} duration bounded`);
  });
  assert(spec.bursts[3].durationSec === spec.tailDecaySec, `${label}: final burst is resolved tail`);
}

for (const engine of ['808', '909', 'reznor', 'aphex', 'mystery']) {
  assertFiniteBounded(resolveClapVoiceSpec(engine, baseParams, 1), engine);
}

const clap808 = resolveClapVoiceSpec('808', baseParams, 1);
const clap909 = resolveClapVoiceSpec('909', baseParams, 1);
const reznor = resolveClapVoiceSpec('reznor', baseParams, 1);
const aphex = resolveClapVoiceSpec('aphex', baseParams, 1);
const fallback = resolveClapVoiceSpec('unknown-engine', baseParams, 1);

assert.strictEqual(fallback.engine, 'aphex', 'unknown engine safely falls back to aphex/default');
assert.strictEqual(fallback.fallbackEngine, true, 'fallback is documented in spec');
assert(clap808.tailDecaySec > clap909.tailDecaySec, '808 clap resolves longer/softer than 909');
assert(clap909.toneHz > clap808.toneHz, '909 clap resolves brighter than 808');
assert(reznor.highpassHz < clap909.highpassHz, 'Reznor-inspired clap keeps darker industrial body than 909');
assert(reznor.bursts[3].gain > clap808.bursts[3].gain, 'Reznor-inspired clap has stronger bounded tail than 808');
assert(aphex.toneJitterHz > clap909.toneJitterHz, 'Aphex-inspired clap has more unstable digital tone jitter than 909');
assert(aphex.spreadSec < clap808.spreadSec, 'Aphex-inspired clap resolves tighter than 808');

const quiet = resolveClapVoiceSpec('909', baseParams, -10);
assert.strictEqual(quiet.velocityGain, 0, 'negative velocity clamps to silence');
assert(quiet.bursts.every(b => b.gain === 0), 'negative velocity produces zero burst gains');

const hostile = resolveClapVoiceSpec('reznor', {
  spread: Infinity,
  decay: NaN,
  tone: -9000,
}, 99);
assertFiniteBounded(hostile, 'hostile params');
assert(hostile.bursts.every(b => b.gain <= 0.55), 'hostile params cannot exceed clap burst headroom');

console.log('Issue 003 clap voice resolver checks passed.');
