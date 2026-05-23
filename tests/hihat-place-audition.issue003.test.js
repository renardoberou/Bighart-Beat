#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const hihatBranch = main.match(/\} else if \(tr\.id === ['"]hihat['"]\) \{([\s\S]*?)\n  \} else if \(tr\.id === ['"]clap['"]\)/);
assert(hihatBranch, 'hihat voice editor branch is present');
const hihatPanel = hihatBranch[1];

const placeWiring = hihatPanel.match(/hatTest\.querySelectorAll\(\s*['"]\[data-place\]['"]\s*\)\.forEach\(\s*(\w+)\s*=>\s*\{([\s\S]*?)\n\s*\}\s*\);/);
assert(placeWiring, 'VOICE-panel HHT PLACE buttons are wired from hatTest [data-place] controls');

const buttonVar = placeWiring[1];
const placeHandler = placeWiring[2];

const setCall = new RegExp(`setHihatPlacement\\(\\s*${buttonVar}\\.dataset\\.place\\s*\\)`).exec(placeHandler);
assert(setCall, 'VOICE-panel HHT PLACE handler still calls setHihatPlacement with the clicked placement');

const previewCall = new RegExp(`previewHihat\\(\\s*parseFloat\\(\\s*${buttonVar}\\.dataset\\.place\\s*\\)\\s*\\)`).exec(placeHandler);
assert(previewCall, 'VOICE-panel HHT PLACE handler auditions the clicked placement with previewHihat(parseFloat(dataset.place))');

assert(
  setCall.index < previewCall.index,
  'VOICE-panel HHT PLACE handler updates placement before auditioning it, matching the quick HHT placement strip',
);

const quickStrip = main.match(/function wireQuickHihatPlacement\(\) \{([\s\S]*?)\n\}/);
assert(quickStrip && /previewHihat\(\s*parseFloat\(\s*\w+\.dataset\.quickHhtPlace\s*\)\s*\)/.test(quickStrip[1]),
  'quick HHT placement strip remains the parity reference and continues to audition placement changes');

console.log('Issue 003 hihat PLACE audition parity regression checks passed.');
