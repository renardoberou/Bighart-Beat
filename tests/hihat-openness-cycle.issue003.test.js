#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const State = require(path.join(root, 'src', 'state', 'pattern-operations.js'));
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

let openness = State.createDefaultHihatOpennessGrid();
openness = State.cycleHihatOpenness(openness, 3);
assert.strictEqual(State.getHihatOpenness(openness, 3), 0.45, 'first tap on an active hihat makes it tight');
openness = State.cycleHihatOpenness(openness, 3);
assert.strictEqual(State.getHihatOpenness(openness, 3), 1, 'second tap on an active hihat makes it open');
openness = State.cycleHihatOpenness(openness, 3);
assert.strictEqual(State.getHihatOpenness(openness, 3), 0, 'third tap on an active hihat returns it closed');
assert.throws(() => State.cycleHihatOpenness(openness, 16), /Step index/, 'cycling validates step bounds');

const clickStart = main.indexOf("c.addEventListener('click', () => {");
assert(clickStart >= 0, 'sequencer cells define click handler');
const clickEnd = main.indexOf('});', clickStart);
assert(clickEnd > clickStart, 'sequencer click handler block can be inspected');
const clickBlock = main.slice(clickStart, clickEnd + 3);

assert(
  /const\s+currentOpen\s*=\s*State\.getHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)/.test(clickBlock),
  'selected active hihat clicks inspect the current openness before deciding whether to edit or delete'
);
assert(
  /if\s*\(\s*currentOpen\s*!==\s*HHT_PLACE\s*\)[\s\S]*State\.setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*HHT_PLACE\)[\s\S]*return;[\s\S]*State\.toggleStep\(PATTERNS\[S\.patt\],\s*tr\.id,\s*i,\s*RATCHETS\[S\.patt\]\)/.test(clickBlock),
  'tapping an already-on hihat with different openness changes it to selected placement before any toggle'
);
assert(
  /State\.toggleStep\(PATTERNS\[S\.patt\],\s*tr\.id,\s*i,\s*RATCHETS\[S\.patt\]\)[\s\S]*wasOn[\s\S]*State\.clearHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)[\s\S]*State\.setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*HHT_PLACE\)/.test(clickBlock),
  'tapping an already-on hihat that already matches the selected placement toggles it off and clears openness; off cells still use selected placement'
);
assert(
  !/State\.cycleHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)/.test(clickBlock),
  'selected active hihat clicks no longer cycle endlessly and block deletion'
);

console.log('Issue 003 hihat openness cycle checks passed.');
