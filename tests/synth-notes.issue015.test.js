#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const SynthNotes = require(path.join(root, 'src', 'state', 'synth-notes.js'));
const { createDefaultTracks } = require(path.join(root, 'src', 'state', 'tracks.js'));
const { createDefaultFxState } = require(path.join(root, 'src', 'state', 'fx-state.js'));
const { createAppState } = require(path.join(root, 'src', 'state', 'app-state.js'));
const { createPatternBanks } = require(path.join(root, 'src', 'state', 'patterns.js'));
const { serializeProject, parseProjectImport } = require(path.join(root, 'src', 'state', 'persistence.js'));

assert.strictEqual(SynthNotes.SYNTH_MIN_HZ, 40, 'synth root minimum is 40 Hz');
assert.strictEqual(SynthNotes.SYNTH_MAX_FREQUENCY_HZ, 2200, 'canonical synth maximum frequency is 2200 Hz');
assert.strictEqual(SynthNotes.SYNTH_MAX_HARMONIC_RATIO, 4, 'synth harmonic ratios expose the canonical 4x maximum');
assert.strictEqual(SynthNotes.SYNTH_ROOT_MAX_HZ, 550, 'synth root maximum is derived from the 2200 Hz cap divided by the 4x harmonic');
assert.strictEqual(SynthNotes.SYNTH_MAX_HZ, 550, 'synth root maximum aliases the 550 Hz root cap');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(1.5), 'harmonic list includes perfect fifth ratio');
assert(SynthNotes.SYNTH_HARMONIC_RATIOS.includes(2), 'harmonic list includes octave ratio');

