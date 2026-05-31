'use strict';

const { resolveSynthVoiceSpec, SYNTH_ENGINE_PROFILES, SYNTH_MAX_FREQUENCY_HZ } = require('../src/rhythm/synth-voice');
const tracks = require('../src/state/tracks');

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

// Test 4: 808 synth at default track pitch (130) produces audible-range pitch (~93.6 Hz)
const defaultTracks = tracks.createDefaultTracks();
const synthTrack = defaultTracks.find(t => t.id === 'synth');
assert(synthTrack !== undefined, 'default tracks include a synth track');
assert(synthTrack.p.pitch === 130, 'synth track default pitch is 130 Hz (got: ' + synthTrack.p.pitch + ')');
const eightOhEightVoice = resolveSynthVoiceSpec('808', synthTrack.p);
assert(
  Math.abs(eightOhEightVoice.pitchHz - 93.6) < 0.5,
  "808 synth at default pitch produces ~93.6 Hz audible-range pitch (got: " + eightOhEightVoice.pitchHz + ")"
);

// Test 5: Aphex modIndex at tone=0.5, shape=0.5 should be ~12 (crystalline, not harsh)
const aphexMid = resolveSynthVoiceSpec('aphex', { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 });
assert(
  Math.abs(aphexMid.modIndex - 12) < 0.5,
  "Aphex modIndex at tone=0.5 shape=0.5 should be ~12 crystalline (got: " + aphexMid.modIndex + ")"
);

if (failures > 0) {
  console.log('\n' + failures + ' test(s) FAILED');
  process.exit(1);
} else {
  console.log('\nAll tests PASSED');
  process.exit(0);
}
