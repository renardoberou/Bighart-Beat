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

function assertResolverCoherentOptionalTail({ label, gateName, gainName, sourceName, tailName }) {
  const blockMatch = synth.match(new RegExp(`if\\s*\\(hihatBudget\\.${gateName}[\\s\\S]*?${sourceName}\\.start\\(t\\);\\s*${sourceName}\\.stop\\([^;]+\\);\\s*\\}`));
  assert(blockMatch, `${label}: optional runtime block is present`);
  const block = blockMatch[0];
  assert(
    new RegExp(`${gainName}\\.gain\\.setTargetAtTime\\(\\.001,\\s*t\\s*\\+\\s*spec\\.${tailName},\\s*spec\\.tailReleaseTau\\)`).test(block),
    `${label}: schedules the resolver tail with setTargetAtTime and spec.tailReleaseTau`
  );
  assert(
    !new RegExp(`${gainName}\\.gain\\.exponentialRampToValueAtTime\\(\\.001,\\s*t\\s*\\+\\s*spec\\.${tailName}`).test(block),
    `${label}: does not undercut resolver tail with a hard exponential ramp at nominal tail time`
  );
  assert(
    new RegExp(`${sourceName}\\.stop\\(t\\s*\\+\\s*spec\\.${tailName}\\s*\\+\\s*spec\\.tailReleaseTau\\s*\\*\\s*4\\)`).test(block),
    `${label}: source remains alive for the full resolver release tau window`
  );
}

assertResolverCoherentOptionalTail({
  label: 'IDM spark layer',
  gateName: 'useIdmSpark',
  gainName: 'sparkGain',
  sourceName: 'spark',
  tailName: 'idmSparkTailSec',
});

assertResolverCoherentOptionalTail({
  label: 'ghost tick layer',
  gateName: 'useGhostTick',
  gainName: 'ghostGain',
  sourceName: 'ghostTick',
  tailName: 'ghostTickTailSec',
});

assert(
  /const\s+hihatTailSec\s*=\s*Math\.max\([\s\S]*useIdmSpark[\s\S]*spec\.idmSparkTailSec\s*\+\s*spec\.tailReleaseTau\s*\*\s*4[\s\S]*useGhostTick[\s\S]*spec\.ghostTickTailSec\s*\+\s*spec\.tailReleaseTau\s*\*\s*4/.test(synth),
  'route lifetime budget keeps IDM spark and ghost tick alive for their full resolver release tau windows'
);

console.log('Issue 003 hihat runtime tail coherence checks passed.');
