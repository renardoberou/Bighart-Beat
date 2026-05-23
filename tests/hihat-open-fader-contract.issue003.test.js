#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const hihatBranch = main.match(/\} else if \(tr\.id === ['"]hihat['"]\) \{([\s\S]*?)\n  \} else if \(tr\.id === ['"]clap['"]\)/);
assert(hihatBranch, 'hihat voice editor branch is present');
const hihatPanel = hihatBranch[1];

assert(
  !/mkRow\(\s*['"]OPEN['"]\s*,[\s\S]*?tr\.p\.open\s*=\s*v\s*\/\s*100/.test(hihatPanel),
  'hihat voice panel must not expose a normal OPEN fader that writes only tr.p.open because sequenced hats use per-step openness',
);

assert(
  /OPENNESS IS PER STEP:\s*PLACE\/OHH ROW/.test(hihatPanel),
  'hihat panel explains that openness is per-step via PLACE/OHH row',
);
assert(
  /HHT\/OHH:\s*TAP ACTIVE = ACC\s*·\s*DOUBLE-TAP CLEAR\s*·\s*HOLD = RATCHET/.test(hihatPanel),
  'hihat panel preserves concise HHT/OHH interaction help copy',
);

assert(/PLACE CLOSED/.test(hihatPanel), 'PLACE CLOSED button remains present');
assert(/PLACE TIGHT/.test(hihatPanel), 'PLACE TIGHT button remains present');
assert(/PLACE OPEN/.test(hihatPanel), 'PLACE OPEN button remains present');

assert(/data-open=['"]0['"][\s\S]*?>CLOSED</.test(hihatPanel), 'closed hihat preview button remains present');
assert(/data-open=['"]\.45['"][\s\S]*?>TIGHT</.test(hihatPanel), 'tight hihat preview button remains present');
assert(/data-open=['"]1['"][\s\S]*?>OPEN</.test(hihatPanel), 'open hihat preview button remains present');

assert(
  /hihat-accent-bloom-20260523/.test(html),
  'static asset cache token is bumped for the hihat open-accent bloom slice',
);

console.log('Issue 003 hihat OPEN fader contract regression checks passed.');
