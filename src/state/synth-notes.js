'use strict';

(function (root) {
  const STEP_COUNT = 16;
  const BANK_COUNT = 4;
  const SYNTH_MIN_HZ = 40;
  const SYNTH_MAX_FREQUENCY_HZ = 500;
  const SYNTH_HARMONIC_RATIOS = [0.5, 0.75, 1, 1.25, 4 / 3, 1.5, 5 / 3, 2, 2.5, 3, 4];
  const SYNTH_MAX_HARMONIC_RATIO = Math.max(...SYNTH_HARMONIC_RATIOS);
  const SYNTH_ROOT_MAX_HZ = SYNTH_MAX_FREQUENCY_HZ / SYNTH_MAX_HARMONIC_RATIO;
  const SYNTH_MAX_HZ = SYNTH_ROOT_MAX_HZ;
  const SYNTH_HARMONIC_INTERVAL_LABELS = [
    [0.5, 'oct↓'],
    [0.75, '5th↓'],
    [1, 'root'],
    [1.25, '3rd-ish'],
    [4 / 3, '4th'],
    [1.5, '5th'],
    [5 / 3, '6th'],
    [2, 'oct'],
    [2.5, 'oct+3rd'],
    [3, 'oct+5th'],
    [4, '2 oct'],
  ];
  const SYNTH_INTERVAL_RATIO_EPSILON = 0.001;

  const ENGINE_DISPLAY_LABELS = {
    '808': '808',
    '909': '909',
    'reznor': 'NIN',
    'aphex': 'AFX',
  };

  // Chromatic note names (12-TET)
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NOTE_NAMES_24 = [
    'C',    // 0  - C
    'C♯½',  // 1  - C quarter-sharp
    'C♯',   // 2  - C# / D♭
    'D♭½',  // 3  - D quarter-flat
    'D',    // 4  - D
    'D♯½',  // 5  - D quarter-sharp
    'D♯',   // 6  - D# / E♭
    'E♭½',  // 7  - E quarter-flat
    'E',    // 8  - E
    'E♯½',  // 9  - E quarter-sharp (F♭)
    'F',    // 10 - F
    'F♯½',  // 11 - F quarter-sharp
    'F♯',   // 12 - F# / G♭
    'G♭½',  // 13 - G quarter-flat
    'G',    // 14 - G
    'G♯½',  // 15 - G quarter-sharp
    'G♯',   // 16 - G# / A♭
    'A♭½',  // 17 - A quarter-flat
    'A',    // 18 - A
    'A♯½',  // 19 - A quarter-sharp
    'A♯',   // 20 - A# / B♭
    'B♭½',  // 21 - B quarter-flat
    'B',    // 22 - B
  ];

  // Reference: A4 = 440 Hz, note index 9 (A) in octave 4
  const A4_HZ = 440;
  const A4_MIDI = 69;

  function hzToMidi(hz) {
    if (!Number.isFinite(hz) || hz <= 0) return 0;
    return 12 * Math.log2(hz / A4_HZ) + A4_MIDI;
  }

  function midiToHz(midi) {
    if (!Number.isFinite(midi)) return SYNTH_ROOT_MAX_HZ;
    return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
  }

  function hzToNoteName(hz, use24Tet) {
    const midi = hzToMidi(hz);
    const midiRounded = Math.round(midi);
    const cents = Math.round((midi - midiRounded) * 100);
    const octave = Math.floor(midiRounded / 12) - 1;
    const noteIndex = ((midiRounded % 12) + 12) % 12;
    if (use24Tet) {
      // 24-TET: use sharps/flats for quarter-tone neighbors
      const centsRounded = Math.round(cents / 50) * 50;
      if (centsRounded === 50) {
        return NOTE_NAMES_24[noteIndex * 2 + 1] || NOTE_NAMES[noteIndex] + '♯½';
      } else if (centsRounded === -50) {
        const prevIndex = ((noteIndex - 1) + 12) % 12;
        return NOTE_NAMES_24[prevIndex * 2 + 1] || NOTE_NAMES[prevIndex] + '♭½';
      }
      return NOTE_NAMES[noteIndex] + octave;
    }
    return NOTE_NAMES[noteIndex] + octave;
  }

  function noteNameToHz(nameAndOctave, use24Tet) {
    const str = String(nameAndOctave || '').trim();
    if (!str) return SYNTH_ROOT_MAX_HZ;
    // Parse note name and octave
    const match = str.match(/^([A-Ga-g][#♯♭]?)([-+]?\d+)?$/);
    if (!match) return SYNTH_ROOT_MAX_HZ;
    let noteStr = match[1].toUpperCase();
    // Normalize accidentals
    if (noteStr.includes('♯')) noteStr = noteStr.replace('♯', '#');
    if (noteStr.includes('♭')) {
      // Convert flat to sharp of previous note
      const flatMap = { 'DB': 'C#', 'EB': 'D#', 'GB': 'F#', 'AB': 'G#', 'BB': 'A#' };
      noteStr = flatMap[noteStr] || noteStr.replace('♭', 'B');
    }
    const octave = match[2] !== undefined ? parseInt(match[2]) : 4;
    let noteIndex = NOTE_NAMES.indexOf(noteStr);
    if (noteIndex < 0) {
      // Try 24-TET names
      const idx24 = NOTE_NAMES_24.indexOf(match[1].toUpperCase());
      if (idx24 >= 0) {
        noteIndex = Math.floor(idx24 / 2);
      } else {
        return SYNTH_ROOT_MAX_HZ;
      }
    }
    const midi = (octave + 1) * 12 + noteIndex;
    return midiToHz(midi);
  }

  function formatSynthNotePitchDisplay(rootHz, use24Tet) {
    const clamped = clamp(rootHz, SYNTH_MIN_HZ, SYNTH_MAX_FREQUENCY_HZ);
    const noteName = hzToNoteName(clamped, use24Tet);
    const cents = Math.round((hzToMidi(clamped) - Math.round(hzToMidi(clamped))) * 100);
    const centsStr = cents === 0 ? '' : ` ${cents > 0 ? '+' : ''}${cents}¢`;
    return `${noteName}${centsStr} (${Math.round(clamped)} Hz)`;
  }

  // Generate note options for a given range (for selectors)
  function noteOptionsForRange(loHz, hiHz, use24Tet) {
    const options = [];
    const loMidi = Math.ceil(hzToMidi(loHz));
    const hiMidi = Math.floor(hzToMidi(hiHz));
    for (let midi = loMidi; midi <= hiMidi; midi++) {
      const hz = midiToHz(midi);
      const octave = Math.floor(midi / 12) - 1;
      const noteIndex = ((midi % 12) + 12) % 12;
      const name = use24Tet ? NOTE_NAMES_24[noteIndex * 2] || NOTE_NAMES[noteIndex] : NOTE_NAMES[noteIndex];
      options.push({ midi, hz, label: name + octave, cents: 0 });
      // Add quarter-tone if 24-TET
      if (use24Tet) {
        const qMidi = midi + 0.5;
        const qHz = midiToHz(qMidi);
        if (qHz <= hiHz) {
          const qName = NOTE_NAMES_24[noteIndex * 2 + 1];
          if (qName) {
            options.push({ midi: qMidi, hz: qHz, label: qName + octave, cents: 50 });
          }
        }
      }
    }
    return options;
  }

  function finiteOr(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, finiteOr(value, lo)));
  }

  function normalizeSynthNoteRatio(value) {
    return clamp(value, 0.25, 16);
  }

  function randomHarmonicRatio(rng) {
    const random = typeof rng === 'function' ? rng : Math.random;
    const index = clamp(Math.floor(random() * SYNTH_HARMONIC_RATIOS.length), 0, SYNTH_HARMONIC_RATIOS.length - 1);
    return SYNTH_HARMONIC_RATIOS[index];
  }

  function formatHz(value) {
    if (!Number.isFinite(value)) return null;
    return Math.round(value) + ' Hz';
  }

  function formatSynthNoteRatioLabel(ratio) {
    const value = normalizeSynthNoteRatio(ratio == null ? 1 : ratio);
    return value >= 1 ? '×' + value.toFixed(value % 1 ? 2 : 0) : value.toFixed(2) + '×';
  }

  function formatSynthNoteIntervalLabel(ratio) {
    const value = normalizeSynthNoteRatio(ratio == null ? 1 : ratio);
    const match = SYNTH_HARMONIC_INTERVAL_LABELS.find(([knownRatio]) => Math.abs(knownRatio - value) < SYNTH_INTERVAL_RATIO_EPSILON);
    return match ? match[1] : formatSynthNoteRatioLabel(value);
  }

  function formatSynthNoteMarkerLabel(ratio) {
    return formatSynthNoteIntervalLabel(ratio);
  }

  function formatSynthNoteMarkerLabelWithPitch(ratio, rootHz) {
    const interval = formatSynthNoteIntervalLabel(ratio);
    const pitchHz = synthPitchForStep(rootHz, ratio);
    const noteName = hzToNoteName(pitchHz, false);
    return noteName + '·' + interval;
  }

  function abbreviateEngineId(engineId) {
    if (typeof engineId !== 'string' || !engineId) return '';
    const id = engineId.trim();
    if (!id) return '';
    if (ENGINE_DISPLAY_LABELS[id] !== undefined) return ENGINE_DISPLAY_LABELS[id];
    // Keep numeric engine ids as-is, abbreviate named ones to 3 chars
    if (/^\d+$/.test(id)) return id;
    return id.slice(0, 3).toUpperCase();
  }

  function formatSynthNoteStatusLabel(options) {
    const opts = options || {};
    const rawStep = Number.isInteger(opts.stepIndex) ? opts.stepIndex : 0;
    const step = clamp(rawStep, 0, STEP_COUNT - 1);
    const interval = formatSynthNoteIntervalLabel(opts.ratio);
    const ratio = formatSynthNoteRatioLabel(opts.ratio);
    const parts = ['STEP ' + String(step + 1).padStart(2, '0'), interval];
    if (interval !== ratio) parts.push(ratio);
    const root = formatHz(opts.rootHz);
    const pitch = formatHz(opts.pitchHz);
    if (root && pitch) parts.push('ROOT ' + root + ' → ' + pitch);
    else if (root) parts.push('ROOT ' + root);
    else if (pitch) parts.push(pitch);
    if (opts.engine) parts.push(opts.engine.toUpperCase());
    return parts.join(' · ');
  }

  function formatSynthNoteCompactStatusLabel(options) {
    const opts = options || {};
    const rawStep = Number.isInteger(opts.stepIndex) ? opts.stepIndex : 0;
    const step = clamp(rawStep, 0, STEP_COUNT - 1);
    const interval = formatSynthNoteIntervalLabel(opts.ratio);
    const parts = [String(step + 1).padStart(2, '0'), interval];
    if (Number.isFinite(opts.pitchHz)) {
      const noteName = hzToNoteName(opts.pitchHz, false);
      parts.push(noteName + ' ' + Math.round(opts.pitchHz) + ' Hz');
    }
    const engineAbbr = abbreviateEngineId(opts.engine);
    if (engineAbbr) parts.push(engineAbbr);
    return parts.join(' · ');
  }

  function findNextApprovedHarmonicRatio(ratio) {
    const value = normalizeSynthNoteRatio(ratio == null ? 1 : ratio);
    let currentIndex = SYNTH_HARMONIC_RATIOS.findIndex(r => Math.abs(r - value) < SYNTH_INTERVAL_RATIO_EPSILON);
    if (currentIndex < 0) currentIndex = SYNTH_HARMONIC_RATIOS.findIndex(r => r > value) - 1;
    const nextIndex = (Math.max(-1, currentIndex) + 1) % SYNTH_HARMONIC_RATIOS.length;
    return SYNTH_HARMONIC_RATIOS[nextIndex];
  }

  function findPreviousApprovedHarmonicRatio(ratio) {
    const value = normalizeSynthNoteRatio(ratio == null ? 1 : ratio);
    const exactIndex = SYNTH_HARMONIC_RATIOS.findIndex(r => Math.abs(r - value) < SYNTH_INTERVAL_RATIO_EPSILON);
    let prevIndex = exactIndex >= 0 ? exactIndex - 1 : -1;
    if (exactIndex < 0) {
      prevIndex = SYNTH_HARMONIC_RATIOS.findIndex(r => r >= value) - 1;
      if (prevIndex < -1) prevIndex = SYNTH_HARMONIC_RATIOS.length - 1;
    }
    const nextIndex = (prevIndex + SYNTH_HARMONIC_RATIOS.length) % SYNTH_HARMONIC_RATIOS.length;
    return SYNTH_HARMONIC_RATIOS[nextIndex];
  }

  function formatSynthNoteEditHintLabel(ratio, rootHz) {
    const previousRatio = findPreviousApprovedHarmonicRatio(ratio);
    const nextRatio = findNextApprovedHarmonicRatio(ratio);
    const previousInterval = formatSynthNoteIntervalLabel(previousRatio);
    const nextInterval = formatSynthNoteIntervalLabel(nextRatio);
    const root = rootHz || SYNTH_ROOT_MAX_HZ;
    const previousName = hzToNoteName(synthPitchForStep(root, previousRatio), false);
    const nextName = hzToNoteName(synthPitchForStep(root, nextRatio), false);
    return 'HARM ▼ ' + previousName + ' ' + previousInterval + ' · HARM ▲ ' + nextName + ' ' + nextInterval;
  }

  function createDefaultSynthNotesGrid() {
    return Array.from({ length: STEP_COUNT }, () => 1);
  }

  function createSynthNotesBanks() {
    return Array.from({ length: BANK_COUNT }, createDefaultSynthNotesGrid);
  }

  function cloneSynthNotesGrid(grid) {
    const clone = Array(STEP_COUNT).fill(1);
    if (!Array.isArray(grid)) return clone;
    for (let i = 0; i < Math.min(STEP_COUNT, grid.length); i++) {
      if (typeof grid[i] === 'number' && Number.isFinite(grid[i])) clone[i] = normalizeSynthNoteRatio(grid[i]);
    }
    return clone;
  }

  function cloneSynthNotesBanks(banks) {
    const clone = createSynthNotesBanks();
    if (!Array.isArray(banks)) return clone;
    for (let i = 0; i < Math.min(BANK_COUNT, banks.length); i++) clone[i] = cloneSynthNotesGrid(banks[i]);
    return clone;
  }

  function getSynthNoteRatio(grid, stepIndex) {
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= STEP_COUNT) {
      throw new Error('Step index must be an integer from 0 to 15');
    }
    const value = Array.isArray(grid) ? grid[stepIndex] : 1;
    return normalizeSynthNoteRatio(value == null ? 1 : value);
  }

  function setSynthNoteRatio(grid, stepIndex, ratio) {
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= STEP_COUNT) {
      throw new Error('Step index must be an integer from 0 to 15');
    }
    const next = cloneSynthNotesGrid(grid);
    next[stepIndex] = normalizeSynthNoteRatio(ratio);
    return next;
  }

  function resetSynthNoteStepToRoot(grid, stepIndex) {
    return setSynthNoteRatio(grid, stepIndex, 1);
  }

  function cycleSynthNoteRatio(grid, stepIndex) {
    return setSynthNoteRatio(grid, stepIndex, findNextApprovedHarmonicRatio(getSynthNoteRatio(grid, stepIndex)));
  }

  function cycleSynthNoteRatioBackward(grid, stepIndex) {
    return setSynthNoteRatio(grid, stepIndex, findPreviousApprovedHarmonicRatio(getSynthNoteRatio(grid, stepIndex)));
  }

  function synthPitchForStep(rootHz, ratio) {
    return clamp(finiteOr(rootHz, SYNTH_ROOT_MAX_HZ) * normalizeSynthNoteRatio(ratio == null ? 1 : ratio), SYNTH_MIN_HZ, SYNTH_MAX_FREQUENCY_HZ);
  }

  function randomHarmonicSynthNotes(grid, activeSteps) {
    const next = cloneSynthNotesGrid(grid);
    const steps = Array.isArray(activeSteps) && activeSteps.some(Boolean)
      ? activeSteps.map((active, i) => active ? i : -1).filter(i => i >= 0 && i < STEP_COUNT)
      : Array.from({ length: STEP_COUNT }, (_, i) => i);
    steps.forEach(step => {
      next[step] = randomHarmonicRatio();
    });
    return next;
  }

  function randomHarmonicSynthNoteStep(grid, stepIndex, rng) {
    return setSynthNoteRatio(grid, stepIndex, randomHarmonicRatio(rng));
  }

  const api = {
    SYNTH_MIN_HZ,
    SYNTH_MAX_FREQUENCY_HZ,
    SYNTH_MAX_HARMONIC_RATIO,
    SYNTH_ROOT_MAX_HZ,
    SYNTH_MAX_HZ,
    SYNTH_HARMONIC_RATIOS,
    normalizeSynthNoteRatio,
    formatSynthNoteRatioLabel,
    formatSynthNoteIntervalLabel,
    formatSynthNoteMarkerLabel,
    formatSynthNoteMarkerLabelWithPitch,
    formatSynthNoteStatusLabel,
    formatSynthNoteCompactStatusLabel,
    abbreviateEngineId,
    ENGINE_DISPLAY_LABELS,
    formatSynthNoteEditHintLabel,
    createDefaultSynthNotesGrid,
    createSynthNotesBanks,
    cloneSynthNotesGrid,
    cloneSynthNotesBanks,
    getSynthNoteRatio,
    setSynthNoteRatio,
    resetSynthNoteStepToRoot,
    cycleSynthNoteRatio,
    cycleSynthNoteRatioBackward,
    synthPitchForStep,
    randomHarmonicSynthNoteStep,
    randomHarmonicSynthNotes,
    // Note name / pitch display utilities
    NOTE_NAMES,
    NOTE_NAMES_24,
    hzToMidi,
    midiToHz,
    hzToNoteName,
    noteNameToHz,
    formatSynthNotePitchDisplay,
    noteOptionsForRange,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
