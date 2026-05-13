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

  function resolveKickVoiceSpec(engineId, params, velocity) {
    const requestedEngine = typeof engineId === 'string' ? engineId : '';
    const fullProfile = ENGINE_PROFILES[requestedEngine] || ENGINE_PROFILES.aphex;
    const engine = ENGINE_PROFILES[requestedEngine] ? requestedEngine : 'aphex';
    const profile = fullProfile.kick;
    const p = params || {};
    const v = clamp(finiteOr(velocity, 1), 0, 1);

    const pitch = clamp(finiteOr(p.pitch, 110), 35, 180);
    const end = clamp(finiteOr(p.end, 44), 24, 110);
    const decay = clamp(finiteOr(p.decay, 0.55), 0.035, 1.35);
    const click = clamp(finiteOr(p.click, 0.68), 0, 1);
    const drive = clamp(finiteOr(p.drive, 0.4), 0, 1);
    const pitchMul = clamp(profile.pitch, 0.5, 1.6);
    const decayMul = clamp(profile.decay, 0.45, 1.35);

    const bodyDecaySec = clamp(decay * decayMul, 0.035, 1.6);
    const subDecaySec = clamp(bodyDecaySec * 1.1, bodyDecaySec, 1.76);

    return {
      engine,
      requestedEngine: requestedEngine || engine,
      fallbackEngine: engine !== requestedEngine,
      attackHz: clamp(pitch * 1.8 * pitchMul, 20, 420),
      dropHz: clamp(pitch * pitchMul, 20, 260),
      endHz: clamp(end * pitchMul, 18, 160),
      bodyDecaySec,
      subDecaySec,
      oscStopSec: clamp(bodyDecaySec + 0.08, 0.05, 1.9),
      subStopSec: clamp(bodyDecaySec * 1.2 + 0.05, 0.06, 2.0),
      driveAmount: clamp(drive * clamp(profile.drive, 0, 2.0), 0, 1),
      clickGain: clamp(v * click * clamp(profile.click, 0, 1.65) * 0.42, 0, 0.9),
      bodyPeakGain: clamp(v * 0.85, 0, 0.85),
      subPeakGain: clamp(v * 0.28, 0, 0.32),
    };
  }

  const api = { resolveKickVoiceSpec };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatKick = Object.assign(root.BighartBeatKick || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
