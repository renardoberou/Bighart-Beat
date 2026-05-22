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
const clickEnd = main.indexOf("c.addEventListener('contextmenu'", clickStart);
assert(clickEnd > clickStart, 'sequencer click handler block can be inspected');
const clickBlock = main.slice(clickStart, clickEnd);

assert(
  /if \(trackId === ['"]hihat['"] && isCellOn\(\)\) \{[\s\S]*State\.toggleHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\)[\s\S]*return;[\s\S]*\}/.test(clickBlock),
  'selected active hihat clicks use the active-hat accent toggle path'
);
assert(
  !/currentOpen\s*!==\s*HHT_PLACE[\s\S]*State\.setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*HHT_PLACE\)[\s\S]*return;/.test(clickBlock),
  'tapping an already-on hihat no longer changes it to selected placement before accent toggle'
);
const normalBranchStart = clickBlock.indexOf('const result = State.toggleStep(PATTERNS[S.patt], tr.id, i, RATCHETS[S.patt]);');
assert(normalBranchStart >= 0, 'normal hihat toggle branch exists');
const normalBranch = clickBlock.slice(normalBranchStart);
assert(
  /const result = State\.toggleStep\(PATTERNS\[S\.patt\],\s*tr\.id,\s*i,\s*RATCHETS\[S\.patt\]\)[\s\S]*if \(trackId === ['"]hihat['"]\) \{[\s\S]*State\.clearHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)[\s\S]*else if \(!wasOn\)[\s\S]*State\.setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*HHT_PLACE\)/.test(normalBranch),
  'off cells still use selected placement, and intentional hihat removal clears openness'
);
assert(
  !/State\.cycleHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)/.test(clickBlock),
  'selected active hihat clicks no longer cycle endlessly and block deletion'
);

console.log('Issue 003 hihat openness cycle checks passed.');
