'use strict';

(function (root) {
  const sharedEngineProfiles = root && root.BighartBeatEngineProfiles
    ? root.BighartBeatEngineProfiles
    : (typeof require === 'function' ? require('./engine-profiles.js') : null);
  const ENGINE_PROFILES = sharedEngineProfiles.ENGINE_PROFILES;

  function finiteOr(v, fallback) {
    return Number.isFinite(v) ? v : fallback;
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, finiteOr(v, lo)));
  }

  function resolveSnareVoiceSpec(engineId, params, velocity) {
    const requestedEngine = typeof engineId === 'string' ? engineId : '';
    const fullProfile = ENGINE_PROFILES[requestedEngine] || ENGINE_PROFILES.aphex;
    const engine = ENGINE_PROFILES[requestedEngine] ? requestedEngine : 'aphex';
    const profile = fullProfile.snare;
    const p = params || {};
    const v = clamp(finiteOr(velocity, 1), 0, 1);
    const isReznor = engine === 'reznor';

    const tone = clamp(finiteOr(p.tone, 180), 60, 900);
    const body = clamp(finiteOr(p.body, 0.72), 0, 1);
    const snap = clamp(finiteOr(p.snap, 0.82), 0, 1);
    const decay = clamp(finiteOr(p.decay, 0.22), 0.035, 0.75);
    const toneMul = clamp(profile.tone, 0.55, 1.55);
    const noiseMul = clamp(profile.noise, 0.55, 1.4);
    const bodyMul = clamp(profile.body, 0.45, 1.25);
    const snapMul = clamp(profile.snap, 0.55, 1.55);

    const noiseDecaySec = clamp(decay, 0.035, 0.75);
    const shellDecaySec = clamp(decay * 0.45 * (0.85 + bodyMul * 0.15), 0.018, 0.45);
    const crackDecaySec = clamp(0.012 * (0.9 + snapMul * 0.08), 0.006, 0.04);

    const outputTrim = clamp(profile.outputTrim, 0.70, 1.00);

    return {
      engine,
      requestedEngine: requestedEngine || engine,
      fallbackEngine: engine !== requestedEngine,
      noiseBandpassHz: clamp(2200 * toneMul, 900, 6500),
      noiseHighpassHz: clamp(800 * toneMul, 300, 3000),
      noisePeakGain: clamp(v * 0.58 * noiseMul * outputTrim, 0, 0.75),
      noiseDecaySec,
      shellFundHz: clamp(tone * toneMul, 60, 900),
      shellOvertoneHz: clamp(tone * 1.5 * toneMul, 90, 1400),
      shellPeakGain: clamp(v * body * 0.68 * bodyMul * outputTrim, 0, 0.75),
      shellDecaySec,
      crackHighpassHz: clamp(4500 * toneMul, 2500, 9500),
      crackPeakGain: clamp(v * snap * 0.55 * snapMul * outputTrim, 0, 0.75),
      crackDecaySec,
      noiseStopSec: clamp(noiseDecaySec + 0.04, 0.04, 0.85),
      shellStopSec: clamp(shellDecaySec + 0.033, 0.02, 0.5),
      crackStopSec: clamp(crackDecaySec + 0.008, 0.01, 0.055),
      outputTrim,
      digitalCrackGain: clamp(
        (engine === 'aphex'
          ? clamp(0.18 * snapMul * outputTrim, 0, 0.42)
          : (isReznor ? clamp(0.06 * snapMul * outputTrim, 0, 0.28) : 0)) * v,
        0, 0.42
      ),
      digitalCrackHz: engine === 'aphex'
        ? clamp(3200 * toneMul, 2000, 8000)
        : clamp(2200 * toneMul, 1500, 6000),
    };
  }

  const api = { resolveSnareVoiceSpec };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatSnare = Object.assign(root.BighartBeatSnare || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
