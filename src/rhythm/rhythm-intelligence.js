'use strict';

(function (root) {
  const DEFAULT_STEPS = 16;
  const METER_SALIENCE = [
    1.00, 0.15, 0.45, 0.15,
    0.75, 0.15, 0.45, 0.15,
    0.90, 0.15, 0.45, 0.15,
    0.75, 0.15, 0.45, 0.15,
  ];
  const TRACK_WEIGHTS = {
    kick: 1.00,
    snare: 0.90,
    clap: 0.75,
    input: 0.65,
    hihat: 0.35,
    ether: 0.25,
  };
  const TRACK_IDS = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether'];

  function clamp01(v) {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(1, v));
  }

  function round3(v) {
    return Math.round(clamp01(v) * 1000) / 1000;
  }

  function compactSwing(v) {
    return clamp01(Number(v));
  }

  function clampRange(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function analyzePumpArousal(comp) {
    const c = comp || {};
    if (!c.on) {
      return {
        arousal: 0,
        breath: 'still',
        value: '--',
        cue: 'Natural dynamics; no pump breath is active.',
      };
    }

    const threshold = clampRange(c.threshold, -80, 0, -24);
    const ratio = clampRange(c.ratio, 1, 20, 4);
    const attack = clampRange(c.attack, 1, 200, 8);
    const release = clampRange(c.release, 20, 2000, 280);
    const gateRate = clampRange(c.gateRate, 10, 2000, release);
    const thresholdDrive = Math.abs(threshold) / 80;
    const ratioDrive = (ratio - 1) / 19;
    const fastAttack = 1 - ((attack - 1) / 199);
    const gateDrive = c.gateOn ? 0.25 : 0;
    const arousal = round3((thresholdDrive * 0.34) + (ratioDrive * 0.36) + (fastAttack * 0.12) + gateDrive);
    const breath = arousal >= 0.75 ? 'heaving'
      : arousal >= 0.50 ? 'pumping'
      : arousal >= 0.25 ? 'lifted'
      : 'still';
    const value = c.gateOn ? `${Math.round(gateRate)}ms EXHALE` : breath.toUpperCase();
    const cue = c.gateOn
      ? `Pump cues a ${Math.round(gateRate)}ms exhale after each kick.`
      : breath === 'still'
        ? 'Compression is subtle; the groove keeps its natural breath.'
        : 'Compression lifts the groove into a shared breath.';

    return { arousal, breath, value, cue };
  }

  function hasHit(pattern, trackId, step) {
    return !!(pattern && pattern[trackId] && pattern[trackId][step]);
  }

  function ratchetCount(ratchets, trackId, step) {
    const raw = ratchets && ratchets[trackId] ? Number(ratchets[trackId][step]) : 1;
    if (!Number.isInteger(raw)) return 1;
    return Math.max(1, Math.min(3, raw));
  }

  function ratchetWeightMultiplier(count) {
    return 1 + ((count - 1) * 0.35);
  }

  function hihatOpennessAt(hihatOpenness, step) {
    const value = Array.isArray(hihatOpenness) ? Number(hihatOpenness[step]) : 0;
    return value === 0.45 || value === 1 ? value : 0;
  }

  function analyzeRhythm(input) {
    const opts = input || {};
    const pattern = opts.pattern || {};
    const ratchets = opts.ratchets || null;
    const hihatOpenness = opts.hihatOpenness || null;
    const stepsPerBar = Number.isInteger(opts.stepsPerBar) && opts.stepsPerBar > 0 ? opts.stepsPerBar : DEFAULT_STEPS;
    const salience = METER_SALIENCE.slice(0, stepsPerBar);
    while (salience.length < stepsPerBar) salience.push(METER_SALIENCE[salience.length % METER_SALIENCE.length]);

    const stepMetrics = [];
    let totalWeight = 0;
    let meterWeight = 0;
    let surpriseWeight = 0;
    let strongWeight = 0;
    let offbeatWeight = 0;
    let activeSteps = 0;

    for (let step = 0; step < stepsPerBar; step++) {
      let stepWeight = 0;
      const hits = [];
      const ratchetMetrics = {};
      for (const trackId of TRACK_IDS) {
        if (hasHit(pattern, trackId, step)) {
          const count = ratchetCount(ratchets, trackId, step);
          let weight = (TRACK_WEIGHTS[trackId] || 0.5) * ratchetWeightMultiplier(count);
          if (trackId === 'hihat') weight += hihatOpennessAt(hihatOpenness, step) * 0.22;
          stepWeight += weight;
          hits.push(trackId);
          if (count > 1) ratchetMetrics[trackId] = count;
        }
      }
      const meter = clamp01(salience[step]);
      const surprise = 1 - meter;
      if (stepWeight > 0) activeSteps++;
      totalWeight += stepWeight;
      meterWeight += stepWeight * meter;
      surpriseWeight += stepWeight * surprise;
      if (meter >= 0.45) strongWeight += stepWeight;
      else offbeatWeight += stepWeight;
      const metric = {
        step,
        hits,
        weight: round3(stepWeight / 3.9),
        salience: round3(meter),
        surprise: round3(stepWeight ? surprise : 0),
      };
      const hihatOpen = hasHit(pattern, 'hihat', step) ? hihatOpennessAt(hihatOpenness, step) : 0;
      if (hihatOpen) metric.hihatOpen = hihatOpen;
      if (Object.keys(ratchetMetrics).length) metric.ratchets = ratchetMetrics;
      stepMetrics.push(metric);
    }

    const maxWeight = stepsPerBar * TRACK_IDS.reduce((sum, id) => sum + (TRACK_WEIGHTS[id] || 0), 0);
    const density = clamp01(totalWeight / maxWeight);
    const syncopation = totalWeight ? clamp01(surpriseWeight / totalWeight) : 0;
    const meterConfidenceBase = totalWeight ? clamp01(meterWeight / totalWeight) : 0;

    const anchorSteps = [0, 4, 8, 12].filter(step => step < stepsPerBar);
    const anchorHits = anchorSteps.reduce((sum, step) => {
      return sum
        + (hasHit(pattern, 'kick', step) ? 1.0 : 0)
        + (hasHit(pattern, 'snare', step) ? 0.55 : 0)
        + (hasHit(pattern, 'clap', step) ? 0.35 : 0);
    }, 0);
    const anchorCapacity = anchorSteps.length * 1.9;
    const anchorConfidence = anchorCapacity ? clamp01(anchorHits / anchorCapacity) : 0;
    let meterConfidence = clamp01((meterConfidenceBase * 0.72) + (anchorConfidence * 0.28));

    const densityPressure = density > 0.6 ? (density - 0.6) / 0.4 : 0;
    const offbeatRatio = totalWeight ? offbeatWeight / totalWeight : 0;
    let surpriseTension = clamp01((syncopation * 0.62) + (density * 0.58) + (offbeatRatio * 0.22) - (anchorConfidence * 0.18));

    const lateRecoveryHits = [12, 14, 15].filter(step => step < stepsPerBar).reduce((sum, step) => {
      return sum + (stepMetrics[step] && stepMetrics[step].hits.length ? 1 : 0);
    }, 0) / 3;
    let recoverability = clamp01((meterConfidence * 0.70) + (anchorConfidence * 0.20) + (lateRecoveryHits * 0.10) - (densityPressure * 0.45));

    const targetSyncopation = 0.38;
    const targetWidth = 0.38;
    const structuredNoveltyCurve = clamp01(1 - Math.abs(syncopation - targetSyncopation) / targetWidth);
    let movementDrive = clamp01((0.42 + meterConfidence * 0.58) * recoverability * structuredNoveltyCurve * (1 - densityPressure * 0.75));
    if (totalWeight && density <= 0.85 && syncopation >= 0.55 && syncopation < 0.82 && recoverability >= 0.18) {
      movementDrive = Math.max(movementDrive, 0.03);
    }

    if (totalWeight === 0) {
      meterConfidence = 0;
      surpriseTension = 0;
      recoverability = 0;
      movementDrive = 0;
    }

    if (density > 0.85) {
      meterConfidence = Math.min(meterConfidence, 0.24);
      surpriseTension = 1;
      recoverability = Math.min(recoverability, 0.17);
      movementDrive = 0;
    }

    const metrics = {
      syncopation: round3(syncopation),
      meterConfidence: round3(meterConfidence),
      surpriseTension: round3(surpriseTension),
      recoverability: round3(recoverability),
      movementDrive: round3(movementDrive),
      density: round3(density),
    };

    const labels = makeLabels(metrics, totalWeight);
    const motorCoupling = makeMotorCoupling(metrics, labels, totalWeight, opts.swing);
    const predictiveTiming = analyzePredictiveTiming(pattern, totalWeight);

    return {
      syncopation: metrics.syncopation,
      meterConfidence: metrics.meterConfidence,
      surpriseTension: metrics.surpriseTension,
      recoverability: metrics.recoverability,
      movementDrive: metrics.movementDrive,
      density: metrics.density,
      labels,
      interpretation: makeInterpretation(metrics, labels, totalWeight),
      pumpArousal: analyzePumpArousal(opts.fx && opts.fx.comp),
      brainLoop: makeBrainLoop(metrics, labels, totalWeight),
      motorCoupling,
      predictiveTiming,
      cognitiveLoad: makeCognitiveLoad(metrics, labels, totalWeight, predictiveTiming),
      stepMetrics,
    };
  }

  function analyzePredictiveTiming(pattern, totalWeight) {
    if (!totalWeight) {
      return {
        predictionError: 0,
        timingBias: 'empty',
        cue: 'Add a downbeat or backbeat so the next pulse can be felt.',
      };
    }

    const expected = [
      { track: 'kick', step: 0 },
      { track: 'kick', step: 4 },
      { track: 'kick', step: 8 },
      { track: 'kick', step: 12 },
      { track: 'snare', step: 4, alt: 'clap' },
      { track: 'snare', step: 12, alt: 'clap' },
    ];
    let locked = 0;
    let early = 0;
    let late = 0;
    let missing = 0;

    expected.forEach(slot => {
      const onTime = hasHit(pattern, slot.track, slot.step) || (slot.alt && hasHit(pattern, slot.alt, slot.step));
      const prevStep = (slot.step + DEFAULT_STEPS - 1) % DEFAULT_STEPS;
      const nextStep = (slot.step + 1) % DEFAULT_STEPS;
      const earlyHit = hasHit(pattern, slot.track, prevStep) || (slot.alt && hasHit(pattern, slot.alt, prevStep));
      const lateHit = hasHit(pattern, slot.track, nextStep) || (slot.alt && hasHit(pattern, slot.alt, nextStep));
      if (onTime) locked++;
      else if (earlyHit) early++;
      else if (lateHit) late++;
      else missing++;
    });

    const slots = expected.length;
    const shifted = early + late;
    const predictionError = round3(((shifted * 0.72) + (missing * 0.42)) / slots);
    const timingBias = early > late ? 'early' : late > early ? 'late' : missing > locked ? 'unclear' : 'locked';
    let cue = 'The downbeat and backbeat make the next pulse easy to predict.';
    if (predictionError >= 0.72) cue = 'Too many anchors are displaced; the body loses what comes next.';
    else if (timingBias === 'early') cue = 'The groove leans early, creating anticipation before the anchor lands.';
    else if (timingBias === 'late') cue = 'The groove drags late, making the anchor feel delayed.';
    else if (timingBias === 'unclear') cue = 'Add a downbeat or backbeat anchor to clarify what comes next.';

    return { predictionError, timingBias, cue };
  }

  function makeLabels(metrics, totalWeight) {
    if (!totalWeight) {
      return { sync: 'broken', anchor: 'lost', tension: 'low', recover: 'unstable', drive: 'flat' };
    }

    const sync = metrics.density > 0.85 ? 'broken'
      : metrics.syncopation < 0.34 ? 'straight'
      : metrics.syncopation < 0.56 ? 'groove'
      : metrics.syncopation < 0.78 ? 'tense'
      : 'broken';

    const anchor = metrics.density > 0.85 ? 'lost'
      : metrics.meterConfidence >= 0.58 ? 'locked'
      : metrics.meterConfidence >= 0.43 ? 'bending'
      : metrics.meterConfidence >= 0.16 ? 'wobbly'
      : 'lost';

    const tension = metrics.surpriseTension >= 0.82 ? 'red'
      : metrics.surpriseTension >= 0.50 ? 'high'
      : metrics.surpriseTension >= 0.28 ? 'med'
      : 'low';

    const recover = metrics.recoverability >= 0.58 ? 'recovers'
      : metrics.recoverability >= 0.18 ? 'wobbles'
      : 'unstable';

    const drive = metrics.movementDrive >= 0.72 ? 'peak'
      : metrics.movementDrive >= 0.48 ? 'locked'
      : metrics.movementDrive >= 0.025 ? 'moving'
      : 'flat';

    return { sync, anchor, tension, recover, drive };
  }

  function makeInterpretation(metrics, labels, totalWeight) {
    if (!totalWeight) return 'Add a kick or snare anchor to give the rhythm a center.';
    if (metrics.density > 0.85 || labels.tension === 'red') return 'Feels overloaded; the main pulse is hard to read.';
    if (labels.tension === 'high' || labels.sync === 'tense') {
      if (labels.recover === 'wobbles' || labels.recover === 'recovers') {
        return 'Feels off-center and tense, but still has a recoverable pulse.';
      }
      return 'Feels tense and unstable; add an anchor so the beat can return.';
    }
    if (labels.drive === 'peak' || labels.drive === 'locked') {
      return 'Strong movement: surprise and meter are working together.';
    }
    if (labels.anchor === 'locked' && labels.tension === 'low') {
      return 'Feels steady and clear; the beat is easy to follow.';
    }
    if (labels.anchor === 'locked' || labels.anchor === 'bending') {
      return 'Feels locked with a little push; it resolves back into the beat.';
    }
    return 'Feels loose; add a stronger landing point to clarify the pulse.';
  }

  function makeCognitiveLoad(metrics, labels, totalWeight, predictiveTiming) {
    if (!totalWeight) {
      return {
        score: 0,
        value: 'EMPTY',
        cue: 'Add a clear pulse so the beat has a center.',
      };
    }
    if (metrics.density > 0.85 || labels.tension === 'red') {
      return {
        score: 1,
        value: 'OVERLOAD',
        cue: 'Too crowded; clear space so the pulse comes back.',
      };
    }

    const predictionLoad = predictiveTiming ? predictiveTiming.predictionError : 0;
    const score = round3(
      0.08
      + (metrics.surpriseTension * 0.42)
      + (metrics.density * 0.28)
      + ((1 - metrics.recoverability) * 0.12)
      + (predictionLoad * 0.30)
      - (metrics.meterConfidence * 0.10)
    );

    if (score >= 0.72) {
      return {
        score,
        value: 'CROWDED',
        cue: 'Busy but playable; remove one layer if the pulse feels hidden.',
      };
    }
    if (metrics.surpriseTension >= 0.18 && metrics.recoverability >= 0.18 && score >= 0.20) {
      return {
        score,
        value: 'SWEET SPOT',
        cue: 'Readable surprise: the groove pushes out and pulls back.',
      };
    }
    return {
      score,
      value: 'CLEAR',
      cue: 'Easy to follow; add a small offbeat if it feels too safe.',
    };
  }

  function makeMotorCoupling(metrics, labels, totalWeight, swingValue) {
    const swing = compactSwing(swingValue);
    if (!totalWeight) {
      return {
        score: 0,
        value: 'STILL',
        cue: 'Add a clear pulse so the body has somewhere to land.',
      };
    }
    if (metrics.density > 0.85 || labels.tension === 'red') {
      return {
        score: 0.12,
        value: 'JAMMED',
        cue: 'Too many hits blur the pulse; clear space before adding swing.',
      };
    }

    const anchorLift = labels.anchor === 'locked' ? 0.22
      : labels.anchor === 'bending' ? 0.14
      : labels.anchor === 'wobbly' ? 0.06
      : 0;
    const pocketLift = swing >= 0.75 ? 0.33
      : swing >= 0.33 ? 0.26
      : swing >= 0.05 ? 0.14
      : 0.04;
    const score = round3((metrics.recoverability * 0.34) + (metrics.movementDrive * 0.22) + anchorLift + pocketLift);

    if (swing >= 0.75) {
      return {
        score,
        value: 'TRIPLET POCKET',
        cue: 'Deep swing: strong lilt. Keep anchors clear so the pulse stays readable.',
      };
    }
    if (swing >= 0.33) {
      return {
        score,
        value: 'BODY POCKET',
        cue: 'Late offbeats give the body a place to lean into the groove.',
      };
    }
    if (swing >= 0.05) {
      return {
        score,
        value: 'LIGHT PUSH',
        cue: 'A small offbeat delay adds a subtle head-nod cue.',
      };
    }
    return {
      score,
      value: 'EVEN',
      cue: 'Even grid: stable pulse, little body sway.',
    };
  }

  function makeBrainLoop(metrics, labels, totalWeight) {
    if (!totalWeight) {
      return {
        value: 'LOST',
        line: 'Add an anchor so your body knows where the pulse starts.',
      };
    }
    if (metrics.density > 0.85 || labels.tension === 'red') {
      return {
        value: 'OVERLOADED',
        line: 'Too many hits blur the pulse.',
      };
    }
    if (labels.tension === 'high' || labels.sync === 'tense') {
      return {
        value: 'USEFUL SURPRISE',
        line: 'The beat surprises you but still pulls back.',
      };
    }
    if (labels.anchor === 'locked' && (labels.tension === 'low' || labels.recover === 'recovers')) {
      return {
        value: 'CLEAR',
        line: 'Your body can predict this pulse.',
      };
    }
    if (labels.recover === 'recovers' && metrics.movementDrive >= 0.025) {
      return {
        value: 'USEFUL SURPRISE',
        line: 'The beat surprises you but still pulls back.',
      };
    }
    return {
      value: 'LOST',
      line: 'Add an anchor so your body knows where the pulse starts.',
    };
  }

  const api = { analyzeRhythm, analyzePumpArousal, METER_SALIENCE, TRACK_WEIGHTS };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatRhythm = Object.assign(root.BighartBeatRhythm || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
