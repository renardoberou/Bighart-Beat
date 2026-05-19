#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(
  /let\s+lastBrainLoopResultStatus\s*=\s*''\s*;/.test(main),
  'runtime remembers the last applied Brain Loop result status instead of treating the chip as render-only text'
);

assert(
  /lastBrainLoopResultStatus\s*=\s*formatBrainLoopResultStatus\(action,\s*result\.targetIndex\)\s*;/.test(main),
  'successful Brain Loop actions store the formatted result before ordinary re-renders can overwrite it'
);

assert(
  /\$\('brainLoopStatus'\)\.textContent\s*=\s*lastBrainLoopResultStatus\s*\|\|\s*\(action\s*\?\s*'BRAIN LOOP READY'\s*:\s*'NO ACTION NEEDED'\)/.test(main),
  'renderRhythmIntelligence preserves the last applied Brain Loop result across ordinary re-renders'
);

assert(
  /lastBrainLoopResultStatus\s*=\s*''\s*;[\s\S]{0,240}\$\('brainLoopStatus'\)\.textContent\s*=\s*'NO ACTION NEEDED'\s*;[\s\S]{0,240}toast\('ANCHOR OK'\)/.test(main),
  'a no-action Brain Loop attempt clears stale result state and immediately updates the visible status chip before reporting OK'
);

console.log('mobile Brain Loop status persistence issue001/003 checks passed');
