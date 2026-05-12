'use strict';

(function (root) {
  const TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether'];
  const STEP_COUNT = 16;

  function assertKnownTrack(trackId) {
    if (!TRACK_IDS.includes(trackId)) throw new Error('Unknown track id: ' + trackId);
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

  function createEmptyGrid() {
    const grid = {};
    TRACK_IDS.forEach(id => { grid[id] = Array(STEP_COUNT).fill(0); });
    return grid;
  }

  function createDefaultRatchetGrid() {
    const grid = {};
    TRACK_IDS.forEach(id => { grid[id] = Array(STEP_COUNT).fill(1); });
    return grid;
  }

  function clonePatternGrid(grid) {
    const clone = {};
    TRACK_IDS.forEach(id => {
      assertKnownTrack(id);
      const steps = grid && grid[id];
      clone[id] = Array.isArray(steps) ? steps.slice(0, STEP_COUNT) : Array(STEP_COUNT).fill(0);
      while (clone[id].length < STEP_COUNT) clone[id].push(0);
    });
    return clone;
  }

  function cloneRatchetGrid(ratchetGrid) {
    const clone = createDefaultRatchetGrid();
    TRACK_IDS.forEach(id => {
      const steps = ratchetGrid && ratchetGrid[id];
      if (!Array.isArray(steps)) return;
      for (let i = 0; i < Math.min(STEP_COUNT, steps.length); i++) {
        if (steps[i] === 1 || steps[i] === 2 || steps[i] === 3) clone[id][i] = steps[i];
      }
    });
    return clone;
  }

  function getRatchetCount(ratchetGrid, trackId, stepIndex) {
    assertKnownTrack(trackId);
    assertStepIndex(stepIndex);
    const steps = ratchetGrid && ratchetGrid[trackId];
    const count = Array.isArray(steps) ? steps[stepIndex] : 1;
    return count === 2 || count === 3 ? count : 1;
  }

  function setRatchetCount(ratchetGrid, trackId, stepIndex, count) {
    assertKnownTrack(trackId);
    assertStepIndex(stepIndex);
    assertRatchetCount(count);
    const next = cloneRatchetGrid(ratchetGrid);
    next[trackId][stepIndex] = count;
    return next;
  }

  function cycleRatchetCount(ratchetGrid, trackId, stepIndex) {
    const current = getRatchetCount(ratchetGrid, trackId, stepIndex);
    return setRatchetCount(ratchetGrid, trackId, stepIndex, current === 3 ? 1 : current + 1);
  }

  function toggleStep(grid, trackId, stepIndex, ratchetGrid) {
    assertKnownTrack(trackId);
    assertStepIndex(stepIndex);
    const next = clonePatternGrid(grid);
    next[trackId][stepIndex] = next[trackId][stepIndex] ? 0 : 1;
    if (ratchetGrid !== undefined) {
      let nextRatchets = cloneRatchetGrid(ratchetGrid);
      if (!next[trackId][stepIndex]) nextRatchets = setRatchetCount(nextRatchets, trackId, stepIndex, 1);
      return { pattern: next, ratchets: nextRatchets };
    }
    return next;
  }

  function clearPattern(grid, ratchetGrid) {
    const pattern = createEmptyGrid();
    if (ratchetGrid !== undefined) return { pattern, ratchets: createDefaultRatchetGrid() };
    return pattern;
  }

  const api = {
    TRACK_IDS,
    STEP_COUNT,
    createEmptyGrid,
    createDefaultRatchetGrid,
    clonePatternGrid,
    cloneRatchetGrid,
    getRatchetCount,
    setRatchetCount,
    cycleRatchetCount,
    toggleStep,
    clearPattern,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
