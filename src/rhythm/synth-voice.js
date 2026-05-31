'use strict';

(function (root) {
  const SYNTH_ENGINE_PROFILES = {
    '808': {
      personality: 'analog-sub-body',
      oscType: 'sine', filterType: 'lowpass', pitch: 0.72, decay: 0.92, tone: 0.72, q: 0.30,
      drive: 0.38, body: 0.72, sub: 0.62, noise: 0.008, attack: 0.002, release: 0.055, glide: 0.010,
      filterEnv: 0.38, filterEnd: 0.46, filterSnap: 0.0030, filterDecay: 0.68,
    },
    '909': {
      personality: 'acid-bass',
      oscType: 'sawtooth', filterType: 'lowpass', pitch: 0.50, decay: 0.92, tone: 0.98, q: 2.80,
      drive: 0.70, body: 0.50, sub: 0.22, noise: 0.025, attack: 0.004, release: 0.040, glide: 0.060,
      filterEnv: 1.80, filterEnd: 0.28, filterSnap: 0.0050, filterDecay: 1.20,
    },
    reznor: {
      personality: 'industrial-mono',
      oscType: 'square', filterType: 'bandpass', pitch: 0.74, decay: 0.90, tone: 0.58, q: 2.00,
      drive: 0.82, body: 0.42, sub: 0.10, noise: 0.18, attack: 0.003, release: 0.018, glide: 0.010,
      filterEnv: 2.20, filterEnd: 0.28, filterSnap: 0.0035, filterDecay: 0.48,
    },
    aphex: {
      personality: 'idm-digital-alien',
      oscType: 'triangle', filterType: 'bandpass', pitch: 1.18, decay: 1.08, tone: 1.34, q: 1.36,
      drive: 0.28, body: 0.32, sub: 0.05, noise: 0.065, attack: 0.0035, release: 0.045, glide: 0.055,
      filterEnv: 1.35, filterEnd: 0.32, filterSnap: 0.0012, filterDecay: 0.64,
    },
  };
  const SYNTH_MAX_FREQUENCY_HZ = 2200;
  const SYNTH_MAX_HARMONIC_RATIO = 4;
  const SYNTH_ROOT_MAX_HZ = SYNTH_MAX_FREQUENCY_HZ / SYNTH_MAX_HARMONIC_RATIO;

  function finiteOr(v, fallback) {
    return Number.isFinite(v) ? v : fallback;
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, finiteOr(v, lo)));
  }

  function resolveSynthVoiceSpec(engineId, params) {
    const requestedEngine = typeof engineId === 'string' ? engineId : '';
    const profile = SYNTH_ENGINE_PROFILES[requestedEngine] || SYNTH_ENGINE_PROFILES.aphex;
    const engine = SYNTH_ENGINE_PROFILES[requestedEngine] ? requestedEngine : 'aphex';
    const p = params || {};
    const requestedPitch = clamp(finiteOr(p.pitch, 220), 40, SYNTH_MAX_FREQUENCY_HZ);
    const requestedDecay = clamp(finiteOr(p.decay, 0.35), 0.04, 2.2);
    const tone = clamp(finiteOr(p.tone, 0.5), 0, 1);
    const shape = clamp(finiteOr(p.shape, 0.5), 0, 1);
    const pitchHz = clamp(requestedPitch * profile.pitch, 40, SYNTH_MAX_FREQUENCY_HZ);
    const decaySec = clamp(requestedDecay * profile.decay * (0.75 + shape * 0.55), 0.04, 2.5);
    const filterBase = 160 + pitchHz * (1.8 + tone * 12.5) * profile.tone;
    const filterHz = clamp(filterBase, 120, 12000);
    const acidQBoost = profile.personality === 'acid-bass' ? tone * 9.0 : 0;
    const filterQ = clamp(0.2 + shape * 8.5 * profile.q + acidQBoost, 0.2, 12);
    const filterEnvAmount = clamp(profile.filterEnv * (0.75 + shape * 0.75) * (profile.personality === 'industrial-mono' ? (1.05 + tone * 0.55) : (0.85 + tone * 0.30)), 0, 7.0);
    const filterEndRatio = clamp(profile.filterEnd * (1.08 - shape * 0.28), 0.12, 0.62);
    const filterAttackSec = clamp(profile.filterSnap * (1.15 - shape * 0.30), 0.0005, 0.012);
    const filterDecaySec = clamp(decaySec * profile.filterDecay * ((profile.personality === 'acid-bass' ? 1.45 : 1.06) - shape * 0.18), filterAttackSec + 0.0005, profile.personality === 'acid-bass' ? decaySec * 1.4 : decaySec);
    const filterTriggerHz = clamp(filterHz * (1 + filterEnvAmount), 120, 12000);
    const filterRestHz = clamp(filterHz * filterEndRatio, 80, 12000);
    const driveAmount = clamp(profile.drive * (0.70 + shape * 0.70), 0, 0.75);
    const bodyGain = clamp(profile.body * (0.78 + tone * 0.20), 0, 0.7);
    const subGain = clamp(profile.sub * (1.10 - tone * 0.35), 0, 0.35);
    const noiseGain = clamp(profile.noise * (0.40 + shape * 1.20), 0, profile.personality === 'industrial-mono' ? 0.20 : 0.16);
    const attackSec = clamp(profile.attack * (1.18 - shape * 0.35), 0.001, 0.03);
    const releaseTau = clamp(profile.release * (0.7 + decaySec * 0.35), 0.003, 0.20);
    const glideSec = clamp(profile.glide * (0.5 + shape), 0, 0.08);
    const chokeTau = clamp(Math.min(0.06, releaseTau * 0.55), 0.003, 0.08);
    const isAphexDigital = profile.personality === 'idm-digital-alien';
    const isIndustrialMono = profile.personality === 'industrial-mono';
    const modRatio = isAphexDigital ? 2.0 + shape * 2.0 + tone * 0.2 : (isIndustrialMono ? 1.1 + shape * 2.4 + tone * 0.8 : 1 + shape);
    const modIndex = isAphexDigital ? 6 + tone * 8 + shape * 4 : (isIndustrialMono ? 8 + tone * 38 + shape * 22 : 0);

    return {
      engine,
      requestedEngine: requestedEngine || engine,
      fallbackEngine: engine !== requestedEngine,
      personality: profile.personality,
      oscType: profile.oscType,
      filterType: profile.filterType,
      pitchHz,
      decaySec,
      attackSec,
      releaseTau,
      filterHz,
      filterTriggerHz,
      filterRestHz,
      filterEnvAmount,
      filterEndRatio,
      filterAttackSec,
      filterDecaySec,
      filterQ,
      driveAmount,
      bodyGain,
      subGain,
      noiseGain,
      glideSec,
      stopSec: clamp(decaySec + releaseTau * 5 + 0.08, 0.09, 3.2),
      chokeTau,
      shape,
      tone,
      modRatio,
      modIndex,
      detuneCents: profile.personality === 'analog-sub-body' ? Math.round(3 + (shape - 0.5) * 16) : (profile.personality === 'acid-bass' ? Math.round(-2 + (shape - 0.5) * 30) : (profile.personality === 'industrial-mono' ? Math.round(4 + (shape - 0.5) * 44) : (isAphexDigital ? -5 + (shape - 0.5) * 20 : 0))),
    };
  }

  const api = { resolveSynthVoiceSpec, SYNTH_ENGINE_PROFILES, SYNTH_MAX_FREQUENCY_HZ, SYNTH_MAX_HARMONIC_RATIO, SYNTH_ROOT_MAX_HZ };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatSynth = Object.assign(root.BighartBeatSynth || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
