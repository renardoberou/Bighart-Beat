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
  /styles\/main\.css\?v=issue001-brainloop-status/.test(html),
  'index busts the stylesheet cache for the Brain Loop quick-action/status button styles'
);
assert(
  /<button(?=[^>]*id="brainLoopQuickBtn")(?=[^>]*class="[^"]*brain-loop-quick-btn[^"]*")[^>]*>[\s\S]*BRAIN\s+LOOP[\s\S]*<\/button>/i.test(html),
  'sequencer tools expose a compact Brain Loop quick-action button near the performance controls'
);
assert(
  /id="brainLoopQuickBtn"[^>]*title="[^"]*Rhythm Intelligence[^"]*next pattern/i.test(html),
  'Brain Loop quick action explains that it applies the Rhythm Intelligence action to the next pattern'
);
assert(
  /const\s+quickActionBtn\s*=\s*\$\('brainLoopQuickBtn'\)/.test(main),
  'runtime keeps a local quick Brain Loop button reference for truthful enabled/disabled state'
);
assert(
  /quickActionBtn\.disabled\s*=\s*!action/.test(main),
  'runtime disables the quick Brain Loop button when analysis has no mutation action'
);
assert(
  /quickActionBtn\.textContent\s*=\s*action\s*&&\s*action\.reason\s*\?\s*\('BRAIN LOOP · '\s*\+\s*action\.reason\)\s*:\s*'BRAIN LOOP OK'/.test(main),
  'runtime mirrors the resolved dynamic Brain Loop action label onto the quick button'
);
assert(
  /\$\('brainLoopQuickBtn'\)\.addEventListener\('click',\s*createRhythmActionVariation\)/.test(main),
  'quick Brain Loop button reuses the existing analysis-to-action variation path'
);
assert(
  /\.brain-loop-quick-btn\s*\{[\s\S]*border:\s*1px\s+solid\s+rgba\(74,184,112,\.45\)[\s\S]*color:\s*var\(--greenLt\)[\s\S]*min-height:\s*28px/.test(css),
  'quick Brain Loop button has its own compact green cognitive-action styling'
);
assert(
  /@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.brain-loop-quick-btn\s*\{[\s\S]*width:\s*100%[\s\S]*min-height:\s*44px[\s\S]*touch-action:\s*manipulation/.test(css),
  'quick Brain Loop button becomes a full-width 44px mobile touch target'
);

console.log('mobile Brain Loop quick action issue001 checks passed');
