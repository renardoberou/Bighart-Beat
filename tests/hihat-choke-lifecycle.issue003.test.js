#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

// ── 1. stopPlay resets hihatChokeState to initial values ──
assert(
  /function\s+stopPlay\s*\(\s*\)\s*\{[\s\S]*?hihatChokeState\.gain\s*=\s*null[\s\S]*?hihatChokeState\.open\s*=\s*0/.test(main),
  'stopPlay() resets hihatChokeState.gain to null and hihatChokeState.open to 0'
);

// ── 2. The reset is inside stopPlay, after the early-return guard ──
// Ensure the reset comes after `if (!S.playing) return;`
const stopPlayMatch = main.match(/function\s+stopPlay\s*\(\s*\)\s*\{([\s\S]*?)\n\}/);
assert(stopPlayMatch, 'stopPlay function body is found');
const body = stopPlayMatch[1];
const earlyReturnIdx = body.indexOf('if (!S.playing) return;');
const chokeResetIdx = body.indexOf('hihatChokeState.gain = null');
assert(earlyReturnIdx >= 0, 'stopPlay has early-return guard');
assert(chokeResetIdx >= 0, 'stopPlay has choke state reset');
assert(chokeResetIdx > earlyReturnIdx,
  'hihatChokeState reset comes after the early-return guard in stopPlay');

// ── 3. synthVoiceState is NOT reset on stop (only choke state is) ──
// (Synth voice state has its own lifecycle via triggerSynthChoke)
assert(
  !body.includes('synthVoiceState'),
  'stopPlay does not reset synthVoiceState (synth choke lifecycle is voice-level)'
);

// ── 4. Initial state and reset state match ──
assert(
  /const\s+hihatChokeState\s*=\s*\{\s*gain:\s*null,\s*open:\s*0\s*\}/.test(main),
  'hihatChokeState initial value has gain:null open:0 matching the reset in stopPlay'
);

console.log('Issue 003 hihat choke lifecycle reset checks passed.');
