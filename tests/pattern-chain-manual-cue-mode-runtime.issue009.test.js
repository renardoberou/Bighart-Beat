#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

assert(/id="chainCueMode"/.test(html), 'chain strip exposes a manual cue mode toggle');
assert(/chainCueMode/.test(main), 'runtime references the manual cue mode toggle');
assert(/State\.setPatternChainManualCueMode\(/.test(main), 'runtime uses the pure manual cue mode setter');
assert(/manualCueMode\s*===\s*['"]hold['"]/.test(main), 'runtime can toggle hold back to continue');
assert(/CUE: HOLD/.test(main), 'runtime shows HOLD mode on the cue toggle');
assert(/CUE: CONT/.test(main), 'runtime shows CONT mode on the cue toggle');
assert(/aria-label[^\n]*manual cue mode/i.test(main), 'runtime gives the cue mode toggle an accessible label');
assert(/autosave\(\)/.test(main), 'cue mode toggle persists the selected cue mode');

console.log('pattern chain manual cue mode runtime issue009 checks passed');
