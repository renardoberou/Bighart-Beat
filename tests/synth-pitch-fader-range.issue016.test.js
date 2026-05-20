#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(
  /ROOT 40 Hz[–-]3000 Hz · STEP NOTES ARE HARMONIC RATIOS/.test(main),
  'SYN voice editor help text announces the new 40 Hz–3000 Hz root pitch range'
);

assert(
  /tr\.id\s*===\s*'synth'[\s\S]*mkRow\(\s*'PITCH'\s*,\s*40\s*,\s*3000\s*,\s*1\s*,\s*tr\.p\.pitch[\s\S]*updateSynthNoteStatus\(\)/.test(main),
  'SYN pitch fader is clamped to 40 Hz minimum and 3000 Hz maximum while updating note status'
);

assert(
  !/tr\.id\s*===\s*'synth'[\s\S]*mkRow\(\s*'PITCH'\s*,\s*40\s*,\s*10000/.test(main),
  'SYN pitch fader no longer exposes the old 10 kHz maximum'
);

console.log('Issue 016 synth pitch fader range checks passed.');
