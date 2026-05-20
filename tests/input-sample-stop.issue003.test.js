#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const match = main.match(/function\s+synthInput\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
assert(match, 'synthInput voice function exists in main runtime');

const synthInput = match[0];

assert(
  /const\s+sampleDur\s*=\s*tr\.smp\.duration\s*\/\s*rate/.test(synthInput),
  'synthInput derives playback-rate-aware sample duration',
);
assert(
  /const\s+dur\s*=\s*p\.decay\s*<\s*1\.0\s*\?\s*sampleDur\s*\*\s*p\.decay\s*:\s*sampleDur/.test(synthInput),
  'synthInput derives audible duration from sample duration and decay without shortening full one-shots',
);
assert(
  /g\.gain\.exponentialRampToValueAtTime\(\.001,\s*t \+ dur\)/.test(synthInput),
  'synthInput keeps short-decay fade envelope ending at the derived audible duration',
);
assert(
  /const\s+stopAt\s*=\s*t \+/.test(synthInput) && /src\.stop\(\s*stopAt\s*\)/.test(synthInput),
  'synthInput schedules BufferSource stop from the trigger time so faded long samples do not keep running',
);
assert(
  /stopAt\s*=\s*t \+[\s\S]*dur/.test(synthInput),
  'synthInput stop time is decay-aware, not just the raw sample length',
);
assert(
  /Math\.min\([^)]*sampleDur/.test(synthInput) || /p\.decay\s*<\s*1\.0[\s\S]*src\.stop/.test(synthInput),
  'synthInput stop scheduling is bounded by intended audible duration without extending beyond the source sample',
);

console.log('Issue 003 input sample stop scheduling checks passed.');
