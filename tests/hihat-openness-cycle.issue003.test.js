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
  /if\s*\(\s*tr\.id\s*===\s*['"]hihat['"]\s*&&\s*wasOn\s*&&\s*TRACKS\.indexOf\(tr\)\s*===\s*S\.sel\s*\)[\s\S]*State\.cycleHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)[\s\S]*return;[\s\S]*State\.toggleStep\(PATTERNS\[S\.patt\],\s*tr\.id,\s*i,\s*RATCHETS\[S\.patt\]\)/.test(clickBlock),
  'tapping an already-on hihat cell while HHT is selected cycles closed/tight/open before any toggle can turn it off'
);
assert(
  /tr\.id\s*===\s*['"]hihat['"][\s\S]*State\.setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*HHT_PLACE\)/.test(clickBlock),
  'tapping an off hihat cell still turns it on with the selected placement'
);

console.log('Issue 003 hihat openness cycle checks passed.');
