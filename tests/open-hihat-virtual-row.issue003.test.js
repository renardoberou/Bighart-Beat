#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(/const\s+OPEN_HIHAT_ROW_ID\s*=\s*['"]open-hihat['"]/.test(main), 'runtime declares a virtual open hihat row id');
assert(/const\s+OPEN_HIHAT_ROW_LABEL\s*=\s*['"]OHH['"]/.test(main), 'runtime declares an OHH virtual row label');
assert(/function\s+sequencerRows\s*\(\s*\)/.test(main), 'runtime builds sequencer rows through a helper');
assert(/if\s*\(\s*tr\.id\s*===\s*['"]hihat['"]\s*\)[\s\S]{0,240}OPEN_HIHAT_ROW_ID/.test(main), 'sequencer inserts OHH immediately after HHT');
assert(/row\.dataset\.id\s*=\s*rowSpec\.rowId/.test(main), 'sequencer row dataset uses the virtual row id');
assert(/rowSpec\.label/.test(main), 'sequencer labels can differ from the backing track label');
assert(/const\s+trackId\s*=\s*rowSpec\.track\.id/.test(main), 'cells keep a backing canonical track id');
assert(/const\s+isOpenHihatRow\s*=\s*rowSpec\.rowId\s*===\s*OPEN_HIHAT_ROW_ID/.test(main), 'cell logic detects the virtual open hihat row');
assert(/if\s*\(\s*isOpenHihatRow\s*\)\s*\{[\s\S]*State\.setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*1\)/.test(main), 'clicking OHH on forces the backing hihat step fully open');
assert(/if\s*\(\s*isOpenHihatRow\s*\)\s*\{[\s\S]*State\.clearHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)/.test(main), 'clicking OHH off clears backing hihat openness');
assert(/if\s*\(\s*isOpenHihatRow\s*\)\s*\{[\s\S]*buildSeq\(\);[\s\S]*return;/.test(main), 'clicking OHH refreshes both split hihat rows after shared backing-state changes');
assert(/State\.getHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)\s*===\s*1/.test(main), 'OHH row active state is derived from fully-open hihat steps');
assert(/\.seq\s*\{[\s\S]*grid-template-rows:\s*repeat\(7,\s*1fr\)/.test(css), 'sequencer grid has seven rows including virtual OHH');
assert(/\.row\[data-id="open-hihat"\]/.test(css), 'CSS has visible OHH row styling');

console.log('Issue 003 virtual open hihat row checks passed.');
