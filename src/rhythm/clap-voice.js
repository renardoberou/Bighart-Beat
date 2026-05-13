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

  function resolveClapVoiceSpec(engineId, params, velocity) {
    const requestedEngine = typeof engineId === 'string' ? engineId : '';
    const fullProfile = ENGINE_PROFILES[requestedEngine] || ENGINE_PROFILES.aphex;
    const engine = ENGINE_PROFILES[requestedEngine] ? requestedEngine : 'aphex';
    const profile = fullProfile.clap;
    const p = params || {};
    const v = clamp(finiteOr(velocity, 1), 0, 1);

    const spreadMs = clamp(finiteOr(p.spread, 10), 0, 60);
    const decay = clamp(finiteOr(p.decay, 0.14), 0.035, 0.55);
    const tone = clamp(finiteOr(p.tone, 1700), 700, 6000);

    const spreadSec = clamp((spreadMs / 1000) * clamp(profile.spread, 0.45, 1.45), 0, 0.06);
    const tailDecaySec = clamp(decay * clamp(profile.decay, 0.65, 1.45), 0.035, 0.55);
    const toneHz = clamp(tone * clamp(profile.tone, 0.55, 1.65), 700, 6000);
    const toneJitterHz = clamp(280 * clamp(profile.jitter, 0, 2.5), 0, 700);
    const highpassHz = clamp(700 * clamp(profile.highpass, 0.45, 2.2), 300, 1800);
    const filterQ = clamp(1.3 * clamp(profile.q, 0.45, 2.0), 0.5, 3);
    const bodyGain = clamp(profile.body, 0.35, 1.25);
    const tailGain = clamp(profile.tail, 0.35, 1.25);
    const velocityGain = v;

    const mkGain = gain => clamp(velocityGain * gain * 0.55, 0, 0.55);
    const shortDur = clamp(0.014 * clamp(profile.snap, 0.65, 1.5), 0.006, 0.05);
    const tailOffsetSec = clamp(spreadSec * 3.1, 0, 0.19);
    const bursts = [
      { offsetSec: 0, gain: mkGain(0.48 * bodyGain), durationSec: shortDur },
      { offsetSec: spreadSec, gain: mkGain(0.42 * bodyGain), durationSec: shortDur },
      { offsetSec: clamp(spreadSec * 2, 0, 0.12), gain: mkGain(0.38 * bodyGain), durationSec: shortDur },
      { offsetSec: tailOffsetSec, gain: mkGain(0.82 * tailGain), durationSec: tailDecaySec },
    ];

    return {
      engine,
      requestedEngine: requestedEngine || engine,
      fallbackEngine: engine !== requestedEngine,
      spreadSec,
      tailOffsetSec,
      tailDecaySec,
      toneHz,
      toneJitterHz,
      highpassHz,
      filterQ,
      stopPaddingSec: 0.02,
      velocityGain,
      bursts,
    };
  }

  const api = { resolveClapVoiceSpec };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatClap = Object.assign(root.BighartBeatClap || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
