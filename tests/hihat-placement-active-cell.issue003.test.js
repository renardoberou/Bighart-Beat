#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const cycleStart = main.indexOf('const cycleCellRatchet = () => {');
assert(cycleStart >= 0, 'main defines long-press/context hihat ratchet editor');
const cycleEnd = main.indexOf('};', cycleStart);
assert(cycleEnd > cycleStart, 'cycleCellRatchet block can be inspected');
const cycleBlock = main.slice(cycleStart, cycleEnd + 2);

assert(
  /if\s*\(\s*!wasOn\s*\)\s*PATTERNS\[S\.patt\]\s*=\s*State\.toggleStep\(PATTERNS\[S\.patt\],\s*tr\.id,\s*i\)/.test(cycleBlock),
  'long-press/context still turns an off cell on before cycling ratchets'
);
assert(
  /tr\.id\s*===\s*['"]hihat['"][\s\S]*State\.setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*HHT_PLACE\)/.test(cycleBlock),
  'long-press/context applies selected HHT placement to active hihat cells without toggling them off'
);
assert(
  !/tr\.id\s*===\s*['"]hihat['"]\s*&&\s*!wasOn/.test(cycleBlock),
  'active hihat placement edit must not be limited to cells that were previously off'
);
assert(
  /State\.cycleRatchetCount\(RATCHETS\[S\.patt\],\s*tr\.id,\s*i\)/.test(cycleBlock),
  'long-press/context keeps ratchet cycling behavior'
);
assert(
  /renderRhythmIntelligence\(\)/.test(cycleBlock) && /autosave\(\)/.test(cycleBlock),
  'active hihat placement edits refresh rhythm intelligence and persist'
);

console.log('Issue 003 active hihat placement edit checks passed.');
