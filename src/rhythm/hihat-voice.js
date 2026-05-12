'use strict';

(function (root) {
  const HIHAT_ENGINE_PROFILES = {
    '808': {
      noise: 0.78,
      tone: 0.12,
      bright: 0.82,
      decay: 1.05,
      ratios: [2.00, 2.74, 3.00, 4.17, 4.36, 6.42],
      oscType: 'square',
      instability: 0,
      glitchChance: 0,
      chokeClosedTau: 0.018,
      chokeOpenTau: 0.060,
    },
    '909': {
      noise: 1.08,
      tone: 0.20,
      bright: 1.24,
      decay: 0.86,
      ratios: [2.00, 2.33, 3.01, 3.88, 4.61, 5.97],
      oscType: 'square',
      instability: 0.01,
      glitchChance: 0,
      chokeClosedTau: 0.014,
      chokeOpenTau: 0.050,
    },
    reznor: {
      noise: 1.18,
      tone: 0.30,
      bright: 0.72,
      decay: 1.18,
      ratios: [1.41, 1.93, 2.79, 3.76, 5.11, 7.23],
      oscType: 'sawtooth',
      instability: 0.025,
      glitchChance: 0.10,
      chokeClosedTau: 0.012,
      chokeOpenTau: 0.070,
    },
    aphex: {
      noise: 0.96,
      tone: 0.44,
      bright: 1.34,
      decay: 0.92,
      ratios: [1.00, 1.618, 2.414, 3.732, 5.387, 8.09],
      oscType: 'triangle',
      instability: 0.045,
      glitchChance: 0.22,
      chokeClosedTau: 0.010,
      chokeOpenTau: 0.085,
    },
  };

  function finiteOr(v, fallback) {
    return Number.isFinite(v) ? v : fallback;
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, finiteOr(v, lo)));
  }

  function rand01(rand) {
    const value = typeof rand === 'function' ? rand() : Math.random();
    return clamp(value, 0, 1);
  }

  function jitter(rand, amount) {
    const safeAmount = clamp(amount, 0, 0.25);
    return 1 + (rand01(rand) * 2 - 1) * safeAmount;
  }

  function resolveHihatVoiceSpec(engineId, params, rand) {
    const requestedEngine = typeof engineId === 'string' ? engineId : '';
    const profile = HIHAT_ENGINE_PROFILES[requestedEngine] || HIHAT_ENGINE_PROFILES.aphex;
    const engine = HIHAT_ENGINE_PROFILES[requestedEngine] ? requestedEngine : 'aphex';
    const p = params || {};
    const freq = clamp(finiteOr(p.freq, 9000), 4000, 14000);
    const requestedDecay = clamp(finiteOr(p.decay, 0.04), 0.002, 0.40);
    const open = clamp(finiteOr(p.open, 0), 0, 1);
    const metal = clamp(finiteOr(p.metal, 0), 0, 1);
    const instability = clamp(profile.instability || 0, 0, 0.08);
    const opennessTail = open > 0 ? open * 0.10 + open * open * 0.37 : 0;
    const openBoost = requestedDecay + opennessTail;
    const decaySec = clamp(openBoost * profile.decay * jitter(rand, instability), 0.006, 0.70);
    const highpassHz = clamp(freq * profile.bright * jitter(rand, instability), 2500, 17000);
    const bandpassHz = clamp(10500 * profile.bright * jitter(rand, instability), 4500, 18000);
    const bandpassQ = clamp(0.7 + instability * 8, 0.5, 2.5);
    const noiseLevel = clamp(0.42 * profile.noise * jitter(rand, instability * 0.6), 0, 0.72);
    const metalLevel = clamp(metal * (0.14 + profile.tone * 0.18), 0, 0.34);
    const ratios = profile.ratios.slice(0, 6).map(r => clamp(r, 0.1, 12));
    const oscillatorFrequencies = ratios.map(r => clamp(205 * r * profile.bright * jitter(rand, instability), 80, 18000));
    const glitchChance = clamp(profile.glitchChance || 0, 0, 0.30);
    const glitchWillFire = glitchChance > 0 && rand01(rand) < glitchChance;
    const glitchBandpassHz = clamp(7000 * jitter(rand, 0.4), 3500, 14000);

    return {
      engine,
      requestedEngine: requestedEngine || engine,
      fallbackEngine: engine !== requestedEngine,
      noiseGain: noiseLevel,
      metalGain: metalLevel,
      noiseLevel,
      metalLevel,
      highpassHz,
      bandpassHz,
      bandpassQ,
      decaySec,
      oscType: profile.oscType,
      ratios,
      oscillatorFrequencies,
      oscillatorGain: ratios.length ? 0.5 / ratios.length : 0,
      glitchChance,
      glitchWillFire,
      glitchBandpassHz,
      glitchGain: clamp(glitchChance * 0.16, 0, 0.06),
      chokeClosedTau: clamp(profile.chokeClosedTau, 0.001, 0.099),
      chokeOpenTau: clamp(Math.max(profile.chokeOpenTau, profile.chokeClosedTau + 0.001), 0.002, 0.10),
      metalHighpassHz: clamp(freq * 0.85 * profile.bright, 2200, 17000),
    };
  }

  const api = { resolveHihatVoiceSpec, HIHAT_ENGINE_PROFILES };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatHihat = Object.assign(root.BighartBeatHihat || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
