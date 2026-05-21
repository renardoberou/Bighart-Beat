'use strict';

(function (root) {
  const TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether', 'synth'];
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
      synth: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
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

  function isAllowedHihatOpenness(value) {
    return value === 0 || value === 0.45 || value === 1;
  }

  function createDefaultHihatOpennessGrid() {
    return Array(STEP_COUNT).fill(0);
  }

  function createDefaultHihatAccentGrid() {
    return Array(STEP_COUNT).fill(0);
  }

  function createHihatOpennessBanks() {
    return Array.from({ length: BANK_COUNT }, createDefaultHihatOpennessGrid);
  }

  function createHihatAccentBanks() {
    return Array.from({ length: BANK_COUNT }, createDefaultHihatAccentGrid);
  }

  function cloneHihatOpennessGrid(opennessGrid) {
    const clone = createDefaultHihatOpennessGrid();
    if (!Array.isArray(opennessGrid)) return clone;
    for (let i = 0; i < Math.min(STEP_COUNT, opennessGrid.length); i++) {
      if (isAllowedHihatOpenness(opennessGrid[i])) clone[i] = opennessGrid[i];
    }
    return clone;
  }

  function isAccentOn(value) {
    return value === 1 || value === true || value === '1' || value === 'ACC' || value === 'acc';
  }

  function cloneHihatAccentGrid(accentGrid) {
    const clone = createDefaultHihatAccentGrid();
    if (!Array.isArray(accentGrid)) return clone;
    for (let i = 0; i < Math.min(STEP_COUNT, accentGrid.length); i++) {
      clone[i] = isAccentOn(accentGrid[i]) ? 1 : 0;
    }
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

  const api = {
    createDefaultGrid,
    createPatternBanks,
    createDefaultRatchetGrid,
    createRatchetBanks,
    cloneRatchetGrid,
    createDefaultHihatOpennessGrid,
    createHihatOpennessBanks,
    cloneHihatOpennessGrid,
    createDefaultHihatAccentGrid,
    createHihatAccentBanks,
    cloneHihatAccentGrid,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
