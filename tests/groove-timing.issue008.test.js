#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const {
  clampSwing,
  stepDurationSeconds,
  swingOffsetSeconds,
  swungStepStartSeconds,
  scheduledHitTimes,
} = require(path.join(root, 'src', 'rhythm', 'groove-timing.js'));

const EPS = 1e-9;
function approx(actual, expected, label) {
  assert(Math.abs(actual - expected) < EPS, `${label}: expected ${expected}, got ${actual}`);
}

assert.strictEqual(clampSwing(-1), 0, 'negative swing clamps to straight timing');
assert.strictEqual(clampSwing(2), 1, 'swing above 1 clamps to max');
assert.strictEqual(clampSwing('bad'), 0, 'non-number swing defaults to straight timing');

const step = stepDurationSeconds(120);
approx(step, 0.125, '120 BPM sixteenth-note step duration');

approx(swingOffsetSeconds(0, step, 0), 0, 'zero swing does not move even steps');
approx(swingOffsetSeconds(1, step, 0), 0, 'zero swing does not move odd steps');
approx(swingOffsetSeconds(2, step, 0.5), 0, 'swing does not move even sixteenth steps');
approx(swingOffsetSeconds(1, step, 0.25), step / 6, '25% swing delays odd sixteenth by one sixth of a step');
approx(swingOffsetSeconds(1, step, 0.5), step / 3, '50% swing delays odd sixteenth by one third of a step');
approx(swingOffsetSeconds(1, step, 0.75), step / 2, '75% swing reaches the classic drum-machine maximum half-step delay');
approx(swingOffsetSeconds(3, step, 1), step / 2, '100% swing is capped at the same maximum half-step delay');

approx(swungStepStartSeconds(1, 10, step, 0.5), 10 + step / 3, 'odd step start time includes stronger swing offset');
approx(swungStepStartSeconds(2, 10.125, step, 0.5), 10.125, 'even step start time remains on the grid');

assert.deepStrictEqual(
  scheduledHitTimes({ stepIndex: 0, stepStart: 20, stepDuration: step, ratchets: 1, swing: 0.75 }),
  [20],
  'even-step single hit remains at step start',
);
assert.deepStrictEqual(
  scheduledHitTimes({ stepIndex: 1, stepStart: 20, stepDuration: step, ratchets: 1, swing: 0.5 }),
  [20 + step / 3],
  'odd-step single hit is delayed by stronger swing',
);
assert.deepStrictEqual(
  scheduledHitTimes({ stepIndex: 1, stepStart: 20, stepDuration: step, ratchets: 2, swing: 0.5 }),
  [20 + step / 3, 20 + step / 3 + (step - step / 3) / 2],
  'odd-step ratchets use the remaining audible step window after stronger swing delay',
);
const maxRatchets = scheduledHitTimes({ stepIndex: 15, stepStart: 30, stepDuration: step, ratchets: 3, swing: 1 });
assert(maxRatchets[maxRatchets.length - 1] < 30 + step, 'max-swing ratchets stay inside the original step window');

console.log('Issue 008 groove timing helper checks passed.');
