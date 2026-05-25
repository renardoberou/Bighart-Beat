#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { resolveHihatVoiceSpec } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const params = { freq: 9300, decay: 0.045, open: 0.15, metal: 0.82 };
const stableRand = () => 0.5;

function assertFiniteSpark(spec, label) {
  ['idmSparkGain', 'idmSparkTailSec', 'idmSparkHz', 'idmSparkQ'].forEach(k => {
    assert(Number.isFinite(spec[k]), `${label}: ${k} is finite`);
  });
  assert(spec.idmSparkGain >= 0 && spec.idmSparkGain <= 0.065, `${label}: idmSparkGain is bounded/headroom-safe`);
  assert(spec.idmSparkTailSec >= 0.003 && spec.idmSparkTailSec <= 0.045, `${label}: idmSparkTailSec is a short mobile-safe crunch tail`);
  assert(spec.idmSparkHz >= 9000 && spec.idmSparkHz <= 18000, `${label}: idmSparkHz stays in high metallic band`);
  assert(spec.idmSparkQ >= 3 && spec.idmSparkQ <= 14, `${label}: idmSparkQ is focused but bounded`);
}

for (const engine of ['808', '909', 'reznor', 'aphex', 'unknown']) {
  assertFiniteSpark(resolveHihatVoiceSpec(engine, params, stableRand, 0.75), `${engine} normal spark spec`);
}
assertFiniteSpark(resolveHihatVoiceSpec('aphex', { freq: Infinity, decay: NaN, open: -1, metal: 9 }, () => NaN, Infinity), 'invalid input sanitized spark spec');

const softAphex = resolveHihatVoiceSpec('aphex', params, stableRand, 0.25);
const normalAphex = resolveHihatVoiceSpec('aphex', params, stableRand, 0.75);
const accentedAphex = resolveHihatVoiceSpec('aphex', params, stableRand, 1.0);
assert(softAphex.idmSparkGain < normalAphex.idmSparkGain, 'soft aphex hihat has less IDM spark than normal velocity');
assert(normalAphex.idmSparkGain < accentedAphex.idmSparkGain, 'accented aphex hihat has more IDM spark than normal velocity');
assert(accentedAphex.idmSparkTailSec <= normalAphex.idmSparkTailSec + 0.00001, 'accented aphex spark stays short/tight instead of lengthening tails');

const normalReznor = resolveHihatVoiceSpec('reznor', params, stableRand, 0.75);
const accentedReznor = resolveHihatVoiceSpec('reznor', params, stableRand, 1.0);
assert(normalReznor.idmSparkGain > 0.001, 'reznor normal hihat exposes a subtle IDM spark layer');
assert(accentedReznor.idmSparkGain > normalReznor.idmSparkGain, 'accented reznor hihat increases IDM spark');

const hat808 = resolveHihatVoiceSpec('808', params, stableRand, 1.0);
const hat909 = resolveHihatVoiceSpec('909', params, stableRand, 1.0);
assert(hat808.idmSparkGain <= 0.001, '808 keeps IDM spark effectively silent even when accented');
assert(hat909.idmSparkGain <= normalAphex.idmSparkGain * 0.25, '909 spark remains much lower than aphex');
assert(accentedAphex.idmSparkGain > hat909.idmSparkGain * 3, 'accented aphex spark is audibly stronger than classic hats');

assert(/Math\.max\([\s\S]*hihatBudget\.useIdmSpark\s*&&\s*spec\.idmSparkGain\s*>\s*0\.001\s*\?\s*spec\.idmSparkTailSec\s*\+\s*spec\.tailReleaseTau/.test(main), 'hihat tail budget includes IDM spark only when render-budgeted and enabled');
assert(/if\s*\(\s*hihatBudget\.useIdmSpark\s*&&\s*spec\.idmSparkGain\s*>\s*0\.001\s*\)\s*\{[\s\S]*const\s+spark\s*=\s*A\.createBufferSource\(\)[\s\S]*spark\.buffer\s*=\s*nz[\s\S]*const\s+sparkFilter\s*=\s*A\.createBiquadFilter\(\)[\s\S]*sparkFilter\.type\s*=\s*'bandpass'[\s\S]*sparkFilter\.frequency\.value\s*=\s*spec\.idmSparkHz[\s\S]*sparkFilter\.Q\.value\s*=\s*spec\.idmSparkQ[\s\S]*sparkGain\.gain\.linearRampToValueAtTime\(clamp\(v \* spec\.idmSparkGain,\s*0,\s*\.065\),\s*t \+ Math\.min\(\.0015,\s*spec\.attackSec\)\)[\s\S]*sparkGain\.gain\.setTargetAtTime\(\.001,\s*t \+ spec\.idmSparkTailSec,\s*spec\.tailReleaseTau\)[\s\S]*spark\.connect\(sparkFilter\);\s*sparkFilter\.connect\(sparkGain\);\s*sparkGain\.connect\(choke\);[\s\S]*spark\.stop\(t \+ spec\.idmSparkTailSec \+ spec\.tailReleaseTau \* 4\)/.test(main), 'synthHihat wires budget-gated IDM spark through choke/polish path with coherent resolver tail scheduling and stop time');

console.log('Issue 003 hihat IDM spark checks passed.');
