'use strict';

(function (root) {
  const TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether'];
  const STEP_COUNT = 16;
  const BANK_COUNT = 4;

  function createDefaultGrid() {
    return {
      kick:  [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
      snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
      hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
      clap:  [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
      input: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      ether: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    };
  }

  function createPatternBanks() {
    return [createDefaultGrid(), createDefaultGrid(), createDefaultGrid(), createDefaultGrid()];
  }

  function createDefaultRatchetGrid() {
    const grid = {};
    TRACK_IDS.forEach(id => { grid[id] = Array(STEP_COUNT).fill(1); });
    return grid;
  }

  function createRatchetBanks() {
    return Array.from({ length: BANK_COUNT }, createDefaultRatchetGrid);
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

  const api = {
    createDefaultGrid,
    createPatternBanks,
    createDefaultRatchetGrid,
    createRatchetBanks,
    cloneRatchetGrid,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
