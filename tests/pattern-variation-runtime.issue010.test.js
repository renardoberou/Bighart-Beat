#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(
  html.includes('src="src/state/pattern-variation.js"'),
  'index.html loads the controlled pattern variation state module before main.js'
);
assert(
  html.includes('id="variationBtn"'),
  'UI exposes a compact controlled variation button'
);
assert(
  /VAR\s*\+?1|VARIATION/i.test(html),
  'variation button is labeled clearly for performance use'
);
assert(
  /function\s+createControlledPatternVariation\s*\(/.test(main),
  'runtime centralizes variation creation in createControlledPatternVariation'
);
assert(
  /targetIndex\s*:\s*\(S\.patt\s*\+\s*1\)\s*%\s*4/.test(main),
  'runtime writes the controlled variation to the next pattern bank'
);
assert(
  /State\.applyControlledPatternVariation\(\{[\s\S]*patterns:\s*PATTERNS[\s\S]*ratchets:\s*RATCHETS[\s\S]*hihatOpenness:\s*HHT_OPENNESS/.test(main),
  'runtime delegates mutation to pure State.applyControlledPatternVariation helper'
);
assert(
  /PATTERNS\[result\.targetIndex\]\s*=\s*result\.patterns\[result\.targetIndex\]/.test(main),
  'runtime applies returned target pattern bank'
);
assert(
  /RATCHETS\[result\.targetIndex\]\s*=\s*result\.ratchets\[result\.targetIndex\]/.test(main),
  'runtime applies returned target ratchet bank'
);
assert(
  /HHT_OPENNESS\[result\.targetIndex\]\s*=\s*result\.hihatOpenness\[result\.targetIndex\]/.test(main),
  'runtime applies returned target hihat openness bank'
);
assert(
  /selectPattern\(result\.targetIndex,\s*\{\s*source:\s*'manual'/.test(main),
  'runtime selects the newly created variation pattern'
);
assert(
  /renderRhythmIntelligence\(\)/.test(main),
  'variation creation refreshes rhythm intelligence'
);
assert(
  /autosave\(\)/.test(main),
  'variation creation autosaves'
);
assert(
  /\$\('variationBtn'\)\.addEventListener\('click',\s*createControlledPatternVariation\)/.test(main),
  'variation button is wired in runtime'
);
assert(
  /\.variation-btn|#variationBtn/.test(css),
  'CSS includes mobile-friendly styling hook for variation control'
);

console.log('pattern variation runtime issue010 tests passed');
