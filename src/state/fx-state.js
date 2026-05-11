'use strict';

(function (root) {
  function createDefaultFxState() {
    return {
      dly: { on:false, mult:0.75, fb:.32, tone:.55, wet:.26 }, // mult = of a beat (16th = 0.25)
      rev: { on:false, size:.60, damp:.55, gate:180, wet:.28 },
    };
  }

  const api = { createDefaultFxState };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
