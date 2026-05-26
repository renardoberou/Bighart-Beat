#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { resolveHihatVoiceSpec } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));

const stableRand = () => 0.5;
const params = { freq: 9300, decay: 0.045, open: 0.18, metal: 0.94 };
const normal = resolveHihatVoiceSpec('aphex', params, stableRand, 0.75);
const accented = resolveHihatVoiceSpec('aphex', params, stableRand, 1.0);
const soft = resolveHihatVoiceSpec('aphex', params, stableRand, 0.35);

function assertFiniteNeedle(spec, label) {
  ['metallicNeedlePinch', 'idmSparkGain', 'idmSparkHz', 'idmSparkQ', 'idmSparkTailSec', 'attackSec', 'noiseTailSec', 'metalTailSec', 'tailReleaseTau', 'airLowpassHz', 'outputTrim'].forEach((key) => {
    assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`);
  });
  const closedNeedleAccent = spec.aphexClosedNeedleAccent || 0;
  assert(spec.metallicNeedlePinch >= 0 && spec.metallicNeedlePinch <= 0.72 + closedNeedleAccent * 0.18, `${label}: metallic needle pinch stays bounded and scoped to closed accent`);
  assert(spec.idmSparkGain >= 0 && spec.idmSparkGain <= 0.065 + closedNeedleAccent * 0.007, `${label}: IDM spark gain stays headroom-safe and scoped to closed accent`);
  assert(spec.idmSparkQ >= 3 && spec.idmSparkQ <= 14 + closedNeedleAccent * 1.5, `${label}: IDM spark Q stays bounded and scoped to closed accent`);
  assert(spec.idmSparkTailSec >= 0.003 - closedNeedleAccent * 0.0005 && spec.idmSparkTailSec <= 0.045, `${label}: IDM spark tail stays short and scoped to closed accent`);
  assert(spec.attackSec >= 0.0008 - closedNeedleAccent * 0.00015 && spec.attackSec <= 0.004, `${label}: attack stays mobile-safe and scoped to closed accent`);
  assert(spec.outputTrim >= 0.62 && spec.outputTrim <= 1, `${label}: output trim keeps global headroom clamp`);
}

[normal, accented, soft].forEach((spec, i) => assertFiniteNeedle(spec, `near-closed fixture ${i}`));

assert(accented.metallicNeedlePinch >= normal.metallicNeedlePinch * 2.45, 'accented near-closed Aphex hats get a stronger metallic needle pinch than normal hits');
assert(accented.idmSparkGain >= normal.idmSparkGain * 2.15, 'accented near-closed Aphex hats get a hotter digital tick/spark than normal hits');
assert(accented.idmSparkHz >= normal.idmSparkHz, 'accented near-closed Aphex hats keep the needle tick at least as bright as normal hits');
assert(accented.airLowpassHz >= normal.airLowpassHz + 900, 'accented near-closed Aphex hats push the surrounding air noticeably brighter than normal hits');
assert(accented.idmSparkQ >= normal.idmSparkQ + 3.7, 'accented near-closed Aphex hats focus the tick with a higher-Q pinch');
assert(accented.idmSparkTailSec <= normal.idmSparkTailSec * 0.70, 'accented near-closed Aphex hats make the tick more immediate with a tighter spark tail');
assert(accented.attackSec <= normal.attackSec * 0.82, 'accented near-closed Aphex hats have a faster needle attack than normal hits');
assert(accented.noiseTailSec <= normal.noiseTailSec * 0.94, 'accented near-closed Aphex hats slightly tighten the main noise tail');
assert(accented.metalTailSec <= normal.metalTailSec * 0.94, 'accented near-closed Aphex hats slightly tighten the metallic tail');
assert(accented.outputTrim <= normal.outputTrim, 'accented near-closed needle does not spend extra output headroom');

assert(soft.metallicNeedlePinch < normal.metallicNeedlePinch, 'soft near-closed Aphex hits remain calmer than normal hits');
assert(soft.idmSparkGain < normal.idmSparkGain, 'soft near-closed Aphex hits keep a restrained digital tick');
assert(soft.idmSparkQ < accented.idmSparkQ - 4, 'soft near-closed Aphex hits avoid the accented high-Q needle focus');

const openParams = { ...params, open: 0.86, decay: 0.12 };
const openNormal = resolveHihatVoiceSpec('aphex', openParams, stableRand, 0.75);
const openAccent = resolveHihatVoiceSpec('aphex', openParams, stableRand, 1.0);
assertFiniteNeedle(openAccent, 'open accented fixture');
assert(openAccent.attackSec === openNormal.attackSec, 'open Aphex hats keep their existing soft open attack rather than closed-needle acceleration');
assert(openAccent.noiseTailSec >= openNormal.noiseTailSec * 0.80, 'open Aphex accent keeps its long shimmer/noise tail class');
assert(openAccent.metalTailSec >= openNormal.metalTailSec * 0.80, 'open Aphex accent keeps its long metallic shimmer tail class');
assert(openAccent.idmSparkTailSec > accented.idmSparkTailSec * 1.6, 'open Aphex hats do not inherit the tight closed-needle spark tail');
assert(openAccent.metallicNeedlePinch <= accented.metallicNeedlePinch * 0.10, 'open Aphex hats do not receive the closed needle pinch boost');

const midOpenAccent = resolveHihatVoiceSpec('aphex', { ...params, open: 0.34 }, stableRand, 1.0);
assert(midOpenAccent.attackSec > accented.attackSec * 1.25, 'part-open hats outside the near-closed slice do not receive the immediate closed-needle attack');
assert(midOpenAccent.metallicNeedlePinch < accented.metallicNeedlePinch * 0.75, 'part-open hats outside the near-closed slice have a clearly reduced needle pinch');

console.log('Issue 003 Aphex closed needle accent checks passed.');
