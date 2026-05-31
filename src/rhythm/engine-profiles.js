'use strict';

(function (root) {
  const ENGINE_PROFILES = {
    '808': {
      kick: { pitch: 0.92, decay: 1.18, click: 0.62, clickHp: 0.85, drive: 0.62, body: 1.00, sub: 1.05, outputTrim: 1.00 },
      snare: { tone: 0.88, noise: 0.82, body: 1.15, snap: 0.75, outputTrim: 1.00 },
      clap: { tone: 0.86, decay: 1.18, spread: 1.12, body: 0.88, tail: 0.82, snap: 0.95, highpass: 0.88, q: 0.92, jitter: 0.45, panWidth: 0.18, panAsym: 0.00 },
      hihat: { noise: 0.84, tone: 0.18, bright: 0.90, decay: 1.15, transient: 0.98, tailDamp: 1.06, airDamp: 0.95, trim: 0.99, ratios: [2.00, 2.74, 3.00, 4.17, 4.36, 6.42], osc: 'square', instability: 0, glitch: 0, chokeClosed: 0.016, chokeOpen: 0.060 },
    },
    '909': {
      kick: { pitch: 1.06, decay: 0.86, click: 1.18, clickHp: 1.45, drive: 0.88, body: 0.82, sub: 0.72, outputTrim: 1.00 },
      snare: { tone: 1.12, noise: 1.12, body: 0.92, snap: 1.18, outputTrim: 0.95 },
      clap: { tone: 1.22, decay: 0.86, spread: 0.88, body: 1.0, tail: 0.92, snap: 1.12, highpass: 1.08, q: 1.08, jitter: 0.55, panWidth: 0.09, panAsym: 0.00 },
      hihat: { noise: 1.14, tone: 0.28, bright: 1.32, decay: 0.82, transient: 1.04, tailDamp: 0.94, airDamp: 1.06, trim: 1.00, ratios: [2.00, 2.33, 3.01, 3.88, 4.61, 5.97], osc: 'square', instability: 0.015, glitch: 0, chokeClosed: 0.014, chokeOpen: 0.044 },
    },
    reznor: {
      kick: { pitch: 0.82, decay: 0.95, click: 1.05, clickHp: 0.92, drive: 1.55, body: 1.05, sub: 0.85, outputTrim: 0.90 },
      snare: { tone: 0.72, noise: 1.28, body: 0.80, snap: 1.25, outputTrim: 0.86 },
      clap: { tone: 0.74, decay: 1.05, spread: 1.05, body: 1.14, tail: 1.18, snap: 1.0, highpass: 0.72, q: 1.28, jitter: 1.0, panWidth: 0.12, panAsym: 0.03 },
      hihat: { noise: 1.28, tone: 0.38, bright: 0.64, decay: 1.28, transient: 0.96, tailDamp: 0.90, airDamp: 0.90, trim: 0.90, ratios: [1.41, 1.93, 2.79, 3.76, 5.11, 7.23], osc: 'sawtooth', instability: 0.025, glitch: 0.10, chokeClosed: 0.012, chokeOpen: 0.080 },
    },
    aphex: {
      // Inharmonic metallic hihat ratios + bounded instability + optional tiny glitch tick.
      kick: { pitch: 1.18, decay: 0.78, click: 1.35, clickHp: 2.35, drive: 1.10, body: 0.74, sub: 0.60, outputTrim: 0.92 },
      snare: { tone: 1.28, noise: 1.05, body: 0.74, snap: 1.45, outputTrim: 0.88 },
      clap: { tone: 1.34, decay: 0.78, spread: 0.62, body: 0.92, tail: 0.95, snap: 1.22, highpass: 1.18, q: 1.18, jitter: 1.55, panWidth: 0.07, panAsym: 0.00 },
      hihat: { noise: 0.96, tone: 0.44, bright: 1.42, decay: 0.85, transient: 1.02, tailDamp: 0.88, airDamp: 1.02, trim: 0.88, ratios: [1.00, 1.618, 2.414, 3.732, 5.387, 8.09], osc: 'triangle', instability: 0.055, glitch: 0.22, chokeClosed: 0.010, chokeOpen: 0.085 },
    },
  };

  function hihatProfileFromEngine(profile) {
    const hihat = profile.hihat;
    return {
      noise: hihat.noise,
      tone: hihat.tone,
      bright: hihat.bright,
      decay: hihat.decay,
      transient: hihat.transient,
      tailDamp: hihat.tailDamp,
      airDamp: hihat.airDamp,
      trim: hihat.trim,
      ratios: hihat.ratios.slice(),
      oscType: hihat.osc,
      instability: hihat.instability,
      glitchChance: hihat.glitch,
      chokeClosedTau: hihat.chokeClosed,
      chokeOpenTau: hihat.chokeOpen,
    };
  }

  const HIHAT_ENGINE_PROFILES = Object.keys(ENGINE_PROFILES).reduce((profiles, engine) => {
    profiles[engine] = hihatProfileFromEngine(ENGINE_PROFILES[engine]);
    return profiles;
  }, {});

  const api = { ENGINE_PROFILES, HIHAT_ENGINE_PROFILES };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatEngineProfiles = Object.assign(root.BighartBeatEngineProfiles || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
