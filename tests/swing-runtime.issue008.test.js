#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(/src="src\/rhythm\/groove-timing\.js(?:\?v=[^"]+)?"/.test(html), 'HTML loads the groove timing helper before main.js');
assert(/src="src\/rhythm\/swing-knob\.js(?:\?v=[^"]+)?"/.test(html), 'HTML loads the swing knob pointer helper before main.js');
assert(/id="vSwing"/.test(html), 'transport UI exposes a swing value readout with id="vSwing"');
assert(!/<input[^>]+id="swing"[^>]+type="range"|<input[^>]+type="range"[^>]+id="swing"/.test(html), 'swing is no longer exposed as a hard-to-hit range slider');

assert(/class="[^"]*swing-knob-control[^"]*"[^>]*(?:role="slider"|aria-valuemin="0")/.test(html), 'HTML exposes swing as an accessible knob/slider control');
assert(/id="swing"/.test(html) && /data-swing-knob/.test(html), 'swing knob has the canonical id and knob data hook');
assert(/aria-valuemin="0"/.test(html) && /aria-valuemax="100"/.test(html), 'swing knob ARIA range can announce persisted/imported 100% swing without overflowing valuemax');
assert(/data-swing-step="-1"/.test(html) && /data-swing-step="1"/.test(html), 'swing control includes large decrement/increment buttons for reliable touch adjustment');
assert(!/class="[^"]*swing-option[^"]*"/.test(html), 'cramped four-button segmented swing control has been removed');
assert(/role="group"[^>]+aria-label="Swing groove amount"|aria-label="Swing groove amount"[^>]+role="group"/.test(html), 'swing knob cluster is announced as a grouped control');

assert(/const Groove\s*=\s*globalThis\.BighartBeatGroove/.test(main), 'runtime reads the groove timing helper');
assert(/const\s+SWING_OPTIONS\s*=\s*\[0,\s*0\.25,\s*0\.5,\s*0\.75\]/.test(main), 'runtime declares the discrete swing options');
assert(/function\s+nearestSwingOption\s*\(/.test(main), 'runtime has a helper for selecting the nearest visible swing option');
assert(/function\s+setSwingFromOption\s*\([^)]*\)\s*\{[\s\S]*S\.swing\s*=\s*Groove\.clampSwing\(value\)[\s\S]*syncSwingControl\(\)[\s\S]*renderRhythmIntelligence\(\)[\s\S]*autosave\(\)/.test(main), 'runtime has a discrete swing selection path that updates S.swing, UI, rhythm intelligence, and persistence');
assert(/addEventListener\('pointerdown'[\s\S]*setSwingFromPointer/.test(main) && /querySelectorAll\('\[data-swing-step\]'\)[\s\S]*addEventListener\('click'[\s\S]*stepSwing/.test(main), 'runtime binds pointer drag on the knob plus click events on +/- buttons');
assert(/function\s+syncSwingControl\s*\([^)]*\)\s*\{[\s\S]*nearestSwingOption\(S\.swing\)[\s\S]*aria-valuenow[\s\S]*aria-valuetext[\s\S]*--swing-angle[\s\S]*vSwing[\s\S]*Math\.round\(S\.swing \* 100\) \+ '%'/.test(main), 'runtime sync updates knob ARIA, radial angle, and vSwing readout after load/import');
assert(/aria-valuenow[\s\S]*Math\.min\(100,[\s\S]*percent/.test(main), 'runtime clamps aria-valuenow to the advertised 0-100 range for imported swing values');
assert(/SwingKnob\.(?:swingFromPoint|valueFromPoint)[\s\S]*nearestSwingOption/.test(main), 'pointer input is mapped through the shared visible -135..135 swing knob helper before snapping to visible choices');
assert(/event\.key === 'Home'[\s\S]*setSwingFromOption\(0\)/.test(main) && /event\.key === 'End'[\s\S]*setSwingFromOption\(0\.75\)/.test(main), 'keyboard slider supports Home for 0% and End for the deepest visible 75% choice');
assert(!/bindF\('swing'/.test(main), 'runtime no longer binds swing as a continuous fader');
assert(!/setFdr\('swing'/.test(main), 'control sync no longer restores swing through the old slider path');
assert(/Groove\.scheduledHitTimes\(\{[\s\S]*stepIndex:\s*step[\s\S]*swing:\s*S\.swing[\s\S]*\}\)/.test(main), 'scheduler applies S.swing when computing hit times');
assert(/tlog\.push\(\{\s*step,\s*time:\s*swungT\s*\}\)/.test(main), 'playhead log follows audible swung step timing');
assert(/swing:\s*S\.swing/.test(main), 'Rhythm Intelligence receives current swing instead of hardcoded swing: 0');
assert(/S\.swing\s*=\s*Groove\.clampSwing\(d\.swing/.test(main), 'project import applies persisted swing');

assert(/\.swing-strip\s*\{[\s\S]*grid-template-columns:\s*minmax\(44px, max-content\) 30px 40px 30px[\s\S]*width:\s*fit-content[\s\S]*margin-top:\s*6px[\s\S]*padding:\s*5px 6px[\s\S]*min-width:\s*0/.test(css), 'CSS keeps the swing strip compact instead of using a huge fixed desktop footprint');
assert(!/min-width:\s*340px/.test(css), 'CSS no longer gives the swing strip a 340px minimum width');
assert(/\.swing-knob-control\s*\{[\s\S]*min-width:\s*40px[\s\S]*min-height:\s*40px[\s\S]*border-radius:\s*50%[\s\S]*touch-action:\s*none/.test(css), 'CSS makes the swing knob compact, round, and drag-safe');
assert(!/\.swing-knob-control\s*\{[\s\S]*min-width:\s*84px[\s\S]*min-height:\s*84px/.test(css), 'CSS no longer uses an 84px swing knob');
assert(/\.swing-knob-control::before\s*\{[\s\S]*conic-gradient/.test(css), 'CSS gives swing a premium radial/rotary visual');
assert(/\.swing-step\s*\{[\s\S]*min-width:\s*30px[\s\S]*min-height:\s*30px/.test(css), 'CSS uses compact +/- controls proportional to the rest of the toolbar');
assert(!/\.swing-step\s*\{[\s\S]*min-width:\s*56px[\s\S]*min-height:\s*56px/.test(css), 'CSS no longer uses 56px swing step buttons');
assert(/@media \(max-width: (?:640|680|720)px\)[\s\S]*\.swing-strip\s*\{[\s\S]*grid-template-columns:\s*minmax\(44px, max-content\) 30px 40px 30px[\s\S]*width:\s*fit-content/.test(css), 'mobile/tablet CSS keeps the swing module compact instead of stacking into a full-width column');
assert(!css.includes('.swing-strip { grid-template-columns: 1fr;'), 'mobile CSS no longer turns swing into a giant single-column module');

console.log('Issue 008 swing runtime wiring checks passed.');
