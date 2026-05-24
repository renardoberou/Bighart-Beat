#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const helperMatch = main.match(/function\s+previewSynthNoteEditAudition\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
assert(helperMatch, 'src/main.js defines previewSynthNoteEditAudition() helper for SYN NOTE EDIT/harmonic auto-audition');
const helper = helperMatch[1];

assert(/if\s*\(\s*S\.playing\s*\)\s*return\s*;/.test(helper), 'SYN NOTE EDIT audition returns immediately while transport is playing');
assert(/previewSynth\s*\(\s*\)\s*;/.test(helper), 'SYN NOTE EDIT audition preserves stopped-state previewSynth feedback');
assert(!/\bplay\s*\(\s*\)/.test(helper) && !/\brunSch\s*\(\s*\)/.test(helper) && !/S\.playing\s*=/.test(helper), 'SYN NOTE EDIT audition does not start transport/scheduler or mutate S.playing');

function functionBody(name) {
  const match = main.match(new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert(match, `${name} exists`);
  return match[1];
}

[
  'moveSelectedSynthNoteStep',
  'randomSelectedSynthNoteStep',
  'cycleSelectedSynthNoteStepBackward',
  'cycleSelectedSynthNoteStepForward',
  'resetSelectedSynthNoteStepToRoot',
].forEach((name) => {
  const body = functionBody(name);
  assert(/previewSynthNoteEditAudition\s*\(\s*\)\s*;/.test(body), `${name} uses stopped-only synth note edit audition helper`);
  assert(!/[^\w$]previewSynth\s*\(\s*\)\s*;/.test(body), `${name} does not call raw previewSynth()`);
});

const rndHarmStart = main.indexOf("syn.querySelector('[data-synth-rnd-harm]')");
assert(rndHarmStart >= 0, 'RND HARM click handler exists');
const rndHarmEnd = main.indexOf("toast('SYN harmonic steps randomized');", rndHarmStart);
assert(rndHarmEnd > rndHarmStart, 'RND HARM click handler can be inspected');
const rndHarmHandler = main.slice(rndHarmStart, rndHarmEnd);

assert(/previewSynthNoteEditAudition\s*\(\s*\)\s*;/.test(rndHarmHandler), 'RND HARM click handler uses stopped-only synth note edit audition helper');
assert(!/[^\w$]previewSynth\s*\(\s*\)\s*;/.test(rndHarmHandler), 'RND HARM click handler does not call raw previewSynth()');

const sequencerSynthNoteEditStart = main.indexOf("if (trackId === 'synth' && trackIndex === S.sel && SYNTH_NOTE_EDIT)");
assert(sequencerSynthNoteEditStart >= 0, 'sequencer-cell SYNTH_NOTE_EDIT handler exists');
const sequencerSynthNoteEditEnd = main.indexOf('return;', sequencerSynthNoteEditStart);
assert(sequencerSynthNoteEditEnd > sequencerSynthNoteEditStart, 'sequencer-cell SYNTH_NOTE_EDIT handler can be inspected');
const sequencerSynthNoteEditHandler = main.slice(sequencerSynthNoteEditStart, sequencerSynthNoteEditEnd);

assert(/previewSynthNoteEditAudition\s*\(\s*\)\s*;/.test(sequencerSynthNoteEditHandler), 'sequencer-cell SYNTH_NOTE_EDIT handler uses stopped-only synth note edit audition helper');
assert(!/[^\w$]previewSynth\s*\(\s*\)\s*;/.test(sequencerSynthNoteEditHandler), 'sequencer-cell SYNTH_NOTE_EDIT handler does not call raw previewSynth()');

const testSynthLine = main.match(/querySelector\('\[data-synth-test\]'\)\.addEventListener\('click',\s*previewSynth\s*\)/);
assert(testSynthLine, 'explicit TEST SYN button continues to call previewSynth directly');

console.log('Issue 003 synth note edit audition static checks passed.');
