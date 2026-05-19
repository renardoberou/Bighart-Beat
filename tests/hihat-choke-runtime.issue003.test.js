#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(
  /const\s+hihatChokeState\s*=\s*\{\s*gain:\s*null,\s*open:\s*false\s*\}/.test(main),
  'runtime keeps shared hihat choke state between hits'
);
assert(
  /function\s+triggerHihatChoke\s*\(\s*t,\s*openAmount,\s*choke,\s*spec\s*\)\s*\{[\s\S]*const\s+previous\s*=\s*hihatChokeState\.gain[\s\S]*const\s+wasOpen\s*=\s*hihatChokeState\.open[\s\S]*const\s+isOpen\s*=\s*openAmount\s*>\s*\.5/.test(main),
  'hihat choke helper compares the new hat openness with the previous active tail'
);
assert(
  /if\s*\(\s*previous\s*&&\s*previous\.gain\s*\)\s*\{[\s\S]*g\.cancelScheduledValues\(t\)[\s\S]*g\.setValueAtTime\(Math\.max\(\.001,\s*g\.value\s*\|\|\s*\.001\),\s*t\)[\s\S]*g\.setTargetAtTime\(\.0008,\s*t,\s*tau\)/.test(main),
  'hihat choke helper safely cancels and ramps the previous tail instead of letting open hats pile up'
);
assert(
  /const\s+tau\s*=\s*!isOpen\s*\?\s*spec\.chokeClosedTau\s*:\s*\(\s*wasOpen\s*\?\s*spec\.chokeOpenTau\s*:\s*spec\.chokeOpenTau\s*\*\s*\.75\s*\)/.test(main),
  'closed hihat hits use the fast closed choke time, while open-to-open transitions keep a softer tail'
);
assert(
  /hihatChokeState\.gain\s*=\s*choke[\s\S]*hihatChokeState\.open\s*=\s*isOpen/.test(main),
  'hihat choke helper records the current tail for the next hat hit'
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
