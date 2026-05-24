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
assert(previewCall, 'VOICE-panel HHT PLACE handler still auditions the clicked placement with previewHihat(parseFloat(dataset.place)) when stopped');

assert(
  setCall.index < previewCall.index,
  'VOICE-panel HHT PLACE handler updates placement before auditioning it, matching the quick HHT placement strip',
);

const guardStart = placeHandler.lastIndexOf('if (!S.playing)', previewCall.index);
assert(guardStart !== -1, 'VOICE-panel HHT PLACE preview is guarded by !S.playing so transport playback stays silent');
assert(setCall.index < guardStart, 'VOICE-panel HHT PLACE updates placement/UI before the playback preview guard, so running transport clicks still update state/UI');
assert(!placeHandler.slice(0, setCall.index).includes('if (!S.playing)'), 'VOICE-panel HHT PLACE placement update is not hidden behind the stopped-state preview guard');

assert(!/\b(?:play|runSch)\s*\(/.test(placeHandler), 'VOICE-panel HHT PLACE audition must not start the transport or scheduler');

const quickStrip = main.match(/function wireQuickHihatPlacement\(\) \{([\s\S]*?)\n\}/);
assert(quickStrip && /if \(!S\.playing\)[\s\S]*previewHihat\(\s*parseFloat\(\s*\w+\.dataset\.quickHhtPlace\s*\)\s*\)/.test(quickStrip[1]),
  'quick HHT placement strip remains the parity reference and only auditions placement changes when stopped');

console.log('Issue 003 hihat PLACE silent-during-playback regression checks passed.');
