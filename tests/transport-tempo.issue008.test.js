#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

assert(/function\s+clearBpmHold\s*\(\s*\)\s*\{[\s\S]*clearInterval\(bpmHold\)[\s\S]*bpmHold\s*=\s*null[\s\S]*\}/.test(main), 'BPM hold has one clear helper that clears and nulls the active interval');
assert(/const\s+BPM_HOLD_DELAY_MS\s*=\s*(3[2-9]\d|4[01]\d|420)\s*;/.test(main), 'BPM hold has a deliberate long-press threshold of roughly 320-420ms');
assert(/function\s+clearBpmHoldTimer\s*\(\s*\)\s*\{[\s\S]*clearTimeout\(bpmHoldTimer\)[\s\S]*bpmHoldTimer\s*=\s*null[\s\S]*\}/.test(main), 'BPM hold has one clear helper that clears and nulls the pending long-press timer');
assert(/function\s+startBpmHold\s*\(\s*delta\s*\)\s*\{\s*clearBpmHold\(\);\s*chgBPM\(delta\);\s*bpmHold\s*=\s*setInterval\(\s*\(\)\s*=>\s*chgBPM\(delta\),\s*110\s*\)[\s\S]*\}/.test(main), 'BPM hold clears any prior interval, nudges tempo by the repeat step once after the delay, then schedules repeat changes');
assert(/function\s+startBpmHoldAfterDelay\s*\(\s*buttonId\s*,\s*delta\s*\)\s*\{\s*clearBpmHoldTimer\(\);\s*bpmHoldTimer\s*=\s*setTimeout\(\s*\(\)\s*=>\s*\{\s*bpmHoldTimer\s*=\s*null;\s*suppressNextBpmClick\(buttonId\);\s*startBpmHold\(delta\);\s*\}\s*,\s*BPM_HOLD_DELAY_MS\s*\)[\s\S]*\}/.test(main), 'BPM long hold starts only after the delay and suppresses the synthesized release click only once a hold actually fires');
assert(/function\s+handleBpmClick\s*\(\s*buttonId\s*,\s*delta\s*,\s*event\s*\)\s*\{[\s\S]*bpmSuppressClickTarget\s*===\s*buttonId[\s\S]*event\.detail\s*!==\s*0[\s\S]*clearBpmClickSuppression\(\)[\s\S]*return[\s\S]*chgBPM\(delta\)[\s\S]*\}/.test(main), 'BPM click handler suppresses one synthesized pointer click after a real hold but still applies direct click/keyboard activation');
const suppressNextMatch = main.match(/function\s+suppressNextBpmClick\s*\(\s*buttonId\s*\)\s*\{([\s\S]*?)\n\s*\}/);
assert(suppressNextMatch, 'BPM synthesized-click suppression helper exists');
assert(!/setTimeout\s*\(/.test(suppressNextMatch[1]), 'BPM synthesized-click suppression does not start an expiry timer on pointerdown before a long hold');
assert(/function\s+scheduleBpmClickSuppressionCleanup\s*\(\s*buttonId\s*\)\s*\{[\s\S]*setTimeout\([\s\S]*bpmSuppressClickTarget\s*===\s*buttonId[\s\S]*clearBpmClickSuppression\(\)[\s\S]*,\s*400\s*\)[\s\S]*\}/.test(main), 'BPM suppression cleanup is delayed until release/cancel/leave so long holds remain suppressed until the release click');
assert(/\$\('bpmUp'\)\.addEventListener\('click',\s*event\s*=>\s*handleBpmClick\('bpmUp',\s*1,\s*event\)\)/.test(main), 'BPM up click routes through synthesized-click suppression guard');
assert(/\$\('bpmDn'\)\.addEventListener\('click',\s*event\s*=>\s*handleBpmClick\('bpmDn',\s*-1,\s*event\)\)/.test(main), 'BPM down click routes through synthesized-click suppression guard');
assert(/\$\('bpmUp'\)\.addEventListener\('pointerdown',\s*event\s*=>\s*\{[\s\S]*startBpmHoldAfterDelay\('bpmUp',\s*2\)[\s\S]*\}\)/.test(main), 'BPM up pointerdown schedules a delayed +2 hold instead of immediately changing tempo');
assert(!/\$\('bpmUp'\)\.addEventListener\('pointerdown',\s*event\s*=>\s*\{[\s\S]*startBpmHold\(2\);[\s\S]*\}\)/.test(main), 'BPM up pointerdown does not start +2 hold immediately');
assert(/\$\('bpmDn'\)\.addEventListener\('pointerdown',\s*event\s*=>\s*\{[\s\S]*startBpmHoldAfterDelay\('bpmDn',\s*-2\)[\s\S]*\}\)/.test(main), 'BPM down pointerdown schedules a delayed -2 hold instead of immediately changing tempo');
assert(!/\$\('bpmDn'\)\.addEventListener\('pointerdown',\s*event\s*=>\s*\{[\s\S]*startBpmHold\(-2\);[\s\S]*\}\)/.test(main), 'BPM down pointerdown does not start -2 hold immediately');
assert(/function\s+endBpmHold\s*\(\s*buttonId\s*\)\s*\{[\s\S]*clearBpmHoldTimer\(\)[\s\S]*clearBpmHold\(\)[\s\S]*scheduleBpmClickSuppressionCleanup\(buttonId\)[\s\S]*\}/.test(main), 'BPM release/cancel/leave clears both pending long-press timer and active repeat interval');
assert(/\$\('bpmUp'\)\.addEventListener\(e,\s*\(\)\s*=>\s*endBpmHold\('bpmUp'\)\)/.test(main), 'BPM up release/cancel/leave clears hold and opens a post-release suppression cleanup window');
assert(/\$\('bpmDn'\)\.addEventListener\(e,\s*\(\)\s*=>\s*endBpmHold\('bpmDn'\)\)/.test(main), 'BPM down release/cancel/leave clears hold and opens a post-release suppression cleanup window');
assert(/function\s+chgBPM\s*\(\s*d\s*\)\s*\{[\s\S]*Math\.min\(240,\s*Math\.max\(40,[\s\S]*\$\('bpmD'\)\.textContent\s*=\s*S\.bpm[\s\S]*N\.dlyLine\.delayTime\.setTargetAtTime\(dlyTimeSec\(\),\s*A\.currentTime,\s*\.03\)[\s\S]*autosave\(\)[\s\S]*\}/.test(main), 'BPM changes remain clamped, update visible value, update delay timing, and autosave');

console.log('Issue 008 transport tempo hold checks passed.');
