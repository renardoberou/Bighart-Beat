#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const kickVoicePath = path.join(root, 'src', 'rhythm', 'kick-voice.js');
assert(fs.existsSync(kickVoicePath), 'kick voice resolver module exists');

const { resolveKickVoiceSpec } = require(kickVoicePath);
assert.strictEqual(typeof resolveKickVoiceSpec, 'function', 'resolveKickVoiceSpec is exported');

const baseParams = {
  pitch: 110,
  end: 44,
  decay: 0.55,
  click: 0.68,
  drive: 0.4,
};

function assertFiniteBounded(spec, label) {
  assert(spec && typeof spec === 'object', `${label}: spec object returned`);
  assert(['808', '909', 'reznor', 'aphex'].includes(spec.engine), `${label}: safe engine id`);
  [
    'attackHz',
    'dropHz',
    'endHz',
    'bodyDecaySec',
    'subDecaySec',
    'oscStopSec',
    'subStopSec',
    'driveAmount',
    'clickGain',
    'clickHighpassHz',
    'outputTrim',
    'bodyPeakGain',
    'subPeakGain',
  ].forEach(key => {
    assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`);
    assert(spec[key] >= 0, `${label}: ${key} is non-negative`);
  });
  assert(spec.attackHz >= 20 && spec.attackHz <= 420, `${label}: attackHz bounded for mobile speakers/headroom`);
  assert(spec.dropHz >= 20 && spec.dropHz <= 260, `${label}: dropHz bounded`);
  assert(spec.endHz >= 18 && spec.endHz <= 160, `${label}: endHz bounded`);
  assert(spec.bodyDecaySec >= 0.035 && spec.bodyDecaySec <= 1.6, `${label}: bodyDecaySec bounded`);
  assert(spec.subDecaySec >= spec.bodyDecaySec, `${label}: sub tail is at least body length`);
  assert(spec.driveAmount >= 0 && spec.driveAmount <= 1, `${label}: driveAmount waveshaper input bounded`);
  assert(spec.clickGain <= 0.9, `${label}: clickGain leaves headroom`);
  assert(spec.clickHighpassHz >= 900 && spec.clickHighpassHz <= 6000, `${label}: clickHighpassHz stays in a musical transient band`);
  assert(spec.outputTrim >= 0.70 && spec.outputTrim <= 1.0, `${label}: outputTrim is bounded for headroom`);
  assert(spec.bodyPeakGain <= 0.85, `${label}: bodyPeakGain leaves headroom`);
  assert(spec.subPeakGain <= 0.32, `${label}: subPeakGain leaves headroom`);
}

function assertPeaksScaleWithVelocity(engine, label) {
  const full = resolveKickVoiceSpec(engine, baseParams, 1);
  const half = resolveKickVoiceSpec(engine, baseParams, 0.5);
  assert(half.bodyPeakGain > 0, `${label}: half velocity keeps audible body`);
  assert(half.subPeakGain > 0, `${label}: half velocity keeps audible sub`);
  assert(half.bodyPeakGain < full.bodyPeakGain, `${label}: bodyPeakGain follows velocity/output trim`);
  assert(half.subPeakGain < full.subPeakGain, `${label}: subPeakGain follows velocity/output trim`);
  assert(Math.abs(half.bodyPeakGain - full.bodyPeakGain * 0.5) < 1e-9, `${label}: body velocity scaling remains linear after trim`);
  assert(Math.abs(half.subPeakGain - full.subPeakGain * 0.5) < 1e-9, `${label}: sub velocity scaling remains linear after trim`);
}

for (const engine of ['808', '909', 'reznor', 'aphex', 'mystery']) {
  assertFiniteBounded(resolveKickVoiceSpec(engine, baseParams, 1), engine);
}

const kick808 = resolveKickVoiceSpec('808', baseParams, 1);
const kick909 = resolveKickVoiceSpec('909', baseParams, 1);
const reznor = resolveKickVoiceSpec('reznor', baseParams, 1);
const aphex = resolveKickVoiceSpec('aphex', baseParams, 1);
const fallback = resolveKickVoiceSpec('unknown-engine', baseParams, 1);

assert.strictEqual(fallback.engine, 'aphex', 'unknown engine safely falls back to aphex/default');
assert(kick808.endHz < kick909.endHz, '808 kick resolves deeper than 909');
assert(kick808.bodyDecaySec > kick909.bodyDecaySec, '808 kick resolves longer than 909');
assert(kick808.bodyPeakGain > kick909.bodyPeakGain, '808 kick has more body weight than 909');
assert(kick808.subPeakGain > kick909.subPeakGain, '808 kick has more sub weight than 909');
assert(kick909.clickGain > kick808.clickGain, '909 kick has stronger click transient than 808');
assert(kick909.clickHighpassHz > kick808.clickHighpassHz, '909 kick click is brighter than 808');
assert(aphex.clickHighpassHz > kick909.clickHighpassHz, 'Aphex-inspired kick click is the sharpest IDM transient');
assert(reznor.driveAmount > kick909.driveAmount, 'Reznor-inspired kick has more bounded drive than 909');
assert(reznor.bodyPeakGain >= kick909.bodyPeakGain, 'Reznor-inspired kick keeps industrial body without exceeding bounds');
assert(reznor.subPeakGain <= kick808.subPeakGain, 'Reznor-inspired kick sub is trimmed below 808 for headroom');
assert(reznor.outputTrim < kick808.outputTrim, 'Reznor-inspired kick uses output trim for driven headroom');
assert(aphex.attackHz > kick808.attackHz, 'Aphex-inspired kick has a brighter/steeper attack than 808');
assert(aphex.bodyDecaySec < kick808.bodyDecaySec, 'Aphex-inspired kick is tighter than 808');
assert(aphex.bodyPeakGain < kick808.bodyPeakGain, 'Aphex-inspired kick has less body than 808');
assert(aphex.subPeakGain < kick808.subPeakGain, 'Aphex-inspired kick has less sub than 808');

for (const engine of ['808', '909', 'reznor', 'aphex']) {
  assertPeaksScaleWithVelocity(engine, engine);
}

const loud808 = resolveKickVoiceSpec('808', baseParams, 2);
assert.strictEqual(loud808.bodyPeakGain, kick808.bodyPeakGain, 'velocity above 1 is clamped before body/output trim');
assert.strictEqual(loud808.subPeakGain, kick808.subPeakGain, 'velocity above 1 is clamped before sub/output trim');

const hostile = resolveKickVoiceSpec('reznor', {
  pitch: Infinity,
  end: -200,
  decay: NaN,
  click: 40,
  drive: -10,
}, 1);
assertFiniteBounded(hostile, 'hostile params');
assert(hostile.clickGain <= 0.9, 'hostile params cannot overdrive click gain');

console.log('Issue 003 kick voice resolver checks passed.');
