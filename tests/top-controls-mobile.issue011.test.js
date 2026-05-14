#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(/<div class="tx-r">[\s\S]*id="engineSel"[\s\S]*id="patt"[\s\S]*id="songQueue"[\s\S]*id="latchFxBtn"[\s\S]*<\/div>\s*<\/div>/.test(html), 'top-right controls keep engine, pattern, chain, and LATCH FX in one reachable control cluster');
assert(css.includes('.tx-r') && /\.tx-r\s*\{[\s\S]*flex-wrap\s*:\s*wrap[\s\S]*min-width\s*:\s*0[\s\S]*max-width\s*:\s*100%/.test(css), 'top-right controls are allowed to wrap without overflowing the viewport');
assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.tx-r\s*\{[\s\S]*grid-column\s*:\s*1\s*\/\s*-1[\s\S]*width\s*:\s*100%[\s\S]*\}/.test(css), 'mobile transport layout gives top controls a full-width wrapped row');
assert(/#engineSel\s*\{[\s\S]*flex\s*:\s*1\s+1\s+260px[\s\S]*min-width\s*:\s*0[\s\S]*max-width\s*:\s*100%/.test(css), 'engine selector can shrink and wrap within the top controls');
assert(/\.patt\s*\{[\s\S]*flex\s*:\s*0\s+0\s+auto/.test(css), 'pattern buttons keep a stable touch-friendly width while rows wrap');
assert(/\.chain-strip\s*\{[\s\S]*flex\s*:\s*1\s+1\s+190px[\s\S]*min-width\s*:\s*0[\s\S]*max-width\s*:\s*100%/.test(css), 'pattern chain strip can shrink or wrap instead of forcing horizontal overflow');
assert(/\.latch-btn\s*\{[\s\S]*flex\s*:\s*0\s+0\s+auto[\s\S]*white-space\s*:\s*nowrap/.test(css), 'LATCH FX remains a visible, non-collapsed touch target on narrow screens');
assert(/@media\s*\(max-width:\s*380px\)\s*\{[\s\S]*#engineSel\s*\{[\s\S]*flex-basis\s*:\s*100%[\s\S]*\.latch-btn\s*\{[\s\S]*order\s*:\s*4[\s\S]*\.chain-strip\s*\{[\s\S]*order\s*:\s*5[\s\S]*flex-basis\s*:\s*100%/.test(css), 'extra-narrow screens put engine/chain on their own wrapped lines while keeping LATCH FX before the full-width chain');

console.log('top controls mobile issue011 checks passed');
