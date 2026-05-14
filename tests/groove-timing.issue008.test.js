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
approx(swingOffsetSeconds(1, step, 0.5), 0.03125, '50% swing delays odd sixteenth by 25% of a step');
approx(swingOffsetSeconds(3, step, 1), 0.0625, '100% swing delays odd sixteenth by 50% of a step');

approx(swungStepStartSeconds(1, 10, step, 0.5), 10.03125, 'odd step start time includes swing offset');
approx(swungStepStartSeconds(2, 10.125, step, 0.5), 10.125, 'even step start time remains on the grid');

assert.deepStrictEqual(
  scheduledHitTimes({ stepIndex: 0, stepStart: 20, stepDuration: step, ratchets: 1, swing: 0.75 }),
  [20],
  'even-step single hit remains at step start',
);
assert.deepStrictEqual(
  scheduledHitTimes({ stepIndex: 1, stepStart: 20, stepDuration: step, ratchets: 1, swing: 0.5 }),
  [20.03125],
  'odd-step single hit is delayed by swing',
);
assert.deepStrictEqual(
  scheduledHitTimes({ stepIndex: 1, stepStart: 20, stepDuration: step, ratchets: 2, swing: 0.5 }),
  [20.03125, 20.078125],
  'odd-step ratchets use the remaining audible step window after swing delay',
);
const maxRatchets = scheduledHitTimes({ stepIndex: 15, stepStart: 30, stepDuration: step, ratchets: 3, swing: 1 });
assert(maxRatchets[maxRatchets.length - 1] < 30 + step, 'max-swing ratchets stay inside the original step window');

console.log('Issue 008 groove timing helper checks passed.');
