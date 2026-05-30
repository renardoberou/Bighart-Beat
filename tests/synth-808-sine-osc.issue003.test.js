'use strict';

const { resolveSynthVoiceSpec, SYNTH_ENGINE_PROFILES, SYNTH_MAX_FREQUENCY_HZ } = require('../src/rhythm/synth-voice');
const hihat = require('../src/rhythm/hihat-voice');

let failures = 0;

function assert(condition, msg) {
  if (!condition) {
    console.error('FAIL: ' + msg);
    failures++;
  } else {
    console.log('PASS: ' + msg);
  }
}

// Test 1: 808 engine profile uses 'sine' oscillator type
assert(
  SYNTH_ENGINE_PROFILES['808'].oscType === 'sine',
  "808 engine profile uses 'sine' oscillator type (got: " + SYNTH_ENGINE_PROFILES['808'].oscType + ")"
);

// Test 2: SYNTH_MAX_FREQUENCY_HZ is >= 2000
assert(
  SYNTH_MAX_FREQUENCY_HZ >= 2000,
  "SYNTH_MAX_FREQUENCY_HZ >= 2000 (got: " + SYNTH_MAX_FREQUENCY_HZ + ")"
);

// Test 3: A synth voice resolved with aphex engine can produce frequencies above 500 Hz
const aphexVoice = resolveSynthVoiceSpec('aphex', { pitch: 440, shape: 1.0, tone: 1.0 });
assert(
  aphexVoice.pitchHz > 500,
  "aphex synth voice can produce frequencies above 500 Hz (got pitchHz: " + aphexVoice.pitchHz + ")"
);

if (failures > 0) {
  console.log('\n' + failures + ' test(s) FAILED');
  process.exit(1);
} else {
  console.log('\nAll tests PASSED');
  process.exit(0);
}
