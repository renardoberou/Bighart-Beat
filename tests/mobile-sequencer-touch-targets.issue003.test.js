'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'main.css'), 'utf8');

function blockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert(match, `${selector} CSS block exists`);
  return match[1];
}

const seq = blockFor('.seq');
const row = blockFor('.row');
const rlbl = blockFor('.rlbl');

assert(/overflow-x\s*:\s*auto\b/.test(seq), 'sequencer scrolls horizontally instead of shrinking 16 steps on mobile');
assert(/-webkit-overflow-scrolling\s*:\s*touch\b/.test(seq), 'sequencer uses momentum touch scrolling on mobile browsers');
assert(/touch-action\s*:\s*pan-x\b/.test(seq), 'sequencer reserves horizontal panning for thumb access');
assert(/repeat\(16,\s*minmax\(32px,\s*1fr\)\)/.test(row), 'sixteen step cells keep at least a 32px touch target');
assert(/grid-template-columns\s*:\s*44px\s+repeat\(16,\s*minmax\(32px,\s*1fr\)\)/.test(row), 'track label plus steps use a stable mobile-friendly grid');
assert(/position\s*:\s*sticky\b/.test(rlbl) && /left\s*:\s*0\b/.test(rlbl), 'track labels stay visible while the step grid scrolls horizontally');
assert(/z-index\s*:\s*2\b/.test(rlbl), 'sticky track labels stay above step cells');
assert(css.includes('.sc.hht-tight::after') && css.includes('.sc.hht-open::after'), 'hihat tight/open labels remain visible');

console.log('mobile sequencer touch target CSS ok');