const banks = SynthNotes.createSynthNotesBanks();
assert.strictEqual(banks.length, 4, 'synth note memory has four pattern banks');
assert.strictEqual(banks[0].length, 16, 'default synth notes contain one harmonic ratio per step');
// Default grid uses musical intervals: root(1) on most steps, 5th(1.5) on 4 and 12, octave(2) on 8
assert.strictEqual(banks[0][0], 1, 'default synth notes start with root on step 0');
assert.strictEqual(banks[0][4], 1.5, 'default synth notes place 5th on step 4');
assert.strictEqual(banks[0][8], 2, 'default synth notes place octave on step 8');
assert.strictEqual(banks[0][12], 1.5, 'default synth notes place 5th on step 12');

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
assert.strictEqual(SynthNotes.synthPitchForStep(125, 4), 500, 'step pitch reaches 500 Hz at 125 Hz root and max harmonic ratio');
assert.strictEqual(SynthNotes.synthPitchForStep(125, 3), 375, 'high harmonic ratios remain distinct at 125 Hz root');
assert.strictEqual(SynthNotes.synthPitchForStep(8000, 4), 2200, 'step pitch still has a final 2200 Hz output safety cap');
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
assert.strictEqual(
  SynthNotes.hzToNoteName(SynthNotes.midiToHz(60.4999), true),
  'C♯½4',
  '24-TET positive quarter-tone labels include the octave',
);
assert.strictEqual(
  SynthNotes.hzToNoteName(SynthNotes.midiToHz(59.5), true),
  'B♯½3',
  '24-TET quarter-flat labels below C4 keep the lower octave',
);
assert.strictEqual(
  SynthNotes.hzToNoteName(SynthNotes.midiToHz(61.5001), true),
  'D♭½4',
  '24-TET negative quarter-tone labels include the octave',
);
assert.strictEqual(
  SynthNotes.hzToNoteName(SynthNotes.midiToHz(60), false),
  'C4',
  '12-TET note labels stay unchanged',
);
assert(
  SynthNotes.formatSynthNotePitchDisplay(SynthNotes.midiToHz(59.5), true).includes('B♯½3'),
  'pitch display keeps the octave for 24-TET quarter-tone roots below C4',
);
assert(
  SynthNotes.formatSynthNotePitchDisplay(SynthNotes.midiToHz(61.5001), true).includes('D♭½4'),
  'pitch display keeps the octave for 24-TET quarter-tone roots',
);
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
assert.strictEqual(
  SynthNotes.formatSynthNoteEditHintLabel(1),
  'HARM ▼ G#4 5th↓ · HARM ▲ F5 3rd-ish',
  'edit hint helper shows the previous/down and next/up approved harmonic labels with note names for root'
);
assert.strictEqual(
  SynthNotes.formatSynthNoteEditHintLabel(0.5),
  'HARM ▼ C#7 2 oct · HARM ▲ G#4 5th↓',
  'edit hint helper wraps from the lowest approved harmonic to the highest approved harmonic with note names'
);
assert.strictEqual(
  SynthNotes.formatSynthNoteEditHintLabel(1.37),
  'HARM ▼ F#5 4th · HARM ▲ G#5 5th',
  'edit hint helper describes adjacent approved harmonics with note names for non-listed ratios without duplicating the table in UI code'
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
tracks[6].p.pitch = 125;
banks[2][5] = 1.5;
const serialized = serializeProject({ appState, tracks, fx, patterns, synthNotes: banks });
assert.deepStrictEqual(serialized.synthNotes[2][5], 1.5, 'serializeProject persists per-step synth harmonic ratios');
const parsed = parseProjectImport(serialized);
assert.strictEqual(parsed.ok, true, 'parseProjectImport accepts synth note banks');
assert.strictEqual(parsed.value.tracks[6].p.pitch, 125, 'parseProjectImport accepts the canonical 125 Hz synth root ceiling');
assert.strictEqual(parsed.value.synthNotes[2][5], 1.5, 'parseProjectImport round-trips synth note banks');

const legacy = serializeProject({ appState, tracks, fx, patterns });
delete legacy.synthNotes;
const hydrated = parseProjectImport(legacy);
assert.strictEqual(hydrated.ok, true, 'legacy projects without synthNotes import');
assert.strictEqual(hydrated.value.synthNotes[0].length, 16, 'legacy imports hydrate synth note banks');
assert.strictEqual(hydrated.value.synthNotes[0][0], 1, 'legacy imports hydrate synth note banks with root on step 0');
assert.strictEqual(hydrated.value.synthNotes[0][4], 1.5, 'legacy imports hydrate musical default with 5th on step 4');
assert.strictEqual(hydrated.value.synthNotes[0][8], 2, 'legacy imports hydrate musical default with octave on step 8');

const bad = serializeProject({ appState, tracks, fx, patterns, synthNotes: banks });
bad.synthNotes[0][0] = 999;
const rejected = parseProjectImport(bad);
assert.strictEqual(rejected.ok, false, 'out-of-range synth note ratio is rejected');
assert(rejected.errors.some(error => /synthNotes\[0\]\[0\]|ratio/i.test(error)), 'synth note rejection points at offending step');

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start >= 0, `runtime exposes ${name}`);
  let depth = 0;
  let end = -1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert(end >= 0, `runtime function ${name} has a balanced body`);
  return source.slice(start, end);
}

