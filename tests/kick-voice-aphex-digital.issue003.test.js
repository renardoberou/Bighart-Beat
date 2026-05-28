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
assert(Number.isFinite(aphexLoud.digitalCrackHz), 'digitalCrackHz is a finite number');
assert(aphexLoud.digitalCrackHz > 0, 'aphex loud kick has positive digitalCrackHz');

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

// ── Test 4b: Aphex at exact accent threshold (0.75) — accentedHit === 0, no crack ──
const aphexBoundary = resolveKickVoiceSpec('aphex', baseParams, 0.75);
assert(
  !aphexBoundary.digitalCrack && aphexBoundary.digitalCrackGain === 0,
  'aphex at velocity 0.75 (exact threshold) does not trigger digitalCrack'
);

// ── Test 4c: Aphex at zero velocity — no crack ──
const aphexZero = resolveKickVoiceSpec('aphex', baseParams, 0);
assert(
  !aphexZero.digitalCrack && aphexZero.digitalCrackGain === 0,
  'aphex at velocity 0 does not trigger digitalCrack'
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
  assert.strictEqual(
    spec.digitalCrackHz, 0,
    `${engine} engine has zero digitalCrackHz`
  );
}

// ── Test 6: digitalCrackGain is bounded ──
assert(aphexLoud.digitalCrackGain <= 0.42, 'digitalCrackGain stays within headroom bound');
assert(aphexLoud.digitalCrackGain > 0, 'digitalCrackGain is positive at max velocity');

// ── Test 7: digitalCrackHz is bounded ──
assert(aphexLoud.digitalCrackHz >= 1500, 'digitalCrackHz is at least 1500 Hz');
assert(aphexLoud.digitalCrackHz <= 8000, 'digitalCrackHz is at most 8000 Hz');

// ── Test 8: digitalCrackHz scales with accentedHit ──
assert(aphexMed.digitalCrackHz >= 1500, 'med velocity crack Hz is within bounds');
assert(aphexMed.digitalCrackHz <= aphexLoud.digitalCrackHz, 'Hz does not exceed max at lower velocity');

// ── Test 9: Spec does not contain stale digitalCrackDecay field ──
assert.strictEqual(aphexLoud.digitalCrackDecay, undefined, 'stale digitalCrackDecay field is not present');

console.log('Aphex IDM digital crack transient kick-voice tests passed.');
