'use strict';

(function (root) {
  const STEP_COUNT = 16;
  const BANK_COUNT = 4;
  const SYNTH_MIN_HZ = 40;
  const SYNTH_MAX_HZ = 3000;
  const SYNTH_HARMONIC_RATIOS = [0.5, 0.75, 1, 1.25, 4 / 3, 1.5, 5 / 3, 2, 2.5, 3, 4];
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
    return parts.join(' · ');
  }

  function createDefaultSynthNotesGrid() {
    return Array.from({ length: STEP_COUNT }, randomHarmonicRatio);
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

  function cycleSynthNoteRatio(grid, stepIndex) {
    const current = getSynthNoteRatio(grid, stepIndex);
    let currentIndex = SYNTH_HARMONIC_RATIOS.findIndex(r => Math.abs(r - current) < 0.001);
    if (currentIndex < 0) currentIndex = SYNTH_HARMONIC_RATIOS.findIndex(r => r > current) - 1;
    const nextIndex = (Math.max(-1, currentIndex) + 1) % SYNTH_HARMONIC_RATIOS.length;
    return setSynthNoteRatio(grid, stepIndex, SYNTH_HARMONIC_RATIOS[nextIndex]);
  }

  function synthPitchForStep(rootHz, ratio) {
    return clamp(finiteOr(rootHz, 220) * normalizeSynthNoteRatio(ratio == null ? 1 : ratio), SYNTH_MIN_HZ, SYNTH_MAX_HZ);
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
    SYNTH_MAX_HZ,
    SYNTH_HARMONIC_RATIOS,
    normalizeSynthNoteRatio,
    formatSynthNoteRatioLabel,
    formatSynthNoteIntervalLabel,
    formatSynthNoteMarkerLabel,
    formatSynthNoteStatusLabel,
    createDefaultSynthNotesGrid,
    createSynthNotesBanks,
    cloneSynthNotesGrid,
    cloneSynthNotesBanks,
    getSynthNoteRatio,
    setSynthNoteRatio,
    cycleSynthNoteRatio,
    synthPitchForStep,
    randomHarmonicSynthNoteStep,
    randomHarmonicSynthNotes,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
