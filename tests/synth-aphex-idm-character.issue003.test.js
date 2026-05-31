#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { resolveSynthVoiceSpec } = require('../src/rhythm/synth-voice.js');

const base = { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 };
const aphex = resolveSynthVoiceSpec('aphex', base);
const eightOhEight = resolveSynthVoiceSpec('808', base);
const nineOhNine = resolveSynthVoiceSpec('909', base);
const reznor = resolveSynthVoiceSpec('reznor', base);

// ── Test 1: Aphex engine identity ──
assert.strictEqual(aphex.engine, 'aphex');
assert.strictEqual(aphex.personality, 'idm-digital-alien');
assert.strictEqual(aphex.oscType, 'triangle');
assert.strictEqual(aphex.filterType, 'bandpass');

// ── Test 2: Aphex has brighter/more resonant tone than 808 ──
// Aphex tone profile (1.50) opens the filter more than 808 (0.72)
assert(
  aphex.filterHz > eightOhEight.filterHz,
  'Aphex filter should be more open (higher filterTriggerHz base) than 808 (got aphex: ' +
    aphex.filterHz.toFixed(1) + ' vs 808: ' + eightOhEight.filterHz.toFixed(1) + ')'
);

// ── Test 3: Aphex has more noise texture than 808 but less than Reznor ──
assert(
  aphex.noiseGain > eightOhEight.noiseGain,
  'Aphex should have more noise texture than 808 (got aphex: ' +
    aphex.noiseGain.toFixed(4) + ' vs 808: ' + eightOhEight.noiseGain.toFixed(4) + ')'
);
assert(
  aphex.noiseGain < reznor.noiseGain,
  'Aphex noise should remain below Reznor industrial grit (got aphex: ' +
    aphex.noiseGain.toFixed(4) + ' vs reznor: ' + reznor.noiseGain.toFixed(4) + ')'
);

// ── Test 4: Aphex has longer decay tails than Reznor (IDM evolving vs industrial gated) ──
assert(
  aphex.decaySec > reznor.decaySec,
  'Aphex should have longer evolving decay than Reznor gated tails (got aphex: ' +
    aphex.decaySec.toFixed(4) + ' vs reznor: ' + reznor.decaySec.toFixed(4) + ')'
);

// ── Test 5: Aphex filterTriggerHz reflects open crystalline character relative to 808 ──
assert(
  aphex.filterTriggerHz > eightOhEight.filterTriggerHz,
  'Aphex filterTriggerHz should be higher than 808 for crystalline openness (got aphex: ' +
    aphex.filterTriggerHz.toFixed(1) + ' vs 808: ' + eightOhEight.filterTriggerHz.toFixed(1) + ')'
);

// ── Test 6: Aphex is NOT the most driven engine — Reznor should be harder ──
assert(
  reznor.driveAmount >= aphex.driveAmount,
  'Reznor should be at least as driven as Aphex (got reznor: ' +
    reznor.driveAmount.toFixed(4) + ' vs aphex: ' + aphex.driveAmount.toFixed(4) + ')'
);

// ── Test 7: Aphex has meaningful FM modulation (modIndex > 0) ──
assert(
  aphex.modIndex > 0,
  'Aphex should have meaningful FM modulation for IDM character (got modIndex: ' + aphex.modIndex + ')'
);
assert(
  Number.isInteger(aphex.modIndex),
  'Aphex modIndex should be an integer'
);

// ── Test 8: All values within mobile-safe bounds ──
assert(
  aphex.driveAmount <= 0.75,
  'Aphex drive must remain mobile-safe (got: ' + aphex.driveAmount.toFixed(4) + ')'
);
assert(
  aphex.noiseGain <= 0.16,
  'Aphex noise must remain within non-industrial bound of 0.16 (got: ' + aphex.noiseGain.toFixed(4) + ')'
);
assert(
  aphex.subGain <= 0.35,
  'Aphex sub gain must remain mobile-safe (got: ' + aphex.subGain.toFixed(4) + ')'
);
assert(
  aphex.filterQ <= 12,
  'Aphex filter Q must stay within stable range (got: ' + aphex.filterQ.toFixed(4) + ')'
);

// ── Test 9: Aphex pitch multiplier results in higher frequency content than 808 ──
assert(
  aphex.pitchHz > eightOhEight.pitchHz,
  'Aphex pitchHz should be higher than 808 due to 1.18 vs 0.72 multiplier (got aphex: ' +
    aphex.pitchHz.toFixed(1) + ' vs 808: ' + eightOhEight.pitchHz.toFixed(1) + ')'
);

// ── Test 10: Aphex has subtle glide for alien pitch sliding ──
assert(
  aphex.glideSec > eightOhEight.glideSec,
  'Aphex glide should exceed 808 glide for alien pitch movement (got aphex: ' +
    aphex.glideSec.toFixed(5) + ' vs 808: ' + eightOhEight.glideSec.toFixed(5) + ')'
);

// ── Test 11: Aphex filterDecaySec longer than reznor for evolving tones ──
assert(
  aphex.filterDecaySec >= reznor.filterDecaySec,
  'Aphex filter decay should be >= reznor for evolving IDM sweeps (got aphex: ' +
    aphex.filterDecaySec.toFixed(5) + ' vs reznor: ' + reznor.filterDecaySec.toFixed(5) + ')'
);

console.log('synth-aphex-idm-character issue003 tests passed');
