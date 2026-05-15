#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(/id="riPredict"/.test(html), 'Rhythm Intelligence panel exposes visible PREDICT value');
assert(/id="riPredictLine"/.test(html), 'Rhythm Intelligence panel exposes predictive timing cue line');
assert(/PREDICT/.test(html), 'Predictive timing row uses compact PREDICT label');
assert(/analysis\.predictiveTiming\.timingBias\.toUpperCase\(\)/.test(main), 'renderRhythmIntelligence renders timing bias');
assert(/analysis\.predictiveTiming\.cue/.test(main), 'renderRhythmIntelligence renders predictive timing cue');

console.log('Issue 001 predictive timing UI wiring checks passed.');
