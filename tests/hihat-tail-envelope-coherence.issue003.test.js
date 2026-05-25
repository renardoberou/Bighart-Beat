#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const synthMatch = main.match(/function\s+synthHihat\s*\(\s*t,\s*v,\s*p\s*\)\s*\{([\s\S]*?)\n\}\n\nfunction\s+previewHihat/);
assert(synthMatch, 'synthHihat runtime body is discoverable');
const synth = synthMatch[1];

function assertSingleCoherentTailPath({ label, gainName, tailExpr, expectedTargetTime, stopExpr, blockPattern }) {
  const blockMatch = synth.match(blockPattern);
  assert(blockMatch, `${label}: runtime layer block is present`);
  const block = blockMatch[0];
  assert(
    new RegExp(`${gainName}\\.gain\\.setTargetAtTime\\(\\.001,\\s*${expectedTargetTime},\\s*spec\\.tailReleaseTau`).test(block),
    `${label}: uses resolver-driven setTargetAtTime tail release`
  );
  assert(
    !new RegExp(`${gainName}\\.gain\\.exponentialRampToValueAtTime\\(\\.001,\\s*t\\s*\\+\\s*${tailExpr}`).test(block),
    `${label}: does not add a hard exponential ramp at the nominal tail that can flatten soft/open tails early`
  );
  assert(
    new RegExp(`${stopExpr}\\.stop\\(t\\s*\\+\\s*${tailExpr}\\s*\\+\\s*spec\\.tailReleaseTau\\s*\\*\\s*4\\)`).test(block),
    `${label}: source remains alive through the resolver release tail`
  );
}

assertSingleCoherentTailPath({
  label: 'noise/open sizzle layer',
  gainName: 'ng',
  tailExpr: 'spec\\.noiseTailSec',
  expectedTargetTime: 't\\s*\\+\\s*spec\\.noiseTailSec\\s*\\*\\s*spec\\.openTailDamp',
  stopExpr: 'ns',
  blockPattern: /const\s+ng\s*=\s*A\.createGain\(\)[\s\S]*?ns\.start\(t\);\s*ns\.stop\([^;]+\);/,
});

assertSingleCoherentTailPath({
  label: 'open shimmer layer',
  gainName: 'sg',
  tailExpr: 'spec\\.openShimmerTailSec',
  expectedTargetTime: 't\\s*\\+\\s*spec\\.openShimmerTailSec\\s*\\*\\s*spec\\.openTailDamp',
  stopExpr: 'shimmer',
  blockPattern: /if\s*\(hihatBudget\.useOpenShimmer[\s\S]*?shimmer\.start\(t\);\s*shimmer\.stop\([^;]+\);\s*\}/,
});

assertSingleCoherentTailPath({
  label: 'open body layer',
  gainName: 'bg',
  tailExpr: 'spec\\.openBodyTailSec',
  expectedTargetTime: 't\\s*\\+\\s*spec\\.openBodyTailSec\\s*\\*\\s*spec\\.openTailDamp',
  stopExpr: 'body',
  blockPattern: /if\s*\(hihatBudget\.useOpenBody[\s\S]*?body\.start\(t\);\s*body\.stop\([^;]+\);\s*\}/,
});

const flutterBlock = synth.match(/if\s*\(hihatBudget\.useOpenFlutter[\s\S]*?flutter\.start\(t\);\s*flutter\.stop\([^;]+\);\s*\}/);
assert(flutterBlock, 'open flutter layer: runtime layer block is present');
assert(
  /flutterGain\.gain\.setTargetAtTime\(\.001,\s*t\s*\+\s*spec\.openFlutterTailSec\s*\*\s*openSizzleTailHold,\s*spec\.tailReleaseTau\s*\*\s*\.45\)/.test(flutterBlock[0]),
  'open flutter layer: uses resolver-driven setTargetAtTime tail release with its flutter tau scale'
);
assert(
  !/flutterGain\.gain\.exponentialRampToValueAtTime\(\.001,\s*t\s*\+\s*spec\.openFlutterTailSec\)/.test(flutterBlock[0]),
  'open flutter layer: does not add a hard exponential ramp at the nominal tail'
);
assert(
  /flutter\.stop\(t\s*\+\s*spec\.openFlutterTailSec\s*\+\s*spec\.tailReleaseTau\)/.test(flutterBlock[0]),
  'open flutter layer: source remains alive through its explicitly budgeted release tail'
);

const metalBlock = synth.match(/if\s*\(spec\.metalGain\s*>\s*0\.001\s*&&\s*metallicFrequencies\.length\)\s*\{[\s\S]*?for\s*\(const\s+frequency\s+of\s+metallicFrequencies\)\s*\{[\s\S]*?o\.start\(t\);\s*o\.stop\([^;]+\);\s*\}\s*\}/);
assert(metalBlock, 'metallic layer: runtime oscillator block is present');
assert(
  /mg\.gain\.setTargetAtTime\(\.001,\s*t\s*\+\s*spec\.metalTailSec\s*\*\s*spec\.openTailDamp,\s*spec\.tailReleaseTau\s*\*\s*\.75\)/.test(metalBlock[0]),
  'metallic layer: uses resolver-driven setTargetAtTime tail release'
);
assert(
  !/mg\.gain\.exponentialRampToValueAtTime\(\.001,\s*t\s*\+\s*spec\.metalTailSec\)/.test(metalBlock[0]),
  'metallic layer: does not add a hard exponential ramp at the nominal tail'
);
assert(
  /o\.stop\(t\s*\+\s*spec\.metalTailSec\s*\+\s*spec\.tailReleaseTau\s*\*\s*4\)/.test(metalBlock[0]),
  'metallic layer: oscillators remain alive through the resolver release tail'
);

assert(
  /const\s+hihatTailSec\s*=\s*Math\.max\([\s\S]*spec\.noiseTailSec\s*\+\s*spec\.tailReleaseTau\s*\*\s*4[\s\S]*spec\.openShimmerTailSec\s*\+\s*spec\.tailReleaseTau\s*\*\s*4[\s\S]*spec\.openBodyTailSec\s*\+\s*spec\.tailReleaseTau\s*\*\s*4[\s\S]*spec\.openFlutterTailSec\s*\+\s*spec\.tailReleaseTau[\s\S]*spec\.metalTailSec\s*\+\s*spec\.tailReleaseTau\s*\*\s*4/.test(synth),
  'route lifetime accounts for full noise/shimmer/body, explicit flutter, and metallic release tails'
);

console.log('Issue 003 hihat tail-envelope coherence checks passed.');
