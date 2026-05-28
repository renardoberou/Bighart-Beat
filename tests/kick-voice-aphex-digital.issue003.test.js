#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const kickVoicePath = path.join(root, 'src', 'rhythm', 'kick-voice.js');
assert(fs.existsSync(kickVoicePath), 'kick voice resolver module exists');

const { resolveKickVoiceSpec } = require(kickVoicePath);
assert.strictEqual(typeof resolveKickVoiceSpec, 'function', 'resolveKickVoiceSpec is exported');

const baseParams = {
  pitch: 110,
  end: 44,
  decay: 0.55,
  click: 0.68,
  drive: 0.4,
};

// ── Test 1: Aphex at high velocity gets digitalCrack fields ──
const aphexLoud = resolveKickVoiceSpec('aphex', baseParams, 1);
assert.strictEqual(aphexLoud.engine, 'aphex', 'aphex engine id preserved');
assert.strictEqual(aphexLoud.digitalCrack, true, 'aphex loud kick has digitalCrack enabled');
assert(Number.isFinite(aphexLoud.digitalCrackGain), 'digitalCrackGain is a finite number');
assert(aphexLoud.digitalCrackGain > 0, 'aphex loud kick has positive digitalCrackGain');
assert(Number.isFinite(aphexLoud.digitalCrackDecay), 'digitalCrackDecay is a finite number');
assert(aphexLoud.digitalCrackDecay > 0, 'aphex loud kick has positive digitalCrackDecay');

// ── Test 2: Aphex at medium-high velocity (just above accent threshold) gets digitalCrack ──
const aphexMed = resolveKickVoiceSpec('aphex', baseParams, 0.8);
assert.strictEqual(aphexMed.digitalCrack, true, 'aphex at velocity 0.8 has digitalCrack');
assert(aphexMed.digitalCrackGain > 0, 'aphex at velocity 0.8 has positive digitalCrackGain');
assert(aphexMed.digitalCrackGain <= aphexLoud.digitalCrackGain, 'medium velocity crack gain does not exceed loud');

// ── Test 3: Aphex at low velocity has zero or no digitalCrack ──
const aphexSoft = resolveKickVoiceSpec('aphex', baseParams, 0.3);
assert(
  !aphexSoft.digitalCrack && aphexSoft.digitalCrackGain === 0,
  'aphex soft kick has no digitalCrack (falsy digitalCrack, zero gain)'
);

// ── Test 4: Aphex at boundary velocity (0.5) — should not fire digitalCrack ──
const aphexMid = resolveKickVoiceSpec('aphex', baseParams, 0.5);
assert(
  !aphexMid.digitalCrack && aphexMid.digitalCrackGain === 0,
  'aphex at velocity 0.5 does not trigger digitalCrack'
);

// ── Test 5: Non-aphex engines have no digitalCrack ──
for (const engine of ['808', '909', 'reznor']) {
  const spec = resolveKickVoiceSpec(engine, baseParams, 1);
  assert(
    !spec.digitalCrack,
    `${engine} engine has no digitalCrack on aphex kick`
  );
  assert.strictEqual(
    spec.digitalCrackGain, 0,
    `${engine} engine has zero digitalCrackGain`
  );
}

// ── Test 6: digitalCrackGain is bounded ──
assert(aphexLoud.digitalCrackGain <= 0.42, 'digitalCrackGain stays within headroom bound');
assert(aphexLoud.digitalCrackDecay >= 0.002, 'digitalCrackDecay is at least 2ms');
assert(aphexLoud.digitalCrackDecay <= 0.04, 'digitalCrackDecay is at most 40ms');

console.log('Aphex IDM digital crack transient kick-voice tests passed.');
