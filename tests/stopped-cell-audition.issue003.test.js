#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const clickStart = main.indexOf("c.addEventListener('click', () => {");
assert(clickStart >= 0, 'sequencer cells wire a click handler');
const clickEnd = main.indexOf("c.addEventListener('contextmenu'", clickStart);
assert(clickEnd > clickStart, 'sequencer click handler can be inspected');
const clickBlock = main.slice(clickStart, clickEnd);

const normalBranchStart = clickBlock.indexOf('const result = State.toggleStep(PATTERNS[S.patt], tr.id, i, RATCHETS[S.patt]);');
assert(normalBranchStart >= 0, 'click handler has a normal toggle branch');
const normalBranch = clickBlock.slice(normalBranchStart);

assert(
  /renderRhythmIntelligence\(\)[\s\S]*autosave\(\)[\s\S]*if\s*\(\s*!S\.playing\s*(?:&&\s*!wasOn\s*)?\)\s*\{[\s\S]*previewVoice\s*\(\s*0\s*,\s*synthKick\s*\)[\s\S]*previewVoice\s*\(\s*1\s*,\s*synthSnare\s*\)[\s\S]*previewVoice\s*\(\s*3\s*,\s*synthClap\s*\)[\s\S]*previewInput\s*\(\s*\)[\s\S]*previewVoice\s*\(\s*5\s*,\s*synthEther\s*\)[\s\S]*\}/.test(normalBranch),
  'normal stopped cell toggles preview KCK/SNR/CLP/INP/ETH after render/autosave behind a !S.playing gate'
);

assert(
  /renderRhythmIntelligence\(\)[\s\S]*autosave\(\)[\s\S]*if\s*\(\s*!S\.playing\s*&&\s*!wasOn\s*\)\s*\{[\s\S]*previewVoice\s*\(\s*0\s*,\s*synthKick\s*\)[\s\S]*previewVoice\s*\(\s*1\s*,\s*synthSnare\s*\)[\s\S]*previewVoice\s*\(\s*3\s*,\s*synthClap\s*\)[\s\S]*previewInput\s*\(\s*\)[\s\S]*previewVoice\s*\(\s*5\s*,\s*synthEther\s*\)[\s\S]*\}/.test(normalBranch),
  'normal stopped KCK/SNR/CLP/INP/ETH auditions are result-aware: only OFF→ON toggles preview, ON→OFF deletion stays silent'
);

assert(
  /if\s*\(\s*trackId\s*===\s*['"]kick['"]\s*\)\s*previewVoice\s*\(\s*0\s*,\s*synthKick\s*\)/.test(normalBranch),
  'kick cell toggles audition synthKick via previewVoice on TRACKS[0]'
);
assert(
  /if\s*\(\s*trackId\s*===\s*['"]snare['"]\s*\)\s*previewVoice\s*\(\s*1\s*,\s*synthSnare\s*\)/.test(normalBranch),
  'snare cell toggles audition synthSnare via previewVoice on TRACKS[1]'
);
assert(
  /if\s*\(\s*trackId\s*===\s*['"]clap['"]\s*\)\s*previewVoice\s*\(\s*3\s*,\s*synthClap\s*\)/.test(normalBranch),
  'clap cell toggles audition synthClap via previewVoice on TRACKS[3]'
);
assert(
  /if\s*\(\s*trackId\s*===\s*['"]input['"]\s*\)\s*previewInput\s*\(\s*\)/.test(normalBranch),
  'input cell toggles audition through the sample-aware previewInput helper'
);
assert(
  /if\s*\(\s*trackId\s*===\s*['"]ether['"]\s*\)\s*previewVoice\s*\(\s*5\s*,\s*synthEther\s*\)/.test(normalBranch),
  'ether cell toggles audition synthEther via previewVoice on TRACKS[5]'
);

assert(
  /if\s*\(\s*!S\.playing\s*&&\s*!wasOn\s*\)\s*\{[\s\S]*if\s*\(\s*trackId\s*===\s*['"]synth['"]\s*\)\s*\{[\s\S]*setLastSynthNoteStep\s*\(\s*i\s*\)[\s\S]*previewSynth\s*\(\s*\)[\s\S]*\}[\s\S]*\}/.test(normalBranch),
  'normal stopped SYN OFF→ON cell toggles set LAST_SYNTH_NOTE_STEP to the toggled step and audition previewSynth()'
);
assert(
  !/if\s*\(\s*S\.playing\s*\)\s*\{[\s\S]*preview(?:Voice|Input|Hihat|Synth)\s*\(/.test(normalBranch),
  'normal cell audition is not gated to fire while transport is running'
);

console.log('Issue 003 stopped non-hihat/SYN cell audition static checks passed.');
