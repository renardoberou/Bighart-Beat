#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(
  html.includes('id="riFixAnchorBtn"'),
  'RI panel exposes a compact FIX ANCHOR action control'
);
assert(
  /FIX\s+ANCHOR/i.test(html),
  'RI action control is labeled for mobile performance use'
);
assert(
  /function\s+createRhythmActionVariation\s*\(/.test(main),
  'runtime centralizes analysis-guided rhythm action variation creation'
);
assert(
  /Rhythm\.analyzeRhythm\(\{[\s\S]*pattern:\s*PATTERNS\[S\.patt\][\s\S]*ratchets:\s*RATCHETS\[S\.patt\][\s\S]*hihatOpenness:\s*HHT_OPENNESS\[S\.patt\]/.test(main),
  'runtime derives the RI action from the current rhythm analysis'
);
assert(
  /State\.resolveRhythmMutationAction\(\{[\s\S]*analysis[\s\S]*pattern:\s*PATTERNS\[S\.patt\][\s\S]*ratchets:\s*RATCHETS\[S\.patt\]/.test(main),
  'runtime delegates analysis-to-action choice to pure State.resolveRhythmMutationAction helper'
);
assert(
  /State\.applyControlledPatternVariation\(\{[\s\S]*edit:\s*action\.edit/.test(main),
  'runtime writes the resolved RI action through the controlled variation helper'
);
assert(
  /targetIndex\s*:\s*\(S\.patt\s*\+\s*1\)\s*%\s*4/.test(main),
  'runtime writes the RI action variation to the next pattern bank'
);
assert(
  /selectPattern\(result\.targetIndex,\s*\{\s*source:\s*'manual'/.test(main),
  'runtime selects the newly created RI action pattern'
);
assert(
  /renderRhythmIntelligence\(\)/.test(main),
  'runtime refreshes rhythm intelligence after applying RI action'
);
assert(
  /autosave\(\)/.test(main),
  'runtime autosaves after applying RI action'
);
assert(
  /\$\('riFixAnchorBtn'\)\.addEventListener\('click',\s*createRhythmActionVariation\)/.test(main),
  'RI action button is wired without requiring audio context'
);

console.log('rhythm action runtime issue007 tests passed');
