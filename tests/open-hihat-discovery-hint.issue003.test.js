#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(/TRY OHH ROW/i.test(main), 'hihat editor includes a first-run hint that points players to the OHH row');
assert(/PLACE OPEN/i.test(main), 'open-hihat hint keeps the place-open action visible');
assert(/ENGINE BUTTONS/i.test(main), 'open-hihat hint reminds players that engine buttons change the hat sound');
assert(/hat-discovery/i.test(main), 'hihat discovery hint has a dedicated class for mobile styling');
assert(/seq-hint[\s\S]*OHH[\s\S]*OPEN/i.test(index), 'always-visible sequencer hint identifies OHH as the open hihat row');
assert(/seq-hint[\s\S]*DOUBLE[\s\S]*CLEAR/i.test(index), 'always-visible sequencer hint documents double-tap hihat clear');
assert(/seq-hint[\s\S]*ENGINE[\s\S]*KIT/i.test(index), 'always-visible sequencer hint connects engine buttons to kit sound changes');
assert(/\.hat-discovery\b/.test(css), 'hihat discovery hint has CSS styling');

console.log('Issue 003 open hihat discovery hint checks passed.');
