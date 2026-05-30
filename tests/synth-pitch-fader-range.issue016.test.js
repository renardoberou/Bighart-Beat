#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const persistence = fs.readFileSync(path.join(root, 'src', 'state', 'persistence.js'), 'utf8');
const { SYNTH_MAX_FREQUENCY_HZ, SYNTH_ROOT_MAX_HZ, SYNTH_MAX_HZ, SYNTH_MAX_HARMONIC_RATIO, synthPitchForStep } = require(path.join(root, 'src', 'state', 'synth-notes.js'));

assert.strictEqual(SYNTH_MAX_FREQUENCY_HZ, 2200, 'canonical synth max output frequency cap is 2200 Hz');
assert.strictEqual(SYNTH_MAX_HARMONIC_RATIO, 4, 'canonical synth harmonic table tops out at a 4x ratio');
assert.strictEqual(SYNTH_ROOT_MAX_HZ, 550, 'canonical synth root max keeps the 4x harmonic distinct under the 2200 Hz output cap');
assert.strictEqual(SYNTH_MAX_HZ, SYNTH_ROOT_MAX_HZ, 'legacy synth root maximum alias matches the 550 Hz root cap');
assert.strictEqual(synthPitchForStep(550, 4), 2200, 'synthPitchForStep maps max root and max harmonic ratio to the 2200 Hz output cap');
assert.strictEqual(synthPitchForStep(550, 3), 1650, 'higher harmonics remain distinct at the max root instead of collapsing to 2200 Hz');

assert(
  /ROOT 40 Hz[–-]550 Hz · STEP NOTES ARE HARMONIC RATIOS/.test(main),
  'SYN voice editor help text announces the 40 Hz–550 Hz root pitch range'
);

assert(
  /tr\.id\s*===\s*'synth'[\s\S]*noteOptionsForRange\(|\.syn-note-selector|syn-note-selector__btn/.test(main),
  'SYN synth editor exposes chromatic note selector buttons instead of raw frequency fader'
);

assert(
  !/tr\.id\s*===\s*'synth'[\s\S]*mkRow\(\s*'PITCH'\s*,\s*40\s*,\s*10000/.test(main),
  'SYN pitch fader no longer exposes the old 10 kHz maximum'
);

assert(
  /synth:\s*\{\s*pitch:\s*\[\s*40\s*,\s*SYNTH_ROOT_MAX_HZ\s*\]/.test(persistence),
  'SYN persistence validation range uses the canonical 40 Hz–550 Hz root pitch range'
);

assert(
  /function\s+applySynthGlideFrequency[\s\S]*clamp\(targetHz,\s*SYNTH_OSC_SAFETY_MIN_HZ,\s*SYNTH_OSC_SAFETY_MAX_HZ\)[\s\S]*setTargetAtTime\(target,\s*t,\s*spec\.glideSec\)/.test(main),
  'runtime uses a broad oscillator safety clamp for derived synth oscillator glide targets'
);

assert(
  !/function\s+applySynthGlideFrequency[\s\S]*clamp\(targetHz,\s*40,\s*SYNTH_MAX_FREQUENCY_HZ\)/.test(main),
  'runtime does not blindly apply the strict 40 Hz–500 Hz cap to sub/FM/modulator derived oscillator targets'
);

assert(
  !/synth:\s*\{\s*pitch:\s*\[\s*40\s*,\s*10000\s*\]/.test(persistence),
  'SYN persistence validation range no longer allows the old 10 kHz maximum'
);

console.log('Issue 016 synth pitch fader range checks passed.');
