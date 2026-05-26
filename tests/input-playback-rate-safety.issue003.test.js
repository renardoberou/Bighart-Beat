#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function extractFunction(name) {
  const start = main.search(new RegExp(`function\\s+${name}\\s*\\(`));
  assert(start >= 0, `${name}() exists`);
  const open = main.indexOf('{', start);
  assert(open >= 0, `${name}() has a body`);
  let depth = 0;
  for (let i = open; i < main.length; i += 1) {
    if (main[i] === '{') depth += 1;
    if (main[i] === '}') depth -= 1;
    if (depth === 0) return main.slice(open + 1, i);
  }
  throw new Error(`${name}() body did not close`);
}

const synthInput = extractFunction('synthInput');

assert(
  /const\s+rawPitch\s*=\s*Number\(\s*p\.pitch\s*\)/.test(synthInput),
  'synthInput normalizes persisted p.pitch through Number() before safety checks',
);
assert(
  /Number\.isFinite\(\s*rawPitch\s*\)[\s\S]*Math\.abs\(\s*rawPitch\s*\)\s*>?=\s*\.01[\s\S]*\?\s*rawPitch\s*:\s*1/.test(synthInput),
  'synthInput defaults non-finite and zero-ish input pitch values to 1',
);
assert(
  /const\s+safePitch\s*=/.test(synthInput),
  'synthInput derives a single bounded safePitch for playback and scheduling',
);
assert(
  /Math\.min\(\s*Math\.abs\(\s*finitePitch\s*\)[\s\S]*16\s*\)/.test(synthInput) ||
    /Math\.min\(\s*16\s*,\s*Math\.abs\(\s*finitePitch\s*\)\s*\)/.test(synthInput),
  'synthInput clamps safePitch to a finite maximum rate',
);
assert(
  /const\s+sampleDur\s*=\s*tr\.smp\.duration\s*\/\s*Math\.abs\(\s*safePitch\s*\)/.test(synthInput) ||
    (/const\s+rate\s*=\s*Math\.abs\(\s*safePitch\s*\)/.test(synthInput) &&
      /const\s+sampleDur\s*=\s*tr\.smp\.duration\s*\/\s*rate/.test(synthInput)),
  'synthInput schedules sample duration from the same safePitch/safeRate used for playback',
);
assert(
  /src\.playbackRate\.value\s*=\s*safePitch\s*;/.test(synthInput),
  'synthInput assigns safePitch to BufferSource playbackRate',
);
assert(
  !/src\.playbackRate\.value\s*=\s*p\.pitch\s*;/.test(synthInput),
  'synthInput must not assign raw persisted p.pitch to playbackRate',
);
assert(
  !/const\s+rate\s*=\s*Math\.max\(\s*\.01\s*,\s*Math\.abs\(\s*p\.pitch\s*\|\|\s*1\s*\)\s*\)/.test(synthInput),
  'synthInput must not use a separate unbounded p.pitch fallback expression for duration',
);

console.log('Issue 003 input playback-rate safety static checks passed.');
