'use strict';

(function (root) {
  function createAppState() {
    return {
      bpm: 120,
      swing: 0,
      playing: false,
      patt: 0,
      sel: 0,
      engine: 'aphex',
      mstVol: .72,
      patternChain: getDefaultPatternChain(),
    };
  }

  function getDefaultPatternChain() {
    if (root && root.BighartBeatState && typeof root.BighartBeatState.createDefaultPatternChain === 'function') {
      return root.BighartBeatState.createDefaultPatternChain();
    }
    if (typeof require === 'function') {
      return require('./pattern-chain.js').createDefaultPatternChain();
    }
    return {
      enabled: false,
      position: 0,
      barCount: 0,
      items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 0, bars: 1 }],
    };
  }

  const api = { createAppState };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
