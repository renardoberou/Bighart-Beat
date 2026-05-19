'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'main.css'), 'utf8');

function mobileBlockFor(selector) {
  const mediaBlocks = Array.from(css.matchAll(/@media\s*\(max-width:\s*640px\)\s*\{([\s\S]*?)\n\}/g)).map(match => match[1]);
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const selectorPattern = new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm');
  for (const mediaBlock of mediaBlocks) {
    const match = mediaBlock.match(selectorPattern);
    if (match) return match[1];
  }
  assert.fail(`${selector} has a mobile max-width: 640px CSS block`);
}

function minHeightAtLeast(block, pixels, label) {
  const match = block.match(/min-height\s*:\s*(\d+)px\b/);
  assert(match, `${label} declares min-height in pixels`);
  assert(Number(match[1]) >= pixels, `${label} min-height is at least ${pixels}px`);
}

const engineButton = mobileBlockFor('#engineSel .div-b');
const hihatPlaceButton = mobileBlockFor('.hht-place-b');

minHeightAtLeast(engineButton, 40, 'engine selector buttons');
assert(/touch-action\s*:\s*manipulation\b/.test(engineButton), 'engine selector buttons avoid double-tap delay on mobile');

minHeightAtLeast(hihatPlaceButton, 40, 'hihat quick place buttons');
assert(/touch-action\s*:\s*manipulation\b/.test(hihatPlaceButton), 'hihat quick place buttons avoid double-tap delay on mobile');

assert(/@media\s*\(max-width:\s*380px\)\s*\{[\s\S]*#engineSel\s*\{\s*flex-basis:\s*100%;\s*\}/.test(css), 'engine selector still wraps to a full-width row on narrow phones');

console.log('mobile hihat and engine touch targets ok');
