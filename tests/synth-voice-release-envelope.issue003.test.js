#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

// Extract synthSynth body
const synthBodyMatch = main.match(/function\s+synthSynth\s*\([^)]*\)\s*\{([\s\S]*?)\n\}\n\nfunction\s+previewSynth/);
assert(synthBodyMatch, 'synthSynth body is present');
const synthBody = synthBodyMatch[1];

// ── 1. Voice gain uses peakGain / sustainFloor variables ──

assert(
  /const\s+peakGain\s*=\s*clamp\(\s*v\s*\*\s*spec\.bodyGain\s*,\s*0\s*,\s*\.7\s*\)/.test(synthBody),
  'synthSynth should compute peakGain via clamp(v * spec.bodyGain, 0, .7)'
);

assert(
  /const\s+sustainFloor\s*=\s*0\.012/.test(synthBody),
  'synthSynth should define sustainFloor = 0.012'
);

// ── 2. Attack phase still ramps to peak gain ──

assert(
  /voiceGain\.gain\.linearRampToValueAtTime\(\s*peakGain\s*,\s*t\s*\+\s*spec\.attackSec\s*\)/.test(synthBody),
  'attack phase should ramp to peakGain (not inline clamp) at t + attackSec'
);

// ── 3. Decay phase ramps to sustain floor, not to .001 ──

assert(
  /voiceGain\.gain\.exponentialRampToValueAtTime\(\s*Math\.max\(\s*sustainFloor\s*,\s*peakGain\s*\*\s*0\.08\s*\)\s*,\s*t\s*\+\s*spec\.decaySec\s*\)/.test(synthBody),
  'decay should ramp to Math.max(sustainFloor, peakGain * 0.08) at t + decaySec'
);

// ── 4. Release phase ramps to .001 after decay using releaseTau ──

assert(
  /voiceGain\.gain\.exponentialRampToValueAtTime\(\s*\.001\s*,\s*t\s*\+\s*spec\.decaySec\s*\+\s*spec\.releaseTau\s*\*\s*3\s*\)/.test(synthBody),
  'release should ramp to .001 at t + spec.decaySec + spec.releaseTau * 3'
);

// ── 5. Sub oscillator gain envelope also gets sustain floor + release ──

assert(
  /sg\.gain\.exponentialRampToValueAtTime\(\s*Math\.max\(\s*0\.006\s*,\s*clamp\(\s*v\s*\*\s*spec\.subGain\s*,\s*0\s*,\s*\.35\s*\)\s*\*\s*0\.08\s*\)\s*,\s*t\s*\+\s*spec\.decaySec\s*\*\s*0\.9\s*\)/.test(synthBody),
  'sub oscillator decay should ramp to Math.max(0.006, clamp(v * spec.subGain, 0, .35) * 0.08) at t + spec.decaySec * 0.9'
);

assert(
  /sg\.gain\.exponentialRampToValueAtTime\(\s*\.001\s*,\s*t\s*\+\s*spec\.decaySec\s*\+\s*spec\.releaseTau\s*\*\s*2\s*\)/.test(synthBody),
  'sub oscillator release should ramp to .001 at t + spec.decaySec + spec.releaseTau * 2'
);

console.log('Issue 003 synth voice release envelope static checks passed.');
