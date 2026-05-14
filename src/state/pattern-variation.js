'use strict';

(function (root) {
  const FALLBACK_TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether'];
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

  const api = { applyControlledPatternVariation };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
