'use strict';

(function (root) {
  const sharedEngineProfiles = root && root.BighartBeatEngineProfiles
    ? root.BighartBeatEngineProfiles
    : (typeof require === 'function' ? require('./engine-profiles.js') : null);
  const HIHAT_ENGINE_PROFILES = sharedEngineProfiles.HIHAT_ENGINE_PROFILES;

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

  function smoothstep01(value) {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  }

  function calculateHihatChokeTau(openAmount, previousOpenAmount, spec) {
    const s = spec || {};
    const closedTau = clamp(finiteOr(s.chokeClosedTau, 0.014), 0.001, 0.099);
    const openTau = clamp(Math.max(finiteOr(s.chokeOpenTau, 0.050), closedTau + 0.001), 0.002, 0.10);
    const openness = smoothstep01(openAmount);
    const previousOpenness = smoothstep01(previousOpenAmount);
    const interpolatedTau = closedTau + (openTau - closedTau) * openness;
    const openTransitionSoftness = 0.75 + previousOpenness * 0.25;
    return clamp(closedTau + (interpolatedTau - closedTau) * openTransitionSoftness, closedTau, openTau);
  }

  function resolveHihatVoiceSpec(engineId, params, rand, velocityOrAccent) {
    const requestedEngine = typeof engineId === 'string' ? engineId : '';
    const profile = HIHAT_ENGINE_PROFILES[requestedEngine] || HIHAT_ENGINE_PROFILES.aphex;
    const engine = HIHAT_ENGINE_PROFILES[requestedEngine] ? requestedEngine : 'aphex';
    const p = params || {};
    const freq = clamp(finiteOr(p.freq, 9000), 4000, 14000);
    const requestedDecay = clamp(finiteOr(p.decay, 0.04), 0.002, 0.40);
    const open = clamp(finiteOr(p.open, 0), 0, 1);
    const metal = clamp(finiteOr(p.metal, 0), 0, 1);
    const velocity = clamp(finiteOr(velocityOrAccent, finiteOr(p.velocity, finiteOr(p.accent, 0.75))), 0, 1);
    const softHit = clamp((0.75 - velocity) / 0.75, 0, 1);
    const accentedHit = clamp((velocity - 0.75) / 0.25, 0, 1);
    const instability = clamp(profile.instability || 0, 0, 0.08);
    const characterTransient = clamp(finiteOr(profile.transient, 1), 0.88, 1.12);
    const characterTailDamp = clamp(finiteOr(profile.tailDamp, 1), 0.82, 1.16);
    const characterAirDamp = clamp(finiteOr(profile.airDamp, 1), 0.84, 1.18);
    const characterTrim = clamp(finiteOr(profile.trim, 1), 0.82, 1);
    const opennessTail = open > 0 ? open * 0.10 + open * open * 0.37 : 0;
    const openBoost = requestedDecay + opennessTail;
    const decaySec = clamp(openBoost * profile.decay * jitter(rand, instability), 0.006, 0.70);
    const highpassHz = clamp(freq * profile.bright * jitter(rand, instability), 2500, 17000);
    const bandpassHz = clamp(10500 * profile.bright * jitter(rand, instability), 4500, 18000);
    const bandpassQ = clamp(0.7 + instability * 8, 0.5, 2.5);
    const noiseLevel = clamp(0.42 * profile.noise * (1 - softHit * 0.05) * jitter(rand, instability * 0.6), 0, 0.72);
    const metalLevel = clamp(metal * (0.14 + profile.tone * 0.18), 0, 0.34);
    const ratios = profile.ratios.slice(0, 6).map(r => clamp(r, 0.1, 12));
    const oscillatorFrequencies = ratios.map(r => clamp(205 * r * profile.bright * jitter(rand, instability), 80, 18000));
    const glitchChance = clamp(profile.glitchChance || 0, 0, 0.30);
    const glitchWillFire = glitchChance > 0 && rand01(rand) < glitchChance;
    const glitchBandpassHz = clamp(7000 * jitter(rand, 0.4), 3500, 14000);
    const attackSec = clamp(0.0009 + open * 0.0024 + instability * 0.004, 0.0008, 0.004);
    const accentedOpenTailTighten = accentedHit * smoothstep01(open);
    const tailReleaseTau = clamp((0.014 + open * 0.062 + open * open * 0.036 + instability * 0.20) * (1 - accentedOpenTailTighten * 0.10), 0.010, 0.16);
    const openTailDamp = clamp(1 - open * 0.10 - open * open * 0.16, 0.68, 1);
    const tailHeadroomTrim = clamp(1 - open * 0.08 - open * open * 0.14 - accentedHit * 0.03, 0.70, 1);
    const velocityTail = 1 - softHit * 0.12 - accentedOpenTailTighten * 0.08;
    const noiseTailSec = clamp(decaySec * characterTailDamp * (1 + open * 0.08) * velocityTail, 0.006, 0.70);
    const metalTailSec = clamp(decaySec * characterTailDamp * (0.72 + open * 0.08) * velocityTail, 0.004, 0.56);
    const transientGain = clamp((1.12 - open * 0.18 + profile.tone * 0.025) * characterTransient * (1 - softHit * 0.08 + accentedHit * 0.05), 0.8, 1.18);
    const outputTrim = clamp((1 - open * 0.10 - open * open * 0.16 - instability * 0.20 - accentedHit * 0.08) * characterTrim, 0.62, 1);
    const airLowpassHz = clamp(freq * profile.bright * characterAirDamp * (1.35 - open * 0.22) * (1 - softHit * 0.08 + accentedHit * 0.04), 8500, 18000);
    const airLowpassQ = clamp(0.45 + instability * 2, 0.2, 0.9);

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
      attackSec,
      noiseTailSec,
      metalTailSec,
      tailReleaseTau,
      openTailDamp,
      tailHeadroomTrim,
      transientGain,
      outputTrim,
      airLowpassHz,
      airLowpassQ,
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

  const api = { resolveHihatVoiceSpec, calculateHihatChokeTau, HIHAT_ENGINE_PROFILES };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatHihat = Object.assign(root.BighartBeatHihat || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
