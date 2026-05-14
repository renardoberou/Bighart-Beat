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
assert(/id="vSwing"/.test(html), 'transport UI exposes a swing value readout with id="vSwing"');
assert(!/<input[^>]+id="swing"[^>]+type="range"|<input[^>]+type="range"[^>]+id="swing"/.test(html), 'swing is no longer exposed as a hard-to-hit range slider');

const swingButtons = [...html.matchAll(/<button\b[^>]*class="[^"]*swing-option[^"]*"[^>]*data-swing="([^"]+)"[^>]*>/g)].map(m => Number(m[1]));
assert.deepStrictEqual(swingButtons, [0, 0.25, 0.5, 0.75], 'HTML exposes exactly four swing toggle choices: 0%, 25%, 50%, 75%');
assert(/role="group"[^>]+aria-label="Swing amount"|aria-label="Swing amount"[^>]+role="group"/.test(html), 'swing toggle is announced as a grouped control');

assert(/const Groove\s*=\s*globalThis\.BighartBeatGroove/.test(main), 'runtime reads the groove timing helper');
assert(/const\s+SWING_OPTIONS\s*=\s*\[0,\s*0\.25,\s*0\.5,\s*0\.75\]/.test(main), 'runtime declares the discrete swing options');
assert(/function\s+nearestSwingOption\s*\(/.test(main), 'runtime has a helper for selecting the nearest visible swing option');
assert(/function\s+setSwingFromOption\s*\([^)]*\)\s*\{[\s\S]*S\.swing\s*=\s*Groove\.clampSwing\(value\)[\s\S]*syncSwingControl\(\)[\s\S]*renderRhythmIntelligence\(\)[\s\S]*autosave\(\)/.test(main), 'runtime has a discrete swing selection path that updates S.swing, UI, rhythm intelligence, and persistence');
assert(/querySelectorAll\('\[data-swing\]'\)[\s\S]*addEventListener\('click'/.test(main), 'runtime binds click events on the swing option buttons');
assert(/function\s+syncSwingControl\s*\([^)]*\)\s*\{[\s\S]*nearestSwingOption\(S\.swing\)[\s\S]*classList\.toggle\('on'[\s\S]*aria-pressed[\s\S]*vSwing[\s\S]*Math\.round\(S\.swing \* 100\) \+ '%'/.test(main), 'runtime sync marks the active selected toggle and updates the vSwing readout after load/import');
assert(!/bindF\('swing'/.test(main), 'runtime no longer binds swing as a continuous fader');
assert(!/setFdr\('swing'/.test(main), 'control sync no longer restores swing through the old slider path');
assert(/Groove\.scheduledHitTimes\(\{[\s\S]*stepIndex:\s*step[\s\S]*swing:\s*S\.swing[\s\S]*\}\)/.test(main), 'scheduler applies S.swing when computing hit times');
assert(/tlog\.push\(\{\s*step,\s*time:\s*swungT\s*\}\)/.test(main), 'playhead log follows audible swung step timing');
assert(/swing:\s*S\.swing/.test(main), 'Rhythm Intelligence receives current swing instead of hardcoded swing: 0');
assert(/S\.swing\s*=\s*Groove\.clampSwing\(d\.swing/.test(main), 'project import applies persisted swing');

assert(/\.swing-strip\s*\{[\s\S]*margin-top:\s*(?:8|10|12|14|16)px[\s\S]*padding:\s*6px/.test(css), 'CSS separates the swing control from sequencer hits with a visible top gap/padded strip');
assert(/\.swing-options\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/.test(css), 'CSS gives swing a visible four-button segmented layout');
assert(/\.swing-option\s*\{[\s\S]*min-height:\s*(?:32|36|40|44|48)px[\s\S]*touch-action:\s*manipulation/.test(css), 'CSS makes swing buttons touch-sized and safe on mobile');
assert(/\.swing-option\.on\s*\{[\s\S]*background:[\s\S]*box-shadow:/.test(css), 'CSS visibly marks the selected swing option');

console.log('Issue 008 swing runtime wiring checks passed.');
