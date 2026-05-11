'use strict';

(function (root) {
  function createAppState() {
    return {
      bpm: 120,
      playing: false,
      patt: 0,
      sel: 0,
      mstVol: .72,
    };
  }

  const api = { createAppState };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
