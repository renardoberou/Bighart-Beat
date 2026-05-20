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
assert.strictEqual(SynthNotes.SYNTH_MAX_HZ, 3000, 'synth root maximum is 3000 Hz');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(1.5), 'harmonic list includes perfect fifth ratio');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(2), 'harmonic list includes octave ratio');

const banks = SynthNotes.createSynthNotesBanks();
assert.strictEqual(banks.length, 4, 'synth note memory has four pattern banks');
assert.strictEqual(banks[0].length, 16, 'default synth notes contain one harmonic ratio per step');
assert(banks[0].every(value => SynthNotes.SYNTH_HARMONIC_RATIOS.includes(value)), 'default synth notes start as random harmonic intervals');

const originalFirstRatio = banks[0][0];
const cycled = SynthNotes.cycleSynthNoteRatio(Array(16).fill(1), 0);
assert.strictEqual(cycled[0], 1.25, 'cycling advances from root to the next harmonic interval');
assert.strictEqual(banks[0][0], originalFirstRatio, 'cycle returns an isolated grid');

const prevFromRoot = SynthNotes.cycleSynthNoteRatioBackward(Array(16).fill(1), 0);
assert.notStrictEqual(prevFromRoot, banks[0], 'backward cycle returns an isolated grid');
assert.strictEqual(prevFromRoot[0], 0.75, 'backward cycling moves root down to the prior harmonic interval');
const prevFromFirst = SynthNotes.cycleSynthNoteRatioBackward(Array(16).fill(0.5), 0);
assert.strictEqual(prevFromFirst[0], 4, 'backward cycling wraps the first harmonic ratio to the last ratio');
const prevFromGeneric = SynthNotes.cycleSynthNoteRatioBackward(Array.from({ length: 16 }, (_, i) => i === 3 ? 1.37 : 1), 3);
assert.strictEqual(prevFromGeneric[3], 4 / 3, 'backward cycling non-listed ratios chooses the nearest approved harmonic below the current value');
const prevSource = Array.from({ length: 16 }, (_, i) => i === 5 ? 0.6 : 1);
const prevSourceBefore = prevSource.slice();
const prevFromBetweenLowRatios = SynthNotes.cycleSynthNoteRatioBackward(prevSource, 5);
assert.strictEqual(prevFromBetweenLowRatios[5], 0.5, 'backward cycling falls to the nearest lower approved ratio below one');
assert.deepStrictEqual(prevSource, prevSourceBefore, 'backward cycle does not mutate the source grid');

const selectedGrid = Array.from({ length: 16 }, (_, i) => SynthNotes.SYNTH_HARMONIC_RATIOS[i % SynthNotes.SYNTH_HARMONIC_RATIOS.length]);
const selectedGridBefore = selectedGrid.slice();
const otherBank = Array.from({ length: 16 }, (_, i) => SynthNotes.SYNTH_HARMONIC_RATIOS[(SynthNotes.SYNTH_HARMONIC_RATIOS.length - 1 - i + SynthNotes.SYNTH_HARMONIC_RATIOS.length) % SynthNotes.SYNTH_HARMONIC_RATIOS.length]);
const otherBankBefore = otherBank.slice();
const selectedStep = 6;
const selectedRandomized = SynthNotes.randomHarmonicSynthNoteStep(selectedGrid, selectedStep, () => 0.99);
assert.notStrictEqual(selectedRandomized, selectedGrid, 'selected-step random harmonic returns a new grid');
assert.strictEqual(selectedRandomized[selectedStep], 4, 'selected-step random harmonic uses deterministic rng against approved ratios');
for (let i = 0; i < 16; i++) {
  if (i !== selectedStep) assert.strictEqual(selectedRandomized[i], selectedGridBefore[i], 'selected-step random harmonic leaves non-selected steps unchanged');
}
assert.deepStrictEqual(selectedGrid, selectedGridBefore, 'selected-step random harmonic does not mutate the source grid');
assert.deepStrictEqual(otherBank, otherBankBefore, 'selected-step random harmonic leaves other pattern banks unchanged when only current grid is replaced');

