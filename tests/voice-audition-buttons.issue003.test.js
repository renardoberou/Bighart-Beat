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
assertIncludes('TEST INP', 'input voice editor renders a TEST INP audition button');
assertIncludes('TEST ETH', 'ether voice editor renders a TEST ETH audition button');

assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?if\s*\(\s*S\.playing\s*\)\s*return\s*;/, 'shared voice preview helper bails while transport is playing');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?initAudio\s*\(\s*\)/, 'shared voice preview helper initializes audio');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?const\s+tr\s*=\s*TRACKS\s*\[\s*trackIndex\s*\]/, 'shared voice preview helper reads the requested TRACKS entry');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?const\s+t\s*=\s*A\.currentTime\s*\+\s*\.0?1[58]/, 'shared voice preview helper schedules from current audio time with a small offset');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?triggerCompGate\s*\(\s*t\s*,\s*tr\.id\s*\)/, 'shared voice preview helper triggers the compressor gate through runtime routing');
assertMatches(/function\s+previewVoice\s*\(\s*trackIndex\s*,\s*synthFn\s*\)\s*\{[\s\S]*?synthFn\s*\(\s*t\s*,\s*tr\.vol\s*,\s*tr\.p\s*\)/, 'shared voice preview helper calls the selected synth with current track volume and params');

assertMatches(/data-voice-test=['"]kick['"][\s\S]*?>TEST KCK<|>TEST KCK<[\s\S]*?data-voice-test=['"]kick['"]/, 'kick TEST button has a stable data hook and exact label');
assertMatches(/data-voice-test=['"]snare['"][\s\S]*?>TEST SNR<|>TEST SNR<[\s\S]*?data-voice-test=['"]snare['"]/, 'snare TEST button has a stable data hook and exact label');
assertMatches(/data-voice-test=['"]clap['"][\s\S]*?>TEST CLP<|>TEST CLP<[\s\S]*?data-voice-test=['"]clap['"]/, 'clap TEST button has a stable data hook and exact label');
assertMatches(/data-voice-test=['"]input['"][\s\S]*?>TEST INP<|>TEST INP<[\s\S]*?data-voice-test=['"]input['"]/, 'input TEST button has a stable data hook and exact label');
assertMatches(/data-voice-test=['"]ether['"][\s\S]*?>TEST ETH<|>TEST ETH<[\s\S]*?data-voice-test=['"]ether['"]/, 'ether TEST button has a stable data hook and exact label');

assertMatches(/querySelector\(\s*['"]\[data-voice-test="kick"\]['"]\s*\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*previewVoice\s*\(\s*0\s*,\s*synthKick\s*\)\s*\)/, 'kick TEST button previews synthKick on TRACKS[0]');
assertMatches(/querySelector\(\s*['"]\[data-voice-test="snare"\]['"]\s*\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*previewVoice\s*\(\s*1\s*,\s*synthSnare\s*\)\s*\)/, 'snare TEST button previews synthSnare on TRACKS[1]');
assertMatches(/querySelector\(\s*['"]\[data-voice-test="clap"\]['"]\s*\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*previewVoice\s*\(\s*3\s*,\s*synthClap\s*\)\s*\)/, 'clap TEST button previews synthClap on TRACKS[3]');
assertMatches(/querySelector\(\s*['"]\[data-voice-test="input"\]['"]\s*\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*previewVoice\s*\(\s*4\s*,\s*synthInput\s*\)\s*\)/, 'input TEST button previews synthInput on TRACKS[4]');
assertMatches(/querySelector\(\s*['"]\[data-voice-test="ether"\]['"]\s*\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*previewVoice\s*\(\s*5\s*,\s*synthEther\s*\)\s*\)/, 'ether TEST button previews synthEther on TRACKS[5]');

assert(!/PATTERNS\s*\[\s*S\.patt\s*\]\s*\[[^\]]+\]\s*=/.test(main), 'voice audition buttons do not write pattern steps');

console.log('Issue 003 voice audition button static checks passed.');
