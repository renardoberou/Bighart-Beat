#!/usr/bin/env node
'use strict';

const assert = require('assert');
const SwingKnob = require('../src/rhythm/swing-knob.js');

const rect = { left: 0, top: 0, width: 100, height: 100 };

function near(actual, expected, label) {
  assert(Math.abs(actual - expected) < 0.001, `${label}: expected ${expected}, got ${actual}`);
}

near(SwingKnob.angleFromPoint(rect, { clientX: 0, clientY: 100 }), -135, 'lower-left is the visible sweep minimum');
near(SwingKnob.angleFromPoint(rect, { clientX: 50, clientY: 0 }), 0, 'top is the visible sweep midpoint');
near(SwingKnob.angleFromPoint(rect, { clientX: 100, clientY: 100 }), 135, 'lower-right is the visible sweep maximum');

near(SwingKnob.swingFromPoint(rect, { clientX: 0, clientY: 100 }), 0, 'lower-left maps to 0% swing');
near(SwingKnob.swingFromPoint(rect, { clientX: 50, clientY: 0 }), 0.5, 'top tap maps to 50% of the full 0-100 ARIA sweep before snapping');
near(SwingKnob.swingFromPoint(rect, { clientX: 100, clientY: 100 }), 1, 'lower-right maps to 100% of the full ARIA/visual sweep');

console.log('Issue 008 swing knob helper checks passed.');