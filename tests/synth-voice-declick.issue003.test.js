#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

// ── Extract synthSynth body ──
const synthBodyMatch = main.match(/function\s+synthSynth\s*\([^)]*\)\s*\{([\s\S]*?)\n\}\n\nfunction\s+previewSynth/);
assert(synthBodyMatch, 'synthSynth body is present');
const synthBody = synthBodyMatch[1];

// ── 1. Noise gain starts at zero (no instant peak) ──
assert(
  /ng\.gain\.setValueAtTime\(\s*0\s*,\s*t\s*\)/.test(synthBody),
  'noise gain starts at setValueAtTime(0, t) to avoid instant-onset click'
);

// ── 2. Noise gain uses linearRampToValueAtTime with spec.attackSec ──
assert(
  /ng\.gain\.linearRampToValueAtTime\(\s*noisePeak\s*,\s*t\s*\+\s*spec\.attackSec\s*\)/.test(synthBody),
  'noise gain ramps to peak over spec.attackSec (not instant)'
);

// ── 3. Noise peak value is not set directly at time t ──
assert(
  !/ng\.gain\.setValueAtTime\(\s*clamp\(v\s*\*\s*spec\.noiseGain/.test(synthBody),
  'noise gain must NOT set instantaneous clamp(v * spec.noiseGain, ...) at time t'
);

// ── 4. Sub gain uses spec.attackSec (not spec.attackSec * 1.3) ──
assert(
  /sg\.gain\.linearRampToValueAtTime\(\s*clamp\(v\s*\*\s*spec\.subGain,\s*0,\s*\.35\)\s*,\s*t\s*\+\s*spec\.attackSec\s*\)/.test(synthBody),
  'sub gain attack timing uses spec.attackSec (synced with main oscillator)'
);
assert(
  !/spec\.attackSec\s*\*\s*1\.3/.test(synthBody),
  'no remaining spec.attackSec * 1.3 desync factor in sub gain'
);

// ── 5. voiceGain zero-floor start is present ──
assert(
  /voiceGain\.gain\.setValueAtTime\(\s*0\s*,\s*t\s*\)/.test(synthBody),
  'voiceGain still starts at zero to prevent DC click'
);

// ── 6. Noise gain still decays to .001 (envelope tail intact) ──
assert(
  /ng\.gain\.exponentialRampToValueAtTime\(\s*\.001\s*,\s*t\s*\+\s*Math\.min\(\s*\.16\s*,\s*spec\.decaySec\s*\)\s*\)/.test(synthBody),
  'noise gain still has decay ramp to .001 at t + Math.min(.16, spec.decaySec)'
);

// ── 7. noisePeak variable is used (not inlined) ──
assert(
  /const\s+noisePeak\s*=\s*clamp\(v\s*\*\s*spec\.noiseGain,\s*0,\s*\.16\)/.test(synthBody),
  'noise peak is stored in a local const noisePeak before ramping'
);

console.log('Issue 003 synth voice de-click static checks passed.');
