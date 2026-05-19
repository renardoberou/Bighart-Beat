#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SynthNotes = require(path.join(root, 'src', 'state', 'synth-notes.js'));
const { createDefaultTracks } = require(path.join(root, 'src', 'state', 'tracks.js'));
const { createDefaultFxState } = require(path.join(root, 'src', 'state', 'fx-state.js'));
const { createAppState } = require(path.join(root, 'src', 'state', 'app-state.js'));
const { createPatternBanks } = require(path.join(root, 'src', 'state', 'patterns.js'));
const { serializeProject, parseProjectImport } = require(path.join(root, 'src', 'state', 'persistence.js'));

assert.strictEqual(SynthNotes.SYNTH_MIN_HZ, 40, 'synth root minimum is 40 Hz');
assert.strictEqual(SynthNotes.SYNTH_MAX_HZ, 10000, 'synth root maximum is 10 kHz');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(1.5), 'harmonic list includes perfect fifth ratio');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(2), 'harmonic list includes octave ratio');

const banks = SynthNotes.createSynthNotesBanks();
assert.strictEqual(banks.length, 4, 'synth note memory has four pattern banks');
assert.strictEqual(banks[0].length, 16, 'default synth notes contain one harmonic ratio per step');
assert(banks[0].every(value => SynthNotes.SYNTH_HARMONIC_RATIOS.includes(value)), 'default synth notes start as random harmonic intervals');

const rootGrid = Array(16).fill(1);
const originalFirstRatio = banks[0][0];
const cycled = SynthNotes.cycleSynthNoteRatio(Array(16).fill(1), 0);
assert.strictEqual(cycled[0], 1.25, 'cycling advances from root to the next harmonic interval');
assert.strictEqual(banks[0][0], originalFirstRatio, 'cycle returns an isolated grid');

assert.strictEqual(SynthNotes.synthPitchForStep(220, 2), 440, 'step pitch multiplies root by harmonic ratio');
assert.strictEqual(SynthNotes.synthPitchForStep(17, 1), 40, 'step pitch clamps below 40 Hz');
assert.strictEqual(SynthNotes.synthPitchForStep(8000, 4), 10000, 'step pitch clamps above 10 kHz');
assert.strictEqual(SynthNotes.normalizeSynthNoteRatio(999), 16, 'ratios are bounded for import safety');
assert.strictEqual(SynthNotes.formatSynthNoteRatioLabel(1), '×1', 'ratio helper preserves root marker style');
assert.strictEqual(SynthNotes.formatSynthNoteRatioLabel(1.25), '×1.25', 'ratio helper preserves above-root marker style');
assert.strictEqual(SynthNotes.formatSynthNoteRatioLabel(0.5), '0.50×', 'ratio helper preserves below-root marker style');
assert.strictEqual(
  SynthNotes.formatSynthNoteStatusLabel({ stepIndex: 5, ratio: 1.5, rootHz: 220, pitchHz: 330 }),
  'STEP 06 · ×1.50 · ROOT 220 Hz → 330 Hz',
  'status helper describes selected synth step, ratio, root Hz, and pitch Hz'
);
assert.strictEqual(
  SynthNotes.formatSynthNoteStatusLabel({ stepIndex: 99, ratio: 0.5 }),
  'STEP 16 · 0.50×',
  'status helper bounds selected synth step labels to the 16-step grid'
);

const activeSteps = Array(16).fill(0);
activeSteps[3] = 1;
const randomized = SynthNotes.randomHarmonicSynthNotes(Array(16).fill(1), activeSteps);
assert.notStrictEqual(randomized, banks[0], 'random harmonic fill returns a new grid');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(randomized[3]), 'random harmonic fill uses approved harmonic ratios');
for (let i = 0; i < 16; i++) {
  if (i !== 3) assert.strictEqual(randomized[i], 1, 'random harmonic fill only changes active synth steps when any are active');
}

const appState = createAppState();
const tracks = createDefaultTracks();
const fx = createDefaultFxState();
const patterns = createPatternBanks();
tracks[6].p.pitch = 10000;
banks[2][5] = 1.5;
const serialized = serializeProject({ appState, tracks, fx, patterns, synthNotes: banks });
assert.deepStrictEqual(serialized.synthNotes[2][5], 1.5, 'serializeProject persists per-step synth harmonic ratios');
const parsed = parseProjectImport(serialized);
assert.strictEqual(parsed.ok, true, 'parseProjectImport accepts synth note banks');
assert.strictEqual(parsed.value.tracks[6].p.pitch, 10000, 'parseProjectImport accepts 10 kHz synth root');
assert.strictEqual(parsed.value.synthNotes[2][5], 1.5, 'parseProjectImport round-trips synth note banks');

const legacy = serializeProject({ appState, tracks, fx, patterns });
delete legacy.synthNotes;
const hydrated = parseProjectImport(legacy);
assert.strictEqual(hydrated.ok, true, 'legacy projects without synthNotes import');
assert.strictEqual(hydrated.value.synthNotes[0].length, 16, 'legacy imports hydrate synth note banks');
assert(hydrated.value.synthNotes[0].every(value => SynthNotes.SYNTH_HARMONIC_RATIOS.includes(value)), 'legacy imports hydrate random harmonic synth note banks');

const bad = serializeProject({ appState, tracks, fx, patterns, synthNotes: banks });
bad.synthNotes[0][0] = 999;
const rejected = parseProjectImport(bad);
assert.strictEqual(rejected.ok, false, 'out-of-range synth note ratio is rejected');
assert(rejected.errors.some(error => /synthNotes\[0\]\[0\]|ratio/i.test(error)), 'synth note rejection points at offending step');

const mainJs = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
assert(mainJs.includes('const SYNTH_NOTES = State.createSynthNotesBanks()'), 'runtime creates synth note banks');
assert(mainJs.includes('pitch: getStepSynthPitch(firingStep)'), 'runtime routes step-specific synth pitch into mono synth');
assert(mainJs.includes('data-synth-note-edit'), 'runtime exposes NOTE EDIT control');
assert(mainJs.includes('data-synth-rnd-harm'), 'runtime exposes random harmonic interval control');
assert(mainJs.includes('data-synth-note-status'), 'voice editor exposes selected synth note status marker');
assert(mainJs.includes('LAST_SYNTH_NOTE_STEP'), 'runtime tracks last edited synth note step');
assert(mainJs.includes('formatSynthNoteStatusLabel'), 'voice editor uses synth note status label helper');
assert(mainJs.includes('State.formatSynthNoteRatioLabel(ratio)'), 'runtime uses synth ratio marker helper for step badges');
assert(!mainJs.includes("'×' + ratio.toFixed"), 'runtime does not duplicate inline synth ratio marker formatting');
assert(mainJs.includes('synthNotes: SYNTH_NOTES'), 'runtime saves/exports synth note banks');
assert(html.includes('src/state/synth-notes.js'), 'page loads synth note state helper before runtime');
assert(css.includes('.row[data-id="synth"] .sc.syn-note::before'), 'CSS displays per-step synth harmonic ratio markers');
assert(css.includes('content: attr(data-note)'), 'CSS reads synth harmonic ratio marker text from data-note');

console.log('Issue 015 synth note harmonic-step checks passed.');
