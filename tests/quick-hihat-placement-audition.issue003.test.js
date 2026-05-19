#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = js.indexOf(marker);
  assert(start !== -1, `${name} function exists`);
  const bodyStart = js.indexOf('{', start);
  assert(bodyStart !== -1, `${name} function has body`);
  let depth = 0;
  for (let i = bodyStart; i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') depth--;
    if (depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`${name} function body did not close`);
}

const quickPlacement = extractFunction('wireQuickHihatPlacement');
assert(/querySelectorAll\('\[data-quick-hht-place\]'\)/.test(quickPlacement), 'quick HHT placement wiring still targets the always-visible sequencer controls');
assert(/setHihatPlacement\(b\.dataset\.quickHhtPlace\)/.test(quickPlacement), 'quick HHT placement still selects the requested openness');
assert(/previewHihat\(\s*parseFloat\(b\.dataset\.quickHhtPlace\)\s*\)/.test(quickPlacement), 'quick HHT placement auditions the selected openness through the real hihat preview path');
assert(quickPlacement.indexOf('setHihatPlacement') < quickPlacement.indexOf('previewHihat'), 'quick HHT placement selects the openness before auditioning it');
assert(!/PATTERNS\s*\[/.test(quickPlacement), 'quick HHT placement audition must not mutate pattern data');
assert(!/\b(?:play|runSch)\s*\(/.test(quickPlacement), 'quick HHT placement audition must not start the transport or scheduler');

console.log('Issue 003 quick hihat placement audition checks passed.');
