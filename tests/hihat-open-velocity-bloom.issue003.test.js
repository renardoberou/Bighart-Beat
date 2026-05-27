#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { resolveHihatVoiceSpec } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));

const stableRand = () => 0.5;
const playableOpen = { freq: 9300, decay: 0.16, open: 0.9, metal: 0.9 };

function assertFiniteHeadroom(spec, label) {
  [
    'noiseGain', 'metalGain', 'noiseTailSec', 'metalTailSec', 'tailReleaseTau',
    'tailHeadroomTrim', 'transientGain', 'outputTrim', 'airLowpassHz',
    'openShimmerGain', 'openShimmerTailSec', 'openShimmerHz', 'openShimmerQ',
    'openBodyGain', 'openBodyTailSec', 'openBodyHz', 'openBodyQ',
    'openFlutterGain', 'openFlutterTailSec', 'openFlutterHz', 'openFlutterQ',
    'idmSparkGain', 'idmSparkTailSec', 'idmSparkHz', 'idmSparkQ'
  ].forEach((key) => assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`));

  assert(spec.noiseGain >= 0 && spec.noiseGain <= 0.72, `${label}: noise gain remains capped`);
  assert(spec.metalGain >= 0 && spec.metalGain <= 0.34, `${label}: metal gain remains capped`);
  assert(spec.openShimmerGain >= 0 && spec.openShimmerGain <= 0.10, `${label}: shimmer gain remains capped`);
  assert(spec.openBodyGain >= 0 && spec.openBodyGain <= 0.11, `${label}: body gain remains capped`);
  assert(spec.openFlutterGain >= 0 && spec.openFlutterGain <= 0.045, `${label}: flutter gain remains capped`);
  assert(spec.idmSparkGain >= 0 && spec.idmSparkGain <= 0.065, `${label}: IDM spark gain remains capped`);
  assert(spec.openShimmerTailSec <= 0.90, `${label}: shimmer tail remains bounded`);
  assert(spec.openFlutterTailSec <= 0.16, `${label}: flutter tail remains bounded`);
  assert(spec.tailHeadroomTrim >= 0.70 && spec.tailHeadroomTrim <= 1, `${label}: tail headroom trim remains bounded`);
  assert(spec.outputTrim >= 0.62 && spec.outputTrim <= 1, `${label}: output trim remains bounded`);
}

for (const engine of ['909', 'aphex']) {
  const soft = resolveHihatVoiceSpec(engine, playableOpen, stableRand, 0.4);
  const normal = resolveHihatVoiceSpec(engine, playableOpen, stableRand, 0.75);
  const accent = resolveHihatVoiceSpec(engine, playableOpen, stableRand, 1.0);

  assertFiniteHeadroom(soft, `${engine} soft open hihat`);
  assertFiniteHeadroom(normal, `${engine} normal open hihat`);
  assertFiniteHeadroom(accent, `${engine} accented open hihat`);

  assert(soft.noiseTailSec > accent.noiseTailSec * 1.20, `${engine}: soft open hit blooms with a noticeably longer main noise tail than accent`);
  assert(soft.openShimmerTailSec > accent.openShimmerTailSec * 1.35, `${engine}: soft open hit blooms with a noticeably longer airy shimmer tail than accent`);
  assert(soft.openBodyTailSec > accent.openBodyTailSec * 1.20, `${engine}: soft open hit keeps body/air lingering longer than accent`);
  assert(soft.openFlutterTailSec > accent.openFlutterTailSec * 1.18, `${engine}: soft open hit keeps the open flutter/sizzle window airier than accent`);

  assert(accent.openShimmerGain > soft.openShimmerGain, `${engine}: accent is more present than soft shimmer without raising tail length`);
  assert(accent.openBodyGain > soft.openBodyGain, `${engine}: accent is more present than soft body without raising tail length`);
  assert(accent.transientGain > soft.transientGain * 1.08, `${engine}: accent snaps with a stronger transient than soft`);
  assert(accent.openShimmerHz > soft.openShimmerHz, `${engine}: accent pushes shimmer brighter than soft`);
  assert(accent.openBodyHz > soft.openBodyHz + 650, `${engine}: accent pushes body/presence brighter than soft`);
  assert(accent.openShimmerQ > soft.openShimmerQ + 0.12, `${engine}: accent focuses shimmer tighter while soft stays airier`);

  assert(soft.outputTrim >= accent.outputTrim, `${engine}: soft open hit is not louder than accent at the output trim stage`);
  assert(soft.tailHeadroomTrim >= accent.tailHeadroomTrim, `${engine}: accent preserves tail headroom with tighter trimming`);
}

const softAphex = resolveHihatVoiceSpec('aphex', playableOpen, stableRand, 0.4);
const accentAphex = resolveHihatVoiceSpec('aphex', playableOpen, stableRand, 1.0);
assert(accentAphex.idmSparkGain > softAphex.idmSparkGain * 1.8, 'aphex: accent adds focused IDM spark over soft open bloom');
assert(accentAphex.openFlutterQ > softAphex.openFlutterQ + 1.0, 'aphex: accent focuses metallic flutter tighter than soft open bloom');

console.log('Issue 003 hihat open velocity bloom checks passed.');
