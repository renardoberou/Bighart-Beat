'use strict';

const assert = require('assert');
const { resolveSynthVoiceSpec } = require('../src/rhythm/synth-voice.js');

const base = { pitch: 220, decay: 0.35, tone: 0.5, shape: 0.5 };
const reznor = resolveSynthVoiceSpec('reznor', base);
const eightOhEight = resolveSynthVoiceSpec('808', base);
const nineOhNine = resolveSynthVoiceSpec('909', base);
const aphex = resolveSynthVoiceSpec('aphex', base);

assert.strictEqual(reznor.engine, 'reznor');
assert.strictEqual(reznor.personality, 'industrial-mono');
assert.strictEqual(reznor.oscType, 'square');
assert.strictEqual(reznor.filterType, 'bandpass');
assert.strictEqual(reznor.modIndex, 0, 'Reznor stays non-FM so it does not blur into Aphex glass');

assert(
  reznor.noiseGain > aphex.noiseGain && reznor.noiseGain > eightOhEight.noiseGain && reznor.noiseGain > nineOhNine.noiseGain,
  'Reznor SYN should be the most noise-forward engine voice'
);
assert(
  reznor.driveAmount > nineOhNine.driveAmount && reznor.driveAmount > aphex.driveAmount,
  'Reznor SYN should be the hardest-driven industrial voice'
);
assert(
  reznor.subGain < eightOhEight.subGain,
  'Reznor SYN should avoid 808-style sub dominance'
);
assert(
  reznor.decaySec < aphex.decaySec,
  'Reznor SYN should be shorter/gated compared with Aphex glass tails'
);
assert(
  reznor.releaseTau < eightOhEight.releaseTau && reznor.releaseTau < aphex.releaseTau,
  'Reznor SYN should release tighter than bass/glass engines'
);
assert(
  reznor.filterTriggerHz > reznor.filterRestHz,
  'Reznor SYN should keep trigger filter movement for per-hit bite'
);
assert(
  reznor.noiseGain <= 0.16,
  'Reznor noise layer must remain bounded for headroom/mobile safety'
);
assert(
  reznor.driveAmount <= 0.75,
  'Reznor drive must remain bounded for mobile-safe waveshaping'
);

console.log('synth-reznor-industrial issue003 tests passed');
