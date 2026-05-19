#!/usr/bin/env node
'use strict';

const assert = require('assert');
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

let grid = Array(16).fill(1);
grid = SynthNotes.cycleSynthNoteRatio(grid, 0);
assert.strictEqual(grid[0], 1.25, 'cycleSynthNoteRatio advances from root to next harmonic ratio');
grid = SynthNotes.setSynthNoteRatio(grid, 0, 16);
grid = SynthNotes.cycleSynthNoteRatio(grid, 0);
assert.strictEqual(grid[0], 0.5, 'cycleSynthNoteRatio wraps high out-of-list values back to first harmonic ratio');

assert.strictEqual(SynthNotes.synthPitchForStep(220, 2), 440, 'synthPitchForStep multiplies root pitch by step ratio');
assert.strictEqual(SynthNotes.synthPitchForStep(1000, 16), 10000, 'synthPitchForStep clamps high playback pitch to safe ceiling');
assert.strictEqual(SynthNotes.synthPitchForStep(20, 0.25), 40, 'synthPitchForStep clamps low playback pitch to safe floor');

const activeOnly = SynthNotes.randomHarmonicSynthNotes(Array(16).fill(1), [0, 1, 0, 1]);
assert.strictEqual(activeOnly[0], 1, 'randomHarmonicSynthNotes leaves inactive steps unchanged when active steps are provided');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(activeOnly[1]), 'randomHarmonicSynthNotes assigns harmonic ratios to active steps');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(activeOnly[3]), 'randomHarmonicSynthNotes assigns harmonic ratios to every active step');

console.log('Issue 003 synth note state checks passed.');
