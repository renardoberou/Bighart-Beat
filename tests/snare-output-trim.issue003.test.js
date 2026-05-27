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

// (a) Verify outputTrim is exported from the resolver
const spec808 = resolveSnareVoiceSpec('808', baseParams, 1);
assert(Number.isFinite(spec808.outputTrim), 'outputTrim is a finite number on resolved spec');

// (b) Verify 808 outputTrim == 1.00 (baseline)
assert.strictEqual(spec808.outputTrim, 1.00, '808 snare outputTrim is 1.00 (baseline)');

// (c) Verify reznor outputTrim < 909 outputTrim (reznor trims more)
const spec909 = resolveSnareVoiceSpec('909', baseParams, 1);
const specReznor = resolveSnareVoiceSpec('reznor', baseParams, 1);
assert(specReznor.outputTrim < spec909.outputTrim, 'reznor snare outputTrim is less than 909 (reznor trims more)');

// (d) Verify aphex outputTrim is between reznor and 909
const specAphex = resolveSnareVoiceSpec('aphex', baseParams, 1);
assert(specAphex.outputTrim > specReznor.outputTrim, 'aphex snare outputTrim is greater than reznor');
assert(specAphex.outputTrim < spec909.outputTrim, 'aphex snare outputTrim is less than 909');

// (e) Verify all outputTrim values are clamped [0.70, 1.00]
for (const engine of ['808', '909', 'reznor', 'aphex']) {
  const s = resolveSnareVoiceSpec(engine, baseParams, 1);
  assert(s.outputTrim >= 0.70, `${engine} outputTrim >= 0.70`);
  assert(s.outputTrim <= 1.00, `${engine} outputTrim <= 1.00`);
}

// (f) Verify index.html loads snare-voice.js before main.js
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const snareScriptIdx = indexHtml.indexOf('snare-voice.js');
const mainScriptIdx = indexHtml.indexOf('main.js');
assert(snareScriptIdx > 0, 'snare-voice.js is referenced in index.html');
assert(mainScriptIdx > 0, 'main.js is referenced in index.html');
assert(snareScriptIdx < mainScriptIdx, 'snare-voice.js is loaded before main.js in index.html');

console.log('Issue 003 snare outputTrim checks passed.');
