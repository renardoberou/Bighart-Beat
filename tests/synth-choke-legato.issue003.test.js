#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

// ── 1. triggerSynthChoke accepts a 5th timeSincePreviousSec parameter ──
// We check the function signature in source via regex.
const sigMatch = main.match(/function\s+triggerSynthChoke\s*\(([^)]*)\)/);
assert(sigMatch, 'triggerSynthChoke function is found in main.js');

const params = sigMatch[1].split(',').map(p => p.trim());
const hasTimeSinceParam = params.some(p => /timeSincePreviousSec/.test(p));
assert(hasTimeSinceParam,
  'triggerSynthChoke accepts a timeSincePreviousSec parameter (5th param)');

// ── 2. Legato gate: when gap is small, choke does NOT ramp to 0.0008 ──
// There should be a conditional that skips or reduces the choke when
// timeSincePreviousSec is below the threshold (~85ms).
const legatoGatePattern = /timeSincePreviousSec\s*<\s*0\.08/;
assert(legatoGatePattern.test(main),
  'main.js contains a legato time-gate check (timeSincePreviousSec < ~0.085)');

// The legato branch should prevent the full .0008 choke ramp.
// Look for isLegato or equivalent guard that skips setTargetAtTime or uses a higher floor.
const isLegatoPattern = /isLegato/i;
assert(isLegatoPattern.test(main),
  'main.js uses an isLegato guard to alter choke behavior');

// ── 3. Full choke still happens for large gaps ──
// setTargetAtTime(0.0008, ...) must still be reachable.
const fullChokePattern = /setTargetAtTime\s*\(\s*\.0008\s*,/;
assert(fullChokePattern.test(main),
  'main.js retains full choke setTargetAtTime(.0008, ...) for non-legato notes');

// ── 4. synthSynth computes timeSincePreviousSec and passes it ──
// Look for the computation of timeSincePreviousSec in main.js.
assert(/timeSincePreviousSec\s*=\s*\(!audition/.test(main),
  'main.js computes timeSincePreviousSec from t and previousTriggerTime');

// triggerSynthChoke call in synthSynth should pass the 5th argument.
const chokeCallMatch = main.match(/triggerSynthChoke\s*\(([^;]+)\)/);
assert(chokeCallMatch, 'triggerSynthChoke call is found in main.js');
const chokeCallArgs = chokeCallMatch[1];
assert(chokeCallArgs.includes('timeSincePreviousSec'),
  'triggerSynthChoke call passes timeSincePreviousSec as 5th argument');

// ── 5. audition mode does not affect legato gating ──
// The timeSincePreviousSec computation should be Infinity when audition is true
// (so legato gating is bypassed, existing behavior preserved).
const auditionInfinityPattern =
  /audition\s*\?\s*(null|Infinity)\s*:\s*synthVoiceState\.triggerTime/;
const hasAuditionBypass = auditionInfinityPattern.test(main) ||
  main.includes('!audition && Number.isFinite(previousTriggerTime)');
assert(hasAuditionBypass,
  'audition mode legs previousTriggerTime to null so timeSincePreviousSec defaults to Infinity (no legato bypass in audition)');

console.log('Issue 003 synth choke legato time-gate checks passed.');
