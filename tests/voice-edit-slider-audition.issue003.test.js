#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function assertMatches(pattern, message) {
  assert(pattern.test(main), message);
}

assertMatches(
  /const\s+VOICE_EDIT_AUDITION_DEBOUNCE_MS\s*=\s*(?:1[0-9]{2}|2[0-4][0-9]|250)\s*;/,
  'voice-edit slider audition uses a bounded short debounce constant'
);

assertMatches(
  /let\s+voiceEditAuditionTimer\s*=\s*null\s*;/,
  'voice-edit slider audition keeps one simple timeout handle'
);

assertMatches(
  /function\s+scheduleVoiceEditAudition\s*\(\s*trackId\s*\)\s*\{[\s\S]*?if\s*\(\s*S\.playing\s*\)\s*return\s*;[\s\S]*?clearTimeout\s*\(\s*voiceEditAuditionTimer\s*\)[\s\S]*?setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?if\s*\(\s*S\.playing\s*\)\s*return\s*;/,
  'voice-edit slider audition bails while playing both before and after the debounce'
);

assertMatches(
  /function\s+scheduleVoiceEditAudition\s*\(\s*trackId\s*\)\s*\{[\s\S]*?case\s+['"]kick['"]\s*:\s*previewVoice\s*\(\s*0\s*,\s*synthKick\s*\)[\s\S]*?case\s+['"]snare['"]\s*:\s*previewVoice\s*\(\s*1\s*,\s*synthSnare\s*\)[\s\S]*?case\s+['"]hihat['"]\s*:\s*previewHihat\s*\(\s*HHT_PLACE\s*\)[\s\S]*?case\s+['"]clap['"]\s*:\s*previewVoice\s*\(\s*3\s*,\s*synthClap\s*\)[\s\S]*?case\s+['"]input['"]\s*:\s*previewInput\s*\(\s*\)[\s\S]*?case\s+['"]ether['"]\s*:\s*previewVoice\s*\(\s*5\s*,\s*synthEther\s*\)[\s\S]*?case\s+['"]synth['"]\s*:\s*previewSynth\s*\(\s*\)/,
  'voice-edit slider audition reuses existing per-voice preview paths for KCK/SNR/HHT/CLP/INP/ETH/SYN'
);

assertMatches(
  /f\.addEventListener\(\s*['"]input['"]\s*,\s*\(\s*\)\s*=>\s*\{[\s\S]*?onChange\s*\(\s*parseFloat\(f\.value\)\s*\)[\s\S]*?autosave\s*\(\s*\)[\s\S]*?initAudio\s*\(\s*\)\s*;[\s\S]*?scheduleVoiceEditAudition\s*\(\s*tr\.id\s*\)/,
  'VOICE EDIT slider input saves the parameter, synchronously unlocks audio, then schedules a debounced audition of the edited track'
);

const auditionHelperStart = main.indexOf('function scheduleVoiceEditAudition(trackId)');
assert(auditionHelperStart >= 0, 'voice-edit slider audition helper exists');
const auditionHelperEnd = main.indexOf('\n}\n\nfunction getStepHihatOpen', auditionHelperStart);
assert(auditionHelperEnd > auditionHelperStart, 'voice-edit slider audition helper can be inspected');
const auditionHelper = main.slice(auditionHelperStart, auditionHelperEnd);
assert(!/setInterval\s*\(/.test(auditionHelper), 'voice-edit slider audition does not introduce polling loops');

console.log('Issue 003 voice-edit slider audition static checks passed.');
