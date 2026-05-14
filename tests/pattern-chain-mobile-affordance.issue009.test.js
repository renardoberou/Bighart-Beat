#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

const songQueueMatch = html.match(/<div class="chain-strip" id="songQueue"[\s\S]*?<\/div>/);
assert(songQueueMatch, 'pattern chain song queue exists');
const songQueue = songQueueMatch[0];

assert(/class="chain-hint"/.test(songQueue), 'chain strip has a visible mobile editing hint instead of relying on title tooltips');
assert(/TAP\s*=\s*SLOT/i.test(songQueue), 'chain hint tells touch users that tapping changes the slot pattern');
assert(/HOLD\s*=\s*BARS/i.test(songQueue), 'chain hint tells touch users that holding changes bar length');
assert(/\.chain-hint\s*\{[\s\S]*flex\s*:\s*1\s+1\s+70px[\s\S]*min-width\s*:\s*54px[\s\S]*white-space\s*:\s*normal/.test(css), 'chain hint is compact and wrap-safe inside the chain strip');
assert(/@media\s*\(max-width:\s*420px\)\s*\{[\s\S]*\.chain-strip\s*\{[\s\S]*flex-wrap\s*:\s*wrap[\s\S]*\.chain-hint\s*\{[\s\S]*flex-basis\s*:\s*100%[\s\S]*order\s*:\s*9/.test(css), 'phone-width chain hint wraps below controls instead of forcing horizontal overflow');

console.log('pattern chain mobile affordance issue009 checks passed');