function loadSynthRootHelpers(mainJs, pitchHz) {
  let buildSeqCalls = 0;
  let updateStatusCalls = 0;
  const sandbox = {
    TRACKS: Array.from({ length: 7 }, (_, i) => i === 6 ? { p: { pitch: pitchHz } } : { p: {} }),
    State: {
      hzToMidi(hz) {
        if (!Number.isFinite(hz) || hz <= 0) return 0;
        return 12 * Math.log2(hz / 440) + 69;
      },
      midiToHz(midi) {
        if (!Number.isFinite(midi)) return 550;
        return 440 * Math.pow(2, (midi - 69) / 12);
      },
    },
    clamp(value, lo, hi) {
      return Math.max(lo, Math.min(hi, value));
    },
    SYNTH_ROOT_MAX_HZ: 550,
    buildSeq() {
      buildSeqCalls += 1;
    },
    updateSynthNoteStatus() {
      updateStatusCalls += 1;
    },
    module: { exports: {} },
    exports: {},
  };
  const script = [
    extractFunction(mainJs, 'roundedSynthRootMidi'),
    extractFunction(mainJs, 'synthRootNoteIndex'),
    extractFunction(mainJs, 'synthRootOctave'),
    extractFunction(mainJs, 'normalizeSynthRootNoteIndex'),
    extractFunction(mainJs, 'synthRootSelectorState'),
    extractFunction(mainJs, 'setSynthRootFromNote'),
    extractFunction(mainJs, 'syncSynthRootSelectorState'),
    'module.exports = { roundedSynthRootMidi, synthRootNoteIndex, synthRootOctave, normalizeSynthRootNoteIndex, synthRootSelectorState, setSynthRootFromNote, syncSynthRootSelectorState };',
  ].join('\n\n');
  vm.runInNewContext(script, sandbox);
  return {
    ...sandbox.module.exports,
    TRACKS: sandbox.TRACKS,
    State: sandbox.State,
    getBuildSeqCalls: () => buildSeqCalls,
    getUpdateStatusCalls: () => updateStatusCalls,
  };
}

function createSelectorRow(count) {
  const buttons = Array.from({ length: count }, () => {
    const state = { active: false };
    return {
      classList: {
        toggle(token, nextState) {
          if (token === 'on') state.active = Boolean(nextState);
        },
        add(token) {
          if (token === 'on') state.active = true;
        },
        remove(token) {
          if (token === 'on') state.active = false;
        },
      },
      get active() {
        return state.active;
      },
    };
  });
  return {
    buttons,
    querySelectorAll() {
      return buttons;
    },
  };
}

function activeButtonIndexes(row) {
  return row.buttons.map((button, idx) => (button.active ? idx : -1)).filter(idx => idx >= 0);
}

