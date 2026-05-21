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
  /const\s+attackSec\s*=\s*\.00[2-5]/.test(synthInput),
  'synthInput defines a 2-5 ms click-guard micro-attack for arbitrary input samples',
);
assert(
  /const\s+attackEnd\s*=\s*Math\.min\(\s*t \+ attackSec,\s*stopAt\s*\)/.test(synthInput),
  'synthInput bounds the click-guard attack endpoint at the source stop time for very short samples',
);
assert(
  /g\.gain\.setValueAtTime\(0,\s*t\)/.test(synthInput) && /g\.gain\.linearRampToValueAtTime\(v,\s*attackEnd\)/.test(synthInput),
  'synthInput ramps input sample gain up from silence to requested velocity over the bounded micro-attack',
);
assert(
  /const\s+releaseSec\s*=\s*\.00[5-9]/.test(synthInput) || /const\s+releaseSec\s*=\s*\.01/.test(synthInput),
  'synthInput defines a 5-10 ms pre-stop release for full-length and decayed input samples',
);
assert(
  /const\s+fadeStart\s*=\s*Math\.min\(\s*stopAt,\s*Math\.max\(attackEnd,\s*stopAt - releaseSec\)\s*\)/.test(synthInput),
  'synthInput schedules the stop fade shortly before BufferSource stop time without placing release automation after stop',
);
assert(
  !/const\s+fadeStart\s*=\s*Math\.max\(t,\s*stopAt - releaseSec\)/.test(synthInput) &&
    !/g\.gain\.setValueAtTime\(v,\s*fadeStart\)/.test(synthInput),
  'synthInput must not set full velocity at a fadeStart that can equal trigger time and override the click-guard attack for very short full-length samples',
);
assert(
  /g\.gain\.setValueAtTime\(p\.decay\s*<\s*1\.0\s*\?\s*\.001\s*:\s*v,\s*fadeStart\)/.test(synthInput) && /g\.gain\.linearRampToValueAtTime\(0,\s*stopAt\)/.test(synthInput),
  'synthInput applies a pre-stop release to silence before stopping to prevent clicks/pops without re-amplifying decayed samples',
);
assert(
  /const\s+decayEnd\s*=\s*Math\.min\(\s*stopAt,\s*Math\.max\(attackEnd,\s*fadeStart\)\s*\)/.test(synthInput) && /g\.gain\.exponentialRampToValueAtTime\(\.001,\s*decayEnd\)/.test(synthInput),
  'synthInput keeps short-decay fade envelope leading into the pre-stop release',
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
