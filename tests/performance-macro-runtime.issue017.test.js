#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(
  html.includes('id="performanceMacroBtn"'),
  'index.html exposes the Performance Macro V1 control'
);
assert(
  /PERF MACRO V1/.test(html),
  'Performance Macro V1 has a clear visible label'
);
assert(
  /title="Performance Macro V1: apply the current Brain Loop action to the next queued pattern when CHAIN is on, or the next bank when CHAIN is off"/.test(html),
  'Performance Macro V1 button explains the chain-aware target rule'
);
assert(
  /const\s+performanceMacroBtn\s*=\s*\$\('performanceMacroBtn'\);/.test(main),
  'renderRhythmIntelligence synchronizes the Performance Macro button state'
);
assert(
  /performanceMacroBtn\.disabled\s*=\s*!action;/.test(main),
  'Performance Macro button is disabled when no Brain Loop action is available'
);
assert(
  /performanceMacroBtn\.textContent\s*=\s*action\s*&&\s*action\.reason\s*\?\s*\('PERF MACRO V1 · '\s*\+\s*action\.reason\)\s*:\s*'PERF MACRO V1 OK'/.test(main),
  'Performance Macro button reflects the current Brain Loop reason'
);
assert(
  /\$\('performanceMacroBtn'\)\.addEventListener\('click',\s*createPerformanceMacroV1Variation\)/.test(main),
  'Performance Macro button is wired to the chain-aware variation handler'
);
assert(
  /function\s+resolvePerformanceMacroTargetIndex\s*\(\)\s*\{[\s\S]*S\.patternChain\s*&&\s*S\.patternChain\.enabled[\s\S]*nextQueuedSlot\s*=\s*\(chain\.position\s*\+\s*1\)\s*%\s*chain\.items\.length[\s\S]*return\s*\(S\.patt\s*\+\s*1\)\s*%\s*4;/.test(main),
  'Performance Macro target resolution follows the chain-aware next-slot / next-bank rule'
);

console.log('performance macro runtime issue017 checks passed');
