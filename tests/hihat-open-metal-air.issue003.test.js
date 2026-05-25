#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { resolveHihatVoiceSpec } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));

const stableRand = () => 0.5;
const highMetalOpen = { freq: 9300, decay: 0.16, open: 0.9, metal: 0.95 };

function assertOpenMetalAirBounds(spec, label) {
  ['openShimmerGain', 'openShimmerTailSec', 'openShimmerHz', 'openShimmerQ',
    'openFlutterGain', 'openFlutterTailSec', 'openFlutterHz', 'openFlutterQ',
    'openSizzleTailBias', 'outputTrim', 'tailHeadroomTrim', 'airLowpassHz'].forEach(k => {
    assert(Number.isFinite(spec[k]), `${label}: ${k} is finite`);
  });
  assert(spec.openShimmerGain >= 0 && spec.openShimmerGain <= 0.085, `${label}: shimmer gain remains headroom-safe`);
  assert(spec.openShimmerTailSec >= 0.006 && spec.openShimmerTailSec <= 0.72, `${label}: shimmer tail remains mobile-safe`);
  assert(spec.openShimmerQ >= 1.2 && spec.openShimmerQ <= 4.2, `${label}: shimmer Q remains bounded`);
  assert(spec.openFlutterGain >= 0 && spec.openFlutterGain <= 0.045, `${label}: flutter gain remains headroom-safe`);
  assert(spec.openFlutterTailSec >= 0.004 && spec.openFlutterTailSec <= 0.16, `${label}: flutter tail remains mobile-safe`);
  assert(spec.openFlutterQ >= 2.5 && spec.openFlutterQ <= 10, `${label}: flutter Q remains bounded`);
  assert(spec.openSizzleTailBias >= 0 && spec.openSizzleTailBias <= 0.30, `${label}: open sizzle tail bias remains bounded`);
  assert(spec.outputTrim >= 0.62 && spec.outputTrim <= 1, `${label}: output trim remains bounded`);
  assert(spec.tailHeadroomTrim >= 0.70 && spec.tailHeadroomTrim <= 1, `${label}: tail headroom trim remains bounded`);
  assert(spec.airLowpassHz >= 8500 && spec.airLowpassHz <= 18000, `${label}: air lowpass remains bounded`);
}

const classic909 = resolveHihatVoiceSpec('909', highMetalOpen, stableRand, 0.75);
const aphex = resolveHihatVoiceSpec('aphex', highMetalOpen, stableRand, 0.75);
const aphexClosed = resolveHihatVoiceSpec('aphex', { ...highMetalOpen, open: 0 }, stableRand, 0.75);

assertOpenMetalAirBounds(classic909, 'classic 909 high-metal open hihat');
assertOpenMetalAirBounds(aphex, 'aphex high-metal open hihat');
assertOpenMetalAirBounds(aphexClosed, 'aphex high-metal closed hihat');

assert(aphex.openShimmerGain > classic909.openShimmerGain * 1.35, 'aphex high-metal open hihat has clearly stronger airy shimmer gain than 909');
assert(aphex.openShimmerTailSec > classic909.openShimmerTailSec * 1.12, 'aphex high-metal open hihat blooms with a clearly longer shimmer tail than 909');
assert(aphex.openShimmerQ > classic909.openShimmerQ + 0.75, 'aphex high-metal open hihat focuses shimmer into a more metallic band than 909');
assert(aphex.openFlutterGain > classic909.openFlutterGain + 0.025, 'aphex high-metal open hihat exposes the existing metallic flutter layer while 909 stays classic-clean');
assert(aphex.openFlutterTailSec > classic909.openFlutterTailSec * 1.35, 'aphex high-metal open hihat lets metallic flutter air hang longer than 909');
assert(aphex.openSizzleTailBias > classic909.openSizzleTailBias + 0.12, 'aphex high-metal open hihat has an audible sizzle tail bias contrast versus 909');
assert(aphex.airLowpassHz > classic909.airLowpassHz + 1500, 'aphex high-metal open hihat has a brighter metallic-air lowpass than 909');
assert(aphex.outputTrim <= classic909.outputTrim, 'aphex high-metal open hihat does not spend more output headroom than 909');
assert(aphex.tailHeadroomTrim <= classic909.tailHeadroomTrim, 'aphex high-metal open hihat does not relax tail headroom trim versus 909');

assert(aphexClosed.openFlutterGain <= 0.001, 'closed aphex high-metal hihat keeps open flutter effectively silent');
assert(aphexClosed.openSizzleTailBias <= 0.001, 'closed aphex high-metal hihat keeps open sizzle tail bias silent');
assert(aphexClosed.openShimmerGain <= 0.001, 'closed aphex high-metal hihat keeps open shimmer silent');
assert(aphex.openFlutterGain > aphexClosed.openFlutterGain + 0.025, 'open aphex high-metal hihat has metallic air contrast versus closed aphex hat');
assert(aphex.openSizzleTailBias > aphexClosed.openSizzleTailBias + 0.12, 'open aphex high-metal hihat adds sizzle bloom only when open');

console.log('Issue 003 hihat open metallic air bloom checks passed.');
