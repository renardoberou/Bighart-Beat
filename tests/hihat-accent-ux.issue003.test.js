#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const labelSelection = main.match(/if \(([^\n]+)\) lbl\.classList\.add\(['"]sel['"]\)/);
assert(labelSelection, 'sequencer row labels apply selected class');
assert(
  /trackIndex\s*===\s*S\.sel/.test(labelSelection[1]) && !/!isOpenHihatRow/.test(labelSelection[1]),
  'OHH row label visibly/semantically receives .sel when its backing hihat track is selected',
);

const openHihatClickBranch = main.match(/if \(isOpenHihatRow\) \{([\s\S]*?)\n        \}\n        if \(trackId === ['"]synth['"]/);
assert(openHihatClickBranch, 'OHH row click branch is present');
assert(
  /trackId\s*===\s*['"]hihat['"]\s*&&\s*wasOn(?!\s*&&\s*trackIndex\s*===\s*S\.sel)/.test(openHihatClickBranch[1]),
  'active OHH taps toggle accent without depending on the currently selected track',
);
assert(
  openHihatClickBranch[1].indexOf('toggleHihatAccent') !== -1 &&
    openHihatClickBranch[1].indexOf('toggleHihatAccent') < openHihatClickBranch[1].indexOf('toggleStep'),
  'active OHH accent toggle runs before OHH row can toggle/delete the hat',
);
assert(
  /else\s+if \(trackId === ['"]hihat['"] && wasOn\) \{[\s\S]*?toggleHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\)[\s\S]*?\}[\s\S]*?if \(!S\.playing\) previewHihat\(1\);/.test(openHihatClickBranch[1]),
  'active OHH accent taps audition open hihat while stopped without starting transport',
);

assert(
  /if \(trackId === ['"]hihat['"] && isCellOn\(\)\) \{[\s\S]*?HHT_ACCENT\[S\.patt\]\s*=\s*State\.toggleHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\);[\s\S]*?previewHihat\(State\.getHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)\);[\s\S]*?return;[\s\S]*?\}/.test(main),
  'active HHT taps toggle accent and preview hihat without depending on the selected track',
);

const activeHihatAccentBranch = main.match(/if \(trackId === ['"]hihat['"] && isCellOn\(\)\) \{([\s\S]*?)\n        \}/);
assert(activeHihatAccentBranch, 'active HHT accent branch exists for selected and non-selected hihat taps');
assert(
  !/currentOpen\s*!==\s*HHT_PLACE/.test(activeHihatAccentBranch[1]) && !/setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*HHT_PLACE\)/.test(activeHihatAccentBranch[1]),
  'selected active HHT tap toggles ACC instead of first changing openness to selected placement',
);

assert(
  /lbl\.setAttribute\(['"]role['"],\s*['"]tab['"]\)/.test(main) &&
    /lbl\.setAttribute\(['"]aria-selected['"],\s*trackIndex\s*===\s*S\.sel\s*\?\s*['"]true['"]\s*:\s*['"]false['"]\)/.test(main),
  'HHT and OHH row labels expose semantic selected state when their backing hihat track is selected',
);

assert(/c\.addEventListener\(['"]contextmenu['"],[\s\S]*?cycleCellRatchet\(\);[\s\S]*?\}\);/.test(main), 'contextmenu ratchet behavior remains wired');
assert(/pressTimer\s*=\s*setTimeout\([\s\S]*?cycleCellRatchet\(\);[\s\S]*?LONG_PRESS_MS/.test(main), 'long-press ratchet behavior remains wired');
assert(/if \(trackId === ['"]hihat['"]\) \{[\s\S]*?if \(trackId === ['"]hihat['"] && !PATTERNS\[S\.patt\]\[trackId\]\[i\]\) \{[\s\S]*?HHT_ACCENT\[S\.patt\] = State\.clearHihatAccent\(HHT_ACCENT\[S\.patt\], i\);[\s\S]*?\}/.test(main), 'off/clear path still clears hihat accents when a hat is intentionally removed');
assert(
  /c\.addEventListener\(['"]dblclick['"],\s*e\s*=>\s*\{[\s\S]*?clearHihatStep\(i\);[\s\S]*?\}\);/.test(main),
  'active HHT/OHH cells expose explicit double-click clear without stealing single-tap ACC toggles',
);
assert(
  /const\s+LAST_HIHAT_TAP_AT\s*=\s*(?:new\s+Map\(\)|Object\.create\(null\))/.test(main),
  'touch double-tap timing is stored outside rebuilt cell closures',
);
assert(
  !/let\s+lastHihatTapAt\s*=\s*0/.test(main),
  'touch double-tap timing is not closure-local inside buildSeq cells',
);
assert(
  /const\s+hihatTapKey\s*=\s*hihatTapStateKey\(rowSpec\.rowId,\s*i\);[\s\S]*?tapAt\s*-\s*LAST_HIHAT_TAP_AT\[hihatTapKey\]\s*<=\s*320[\s\S]*?clearHihatStep\(i\);/.test(main),
  'touch double-taps on hihat cells persist across rebuilds and use row-aware explicit clear path',
);
assert(
  /function\s+hihatTapStateKey\s*\(\s*rowId\s*,\s*step\s*\)\s*\{[\s\S]*?`\$\{S\.patt\}:\$\{rowId\}:\$\{step\}`[\s\S]*?\}/.test(main) &&
    /function\s+clearHihatTapState\s*\(\s*step\s*\)\s*\{[\s\S]*?LAST_HIHAT_TAP_AT\[hihatTapStateKey\(['"]hihat['"],\s*step\)\]\s*=\s*0;[\s\S]*?LAST_HIHAT_TAP_AT\[hihatTapStateKey\(OPEN_HIHAT_ROW_ID,\s*step\)\]\s*=\s*0;[\s\S]*?\}/.test(main) &&
    /function\s+clearHihatStep\s*\(\s*step\s*\)\s*\{[\s\S]*?PATTERNS\[S\.patt\]\.hihat\[step\]\s*=\s*0;[\s\S]*?clearHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*step\)[\s\S]*?clearHihatAccent\(HHT_ACCENT\[S\.patt\],\s*step\)[\s\S]*?setRatchetCount\(RATCHETS\[S\.patt\],\s*['"]hihat['"],\s*step,\s*1\)[\s\S]*?clearHihatTapState\(step\);[\s\S]*?\}/.test(main),
  'hihat clear removes the backing step and clears openness, accent, ratchet, and both row pending double-tap states',
);
assert(
  /if \(tr\.id === ['"]hihat['"] && !PATTERNS\[S\.patt\]\[trackId\]\[i\]\) \{[\s\S]*?clearHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)[\s\S]*?clearHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\)[\s\S]*?setRatchetCount\(RATCHETS\[S\.patt\],\s*tr\.id,\s*i,\s*1\)[\s\S]*?\}\s*else\s*\{[\s\S]*?cycleRatchetCount/.test(main),
  'hihat ratchet/counterpart path that leaves backing off clears stale openness/accent and resets ratchet instead of cycling ratchet back on',
);
assert(
  /if \(trackId === ['"]hihat['"] && !PATTERNS\[S\.patt\]\[trackId\]\[i\]\) \{[\s\S]*?clearHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)[\s\S]*?clearHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\)[\s\S]*?setRatchetCount\(RATCHETS\[S\.patt\],\s*trackId,\s*i,\s*1\)[\s\S]*?\}/.test(main),
  'any hihat toggle path that leaves the backing hihat step off clears stale openness/accent/ratchet state, including counterpart-row deletion',
);

console.log('Issue 003 hihat accent UX regression checks passed.');
