#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert.match(index, /<div class="ve-row"><div class="ve-lbl">FOCUS<\/div><div><\/div><div class="ve-val" id="riLoad">--<\/div><\/div>/, 'Rhythm Intelligence panel exposes a compact FOCUS load row');
assert.match(index, /<div class="ri-read" id="riLoadLine">[^<]*<\/div>/, 'Rhythm Intelligence panel exposes a compact load cue line');
assert.ok(index.indexOf('id="riLoad"') < index.indexOf('id="riPredictLine"'), 'FOCUS load row appears before detailed cue lines');

assert.match(main, /\$\('riLoad'\)\.textContent\s*=\s*analysis\.cognitiveLoad\.value;/, 'renderRhythmIntelligence renders cognitive load value');
assert.match(main, /\$\('riLoadLine'\)\.textContent\s*=\s*analysis\.cognitiveLoad\.cue;/, 'renderRhythmIntelligence renders cognitive load cue');

console.log('Issue 001 cognitive load UI wiring checks passed.');
