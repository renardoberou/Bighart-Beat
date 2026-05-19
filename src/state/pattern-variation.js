'use strict';

(function (root) {
  const FALLBACK_TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether', 'synth'];
  const STEP_COUNT = 16;
  const BANK_COUNT = 4;

  function getOps() {
    if (root && root.BighartBeatState) return root.BighartBeatState;
    if (typeof require === 'function') return require('./pattern-operations.js');
    return null;
  }

  function trackIds() {
    const ops = getOps();
    return ops && Array.isArray(ops.TRACK_IDS) ? ops.TRACK_IDS : FALLBACK_TRACK_IDS;
  }

  function assertBankIndex(index, label) {
    if (!Number.isInteger(index) || index < 0 || index >= BANK_COUNT) {
      throw new Error(label + ' pattern index must be an integer from 0 to 3');
    }
  }

  function assertDifferentBanks(sourceIndex, targetIndex) {
    if (sourceIndex === targetIndex) {
      throw new Error('Controlled variation source and target pattern must not be the same');
    }
  }

  function assertKnownTrack(trackId) {
    if (!trackIds().includes(trackId)) throw new Error('Unknown track id: ' + trackId);
  }

  function assertStepIndex(stepIndex) {
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= STEP_COUNT) {
      throw new Error('Step index must be an integer from 0 to 15');
    }
  }

  function assertRatchetCount(count) {
    if (count !== 1 && count !== 2 && count !== 3) {
      throw new Error('Ratchet count must be integer 1, 2, or 3');
    }
  }

  function assertHihatOpenness(value) {
    if (value !== 0 && value !== 0.45 && value !== 1) {
      throw new Error('Hihat openness must be exactly 0, 0.45, or 1');
    }
  }

  function clonePatternGrid(grid) {
    const ops = getOps();
    if (ops && typeof ops.clonePatternGrid === 'function') return ops.clonePatternGrid(grid);
    const clone = {};
    trackIds().forEach(id => {
      const steps = grid && Array.isArray(grid[id]) ? grid[id] : [];
      clone[id] = steps.slice(0, STEP_COUNT);
      while (clone[id].length < STEP_COUNT) clone[id].push(0);
    });
    return clone;
  }

  function cloneRatchetGrid(grid) {
    const ops = getOps();
    if (ops && typeof ops.cloneRatchetGrid === 'function') return ops.cloneRatchetGrid(grid);
    const clone = {};
    trackIds().forEach(id => {
      clone[id] = Array(STEP_COUNT).fill(1);
      const steps = grid && Array.isArray(grid[id]) ? grid[id] : [];
      for (let i = 0; i < Math.min(STEP_COUNT, steps.length); i++) {
        if (steps[i] === 1 || steps[i] === 2 || steps[i] === 3) clone[id][i] = steps[i];
      }
    });
    return clone;
  }

  function cloneHihatOpennessGrid(grid) {
    const ops = getOps();
    if (ops && typeof ops.cloneHihatOpennessGrid === 'function') return ops.cloneHihatOpennessGrid(grid);
    const clone = Array(STEP_COUNT).fill(0);
    if (!Array.isArray(grid)) return clone;
    for (let i = 0; i < Math.min(STEP_COUNT, grid.length); i++) {
      if (grid[i] === 0 || grid[i] === 0.45 || grid[i] === 1) clone[i] = grid[i];
    }
    return clone;
  }

  function cloneBanks(banks, cloneGrid, fallbackGrid) {
    const next = Array.isArray(banks) ? banks.slice(0, BANK_COUNT) : [];
    while (next.length < BANK_COUNT) next.push(fallbackGrid());
    for (let i = 0; i < BANK_COUNT; i++) next[i] = cloneGrid(next[i]);
    return next;
  }

  function emptyPatternGrid() {
    const grid = {};
    trackIds().forEach(id => { grid[id] = Array(STEP_COUNT).fill(0); });
    return grid;
  }

  function emptyRatchetGrid() {
    const grid = {};
    trackIds().forEach(id => { grid[id] = Array(STEP_COUNT).fill(1); });
    return grid;
  }

  function emptyHihatOpennessGrid() {
    return Array(STEP_COUNT).fill(0);
  }

  function validateEdit(edit) {
    if (!edit || typeof edit !== 'object') throw new Error('Controlled variation edit is required');
    assertKnownTrack(edit.trackId);
    assertStepIndex(edit.stepIndex);
    if (edit.active !== 0 && edit.active !== 1 && edit.active !== false && edit.active !== true) {
      throw new Error('Controlled variation edit active must be 0/1 or boolean');
    }
    if (edit.ratchet !== undefined) assertRatchetCount(edit.ratchet);
    if (edit.hihatOpen !== undefined) {
      if (edit.trackId !== 'hihat') throw new Error('Hihat openness can only be applied to the hihat track');
      assertHihatOpenness(edit.hihatOpen);
    }
  }

  function hitAt(pattern, trackId, stepIndex) {
    return !!(pattern && pattern[trackId] && pattern[trackId][stepIndex]);
  }

  function resolvePredictiveTimingEdit(analysis, pattern) {
    const timing = analysis && analysis.predictiveTiming ? analysis.predictiveTiming : {};
    const bias = timing.timingBias;
    if (bias !== 'early' && bias !== 'late') return null;

    const expected = [
      { trackId: 'kick', stepIndex: 0 },
      { trackId: 'kick', stepIndex: 4 },
      { trackId: 'kick', stepIndex: 8 },
      { trackId: 'kick', stepIndex: 12 },
      { trackId: 'snare', stepIndex: 4, altTrackId: 'clap' },
      { trackId: 'snare', stepIndex: 12, altTrackId: 'clap' },
    ];
    const offset = bias === 'early' ? STEP_COUNT - 1 : 1;
    for (const slot of expected) {
      const stepIndex = slot.stepIndex;
      if (hitAt(pattern, slot.trackId, stepIndex) || (slot.altTrackId && hitAt(pattern, slot.altTrackId, stepIndex))) continue;
      const displacedStep = (stepIndex + offset) % STEP_COUNT;
      if (hitAt(pattern, slot.trackId, displacedStep)) {
        return { trackId: slot.trackId, stepIndex, active: 1 };
      }
      if (slot.altTrackId && hitAt(pattern, slot.altTrackId, displacedStep)) {
        return { trackId: slot.altTrackId, stepIndex, active: 1 };
      }
    }
    return null;
  }

  function resolveRhythmMutationAction(input) {
    const opts = input || {};
    const analysis = opts.analysis || {};
    const labels = analysis.labels || {};
    const pattern = opts.pattern || {};

    const timingEdit = resolvePredictiveTimingEdit(analysis, pattern);
    if (timingEdit) {
      return {
        reason: 'FIX TIMING',
        edit: timingEdit,
      };
    }

    if (labels.anchor === 'locked') {
      const cognitiveLoad = analysis.cognitiveLoad || {};
      if (labels.drive === 'flat' && cognitiveLoad.value === 'CLEAR') {
        const liftStep = [15, 14, 11, 7].find(step => !hitAt(pattern, 'hihat', step));
        if (liftStep !== undefined) {
          return {
            reason: 'HAT LIFT',
            edit: {
              trackId: 'hihat',
              stepIndex: liftStep,
              active: 1,
              hihatOpen: 1,
            },
          };
        }
      }
      return null;
    }
    if (labels.anchor === 'lost' || labels.anchor === 'wobbly' || labels.sync === 'broken') {
      const stepIndex = [0, 8, 4, 12].find(step => !hitAt(pattern, 'kick', step));
      if (stepIndex !== undefined) {
        return {
          reason: 'ADD ANCHOR',
          edit: {
            trackId: 'kick',
            stepIndex,
            active: 1,
          },
        };
      }
      const hihatStep = [1, 3, 5, 7, 9, 11, 13, 15].find(step => hitAt(pattern, 'hihat', step));
      if (hihatStep !== undefined) {
        return {
          reason: 'CLEAR SPACE',
          edit: {
            trackId: 'hihat',
            stepIndex: hihatStep,
            active: 0,
          },
        };
      }
    }

    return null;
  }

  function applyControlledPatternVariation(input) {
    const opts = input || {};
    assertBankIndex(opts.sourceIndex, 'Source');
    assertBankIndex(opts.targetIndex, 'Target');
    assertDifferentBanks(opts.sourceIndex, opts.targetIndex);
    validateEdit(opts.edit);

    const nextPatterns = cloneBanks(opts.patterns, clonePatternGrid, emptyPatternGrid);
    const nextRatchets = cloneBanks(opts.ratchets, cloneRatchetGrid, emptyRatchetGrid);
    const nextHihatOpenness = cloneBanks(opts.hihatOpenness, cloneHihatOpennessGrid, emptyHihatOpennessGrid);
    const targetPattern = clonePatternGrid(nextPatterns[opts.sourceIndex]);
    const targetRatchets = cloneRatchetGrid(nextRatchets[opts.sourceIndex]);
    const targetHihatOpen = cloneHihatOpennessGrid(nextHihatOpenness[opts.sourceIndex]);
    const edit = opts.edit;
    const active = edit.active === true || edit.active === 1 ? 1 : 0;

    targetPattern[edit.trackId][edit.stepIndex] = active;
    targetRatchets[edit.trackId][edit.stepIndex] = active ? (edit.ratchet || 1) : 1;
    if (edit.trackId === 'hihat') {
      targetHihatOpen[edit.stepIndex] = active ? (edit.hihatOpen || 0) : 0;
    }

    nextPatterns[opts.targetIndex] = targetPattern;
    nextRatchets[opts.targetIndex] = targetRatchets;
    nextHihatOpenness[opts.targetIndex] = targetHihatOpen;

    return {
      patterns: nextPatterns,
      ratchets: nextRatchets,
      hihatOpenness: nextHihatOpenness,
      targetIndex: opts.targetIndex,
    };
  }

  const api = { applyControlledPatternVariation, resolveRhythmMutationAction };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
