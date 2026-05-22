#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const clickStart = main.indexOf("c.addEventListener('click', () => {");
assert(clickStart >= 0, 'sequencer cells wire a click handler');
const clickEnd = main.indexOf("c.addEventListener('contextmenu'", clickStart);
assert(clickEnd > clickStart, 'sequencer click handler can be inspected');
const clickBlock = main.slice(clickStart, clickEnd);

const openBranchStart = clickBlock.indexOf('if (isOpenHihatRow) {');
assert(openBranchStart >= 0, 'click handler has open-hihat virtual row branch');
const openBranchEnd = clickBlock.indexOf('return;', openBranchStart);
assert(openBranchEnd > openBranchStart, 'open-hihat branch returns after handling the virtual row');
const openBranch = clickBlock.slice(openBranchStart, openBranchEnd + 'return;'.length);

assert(
  /HHT_OPENNESS\[S\.patt\]\s*=\s*State\.setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*1\)/.test(openBranch),
  'OHH branch sets the step to open before previewing'
);
assert(
  /buildSeq\(\)[\s\S]*renderRhythmIntelligence\(\)[\s\S]*autosave\(\)[\s\S]*if\s*\(\s*!S\.playing\s*(?:&&\s*!wasOn\s*)?\)\s*previewHihat\(\s*1\s*\)[\s\S]*return;/.test(openBranch),
  'OHH click previews open hihat only while stopped, after build/render/autosave and before return'
);
assert(
  /else\s+if \(trackId === ['"]hihat['"] && wasOn\) \{[\s\S]*?State\.toggleHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\)[\s\S]*?\}/.test(openBranch) &&
    /buildSeq\(\)[\s\S]*renderRhythmIntelligence\(\)[\s\S]*autosave\(\)[\s\S]*if\s*\(\s*!S\.playing\s*\)\s*previewHihat\(\s*1\s*\)[\s\S]*return;/.test(openBranch),
  'OHH active accent taps and OFF→ON placements preview open hihat while stopped; clear remains explicit double-tap'
);

const activeAccentBranchStart = clickBlock.indexOf("if (trackId === 'hihat' && isCellOn()) {");
assert(activeAccentBranchStart >= 0, 'click handler has active HHT accent branch');
const activeAccentBranchEnd = clickBlock.indexOf('return;', activeAccentBranchStart);
assert(activeAccentBranchEnd > activeAccentBranchStart, 'active HHT accent branch returns');
const activeAccentBranch = clickBlock.slice(activeAccentBranchStart, activeAccentBranchEnd + 'return;'.length);
assert(
  /HHT_ACCENT\[S\.patt\]\s*=\s*State\.toggleHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\)/.test(activeAccentBranch),
  'active HHT branch toggles accent instead of changing selected placement'
);
assert(
  /buildSeq\(\)[\s\S]*renderRhythmIntelligence\(\)[\s\S]*autosave\(\)[\s\S]*if\s*\(\s*!S\.playing\s*\)\s*previewHihat\(\s*State\.getHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)\s*\)[\s\S]*return;/.test(activeAccentBranch),
  'active HHT accent previews stored openness only while stopped, after mutation/build/autosave and before return'
);

const normalBranchStart = clickBlock.indexOf('const result = State.toggleStep(PATTERNS[S.patt], tr.id, i, RATCHETS[S.patt]);');
assert(normalBranchStart >= 0, 'click handler has normal toggle branch');
const normalBranch = clickBlock.slice(normalBranchStart);
assert(
  /if \(trackId === 'hihat'\) \{[\s\S]*!PATTERNS\[S\.patt\]\[trackId\]\[i\][\s\S]*State\.clearHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)[\s\S]*else if \(!wasOn\)[\s\S]*State\.setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*HHT_PLACE\)[\s\S]*\}/.test(normalBranch),
  'normal HHT toggle preserves off-clear/on-set openness semantics'
);
assert(
  /renderRhythmIntelligence\(\)[\s\S]*autosave\(\)[\s\S]*if\s*\(\s*trackId\s*===\s*['"]hihat['"]\s*&&\s*!S\.playing\s*(?:&&\s*!wasOn\s*)?\)\s*previewHihat\(\s*State\.getHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)\s*\)/.test(normalBranch),
  'normal HHT toggle previews the current stored openness only while stopped, after mutation/build/autosave'
);
assert(
  /renderRhythmIntelligence\(\)[\s\S]*autosave\(\)[\s\S]*if\s*\(\s*trackId\s*===\s*['"]hihat['"]\s*&&\s*!S\.playing\s*&&\s*!wasOn\s*\)\s*previewHihat\(\s*State\.getHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)\s*\)/.test(normalBranch),
  'normal HHT toggle audition is result-aware: only OFF→ON hihat placement previews, ON→OFF deletion stays silent'
);

assert(
  !/if\s*\(\s*S\.playing\s*\)\s*previewHihat/.test(clickBlock),
  'hihat cell audition is never gated to play while transport is running'
);

console.log('Issue 003 stopped hihat cell audition checks passed.');
