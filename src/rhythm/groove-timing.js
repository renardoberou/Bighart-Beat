'use strict';

(function (root) {
  function clampSwing(value) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  function stepDurationSeconds(bpm) {
    return 60 / bpm / 4;
  }

  function normalizeRatchets(count) {
    return count === 2 || count === 3 ? count : 1;
  }

  function swingOffsetSeconds(stepIndex, stepDuration, swing) {
    const classicMaxOffset = stepDuration * 0.5;
    const strongerOffset = stepDuration * clampSwing(swing) * (2 / 3);
    return stepIndex % 2 === 1 ? Math.min(classicMaxOffset, strongerOffset) : 0;
  }

  function swungStepStartSeconds(stepIndex, stepStart, stepDuration, swing) {
    return stepStart + swingOffsetSeconds(stepIndex, stepDuration, swing);
  }

  function scheduledHitTimes(options) {
    const stepIndex = options.stepIndex;
    const stepStart = options.stepStart;
    const stepDuration = options.stepDuration;
    const count = normalizeRatchets(options.ratchets);
    const swing = clampSwing(options.swing);
    const offset = swingOffsetSeconds(stepIndex, stepDuration, swing);
    const audibleStart = stepStart + offset;
    const ratchetWindow = Math.max(0.001, stepDuration - offset);
    return Array.from({ length: count }, (_, i) => audibleStart + i * ratchetWindow / count);
  }

  const api = {
    clampSwing,
    stepDurationSeconds,
    swingOffsetSeconds,
    swungStepStartSeconds,
    scheduledHitTimes,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatGroove = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
