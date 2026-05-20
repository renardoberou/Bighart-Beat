#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function assertIncludes(needle, message) {
  assert(main.includes(needle), message);
}

function assertMatches(pattern, message) {
  assert(pattern.test(main), message);
}

assertIncludes('TEST KCK', 'kick voice editor renders a TEST KCK audition button');
assertIncludes('TEST SNR', 'snare voice editor renders a TEST SNR audition button');
assertIncludes('TEST CLP', 'clap voice editor renders a TEST CLP audition button');

assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?if\s*\(\s*S\.playing\s*\)\s*return\s*;/, 'shared voice preview helper bails while transport is playing');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?initAudio\s*\(\s*\)/, 'shared voice preview helper initializes audio');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?const\s+tr\s*=\s*TRACKS\s*\[\s*trackIndex\s*\]/, 'shared voice preview helper reads the requested TRACKS entry');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?const\s+t\s*=\s*A\.currentTime\s*\+\s*\.0?1[58]/, 'shared voice preview helper schedules from current audio time with a small offset');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?triggerCompGate\s*\(\s*t\s*,\s*tr\.id\s*\)/, 'shared voice preview helper triggers the compressor gate through runtime routing');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?synthFn\s*\(\s*t\s*,\s*tr\.vol\s*,\s*tr\.p\s*\)/, 'shared voice preview helper calls the selected synth with current track volume and params');

assertMatches(/data-voice-test=['"]kick['"][\s\S]*?>TEST KCK<|>TEST KCK<[\s\S]*?data-voice-test=['"]kick['"]/, 'kick TEST button has a stable data hook and exact label');
assertMatches(/data-voice-test=['"]snare['"][\s\S]*?>TEST SNR<|>TEST SNR<[\s\S]*?data-voice-test=['"]snare['"]/, 'snare TEST button has a stable data hook and exact label');
assertMatches(/data-voice-test=['"]clap['"][\s\S]*?>TEST CLP<|>TEST CLP<[\s\S]*?data-voice-test=['"]clap['"]/, 'clap TEST button has a stable data hook and exact label');

assertMatches(/querySelector\(\s*['"]\[data-voice-test="kick"\]['"]\s*\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*previewVoice\s*\(\s*0\s*,\s*synthKick\s*\)\s*\)/, 'kick TEST button previews synthKick on TRACKS[0]');
assertMatches(/querySelector\(\s*['"]\[data-voice-test="snare"\]['"]\s*\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*previewVoice\s*\(\s*1\s*,\s*synthSnare\s*\)\s*\)/, 'snare TEST button previews synthSnare on TRACKS[1]');
assertMatches(/querySelector\(\s*['"]\[data-voice-test="clap"\]['"]\s*\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*previewVoice\s*\(\s*3\s*,\s*synthClap\s*\)\s*\)/, 'clap TEST button previews synthClap on TRACKS[3]');

assert(!/PATTERNS\s*\[\s*S\.patt\s*\]\s*\[[^\]]+\]\s*=/.test(main), 'voice audition buttons do not write pattern steps');

console.log('Issue 003 voice audition button static checks passed.');
