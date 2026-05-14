#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(/function\s+clearBpmHold\s*\(\s*\)\s*\{[\s\S]*clearInterval\(bpmHold\)[\s\S]*bpmHold\s*=\s*null[\s\S]*\}/.test(main), 'BPM hold has one clear helper that clears and nulls the active interval');
assert(/function\s+startBpmHold\s*\(\s*delta\s*\)\s*\{[\s\S]*clearBpmHold\(\)[\s\S]*bpmHold\s*=\s*setInterval\(\s*\(\)\s*=>\s*chgBPM\(delta\),\s*110\s*\)[\s\S]*\}/.test(main), 'BPM hold starts by clearing any prior interval before scheduling repeat changes');
assert(/\$\('bpmUp'\)\.addEventListener\('pointerdown',\s*\(\)\s*=>\s*\{\s*startBpmHold\(2\);\s*\}\)/.test(main), 'BPM up hold uses guarded start helper');
assert(/\$\('bpmDn'\)\.addEventListener\('pointerdown',\s*\(\)\s*=>\s*\{\s*startBpmHold\(-2\);\s*\}\)/.test(main), 'BPM down hold uses guarded start helper');
assert(/\$\('bpmUp'\)\.addEventListener\(e,\s*clearBpmHold\)/.test(main), 'BPM up release/cancel/leave uses shared clear helper');
assert(/\$\('bpmDn'\)\.addEventListener\(e,\s*clearBpmHold\)/.test(main), 'BPM down release/cancel/leave uses shared clear helper');
assert(/function\s+chgBPM\s*\(\s*d\s*\)\s*\{[\s\S]*Math\.min\(240,\s*Math\.max\(40,[\s\S]*\$\('bpmD'\)\.textContent\s*=\s*S\.bpm[\s\S]*N\.dlyLine\.delayTime\.setTargetAtTime\(dlyTimeSec\(\),\s*A\.currentTime,\s*\.03\)[\s\S]*autosave\(\)[\s\S]*\}/.test(main), 'BPM changes remain clamped, update visible value, update delay timing, and autosave');

console.log('Issue 008 transport tempo hold checks passed.');
