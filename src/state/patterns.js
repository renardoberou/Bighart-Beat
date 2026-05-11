'use strict';

(function (root) {
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

  const api = { createDefaultGrid, createPatternBanks };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
