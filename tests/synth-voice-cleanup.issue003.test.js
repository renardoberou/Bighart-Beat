#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(
  /const\s+synthVoiceState\s*=\s*\{\s*gain:\s*null,\s*cleanup:\s*null,\s*pitchHz:\s*null,\s*triggerTime:\s*null\s*\}/.test(main),
  'mono synth state keeps cleanup separately from glide pitch/time state'
);

assert(
  /function\s+createSynthVoiceCleanupHandle\s*\(\s*nodes\s*\)\s*\{/.test(main),
  'runtime provides a synth cleanup handle factory'
);
assert(
  /let\s+cleaned\s*=\s*false[\s\S]*return\s+function\s+cleanupSynthVoice\s*\(\s*stopAt\s*\)[\s\S]*if\s*\(\s*cleaned\s*\)\s*return[\s\S]*cleaned\s*=\s*true/.test(main),
  'cleanup handle is idempotent'
);
assert(
  /\.stop\(\s*safeStopAt\s*\)[\s\S]*setTimeout\([\s\S]*\.disconnect\(\s*\)/.test(main),
  'cleanup handle stops sources at the requested time and disconnects captured nodes'
);

assert(
  /function\s+triggerSynthChoke\s*\(\s*t,\s*voiceGain,\s*spec,\s*cleanup\s*\)\s*\{[\s\S]*const\s+previousCleanup\s*=\s*synthVoiceState\.cleanup[\s\S]*const\s+cleanupAt\s*=\s*t\s*\+\s*Math\.max\(\s*\.02,\s*Math\.min\(\s*\.18,\s*spec\.chokeTau\s*\*\s*6\s*\)\s*\)[\s\S]*previousCleanup\(\s*cleanupAt\s*\)[\s\S]*synthVoiceState\.cleanup\s*=\s*cleanup/.test(main),
  'triggerSynthChoke retires the previous cleanup handle shortly after the choke tail and stores the new handle'
);

const synthBodyMatch = main.match(/function\s+synthSynth\s*\([^)]*\)\s*\{([\s\S]*?)\n\}\n\nfunction\s+previewSynth/);
assert(synthBodyMatch, 'synthSynth body is present');
const synthBody = synthBodyMatch[1];

assert(
  /const\s+synthCleanupNodes\s*=\s*\[\s*voiceGain\s*\]/.test(synthBody),
  'synthSynth starts a cleanup node list with the voice gain'
);
assert(
  /synthCleanupNodes\.push\(\s*osc,\s*filter,\s*sat\s*\)/.test(synthBody),
  'non-audition cleanup handle includes carrier oscillator/filter/saturation nodes'
);
assert(
  /synthCleanupNodes\.push\(\s*mod,\s*modGain\s*\)/.test(synthBody),
  'cleanup handle includes optional FM/modulator nodes when created'
);
assert(
  /synthCleanupNodes\.push\(\s*sub,\s*sg\s*\)/.test(synthBody),
  'cleanup handle includes optional sub oscillator nodes when created'
);
assert(
  /synthCleanupNodes\.push\(\s*ns,\s*nf,\s*ng\s*\)/.test(synthBody),
  'cleanup handle includes optional noise source/filter/gain nodes when created'
);
assert(
  /if\s*\(\s*!audition\s*\)\s*\{\s*triggerSynthChoke\(\s*t,\s*voiceGain,\s*spec,\s*createSynthVoiceCleanupHandle\(\s*synthCleanupNodes\s*\)\s*\);\s*\}/.test(synthBody),
  'only non-audition playback stores/replaces the cleanup handle'
);
assert(
  !/audition[\s\S]{0,120}synthVoiceState\.cleanup\s*=/.test(synthBody),
  'audition playback does not write shared cleanup state'
);
assert(
  /const\s+previousPitchHz\s*=\s*audition\s*\?\s*null\s*:\s*synthVoiceState\.pitchHz[\s\S]*synthVoiceState\.pitchHz\s*=\s*spec\.pitchHz[\s\S]*synthVoiceState\.triggerTime\s*=\s*t/.test(synthBody),
  'glide pitch continuity remains isolated in pitch/time state, not cleanup state'
);

console.log('Issue 003 synth voice cleanup static checks passed.');
