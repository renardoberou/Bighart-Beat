#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function blockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert(match, `${selector} CSS block exists`);
  return match[1];
}

const mixerRow = blockFor('.mt');
const toggles = blockFor('.mt-toggles');
const mixerButton = blockFor('.mt-btn');

assert(/grid-template-columns\s*:\s*30px\s+114px\s+minmax\(48px,\s*1fr\)\s+34px/.test(mixerRow), 'mixer rows reserve compact columns that fit a 320px viewport while keeping three explicit toggles');
assert(/display\s*:\s*grid\b/.test(toggles), 'mixer M/D/R toggles use a stable grid instead of shrinking flex buttons');
assert(/grid-template-columns\s*:\s*repeat\(3,\s*36px\)/.test(toggles), 'mixer M/D/R toggles each keep a 36px mobile touch target');
assert(/min-width\s*:\s*36px/.test(mixerButton) && /min-height\s*:\s*36px/.test(mixerButton), 'mixer M/D/R buttons are at least 36px in both dimensions');
assert(/data-k="mute"[\s\S]*>M<\/button>/.test(main), 'mixer markup keeps an explicit M mute button');
assert(/data-k="dlyS"[\s\S]*>D<\/button>/.test(main), 'mixer markup keeps an explicit D delay-send button');
assert(/data-k="revS"[\s\S]*>R<\/button>/.test(main), 'mixer markup keeps an explicit R reverb-send button');

console.log('mobile mixer touch target checks passed');
