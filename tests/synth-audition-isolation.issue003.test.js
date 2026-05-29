#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(
  /function\s+synthSynth\s*\(\s*t,\s*v,\s*p,\s*options\s*=\s*\{\s*\}\s*\)/.test(main),
  'synthSynth accepts an optional options object for audition-isolated calls'
);

const synthBodyMatch = main.match(/function\s+synthSynth\s*\([^)]*\)\s*\{([\s\S]*?)\n\}\n\nfunction\s+previewSynth/);
assert(synthBodyMatch, 'synthSynth body is present');
const synthBody = synthBodyMatch[1];

assert(
  /const\s+audition\s*=\s*options\.audition\s*===\s*true/.test(synthBody),
  'synthSynth derives an explicit audition flag from options.audition'
);
assert(
  /if\s*\(\s*!audition\s*\)\s*\{\s*triggerSynthChoke\(t,\s*voiceGain,\s*spec,\s*createSynthVoiceCleanupHandle\(synthCleanupNodes\)\s*,/.test(synthBody),
  'synthSynth only chokes/stores the shared mono voice cleanup for non-audition playback (now with legato timeSincePreviousSec arg)'
);
assert(
  /const\s+previousPitchHz\s*=\s*audition\s*\?\s*null\s*:\s*synthVoiceState\.pitchHz/.test(synthBody),
  'auditions do not read shared previous pitch for glide start'
);
assert(
  /const\s+previousTriggerTime\s*=\s*audition\s*\?\s*null\s*:\s*synthVoiceState\.triggerTime/.test(synthBody),
  'auditions do not read shared previous trigger time for glide'
);
assert(
  /if\s*\(\s*!audition\s*\)\s*\{\s*synthVoiceState\.pitchHz\s*=\s*spec\.pitchHz;\s*synthVoiceState\.triggerTime\s*=\s*t;\s*\}/.test(synthBody),
  'synthSynth only writes shared pitch/time state for non-audition playback'
);
assert(
  /function\s+previewSynth\s*\(\s*\)\s*\{[\s\S]*triggerCompGate\(t,\s*tr\.id\)[\s\S]*synthSynth\(t,\s*getTrackVoiceVelocity\(\s*6\s*\),\s*\{\s*\.\.\.tr\.p,\s*pitch:\s*getStepSynthPitch\(LAST_SYNTH_NOTE_STEP\)\s*\},\s*\{\s*audition:\s*true\s*\}\s*\)/.test(main),
  'previewSynth/TEST SYN passes audition true while preserving compressor gate and selected harmonic pitch'
);
assert(
  /case\s+'synth':\s*\{\s*const\s+v\s*=\s*getTrackVoiceVelocity\(ti\);\s*synthSynth\(t,\s*v,\s*\{\s*\.\.\.tr\.p,\s*pitch:\s*getStepSynthPitch\(firingStep\)\s*\}\);\s*break;\s*\}/.test(main),
  'sequenced synth playback keeps the normal non-audition synthSynth call'
);

console.log('Issue 003 synth audition isolation static checks passed.');
