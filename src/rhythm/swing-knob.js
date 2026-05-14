'use strict';

(function (root) {
  const MIN_ANGLE = -135;
  const MAX_ANGLE = 135;
  const MAX_SWING = 1;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function pointCenter(rect) {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function angleFromPoint(rect, point) {
    const center = pointCenter(rect);
    const dx = point.clientX - center.x;
    const dy = point.clientY - center.y;
    const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
    return clamp(angle, MIN_ANGLE, MAX_ANGLE);
  }

  function swingFromAngle(angle) {
    return ((clamp(angle, MIN_ANGLE, MAX_ANGLE) - MIN_ANGLE) / (MAX_ANGLE - MIN_ANGLE)) * MAX_SWING;
  }

  function swingFromPoint(rect, point) {
    return swingFromAngle(angleFromPoint(rect, point));
  }

  function angleFromSwing(value) {
    const n = typeof value === 'number' ? value : parseFloat(value);
    const swing = Number.isFinite(n) ? clamp(n, 0, MAX_SWING) : 0;
    return MIN_ANGLE + (swing / MAX_SWING) * (MAX_ANGLE - MIN_ANGLE);
  }

  const api = {
    MIN_ANGLE,
    MAX_ANGLE,
    MAX_SWING,
    angleFromPoint,
    swingFromAngle,
    swingFromPoint,
    angleFromSwing,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatSwingKnob = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
