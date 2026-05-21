#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(/function\s+clearBpmHold\s*\(\s*\)\s*\{[\s\S]*clearInterval\(bpmHold\)[\s\S]*bpmHold\s*=\s*null[\s\S]*\}/.test(main), 'BPM hold has one clear helper that clears and nulls the active interval');
assert(/function\s+startBpmHold\s*\(\s*delta\s*\)\s*\{\s*clearBpmHold\(\);\s*chgBPM\(delta\);\s*bpmHold\s*=\s*setInterval\(\s*\(\)\s*=>\s*chgBPM\(delta\),\s*110\s*\)[\s\S]*\}/.test(main), 'BPM hold clears any prior interval, immediately nudges tempo, then schedules repeat changes');
assert(/function\s+handleBpmClick\s*\(\s*buttonId\s*,\s*delta\s*,\s*event\s*\)\s*\{[\s\S]*bpmSuppressClickTarget\s*===\s*buttonId[\s\S]*event\.detail\s*!==\s*0[\s\S]*clearBpmClickSuppression\(\)[\s\S]*return[\s\S]*chgBPM\(delta\)[\s\S]*\}/.test(main), 'BPM click handler suppresses one synthesized pointer click but still applies direct click/keyboard activation');
const suppressNextMatch = main.match(/function\s+suppressNextBpmClick\s*\(\s*buttonId\s*\)\s*\{([\s\S]*?)\n\s*\}/);
assert(suppressNextMatch, 'BPM synthesized-click suppression helper exists');
assert(!/setTimeout\s*\(/.test(suppressNextMatch[1]), 'BPM synthesized-click suppression does not start an expiry timer on pointerdown before a long hold');
assert(/function\s+scheduleBpmClickSuppressionCleanup\s*\(\s*buttonId\s*\)\s*\{[\s\S]*setTimeout\([\s\S]*bpmSuppressClickTarget\s*===\s*buttonId[\s\S]*clearBpmClickSuppression\(\)[\s\S]*,\s*400\s*\)[\s\S]*\}/.test(main), 'BPM suppression cleanup is delayed until release/cancel/leave so long holds remain suppressed until the release click');
assert(/\$\('bpmUp'\)\.addEventListener\('click',\s*event\s*=>\s*handleBpmClick\('bpmUp',\s*1,\s*event\)\)/.test(main), 'BPM up click routes through synthesized-click suppression guard');
assert(/\$\('bpmDn'\)\.addEventListener\('click',\s*event\s*=>\s*handleBpmClick\('bpmDn',\s*-1,\s*event\)\)/.test(main), 'BPM down click routes through synthesized-click suppression guard');
assert(/\$\('bpmUp'\)\.addEventListener\('pointerdown',\s*event\s*=>\s*\{[\s\S]*suppressNextBpmClick\('bpmUp'\)[\s\S]*startBpmHold\(2\);[\s\S]*\}\)/.test(main), 'BPM up hold immediately nudges and suppresses the following synthesized click');
assert(/\$\('bpmDn'\)\.addEventListener\('pointerdown',\s*event\s*=>\s*\{[\s\S]*suppressNextBpmClick\('bpmDn'\)[\s\S]*startBpmHold\(-2\);[\s\S]*\}\)/.test(main), 'BPM down hold immediately nudges and suppresses the following synthesized click');
assert(/\$\('bpmUp'\)\.addEventListener\(e,\s*\(\)\s*=>\s*endBpmHold\('bpmUp'\)\)/.test(main), 'BPM up release/cancel/leave clears hold and opens a post-release suppression cleanup window');
assert(/\$\('bpmDn'\)\.addEventListener\(e,\s*\(\)\s*=>\s*endBpmHold\('bpmDn'\)\)/.test(main), 'BPM down release/cancel/leave clears hold and opens a post-release suppression cleanup window');
assert(/function\s+chgBPM\s*\(\s*d\s*\)\s*\{[\s\S]*Math\.min\(240,\s*Math\.max\(40,[\s\S]*\$\('bpmD'\)\.textContent\s*=\s*S\.bpm[\s\S]*N\.dlyLine\.delayTime\.setTargetAtTime\(dlyTimeSec\(\),\s*A\.currentTime,\s*\.03\)[\s\S]*autosave\(\)[\s\S]*\}/.test(main), 'BPM changes remain clamped, update visible value, update delay timing, and autosave');

console.log('Issue 008 transport tempo hold checks passed.');
