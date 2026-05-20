#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(
  /styles\/main\.css\?v=[^"]+/.test(html),
  'index busts the stylesheet cache for the Brain Loop result status styles'
);

assert(
  /<div\s+class="seq-tools">[\s\S]*id="brainLoopQuickBtn"[\s\S]*id="brainLoopStatus"[\s\S]*<\/div>\s*<div\s+class="seq"/i.test(html),
  'sequencer tools expose a persistent Brain Loop result status beside the quick action surface'
);
assert(
  /id="brainLoopStatus"(?=[^>]*class="[^"]*brain-loop-status[^"]*")(?=[^>]*aria-live="polite")[^>]*>\s*BRAIN LOOP READY\s*<\/div>/i.test(html),
  'Brain Loop result status starts as a polite, screen-reader-visible ready message'
);

assert(
  /\.brain-loop-status\s*\{[\s\S]*min-height:\s*28px[\s\S]*border:\s*1px\s+solid\s+rgba\(74,184,112,\.28\)[\s\S]*color:\s*var\(--greenLt\)/.test(css),
  'Brain Loop status chip has compact green result styling'
);
assert(
  /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.brain-loop-status\s*\{[\s\S]*width:\s*100%[\s\S]*min-height:\s*32px[\s\S]*white-space:\s*normal/.test(css),
  'Brain Loop status chip remains full-width and readable on mobile'
);

assert(
  /function\s+formatBrainLoopResultStatus\s*\(\s*action\s*,\s*targetIndex\s*\)\s*\{[\s\S]*const\s+patternLetter\s*=\s*'ABCD'\[targetIndex\][\s\S]*return\s+patternLetter\s*\+\s*' → '/.test(main),
  'runtime formats a concise persistent Brain Loop result with the target pattern letter'
);
assert(
  /function\s+formatBrainLoopResultStatus[\s\S]*hihatOpen\s*===\s*1\s*\?\s*'OPEN'\s*:\s*hihatOpen\s*===\s*0\.45\s*\?\s*'TIGHT'\s*:\s*'CLOSED'/.test(main),
  'Brain Loop result formatting names hihat openness as CLOSED, TIGHT, or OPEN'
);
assert(
  /\$\('brainLoopStatus'\)\.textContent\s*=\s*lastBrainLoopResultStatus\s*\|\|\s*\(action\s*\?\s*'BRAIN LOOP READY'\s*:\s*'NO ACTION NEEDED'\)/.test(main),
  'renderRhythmIntelligence keeps the Brain Loop status truthful before an action is applied and preserves applied results'
);
assert(
  /\$\('brainLoopStatus'\)\.textContent\s*=\s*formatBrainLoopResultStatus\(action,\s*result\.targetIndex\)/.test(main),
  'successful Brain Loop actions persist the result in the mobile status chip'
);
assert(
  /formatBrainLoopResultStatus[\s\S]*HEARD HAT/.test(main),
  'hihat Brain Loop results persist the audible hihat confirmation'
);

console.log('mobile Brain Loop result status issue001/003 checks passed');
