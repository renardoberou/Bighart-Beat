#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(html.includes('src="src/rhythm/groove-timing.js"'), 'HTML loads the groove timing helper before main.js');
assert(/id="swing"/.test(html), 'transport UI exposes a swing slider with id="swing"');
assert(/id="vSwing"/.test(html), 'transport UI exposes a swing value readout with id="vSwing"');
assert(/<input[^>]+id="swing"[^>]+min="0"[^>]+max="100"[^>]+value="0"/.test(html), 'swing slider uses a 0-100 percent range');

assert(/const Groove\s*=\s*globalThis\.BighartBeatGroove/.test(main), 'runtime reads the groove timing helper');
assert(/bindF\('swing'/.test(main), 'runtime binds the swing slider through bindF');
assert(/S\.swing\s*=\s*Groove\.clampSwing\(v\s*\/\s*100\)/.test(main), 'swing slider writes normalized S.swing');
assert(/Groove\.scheduledHitTimes\(\{[\s\S]*stepIndex:\s*step[\s\S]*swing:\s*S\.swing[\s\S]*\}\)/.test(main), 'scheduler applies S.swing when computing hit times');
assert(/tlog\.push\(\{\s*step,\s*time:\s*swungT\s*\}\)/.test(main), 'playhead log follows audible swung step timing');
assert(/swing:\s*S\.swing/.test(main), 'Rhythm Intelligence receives current swing instead of hardcoded swing: 0');
assert(/S\.swing\s*=\s*Groove\.clampSwing\(d\.swing/.test(main), 'project import applies persisted swing');
assert(/setFdr\('swing',\s*Math\.round\(S\.swing \* 100\)/.test(main), 'control sync restores the swing slider after load/import');
assert(/\.swing-strip\s*\{/.test(css) && /\.swing-val\s*\{/.test(css), 'swing control has compact mobile-friendly styling');

console.log('Issue 008 swing runtime wiring checks passed.');
