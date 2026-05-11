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

  function createEmptyGrid() {
    const grid = {};
    TRACK_IDS.forEach(id => { grid[id] = Array(STEP_COUNT).fill(0); });
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

  function toggleStep(grid, trackId, stepIndex) {
    assertKnownTrack(trackId);
    assertStepIndex(stepIndex);
    const next = clonePatternGrid(grid);
    next[trackId][stepIndex] = next[trackId][stepIndex] ? 0 : 1;
    return next;
  }

  function clearPattern() {
    return createEmptyGrid();
  }

  const api = {
    TRACK_IDS,
    STEP_COUNT,
    createEmptyGrid,
    clonePatternGrid,
    toggleStep,
    clearPattern,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
