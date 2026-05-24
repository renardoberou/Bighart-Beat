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

  function selectBudgetedOscillatorFrequencies(frequencies, maxMetallicSources) {
    const source = Array.isArray(frequencies) ? frequencies.filter(Number.isFinite) : [];
    const count = source.length;
    const cap = clamp(Math.floor(finiteOr(maxMetallicSources, count)), 0, count);
    if (cap >= count) return source.slice();
    if (cap <= 0) return [];
    if (cap === 1) return [source[0]];

    const selected = [];
    const used = Object.create(null);
    for (let i = 0; i < cap; i += 1) {
      const rawIndex = Math.round(i * (count - 1) / (cap - 1));
      let index = rawIndex;
      while (used[index] && index < count - 1) index += 1;
      while (used[index] && index > 0) index -= 1;
      used[index] = true;
      selected.push(source[index]);
    }
    return selected;
  }

  function resolveHihatRenderBudget(spec, options) {
    const s = spec || {};
    const opts = options || {};
    const audible = {
      useGhostTick: finiteOr(s.ghostTickGain, 0) > 0.001,
      useOpenShimmer: finiteOr(s.openShimmerGain, 0) > 0.001,
      useOpenBody: finiteOr(s.openBodyGain, 0) > 0.001,
      useOpenFlutter: finiteOr(s.openFlutterGain, 0) > 0.001,
      useIdmSpark: finiteOr(s.idmSparkGain, 0) > 0.001,
      useGlitch: !!s.glitchWillFire && finiteOr(s.glitchGain, 0) > 0.001,
    };
    const oscillatorFrequencies = Array.isArray(s.oscillatorFrequencies) ? s.oscillatorFrequencies.filter(Number.isFinite) : [];
    const metalAudible = finiteOr(s.metalGain, finiteOr(s.metalLevel, 0)) > 0.001 && oscillatorFrequencies.length > 0;
    const availableMetallicSourceCount = metalAudible ? oscillatorFrequencies.length : 0;
    const availableOptionalSourceCount = Object.keys(audible).reduce((sum, key) => sum + (audible[key] ? 1 : 0), 0);
    const fallbackCap = opts.mobile || opts.denseRatchet ? 3 : availableOptionalSourceCount;
    const maxOptionalSources = clamp(Math.floor(finiteOr(opts.maxOptionalSources, fallbackCap)), 0, availableOptionalSourceCount);
    const metallicFallbackCap = opts.mobile && opts.denseRatchet
      ? 3
      : (opts.mobile || opts.denseRatchet ? 4 : availableMetallicSourceCount);
    const minimumAudibleMetallicSources = metalAudible ? Math.min(2, availableMetallicSourceCount) : 0;
    const hasExplicitMetallicCap = Number.isFinite(opts.maxMetallicSources);
    const requestedMetallicCap = clamp(Math.floor(finiteOr(opts.maxMetallicSources, metallicFallbackCap)), 0, availableMetallicSourceCount);
    const maxMetallicSources = metalAudible
      ? (hasExplicitMetallicCap
        ? requestedMetallicCap
        : clamp(Math.max(requestedMetallicCap, minimumAudibleMetallicSources), minimumAudibleMetallicSources, availableMetallicSourceCount))
      : 0;
    const budgetedOscillatorFrequencies = metalAudible
      ? selectBudgetedOscillatorFrequencies(oscillatorFrequencies, maxMetallicSources)
      : [];
    const metallicSourceCount = budgetedOscillatorFrequencies.length;
    const engine = typeof s.engine === 'string' ? s.engine : '';
    const priority = engine === 'reznor'
      ? ['useGhostTick', 'useOpenFlutter', 'useIdmSpark', 'useOpenShimmer', 'useOpenBody', 'useGlitch']
      : engine === 'aphex'
        ? ['useGhostTick', 'useIdmSpark', 'useOpenFlutter', 'useOpenShimmer', 'useOpenBody', 'useGlitch']
        : ['useGhostTick', 'useOpenShimmer', 'useOpenBody', 'useOpenFlutter', 'useIdmSpark', 'useGlitch'];
    const selected = {
      useGhostTick: false,
      useOpenShimmer: false,
      useOpenBody: false,
      useOpenFlutter: false,
      useIdmSpark: false,
      useGlitch: false,
    };
    let optionalSourceCount = 0;
    for (const key of priority) {
      if (!audible[key] || optionalSourceCount >= maxOptionalSources) continue;
      selected[key] = true;
      optionalSourceCount += 1;
    }
    return {
      ...selected,
      maxOptionalSources,
      optionalSourceCount,
      availableOptionalSourceCount,
      maxMetallicSources,
      metallicSourceCount,
      availableMetallicSourceCount,
      budgetedOscillatorFrequencies,
      totalSourceEstimate: 1 + optionalSourceCount + metallicSourceCount,
      mobile: !!opts.mobile,
      denseRatchet: !!opts.denseRatchet,
    };
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
    const decayOpenShape = smoothstep01((requestedDecay - 0.02) / 0.38);
    const opennessTail = open > 0
      ? (open * 0.05 + open * open * 0.20) * (0.55 + decayOpenShape * 1.25)
      : 0;
    const openBoost = requestedDecay + opennessTail;
    const decaySec = clamp(openBoost * profile.decay * jitter(rand, instability), 0.006, 0.70);
    const highpassHz = clamp(freq * profile.bright * jitter(rand, instability), 2500, 17000);
    const bandpassHz = clamp(10500 * profile.bright * jitter(rand, instability), 4500, 18000);
    const bandpassQ = clamp(0.7 + instability * 8, 0.5, 2.5);
    const noiseLevel = clamp(0.42 * profile.noise * (1 - softHit * 0.05) * jitter(rand, instability * 0.6), 0, 0.72);
    const baseMetalLevel = clamp(metal * (0.14 + profile.tone * 0.18), 0, 0.34);
    const isAphex = engine === 'aphex';
    const isReznor = engine === 'reznor';
    const idmEdge = isAphex ? clamp(0.35 + metal * 0.10 + accentedHit * 0.45 - softHit * 0.25, 0.08, 0.95) : 0;
    const needleClosedness = Math.pow(clamp((0.78 - open) / 0.78, 0, 1), 0.70);
    const needleCharacter = isAphex ? 1 : (isReznor ? 0.38 : 0);
    const metallicNeedlePinch = clamp(
      needleClosedness * needleCharacter * (0.16 + metal * 0.22 + accentedHit * 0.54 - softHit * 0.13),
      0,
      0.72
    );
    const metalLevel = clamp(baseMetalLevel * (1 + idmEdge * 0.14 + metallicNeedlePinch * 0.08), 0, 0.34);
    const ratios = profile.ratios.slice(0, 6).map(r => clamp(r, 0.1, 12));
    const oscillatorFrequencies = ratios.map(r => clamp(205 * r * profile.bright * jitter(rand, instability), 80, 18000));
    const baseGlitchChance = clamp(profile.glitchChance || 0, 0, 0.30);
    const glitchChance = clamp(baseGlitchChance * (isAphex ? (0.65 + idmEdge * 0.75) : 1), 0, 0.30);
    const glitchWillFire = glitchChance > 0 && rand01(rand) < glitchChance;
    const glitchBandpassHz = clamp(7000 * (1 + idmEdge * 0.12) * jitter(rand, 0.4), 3500, 14000);
    const attackSec = clamp(0.0009 + open * 0.0024 + instability * 0.004, 0.0008, 0.004);
    const accentedOpenTailTighten = accentedHit * smoothstep01(open);
    const tailReleaseTau = clamp((0.014 + open * 0.062 + open * open * 0.036 + instability * 0.20) * (1 - accentedOpenTailTighten * 0.10), 0.010, 0.16);
    const openTailDamp = clamp(1 - open * 0.10 - open * open * 0.16, 0.68, 1);
    const tailHeadroomTrim = clamp(1 - open * 0.08 - open * open * 0.14 - accentedHit * 0.03, 0.70, 1);
    const velocityTail = 1 - softHit * 0.12 - accentedOpenTailTighten * 0.08;
    const noiseTailSec = clamp(decaySec * characterTailDamp * (1 + open * 0.08) * velocityTail, 0.006, 0.70);
    const metalTailSec = clamp(decaySec * characterTailDamp * (0.72 + open * 0.08) * velocityTail, 0.004, 0.56);
    const transientGain = clamp((1.12 - open * 0.18 + profile.tone * 0.025) * characterTransient * (1 - softHit * 0.08 + accentedHit * 0.05), 0.8, 1.18);
    const openShape = smoothstep01(open);
    const openAphexMetalAir = isAphex ? openShape * smoothstep01((metal - 0.55) / 0.45) : 0;
    const outputTrim = clamp((1 - open * 0.10 - open * open * 0.16 - instability * 0.20 - accentedHit * 0.08 - metallicNeedlePinch * 0.025 - openAphexMetalAir * 0.018) * characterTrim, 0.62, 1);
    const airLowpassHz = clamp(freq * profile.bright * characterAirDamp * (1.35 - open * 0.22) * (1 - softHit * 0.08 + accentedHit * 0.04) * (1 + openAphexMetalAir * 0.13), 8500, 18000);
    const airLowpassQ = clamp(0.45 + instability * 2, 0.2, 0.9);
    const openAccentBloom = clamp(openShape * (0.045 + accentedHit * 0.135 - softHit * 0.035), 0, 0.32);
    const openDecayPresenceLift = 1 + openShape * decayOpenShape * 0.12;
    const softOpenAirTailLift = openShape * softHit;
    const accentedOpenSnap = openShape * accentedHit;
    const openShimmerGain = clamp(openShape * (0.018 + profile.tone * 0.028 + metal * 0.018) * (0.85 + accentedHit * 0.35 - softHit * 0.25) * (1 + openAccentBloom * 0.22) * openDecayPresenceLift * (1 + openAphexMetalAir * 0.10), 0, 0.085);
    const openShimmerTailSec = clamp(noiseTailSec * (0.82 + open * 0.22) * (1 + softOpenAirTailLift * 0.22 + openAccentBloom * 0.05 - accentedOpenSnap * 0.04), 0.006, 0.72);
    const openShimmerHz = clamp(11500 * profile.bright * (1 + open * 0.18) * (1 - softHit * 0.05 + accentedHit * 0.08) * jitter(rand, instability * 0.4), 6500, 18000);
    const openShimmerQ = clamp(1.6 + open * 1.2 + instability * 10 + openAphexMetalAir * 0.72, 1.2, 4.2);
    const openBodyCharacter = engine === '808' ? 0.74 : (engine === '909' ? 1.0 : (isReznor ? 1.12 : 1.24));
    const openBodyGain = clamp(openShape * (0.034 + profile.tone * 0.035 + metal * 0.012) * openBodyCharacter * (0.72 + accentedHit * 0.38 - softHit * 0.22) * (1 + openAccentBloom * 0.28) * openDecayPresenceLift * jitter(rand, instability * 0.35), 0, 0.11);
    const openBodyTailSec = clamp(noiseTailSec * (0.70 + open * 0.12) * (1 + softOpenAirTailLift * 0.12 + openAccentBloom * 0.04 - accentedOpenSnap * 0.05), 0.004, 0.64);
    const openBodyHz = clamp(4200 * profile.bright * (0.95 + profile.tone * 0.28) * (1 + open * 0.20) * (1 - softHit * 0.06 + accentedHit * 0.10) * jitter(rand, instability * 0.45), 2600, 12000);
    const openBodyQ = clamp(0.65 + open * 0.55 + profile.tone * 0.75 + instability * 8, 0.45, 2.8);
    const idmSparkCharacter = isAphex ? 1 : (isReznor ? 0.58 : 0);
    const idmSparkEnergy = clamp((0.36 + metal * 0.26 + accentedHit * 0.64 - softHit * 0.28) * idmSparkCharacter, 0, 1);
    const idmSparkGain = clamp(idmSparkEnergy * (isAphex ? 0.052 : 0.034) * (1 + metallicNeedlePinch * 0.16) * jitter(rand, instability * 0.5), 0, 0.065);
    const idmSparkTailSec = clamp(0.0065 + open * 0.006 + instability * 0.12 - accentedHit * 0.0012 - metallicNeedlePinch * 0.0016, 0.003, 0.045);
    const idmSparkHz = clamp(freq * (isAphex ? 1.62 : 1.36) * profile.bright * (1 + accentedHit * 0.035 + metallicNeedlePinch * 0.018) * jitter(rand, instability * 0.7), 9000, 18000);
    const idmSparkQ = clamp(5.0 + idmSparkEnergy * 4.4 + metallicNeedlePinch * 1.8 + instability * 38, 3, 14);
    const openFlutterCharacter = isAphex ? 1 : (isReznor ? 0.45 : 0);
    const openMetalFlutter = isAphex ? openShape * smoothstep01((metal - 0.55) / 0.45) : 0;
    const openSizzleTailBias = clamp(
      openShape * (0.52 + open * 0.48) * (isAphex ? 1 : (isReznor ? 0.34 : 0)) * (0.045 + metal * 0.18 + accentedHit * 0.105 - softHit * 0.065),
      0,
      0.30
    );
    const openFlutterEnergy = clamp(openShape * openFlutterCharacter * (0.42 + metal * 0.28 + accentedHit * 0.48 - softHit * 0.42), 0, 1);
    const openFlutterGain = clamp(openFlutterEnergy * (isAphex ? 0.038 : 0.025) * (1 + openMetalFlutter * 0.78 + openSizzleTailBias * 0.42) * jitter(rand, instability * 0.55), 0, 0.045);
    const openFlutterTailSec = clamp((0.018 + open * 0.048 + instability * 0.60) * (1 + openMetalFlutter * 0.08 + openSizzleTailBias * 0.55 - accentedHit * 0.04), 0.004, 0.16);
    const openFlutterHz = clamp(7200 * profile.bright * (1 + open * 0.14 + metal * openMetalFlutter * 0.10 + accentedHit * 0.06 + openSizzleTailBias * 0.08) * jitter(rand, instability * 0.8), 5200, 16000);
    const openFlutterQ = clamp(3.2 + openFlutterEnergy * 3.2 + openMetalFlutter * 1.35 + openSizzleTailBias * 2.0 + instability * 45, 2.5, 10);
    const ghostClosedness = Math.pow(clamp((0.72 - open) / 0.72, 0, 1), 1.35);
    const ghostVelocityLift = smoothstep01(softHit);
    const ghostTickEnergy = clamp(ghostClosedness * (0.16 + ghostVelocityLift * 0.84) * (0.78 + metal * 0.18 + profile.tone * 0.08), 0, 1);
    const ghostTickGain = clamp(ghostTickEnergy * 0.034 * characterTransient * jitter(rand, instability * 0.45), 0, 0.04);
    const ghostTickTailSec = clamp(0.0042 + ghostClosedness * 0.0062 + ghostVelocityLift * 0.0020 + instability * 0.035, 0.003, 0.018);
    const ghostTickHz = clamp(freq * (1.02 + profile.tone * 0.14 - open * 0.08) * profile.bright * (1 - softHit * 0.03) * jitter(rand, instability * 0.5), 6500, 16000);
    const ghostTickQ = clamp(3.4 + ghostTickEnergy * 2.6 + profile.tone * 1.0 + instability * 20, 2.5, 9);
    const baseChokeClosedTau = clamp(profile.chokeClosedTau, 0.001, 0.099);
    const baseChokeOpenTau = clamp(Math.max(profile.chokeOpenTau, profile.chokeClosedTau + 0.001), 0.002, 0.10);
    const velocityChokeRelease = 1 + openShape * (softHit * 0.12 - accentedHit * 0.16);
    const chokeOpenTau = clamp(Math.max(baseChokeOpenTau * velocityChokeRelease, baseChokeClosedTau + 0.001), 0.002, 0.10);

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
      openAccentBloom,
      openShimmerGain,
      openShimmerTailSec,
      openShimmerHz,
      openShimmerQ,
      openBodyGain,
      openBodyTailSec,
      openBodyHz,
      openBodyQ,
      openFlutterGain,
      openFlutterTailSec,
      openFlutterHz,
      openFlutterQ,
      openSizzleTailBias,
      ghostTickGain,
      ghostTickTailSec,
      ghostTickHz,
      ghostTickQ,
      idmSparkGain,
      idmSparkTailSec,
      idmSparkHz,
      idmSparkQ,
      oscType: profile.oscType,
      ratios,
      oscillatorFrequencies,
      oscillatorGain: ratios.length ? 0.5 / ratios.length : 0,
      glitchChance,
      glitchWillFire,
      glitchBandpassHz,
      glitchGain: clamp(glitchChance * (0.13 + idmEdge * 0.08), 0, 0.06),
      idmEdge,
      metallicNeedlePinch,
      chokeClosedTau: baseChokeClosedTau,
      chokeOpenTau,
      metalHighpassHz: clamp(freq * 0.85 * profile.bright, 2200, 17000),
    };
  }

  const api = { resolveHihatVoiceSpec, resolveHihatRenderBudget, calculateHihatChokeTau, HIHAT_ENGINE_PROFILES };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatHihat = Object.assign(root.BighartBeatHihat || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