assert.strictEqual(SynthNotes.synthPitchForStep(220, 2), 440, 'step pitch multiplies root by harmonic ratio');
assert.strictEqual(SynthNotes.synthPitchForStep(17, 1), 40, 'step pitch clamps below 40 Hz');
assert.strictEqual(SynthNotes.synthPitchForStep(8000, 4), 3000, 'step pitch clamps above 3000 Hz');
assert.strictEqual(SynthNotes.normalizeSynthNoteRatio(999), 16, 'ratios are bounded for import safety');
assert.strictEqual(SynthNotes.formatSynthNoteRatioLabel(1), '×1', 'ratio helper preserves root marker style');
assert.strictEqual(SynthNotes.formatSynthNoteRatioLabel(1.25), '×1.25', 'ratio helper preserves above-root marker style');
assert.strictEqual(SynthNotes.formatSynthNoteRatioLabel(0.5), '0.50×', 'ratio helper preserves below-root marker style');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(0.5), 'oct↓', 'interval helper labels octave down ratios compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(0.75), '5th↓', 'interval helper labels fifth down ratios compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(1), 'root', 'interval helper labels the root ratio compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(1.25), '3rd-ish', 'interval helper labels the 1.25 harmonic as a copyright-safe approximate third');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(4 / 3), '4th', 'interval helper labels fourth ratios compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(1.5), '5th', 'interval helper labels fifth ratios compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(5 / 3), '6th', 'interval helper labels sixth ratios compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(2), 'oct', 'interval helper labels octave ratios compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(2.5), 'oct+3rd', 'interval helper labels octave plus third ratios compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(3), 'oct+5th', 'interval helper labels octave plus fifth ratios compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(4), '2 oct', 'interval helper labels two-octave ratios compactly');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(1.5004), '5th', 'interval helper snaps near known harmonic ratios');
assert.strictEqual(SynthNotes.formatSynthNoteIntervalLabel(1.37), '×1.37', 'interval helper falls back to a safe generic ratio label');
assert.strictEqual(SynthNotes.formatSynthNoteMarkerLabel(2.5), 'oct+3rd', 'marker helper keeps known harmonic cell badges compact');
assert.strictEqual(SynthNotes.formatSynthNoteMarkerLabel(1.37), '×1.37', 'marker helper keeps generic ratio cell badges safe and readable');
assert.strictEqual(
  SynthNotes.formatSynthNoteStatusLabel({ stepIndex: 5, ratio: 1.5, rootHz: 220, pitchHz: 330 }),
  'STEP 06 · 5th · ×1.50 · ROOT 220 Hz → 330 Hz',
  'status helper describes selected synth step, interval, ratio, root Hz, and pitch Hz'
);
assert.strictEqual(
  SynthNotes.formatSynthNoteStatusLabel({ stepIndex: 5, ratio: 1.37 }),
  'STEP 06 · ×1.37',
  'status helper does not duplicate generic ratio fallback labels'
);
assert.strictEqual(
  SynthNotes.formatSynthNoteStatusLabel({ stepIndex: 99, ratio: 0.5 }),
  'STEP 16 · oct↓ · 0.50×',
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
tracks[6].p.pitch = 3000;
banks[2][5] = 1.5;
const serialized = serializeProject({ appState, tracks, fx, patterns, synthNotes: banks });
assert.deepStrictEqual(serialized.synthNotes[2][5], 1.5, 'serializeProject persists per-step synth harmonic ratios');
const parsed = parseProjectImport(serialized);
assert.strictEqual(parsed.ok, true, 'parseProjectImport accepts synth note banks');
assert.strictEqual(parsed.value.tracks[6].p.pitch, 3000, 'parseProjectImport accepts the canonical 3000 Hz synth root ceiling');
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
assert(mainJs.includes('data-synth-rnd-step'), 'runtime exposes selected-step random harmonic control');
assert(mainJs.includes('data-synth-prev-step'), 'runtime exposes selected-step previous/down harmonic control');
assert(mainJs.includes('RND STEP'), 'selected-step random harmonic control is clearly labeled');
assert(mainJs.includes('HARM ▼'), 'selected-step previous/down harmonic control uses the compact harmonic-down label');
assert(/data-synth-prev-step="1"[^>]*title="[^"]*(Previous|previous|Down|down)[^"]*harmonic[^"]*"[^>]*aria-label="[^"]*(Previous|previous|Down|down)[^"]*harmonic[^"]*"/.test(mainJs), 'selected-step previous/down harmonic control has accessible title and aria-label');
assert(mainJs.includes('State.randomHarmonicSynthNoteStep(SYNTH_NOTES[S.patt], LAST_SYNTH_NOTE_STEP)'), 'selected-step random harmonic uses the selected synth note step helper only');
assert(mainJs.includes('State.cycleSynthNoteRatioBackward(SYNTH_NOTES[S.patt], LAST_SYNTH_NOTE_STEP)'), 'selected-step previous/down harmonic uses the backward cycle helper only');
assert(/querySelector\('\[data-synth-prev-step\]'\)\.addEventListener\('\s*click\s*'\s*,\s*cycleSelectedSynthNoteStepBackward\s*\)/.test(mainJs), 'selected-step previous/down harmonic button triggers the runtime backward-cycle action');
assert(/function cycleSelectedSynthNoteStepBackward\(\) \{[\s\S]*?State\.cycleSynthNoteRatioBackward\(SYNTH_NOTES\[S\.patt\], LAST_SYNTH_NOTE_STEP\)[\s\S]*?buildSeq\(\)[\s\S]*?updateSynthNoteStatus\(\)[\s\S]*?autosave\(\)[\s\S]*?previewSynth\(\)[\s\S]*?toast\('SYN step harmonic down'\)/.test(mainJs), 'selected-step previous/down harmonic action rebuilds status, saves, previews, and toasts');
assert(mainJs.includes('previewSynth();'), 'selected-step random harmonic previews the selected-step pitch');
assert(/querySelector\('\[data-synth-rnd-harm\]'\)\.addEventListener\('\s*click\s*'\s*,\s*\(\)\s*=>\s*\{[\s\S]*?State\.randomHarmonicSynthNotes\(SYNTH_NOTES\[S\.patt\],\s*PATTERNS\[S\.patt\]\.synth\)[\s\S]*?buildSeq\(\)[\s\S]*?updateSynthNoteStatus\(\)[\s\S]*?autosave\(\)[\s\S]*?previewSynth\(\)[\s\S]*?toast\('SYN harmonic steps randomized'\)/.test(mainJs), 'global RND HARM randomizes, rebuilds status, autosaves, previews selected synth step, and toasts');
assert(mainJs.includes('data-synth-note-status'), 'voice editor exposes selected synth note status marker');
assert(mainJs.includes('LAST_SYNTH_NOTE_STEP'), 'runtime tracks last edited synth note step');
assert(mainJs.includes('formatSynthNoteStatusLabel'), 'voice editor uses synth note status label helper');
assert(mainJs.includes('State.formatSynthNoteMarkerLabel(ratio)'), 'runtime uses compact marker helper for step badges');
const noteEditCellTapBranch = mainJs.match(/if \(trackId === 'synth' && trackIndex === S\.sel && SYNTH_NOTE_EDIT\) \{[\s\S]*?\n        \}/);
assert(noteEditCellTapBranch, 'runtime handles selected SYN NOTE EDIT cell taps');
assert(
  /State\.cycleSynthNoteRatio\(SYNTH_NOTES\[S\.patt\], i\)[\s\S]*?setLastSynthNoteStep\(i\)[\s\S]*?buildSeq\(\)[\s\S]*?buildVE\(\)[\s\S]*?renderRhythmIntelligence\(\)[\s\S]*?autosave\(\)[\s\S]*?previewSynth\(\)/.test(noteEditCellTapBranch[0]),
  'SYN NOTE EDIT cell taps preview the cycled harmonic after state, editor rebuild, rhythm render, and autosave updates'
);
assert(!mainJs.includes("'×' + ratio.toFixed"), 'runtime does not duplicate inline synth ratio marker formatting');
assert(mainJs.includes('synthNotes: SYNTH_NOTES'), 'runtime saves/exports synth note banks');
assert(html.includes('src/state/synth-notes.js'), 'page loads synth note state helper before runtime');
assert(css.includes('.row[data-id="synth"] .sc.syn-note::before'), 'CSS displays per-step synth harmonic ratio markers');
assert(css.includes('content: attr(data-note)'), 'CSS reads synth harmonic ratio marker text from data-note');
assert(mainJs.includes('syn-note-selected'), 'runtime uses a stable selected synth note step marker class');
assert(/function\s+setSynthNoteMarker\s*\(\s*\)\s*\{[\s\S]*?classList\.remove\('syn-note',\s*'syn-note-selected'\)[\s\S]*?trackId\s*===\s*'synth'[\s\S]*?trackIndex\s*===\s*S\.sel[\s\S]*?SYNTH_NOTE_EDIT[\s\S]*?i\s*===\s*LAST_SYNTH_NOTE_STEP[\s\S]*?classList\.add\('syn-note-selected'\)/.test(mainJs), 'SYN NOTE EDIT grid refresh removes/reapplies selected-step marker from LAST_SYNTH_NOTE_STEP only for selected SYN');
assert(/function\s+moveSelectedSynthNoteStep\s*\(\s*delta\s*\)\s*\{[\s\S]*?setLastSynthNoteStep[\s\S]*?buildSeq\(\)[\s\S]*?updateSynthNoteStatus\(\)/.test(mainJs), 'STEP navigation rebuilds the sequencer so the selected-step marker moves');
const moveSelectedSynthNoteStepBody = mainJs.match(/function\s+moveSelectedSynthNoteStep\s*\(\s*delta\s*\)\s*\{([\s\S]*?)\n\}/);
assert(moveSelectedSynthNoteStepBody, 'runtime exposes the selected synth-step navigation helper body');
assert(/buildSeq\(\)[\s\S]*updateSynthNoteStatus\(\)[\s\S]*previewSynth\(\)[\s\S]*toast\(`SYN step \$\{String\(LAST_SYNTH_NOTE_STEP \+ 1\)\.padStart\(2, '0'\)\} selected`\)/.test(moveSelectedSynthNoteStepBody[1]), 'STEP navigation rebuilds marker/status, previews the newly selected pitch, and toasts the selected step number');
assert(!/autosave\s*\(/.test(moveSelectedSynthNoteStepBody[1]), 'STEP navigation does not autosave because selection movement is UI-only');
assert(!/SYNTH_NOTES\s*\[\s*S\.patt\s*\]\s*=|State\.cycleSynthNoteRatio|State\.randomHarmonicSynthNoteStep|State\.resetSynthNoteStepToRoot/.test(moveSelectedSynthNoteStepBody[1]), 'STEP navigation does not mutate synth note ratios');
assert(css.includes('.row[data-id="synth"] .sc.syn-note-selected'), 'CSS defines a selected synth note step marker');
assert(/\.row\[data-id="synth"\]\s+\.sc\.syn-note-selected\s*\{[\s\S]*?(outline|border|box-shadow)/.test(css), 'selected synth note marker has a visible mobile-readable outline/border/shadow');

console.log('Issue 015 synth note harmonic-step checks passed.');
