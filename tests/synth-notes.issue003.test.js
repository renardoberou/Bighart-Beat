#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SynthNotes = require(path.join(root, 'src', 'state', 'synth-notes.js'));

const banks = SynthNotes.createSynthNotesBanks();
assert.strictEqual(banks.length, 4, 'synth note state creates four pattern banks');
assert.strictEqual(banks[0].length, 16, 'default synth note grid contains 16 step ratios');
assert(banks[0].every(value => SynthNotes.SYNTH_HARMONIC_RATIOS.includes(value)), 'default synth note grid starts with random harmonic intervals');
assert.notStrictEqual(banks[0], banks[1], 'synth note banks are independent arrays');

const cloned = SynthNotes.cloneSynthNotesGrid([0.1, 0.5, 2, 20, Infinity, 'bad']);
assert.deepStrictEqual(cloned.slice(0, 6), [0.25, 0.5, 2, 16, 1, 1], 'cloneSynthNotesGrid clamps finite ratios and defaults malformed values');

assert.strictEqual(SynthNotes.getSynthNoteRatio([undefined], 0), 1, 'missing synth note ratio reads as root');
assert.throws(() => SynthNotes.getSynthNoteRatio([], 16), /0 to 15/, 'getSynthNoteRatio rejects invalid step indexes');
assert.deepStrictEqual(SynthNotes.setSynthNoteRatio(Array(16).fill(1), 2, 99).slice(0, 4), [1, 1, 16, 1], 'setSynthNoteRatio returns a cloned bounded grid');
const resetSource = Array.from({ length: 16 }, (_, i) => i + 1);
const resetGrid = SynthNotes.resetSynthNoteStepToRoot(resetSource, 5);
assert.notStrictEqual(resetGrid, resetSource, 'resetSynthNoteStepToRoot returns an isolated grid');
assert.strictEqual(resetGrid[5], 1, 'resetSynthNoteStepToRoot resets selected step ratio to root');
assert.strictEqual(resetGrid[4], resetSource[4], 'resetSynthNoteStepToRoot leaves other steps unchanged');
assert.strictEqual(resetSource[5], 6, 'resetSynthNoteStepToRoot does not mutate the source grid');

let grid = Array(16).fill(1);
grid = SynthNotes.cycleSynthNoteRatio(grid, 0);
assert.strictEqual(grid[0], 1.25, 'cycleSynthNoteRatio advances from root to next harmonic ratio');
grid = SynthNotes.setSynthNoteRatio(grid, 0, 16);
grid = SynthNotes.cycleSynthNoteRatio(grid, 0);
assert.strictEqual(grid[0], 0.5, 'cycleSynthNoteRatio wraps high out-of-list values back to first harmonic ratio');

assert.strictEqual(SynthNotes.synthPitchForStep(220, 2), 440, 'synthPitchForStep multiplies root pitch by step ratio');
assert.strictEqual(SynthNotes.synthPitchForStep(1000, 16), 2200, 'synthPitchForStep clamps high playback pitch to safe ceiling');
assert.strictEqual(SynthNotes.synthPitchForStep(20, 0.25), 40, 'synthPitchForStep clamps low playback pitch to safe floor');

const activeOnly = SynthNotes.randomHarmonicSynthNotes(Array(16).fill(1), [0, 1, 0, 1]);
assert.strictEqual(activeOnly[0], 1, 'randomHarmonicSynthNotes leaves inactive steps unchanged when active steps are provided');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(activeOnly[1]), 'randomHarmonicSynthNotes assigns harmonic ratios to active steps');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(activeOnly[3]), 'randomHarmonicSynthNotes assigns harmonic ratios to every active step');