const mainJs = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
const roundedSelector = loadSynthRootHelpers(mainJs, 130);
assert.strictEqual(roundedSelector.roundedSynthRootMidi(), 48, 'default 130 Hz synth root rounds to MIDI 48 for selector building');
assert.strictEqual(roundedSelector.synthRootNoteIndex(), 0, 'default 130 Hz synth root highlights C when building the selector');
assert.strictEqual(roundedSelector.synthRootOctave(), 3, 'default 130 Hz synth root highlights octave 3 when building the selector');
assert.strictEqual(
  roundedSelector.roundedSynthRootMidi(),
  (roundedSelector.synthRootOctave() + 1) * 12 + roundedSelector.synthRootNoteIndex(),
  'rounded note index and octave are derived from the same semitone when building the selector',
);
const capSelector = loadSynthRootHelpers(mainJs, 550);
assert.strictEqual(capSelector.roundedSynthRootMidi(), 73, '550 Hz synth root rounds to MIDI 73 for selector building');
assert.strictEqual(capSelector.synthRootNoteIndex(), 1, '550 Hz synth root highlights C# when building the selector');
assert.strictEqual(capSelector.synthRootOctave(), 5, '550 Hz synth root highlights octave 5 when building the selector');
assert(
  /for \(let oct = 1; oct <= 5; oct\+\+\)/.test(mainJs),
  'runtime exposes octave buttons through C5 so the 550 Hz cap remains editable',
);
const capNoteRow = createSelectorRow(12);
const capOctaveRow = createSelectorRow(5);
capSelector.syncSynthRootSelectorState(capNoteRow, capOctaveRow, () => {});
assert.deepStrictEqual(activeButtonIndexes(capNoteRow), [1], '550 Hz root keeps the C# note button highlighted');
assert.deepStrictEqual(activeButtonIndexes(capOctaveRow), [4], '550 Hz root highlights the C5 octave button');
const clickSelector = loadSynthRootHelpers(mainJs, 130);
clickSelector.setSynthRootFromNote(11.892, 3);
assert.strictEqual(
  clickSelector.TRACKS[6].p.pitch,
  clickSelector.State.midiToHz(48),
  'octave clicks normalize stale fractional note indexes before converting back to Hz',
);
assert.strictEqual(clickSelector.getBuildSeqCalls(), 1, 'setSynthRootFromNote rebuilds the sequencer after changing the root pitch');
assert.strictEqual(clickSelector.getUpdateStatusCalls(), 1, 'setSynthRootFromNote refreshes the synth note status after changing the root pitch');
const clampedSelector = loadSynthRootHelpers(mainJs, 130);
const clampedNoteRow = createSelectorRow(12);
const clampedOctaveRow = createSelectorRow(3);
let labelRefreshes = 0;
clampedSelector.setSynthRootFromNote(0, 1);
const syncResult = clampedSelector.syncSynthRootSelectorState(clampedNoteRow, clampedOctaveRow, () => {
  labelRefreshes += 1;
});
assert.strictEqual(clampedSelector.TRACKS[6].p.pitch, 40, 'low root pitch clamps to the 40 Hz floor');
assert.strictEqual(syncResult.currentMidi, 27, 'clamped low root resyncs from the rounded actual MIDI value');
assert.strictEqual(syncResult.currentNoteIdx, 3, 'clamped low root re-syncs to the actual D# note index');
assert.strictEqual(syncResult.currentOctave, 1, 'clamped low root re-syncs to the actual octave');
assert.deepStrictEqual(activeButtonIndexes(clampedNoteRow), [3], 'clamped low root highlights the actual D# button, not the requested C button');
assert.deepStrictEqual(activeButtonIndexes(clampedOctaveRow), [0], 'clamped low root keeps the actual octave button in sync');
assert.strictEqual(labelRefreshes, 1, 'selector label refresh callback fires once');
assert(mainJs.includes('const SYNTH_NOTES = State.createSynthNotesBanks()'), 'runtime creates synth note banks');
assert(mainJs.includes('pitch: getStepSynthPitch(firingStep)'), 'runtime routes step-specific synth pitch into mono synth');
assert(mainJs.includes('data-synth-note-edit'), 'runtime exposes NOTE EDIT control');
assert(mainJs.includes('data-synth-rnd-harm'), 'runtime exposes random harmonic interval control');
assert(mainJs.includes('data-synth-rnd-step'), 'runtime exposes selected-step random harmonic control');
assert(mainJs.includes('data-synth-prev-step'), 'runtime exposes selected-step previous/down harmonic control');
assert(mainJs.includes('data-synth-next-step'), 'runtime exposes selected-step next/up harmonic control');
assert(mainJs.includes('RND STEP'), 'selected-step random harmonic control is clearly labeled');
assert(mainJs.includes('HARM ▼'), 'selected-step previous/down harmonic control uses the compact harmonic-down label');
assert(mainJs.includes('HARM ▲'), 'selected-step next/up harmonic control uses the compact harmonic-up label');
assert(/data-synth-prev-step="1"[^>]*title="[^"]*(Previous|previous|Down|down)[^"]*harmonic[^"]*"[^>]*aria-label="[^"]*(Previous|previous|Down|down)[^"]*harmonic[^"]*"/.test(mainJs), 'selected-step previous/down harmonic control has accessible title and aria-label');
assert(/data-synth-next-step="1"[^>]*title="[^"]*(Advance|advance|Up|up)[^"]*harmonic[^"]*"[^>]*aria-label="[^"]*(Advance|advance|Up|up)[^"]*harmonic[^"]*"/.test(mainJs), 'selected-step next/up harmonic control has accessible title and aria-label');
assert(mainJs.includes('State.randomHarmonicSynthNoteStep(SYNTH_NOTES[S.patt], LAST_SYNTH_NOTE_STEP)'), 'selected-step random harmonic uses the selected synth note step helper only');
assert(mainJs.includes('State.cycleSynthNoteRatioBackward(SYNTH_NOTES[S.patt], LAST_SYNTH_NOTE_STEP)'), 'selected-step previous/down harmonic uses the backward cycle helper only');
assert(mainJs.includes('State.cycleSynthNoteRatio(SYNTH_NOTES[S.patt], LAST_SYNTH_NOTE_STEP)'), 'selected-step next/up harmonic uses the forward cycle helper only');
assert(/querySelector\('\[data-synth-prev-step\]'\)\.addEventListener\('\s*click\s*'\s*,\s*cycleSelectedSynthNoteStepBackward\s*\)/.test(mainJs), 'selected-step previous/down harmonic button triggers the runtime backward-cycle action');
assert(/querySelector\('\[data-synth-next-step\]'\)\.addEventListener\('\s*click\s*'\s*,\s*cycleSelectedSynthNoteStepForward\s*\)/.test(mainJs), 'selected-step next/up harmonic button triggers the runtime forward-cycle action');
assert(/function cycleSelectedSynthNoteStepBackward\(\) \{[\s\S]*?State\.cycleSynthNoteRatioBackward\(SYNTH_NOTES\[S\.patt\], LAST_SYNTH_NOTE_STEP\)[\s\S]*?buildSeq\(\)[\s\S]*?updateSynthNoteStatus\(\)[\s\S]*?autosave\(\)[\s\S]*?previewSynthNoteEditAudition\(\)[\s\S]*?toast\('SYN step harmonic down'\)/.test(mainJs), 'selected-step previous/down harmonic action rebuilds status, saves, auditions, and toasts');
assert(/function cycleSelectedSynthNoteStepForward\(\) \{[\s\S]*?State\.cycleSynthNoteRatio\(SYNTH_NOTES\[S\.patt\], LAST_SYNTH_NOTE_STEP\)[\s\S]*?buildSeq\(\)[\s\S]*?updateSynthNoteStatus\(\)[\s\S]*?autosave\(\)[\s\S]*?previewSynthNoteEditAudition\(\)[\s\S]*?toast\('SYN step harmonic up'\)/.test(mainJs), 'selected-step next/up harmonic action rebuilds status, saves, auditions, and toasts');
assert(mainJs.includes('previewSynthNoteEditAudition();'), 'selected-step random harmonic auditions the selected-step pitch through the stopped-only helper');
assert(/querySelector\('\[data-synth-rnd-harm\]'\)\.addEventListener\('\s*click\s*'\s*,\s*\(\)\s*=>\s*\{[\s\S]*?State\.randomHarmonicSynthNotes\(SYNTH_NOTES\[S\.patt\],\s*PATTERNS\[S\.patt\]\.synth\)[\s\S]*?buildSeq\(\)[\s\S]*?updateSynthNoteStatus\(\)[\s\S]*?autosave\(\)[\s\S]*?previewSynthNoteEditAudition\(\)[\s\S]*?toast\('SYN harmonic steps randomized'\)/.test(mainJs), 'global RND HARM randomizes, rebuilds status, autosaves, auditions selected synth step, and toasts');
assert(mainJs.includes('data-synth-note-status'), 'voice editor exposes selected synth note status marker');
assert(mainJs.includes('data-synth-note-hint'), 'voice editor exposes selected synth note harmonic edit hint marker');
assert(mainJs.includes('LAST_SYNTH_NOTE_STEP'), 'runtime tracks last edited synth note step');
assert(mainJs.includes('formatSynthNoteCompactStatusLabel'), 'voice editor uses compact synth note status label helper');
assert(mainJs.includes('formatSynthNoteEditHintLabel'), 'voice editor uses synth note edit hint helper');
assert(mainJs.includes('State.formatSynthNoteMarkerLabelWithPitch(ratio'), 'runtime uses compact marker helper for step badges');
assert(/function updateSynthNoteStatus\(\) \{[\s\S]*?querySelector\('\[data-synth-note-status\]'\)[\s\S]*?querySelector\('\[data-synth-note-hint\]'\)[\s\S]*?synthNoteStatusText\(LAST_SYNTH_NOTE_STEP\)[\s\S]*?synthNoteEditHintText\(LAST_SYNTH_NOTE_STEP\)/.test(mainJs), 'selected synth note refresh updates both status and adjacent harmonic edit hint');
const setSynthRootFromNoteBody = mainJs.match(/function setSynthRootFromNote\(noteIndex, octave, use24Tet = false\) \{([\s\S]*?)\n\}/);
assert(setSynthRootFromNoteBody, 'runtime exposes the synth root setter body');
assert(
  /TRACKS\[6\]\.p\.pitch = clamp\([\s\S]*?buildSeq\(\)[\s\S]*?updateSynthNoteStatus\(\)/.test(setSynthRootFromNoteBody[1]),
  'setSynthRootFromNote refreshes the sequencer labels and pitch markers immediately after changing the root pitch',
);
assert(
  /use24Tet\s*\?\s*normalizedNoteIndex\s*\/\s*2\s*:\s*normalizedNoteIndex/.test(setSynthRootFromNoteBody[1]),
  'setSynthRootFromNote preserves quarter-tone roots when 24-TET is enabled',
);
const noteEditCellTapBranch = mainJs.match(/if \(trackId === 'synth' && trackIndex === S\.sel && SYNTH_NOTE_EDIT\) \{[\s\S]*?\n        \}/);
assert(noteEditCellTapBranch, 'runtime handles selected SYN NOTE EDIT cell taps');
assert(
  /State\.cycleSynthNoteRatio\(SYNTH_NOTES\[S\.patt\], i\)[\s\S]*?LAST_SYNTH_NOTE_STEP = i[\s\S]*?updateSynthNoteStatus\(\)[\s\S]*?previewSynthNoteEditAudition\(\)[\s\S]*?buildSeq\(\)[\s\S]*?buildVE\(\)[\s\S]*?renderRhythmIntelligence\(\)[\s\S]*?autosave\(\)/.test(noteEditCellTapBranch[0]),
  'SYN NOTE EDIT cell taps audition the cycled harmonic through the stopped-only helper after state, editor rebuild, rhythm render, and autosave updates'
);
assert(
  /updateSynthNoteStatus\(\)/.test(noteEditCellTapBranch[0]),
  'SYN NOTE EDIT cell taps refresh the selected synth note status display'
);
assert(!mainJs.includes("'×' + ratio.toFixed"), 'runtime does not duplicate inline synth ratio marker formatting');
assert(mainJs.includes('synthNotes: SYNTH_NOTES'), 'runtime saves/exports synth note banks');
assert(html.includes('src/state/synth-notes.js'), 'page loads synth note state helper before runtime');
assert(css.includes('.row[data-id="synth"] .sc.syn-note::before'), 'CSS displays per-step synth harmonic ratio markers');
assert(css.includes('content: attr(data-note)'), 'CSS reads synth harmonic ratio marker text from data-note');
assert(mainJs.includes('syn-note-selected'), 'runtime uses a stable selected synth note step marker class');
assert(/function\s+setSynthNoteMarker\s*\(\s*\)\s*\{[\s\S]*?classList\.remove\('syn-note',\s*'syn-note-selected'[^)]*\)[\s\S]*?trackId\s*===\s*'synth'[\s\S]*?trackIndex\s*===\s*S\.sel[\s\S]*?SYNTH_NOTE_EDIT[\s\S]*?i\s*===\s*LAST_SYNTH_NOTE_STEP[\s\S]*?classList\.add\('syn-note-selected'\)/.test(mainJs), 'SYN NOTE EDIT grid refresh removes/reapplies selected-step marker from LAST_SYNTH_NOTE_STEP only for selected SYN');
assert(/function\s+moveSelectedSynthNoteStep\s*\(\s*delta\s*\)\s*\{[\s\S]*?setLastSynthNoteStep[\s\S]*?buildSeq\(\)[\s\S]*?updateSynthNoteStatus\(\)/.test(mainJs), 'STEP navigation rebuilds the sequencer so the selected-step marker moves');
const selectPatternBody = mainJs.match(/function\s+selectPattern\s*\(\s*patternIndex\s*,\s*options\s*\)\s*\{([\s\S]*?)\n\}/);
assert(selectPatternBody, 'runtime exposes the pattern selection helper body');
assert(/S\.patt\s*=\s*patternIndex[\s\S]*?buildSeq\(\)[\s\S]*?updateSynthNoteStatus\(\)[\s\S]*?renderRhythmIntelligence\(\)/.test(selectPatternBody[1]), 'pattern switch rebuilds the sequencer and refreshes synth note status/hint for the new pattern bank before rhythm render');
const moveSelectedSynthNoteStepBody = mainJs.match(/function\s+moveSelectedSynthNoteStep\s*\(\s*delta\s*\)\s*\{([\s\S]*?)\n\}/);
assert(moveSelectedSynthNoteStepBody, 'runtime exposes the selected synth-step navigation helper body');
assert(/buildSeq\(\)[\s\S]*updateSynthNoteStatus\(\)[\s\S]*previewSynthNoteEditAudition\(\)[\s\S]*toast\(`SYN step \$\{String\(LAST_SYNTH_NOTE_STEP \+ 1\)\.padStart\(2, '0'\)\} selected`\)/.test(moveSelectedSynthNoteStepBody[1]), 'STEP navigation rebuilds marker/status, auditions the newly selected pitch, and toasts the selected step number');
assert(!/autosave\s*\(/.test(moveSelectedSynthNoteStepBody[1]), 'STEP navigation does not autosave because selection movement is UI-only');
assert(!/SYNTH_NOTES\s*\[\s*S\.patt\s*\]\s*=|State\.cycleSynthNoteRatio|State\.randomHarmonicSynthNoteStep|State\.resetSynthNoteStepToRoot/.test(moveSelectedSynthNoteStepBody[1]), 'STEP navigation does not mutate synth note ratios');
assert(css.includes('.row[data-id="synth"] .sc.syn-note-selected'), 'CSS defines a selected synth note step marker');
assert(/row\[data-id="synth"\]\s+\.sc\.syn-note-selected\s*\{[\s\S]*?(outline|border|box-shadow)/.test(css), 'selected synth note marker has a visible mobile-readable outline/border/shadow');

// --- Engine display label mapping (Issue: display labels match button UI) ---
assert.strictEqual(SynthNotes.ENGINE_DISPLAY_LABELS['808'], '808', '808 maps to 808');
assert.strictEqual(SynthNotes.ENGINE_DISPLAY_LABELS['909'], '909', '909 maps to 909');
assert.strictEqual(SynthNotes.ENGINE_DISPLAY_LABELS['reznor'], 'NIN', 'reznor maps to NIN');
assert.strictEqual(SynthNotes.ENGINE_DISPLAY_LABELS['aphex'], 'AFX', 'aphex maps to AFX');

const labelAphex = SynthNotes.formatSynthNoteCompactStatusLabel({ stepIndex: 0, ratio: 1, engine: 'aphex' });
assert(labelAphex.includes('AFX'), 'compact status label for aphex uses AFX, got: ' + labelAphex);
assert(!labelAphex.includes('APX'), 'compact status label for aphex does not use old APX abbreviation, got: ' + labelAphex);

const labelReznor = SynthNotes.formatSynthNoteCompactStatusLabel({ stepIndex: 0, ratio: 1, engine: 'reznor' });
assert(labelReznor.includes('NIN'), 'compact status label for reznor uses NIN, got: ' + labelReznor);
assert(!labelReznor.includes('REZ'), 'compact status label for reznor does not use old REZ abbreviation, got: ' + labelReznor);

const label909 = SynthNotes.formatSynthNoteCompactStatusLabel({ stepIndex: 0, ratio: 1, engine: '909' });
assert(label909.includes('909'), 'compact status label for 909 includes 909, got: ' + label909);

console.log('Issue 015 synth note harmonic-step checks passed.');
