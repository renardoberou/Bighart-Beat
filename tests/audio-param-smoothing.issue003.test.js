#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'src', 'main.js');
const main = fs.readFileSync(mainPath, 'utf8');

assert(
  /function\s+cancelAndHoldOrSmoothParam\s*\(/.test(main),
  'main.js defines a shared cancelAndHoldOrSmoothParam helper'
);
assert(
  /cancelAndHoldOrSmoothParam[\s\S]*cancelAndHoldAtTime\(t\)/.test(main),
  'helper prefers native cancelAndHoldAtTime(t) when available'
);
assert(
  /cancelAndHoldOrSmoothParam[\s\S]*cancelScheduledValues\(t\)/.test(main),
  'helper falls back to cancelScheduledValues(t)'
);
assert(
  /cancelAndHoldOrSmoothParam[\s\S]*(setTargetAtTime|linearRampToValueAtTime)\(/.test(main),
  'fallback smooths/re-anchors over a tiny de-click window'
);

const staleRawFallbacks = [
  /setValueAtTime\(\s*g\.value\s*,\s*t\s*\)/,
  /setValueAtTime\(\s*Math\.max\(\s*\.001\s*,\s*g\.value\s*\|\|\s*\.001\s*\)\s*,\s*t\s*\)/
];
staleRawFallbacks.forEach((pattern) => {
  assert(!pattern.test(main), `fallback must not hard-set stale raw AudioParam.value via ${pattern}`);
});

[
  ['triggerGate', /function\s+triggerGate\s*\([\s\S]*?cancelAndHoldOrSmoothParam\(\s*g\s*,\s*t\s*,\s*\{[\s\S]*?floor:\s*0/],
  ['triggerCompGate', /function\s+triggerCompGate\s*\([\s\S]*?cancelAndHoldOrSmoothParam\(\s*g\s*,\s*t\s*,\s*\{[\s\S]*?floor:\s*dbToGain\(-80\)/],
  ['triggerHihatChoke', /function\s+triggerHihatChoke\s*\([\s\S]*?cancelAndHoldOrSmoothParam\(\s*g\s*,\s*t\s*,\s*\{[\s\S]*?floor:\s*\.0008/],
  ['triggerSynthChoke', /function\s+triggerSynthChoke\s*\([\s\S]*?cancelAndHoldOrSmoothParam\(\s*g\s*,\s*t\s*,\s*\{[\s\S]*?floor:\s*\.0008/]
].forEach(([name, pattern]) => {
  assert(pattern.test(main), `${name} uses shared helper with an appropriate gain floor`);
});

const helperMatch = main.match(/function\s+cancelAndHoldOrSmoothParam\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
assert(helperMatch, 'can extract cancelAndHoldOrSmoothParam for behavioral checks');
const sandbox = { Math, Number };
vm.createContext(sandbox);
vm.runInContext(`${helperMatch[0]}; this.cancelAndHoldOrSmoothParam = cancelAndHoldOrSmoothParam;`, sandbox);

function fakeParam(value, includeCancelAndHold = false) {
  const events = [];
  const param = {
    value,
    events,
    cancelScheduledValues(t) { events.push(['cancelScheduledValues', t]); },
    setValueAtTime(v, t) { events.push(['setValueAtTime', v, t]); },
    setTargetAtTime(v, t, tau) { events.push(['setTargetAtTime', v, t, tau]); },
    linearRampToValueAtTime(v, t) { events.push(['linearRampToValueAtTime', v, t]); }
  };
  if (includeCancelAndHold) param.cancelAndHoldAtTime = (t) => events.push(['cancelAndHoldAtTime', t]);
  return param;
}

const nativeParam = fakeParam(0.75, true);
sandbox.cancelAndHoldOrSmoothParam(nativeParam, 1.25, { floor: 0.0008 });
assert.deepStrictEqual(nativeParam.events, [['cancelAndHoldAtTime', 1.25]], 'native path only calls cancelAndHoldAtTime');

const fallbackParam = fakeParam(0, false);
sandbox.cancelAndHoldOrSmoothParam(fallbackParam, 2, { floor: 0.0008, smoothTime: 0.004 });
assert.strictEqual(fallbackParam.events[0][0], 'cancelScheduledValues', 'fallback cancels future values first');
assert(!fallbackParam.events.some((event) => event[0] === 'setValueAtTime' && event[1] === 0), 'fallback never anchors gain to abrupt zero');
assert(
  fallbackParam.events.some((event) => event[0] === 'setTargetAtTime' || event[0] === 'linearRampToValueAtTime'),
  'fallback schedules a smoothing event'
);
assert(
  fallbackParam.events.some((event) => event[1] >= 0.0008),
  'fallback clamps the anchor to the requested positive floor'
);

const staleValueParam = fakeParam(0.73, false);
sandbox.cancelAndHoldOrSmoothParam(staleValueParam, 3, { floor: 0.0008, fallbackValue: 0.0008, smoothTime: 0.004 });
assert(
  staleValueParam.events.some((event) => event[0] === 'setTargetAtTime' && event[1] === 0.0008),
  'fallback re-anchors from the known-safe fallbackValue instead of stale AudioParam.value'
);
assert(
  !staleValueParam.events.some((event) => event[1] === 0.73),
  'fallback must not schedule the stale raw AudioParam.value as the smoothing anchor'
);

console.log('Issue 003 AudioParam smoothing regression checks passed.');
