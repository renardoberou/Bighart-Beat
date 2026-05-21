#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const { calculateHihatChokeTau } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));

assert.strictEqual(typeof calculateHihatChokeTau, 'function', 'hihat choke tau helper is exported for runtime and tests');

const runtimeChokeSpec = { chokeClosedTau: 0.014, chokeOpenTau: 0.050 };
const justClosedSide = calculateHihatChokeTau(0.49, 0.49, runtimeChokeSpec);
const justOpenSide = calculateHihatChokeTau(0.51, 0.49, runtimeChokeSpec);
const closedTau = calculateHihatChokeTau(0, 1, runtimeChokeSpec);
const fullyOpenFromClosedTau = calculateHihatChokeTau(1, 0, runtimeChokeSpec);
const fullyOpenFromOpenTau = calculateHihatChokeTau(1, 1, runtimeChokeSpec);
assert(Math.abs(justOpenSide - justClosedSide) < 0.004, 'choke tau changes continuously around 0.5 openness instead of jumping binary-open');
assert(closedTau <= runtimeChokeSpec.chokeClosedTau + 0.0005, 'fully closed hihat keeps the tight closed choke time');
assert(fullyOpenFromClosedTau > closedTau, 'fully open hihat from a closed/tight tail gets a longer safe tail than closed');
assert(fullyOpenFromOpenTau > fullyOpenFromClosedTau, 'open-to-open hihat transitions keep the softest safe tail');
assert(fullyOpenFromOpenTau <= runtimeChokeSpec.chokeOpenTau, 'fully open hihat choke tau remains bounded by the open profile');

assert(
  /const\s+hihatChokeState\s*=\s*\{\s*gain:\s*null,\s*open:\s*0\s*\}/.test(main),
  'runtime keeps shared hihat choke state and previous openness between hits'
);
assert(
  /function\s+triggerHihatChoke\s*\(\s*t,\s*openAmount,\s*choke,\s*spec\s*\)\s*\{[\s\S]*const\s+previous\s*=\s*hihatChokeState\.gain[\s\S]*const\s+previousOpen\s*=\s*hihatChokeState\.open[\s\S]*const\s+currentOpen\s*=\s*clamp\(openAmount,\s*0,\s*1\)/.test(main),
  'hihat choke helper compares continuous new hat openness with the previous active tail'
);
assert(
  /if\s*\(\s*previous\s*&&\s*previous\.gain\s*\)\s*\{[\s\S]*cancelAndHoldOrSmoothParam\(g,\s*t,\s*\{\s*floor:\s*\.0008[\s\S]*g\.setTargetAtTime\(\.0008,\s*t,\s*tau\)/.test(main),
  'hihat choke helper smoothly cancels and ramps the previous tail instead of letting open hats pile up'
);
assert(
  /const\s+tau\s*=\s*HihatVoice\.calculateHihatChokeTau\(currentOpen,\s*previousOpen,\s*spec\)/.test(main),
  'hihat choke helper interpolates choke tau continuously from closed to open openness'
);
assert(
  /hihatChokeState\.gain\s*=\s*choke[\s\S]*hihatChokeState\.open\s*=\s*currentOpen/.test(main),
  'hihat choke helper records continuous current openness for the next hat hit'
);
assert(
  /function\s+synthHihat\s*\(\s*t,\s*v,\s*p\s*\)\s*\{[\s\S]*const\s+choke\s*=\s*A\.createGain\(\)[\s\S]*const\s+hatPolish\s*=\s*A\.createGain\(\)[\s\S]*choke\.connect\(hatPolish\);\s*hatPolish\.connect\(hatAir\);\s*hatAir\.connect\(dest\)[\s\S]*triggerHihatChoke\(t,\s*p\.open,\s*choke,\s*spec\)/.test(main),
  'synthHihat routes every hihat through the shared choke gain before the post-choke polish stage'
);
assert(
  /choke\.gain\.linearRampToValueAtTime\(1,\s*t\s*\+\s*spec\.attackSec\)/.test(main),
  'synthHihat uses resolver-provided attackSec for the shared choke envelope'
);
assert(
  /ng\.gain\.linearRampToValueAtTime\(clamp\(v\s*\*\s*spec\.noiseGain\s*\*\s*spec\.transientGain,\s*0,\s*\.72\),\s*t\s*\+\s*spec\.attackSec\)/.test(main),
  'synthHihat applies resolver transientGain and attackSec to the noise attack'
);
assert(
  /ng\.gain\.exponentialRampToValueAtTime\(\.001,\s*t\s*\+\s*spec\.noiseTailSec\)/.test(main),
  'synthHihat uses resolver-provided noiseTailSec instead of a hard-coded decay tail'
);
assert(
  /mg\.gain\.exponentialRampToValueAtTime\(\.001,\s*t\s*\+\s*spec\.metalTailSec\)/.test(main),
  'synthHihat uses resolver-provided metalTailSec for metallic hihat tail shaping'
);
assert(
  /function\s+previewHihat\s*\(\s*openAmount\s*\)\s*\{[\s\S]*const\s+p\s*=\s*\{\s*\.\.\.tr\.p,\s*open:\s*openAmount\s*\}[\s\S]*synthHihat\(t,\s*tr\.vol,\s*p\)/.test(main),
  'hihat audition/previews exercise the same open/closed choke path as sequenced playback'
);

console.log('Issue 003 hihat choke runtime checks passed.');
