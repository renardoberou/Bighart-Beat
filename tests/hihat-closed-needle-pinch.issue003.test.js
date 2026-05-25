#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { resolveHihatVoiceSpec } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));

const stableRand = () => 0.5;
const closedParams = { freq: 9300, decay: 0.045, open: 0.06, metal: 0.84 };
const nearClosedParams = { ...closedParams, open: 0.24 };
const openParams = { ...closedParams, open: 1, decay: 0.11 };

function finiteNeedle(spec, label) {
  ['metallicNeedlePinch', 'idmSparkGain', 'idmSparkQ', 'idmSparkTailSec', 'outputTrim', 'noiseTailSec', 'metalTailSec', 'tailReleaseTau'].forEach(key => {
    assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`);
  });
  assert(spec.metallicNeedlePinch >= 0 && spec.metallicNeedlePinch <= 0.72, `${label}: needle pinch remains normalized`);
  assert(spec.idmSparkGain >= 0 && spec.idmSparkGain <= 0.065, `${label}: spark gain remains headroom-safe`);
  assert(spec.idmSparkQ >= 3 && spec.idmSparkQ <= 14, `${label}: spark Q remains bounded`);
  assert(spec.idmSparkTailSec >= 0.003 && spec.idmSparkTailSec <= 0.045, `${label}: spark tail remains short/mobile-safe`);
  assert(spec.outputTrim >= 0.62 && spec.outputTrim <= 1, `${label}: output trim remains clamped`);
}

const softAphex = resolveHihatVoiceSpec('aphex', closedParams, stableRand, 0.25);
const normalAphex = resolveHihatVoiceSpec('aphex', closedParams, stableRand, 0.75);
const accentedAphex = resolveHihatVoiceSpec('aphex', closedParams, stableRand, 1.0);
[softAphex, normalAphex, accentedAphex].forEach((spec, index) => finiteNeedle(spec, `closed aphex velocity ${index}`));

assert(accentedAphex.metallicNeedlePinch >= normalAphex.metallicNeedlePinch * 2.15, 'accented closed aphex hats expose a clearly stronger metallic needle pinch than normal hits');
assert(accentedAphex.idmSparkGain >= normalAphex.idmSparkGain * 2.05, 'accented closed aphex hats make the existing IDM spark audibly more needle-like than normal hits');
assert(accentedAphex.idmSparkQ >= normalAphex.idmSparkQ + 3.0, 'accented closed aphex hats focus the spark with a high-Q pinch');
assert(accentedAphex.idmSparkTailSec <= normalAphex.idmSparkTailSec * 0.78, 'accented closed aphex needle stays shorter than the normal spark tail');
assert(accentedAphex.outputTrim <= normalAphex.outputTrim, 'accented closed aphex needle spends no extra output headroom');
assert(softAphex.idmSparkGain < normalAphex.idmSparkGain && softAphex.idmSparkQ < accentedAphex.idmSparkQ, 'soft aphex hats remain calmer than normal/accented hits');

const nearClosedNormal = resolveHihatVoiceSpec('aphex', nearClosedParams, stableRand, 0.75);
const nearClosedAccent = resolveHihatVoiceSpec('aphex', nearClosedParams, stableRand, 1.0);
finiteNeedle(nearClosedAccent, 'near-closed aphex accent');
assert(nearClosedAccent.metallicNeedlePinch > nearClosedNormal.metallicNeedlePinch * 1.45, 'near-closed aphex accents still retain a playable needle lift');
assert(nearClosedAccent.idmSparkGain > nearClosedNormal.idmSparkGain * 1.45, 'near-closed aphex accents keep velocity-responsive IDM sparkle');
assert(nearClosedAccent.idmSparkTailSec <= nearClosedNormal.idmSparkTailSec, 'near-closed accent needle does not lengthen its spark tail');

const openNormal = resolveHihatVoiceSpec('aphex', openParams, stableRand, 0.75);
const openAccent = resolveHihatVoiceSpec('aphex', openParams, stableRand, 1.0);
finiteNeedle(openAccent, 'open aphex accent');
assert(openAccent.metallicNeedlePinch <= accentedAphex.metallicNeedlePinch * 0.20, 'aphex needle/pinch fades down as hats open');
assert(openAccent.idmSparkGain <= accentedAphex.idmSparkGain * 0.62, 'open aphex hats do not inherit the full closed-hat needle spark gain');
assert(openAccent.idmSparkQ <= accentedAphex.idmSparkQ - 1.0, 'open aphex hats keep less focused spark than closed accents');
assert(openAccent.noiseTailSec <= openNormal.noiseTailSec, 'open accented needle work does not lengthen open noise tails');
assert(openAccent.metalTailSec <= openNormal.metalTailSec, 'open accented needle work does not lengthen open metal tails');
assert(openAccent.tailReleaseTau <= openNormal.tailReleaseTau, 'open accented needle work does not lengthen open release tau');
assert(openAccent.outputTrim <= openNormal.outputTrim, 'open accented needle work does not raise open output trim/headroom');

const accentedReznor = resolveHihatVoiceSpec('reznor', closedParams, stableRand, 1.0);
const accented808 = resolveHihatVoiceSpec('808', closedParams, stableRand, 1.0);
const accented909 = resolveHihatVoiceSpec('909', closedParams, stableRand, 1.0);
finiteNeedle(accentedReznor, 'reznor accent');
finiteNeedle(accented808, '808 accent');
finiteNeedle(accented909, '909 accent');
assert(accentedReznor.metallicNeedlePinch > 0 && accentedReznor.idmSparkGain > 0.001, 'reznor retains a subtler needle/spark version');
assert(accentedReznor.idmSparkGain < accentedAphex.idmSparkGain * 0.70, 'reznor needle remains subtler than aphex');
assert.strictEqual(accented808.metallicNeedlePinch, 0, '808 does not gain aphex-style metallic needle pinch');
assert.strictEqual(accented909.metallicNeedlePinch, 0, '909 does not gain aphex-style metallic needle pinch');
assert(accented808.idmSparkGain <= 0.001, '808 does not gain aphex-style IDM spark');
assert(accented909.idmSparkGain <= 0.001, '909 does not gain aphex-style IDM spark');

console.log('Issue 003 closed hihat needle/pinch checks passed.');