const mainJs = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const mainCss = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
assert(mainJs.includes('data-synth-note-prev'), 'voice editor exposes a stable previous synth-step control marker');
assert(mainJs.includes('data-synth-note-next'), 'voice editor exposes a stable next synth-step control marker');
assert(mainJs.includes('data-synth-root-step'), 'voice editor exposes a stable root selected-step control marker');
assert(mainJs.includes('ROOT STEP'), 'root selected-step control is clearly labeled');
assert(/data-synth-root-step="1"[^>]*title="[^"]*root[^"]*"[^>]*aria-label="[^"]*root[^"]*"/i.test(mainJs), 'root selected-step control has accessible root title and aria-label');
assert(/function\s+moveSelectedSynthNoteStep\s*\(\s*delta\s*\)/.test(mainJs), 'runtime has a focused selected synth-step navigation helper');
assert(/function\s+resetSelectedSynthNoteStepToRoot\s*\(\s*\)/.test(mainJs), 'runtime has a focused selected synth-step root reset helper');
assert(/\(\s*LAST_SYNTH_NOTE_STEP\s*\+\s*delta\s*\+\s*16\s*\)\s*%\s*16/.test(mainJs), 'selected synth-step navigation wraps across the 16-step grid');
assert(/setLastSynthNoteStep\s*\(\s*\(\s*LAST_SYNTH_NOTE_STEP\s*\+\s*delta\s*\+\s*16\s*\)\s*%\s*16\s*\)/.test(mainJs), 'navigation updates LAST_SYNTH_NOTE_STEP through the existing setter');
assert(/moveSelectedSynthNoteStep[\s\S]{0,220}updateSynthNoteStatus\s*\(/.test(mainJs), 'navigation refreshes the selected-step status label');
assert(/resetSelectedSynthNoteStepToRoot[\s\S]{0,260}State\.resetSynthNoteStepToRoot\s*\(\s*SYNTH_NOTES\[S\.patt\]\s*,\s*LAST_SYNTH_NOTE_STEP\s*\)/.test(mainJs), 'root reset applies the state helper to the selected synth note step only');
assert(/resetSelectedSynthNoteStepToRoot[\s\S]{0,420}buildSeq\s*\([\s\S]*updateSynthNoteStatus\s*\([\s\S]*autosave\s*\([\s\S]*previewSynth\s*\(/.test(mainJs), 'root reset rebuilds steps, refreshes status, autosaves, and previews the synth');
assert(/querySelector\('\[data-synth-note-prev\]'\)[\s\S]{0,120}moveSelectedSynthNoteStep\s*\(\s*-1\s*\)/.test(mainJs), 'previous control moves the selected synth step backward');
assert(/querySelector\('\[data-synth-note-next\]'\)[\s\S]{0,120}moveSelectedSynthNoteStep\s*\(\s*1\s*\)/.test(mainJs), 'next control moves the selected synth step forward');
assert(/querySelector\('\[data-synth-root-step\]'\)\.addEventListener\('\s*click\s*'\s*,\s*resetSelectedSynthNoteStepToRoot\s*\)/.test(mainJs), 'root selected-step control triggers the root reset helper');

const helperMatch = mainJs.match(/function\s+moveSelectedSynthNoteStep\s*\(\s*delta\s*\)\s*{([\s\S]*?)\n}/);
assert(helperMatch, 'selected synth-step navigation helper body is discoverable');
assert(!/PATTERNS|SYNTH_NOTES|cycleSynthNoteRatio|randomHarmonicSynthNotes/.test(helperMatch[1]), 'navigation does not mutate pattern steps or synth note ratios');

// Tap-to-cycle: verify the click handler block for cycling synth note ratios on active steps
const tapCycleBranch = mainJs.match(/if \(trackId === 'synth' && trackIndex === S\.sel && !SYNTH_NOTE_EDIT && PATTERNS\[S\.patt\]\[trackId\]\[i\]\) \{([\s\S]*?)\n        \}/);
assert(tapCycleBranch, 'tap-to-cycle branch remains discoverable');
assert(
  /buildSeq\(\)[\s\S]*flashSynthStepEditFeedback\(i,/.test(tapCycleBranch[1]),
  'tap-to-cycle refreshes the sequencer before attaching feedback to the rebuilt live synth cell',
);
assert(
  !/c\.appendChild\(popover\)/.test(tapCycleBranch[1]),
  'tap-to-cycle no longer appends the interval popover to the stale detached cell',
);
assert(
  !/c\.classList\.add\('tap-flash'\)/.test(tapCycleBranch[1]),
  'tap-to-cycle no longer flashes the stale detached cell directly',
);
assert(mainJs.includes('function flashSynthStepEditFeedback(stepIndex, label)'), 'tap-to-cycle feedback helper is defined');
assert(mainJs.includes("const seq = $('seq');"), 'tap-to-cycle feedback helper re-queries the sequencer root');
assert(mainJs.includes('.row[data-id="synth"] .sc[data-ti="6"][data-s="'), 'tap-to-cycle feedback helper resolves the live synth cell by step index');
assert(mainJs.includes('liveCell.appendChild(popover);'), 'tap-to-cycle feedback helper appends feedback to the live synth cell');
assert(/tap-flash/.test(mainJs), 'tap-to-cycle handler references tap-flash CSS class for visual feedback');
assert(/synthTapFlash/.test(mainCss), 'main.css defines the synthTapFlash keyframe animation');

console.log('Issue 003 synth note state and selected-step navigation checks passed.');
