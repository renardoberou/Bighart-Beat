#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const Patterns = require(path.join(root, 'src', 'state', 'patterns.js'));
const Ops = require(path.join(root, 'src', 'state', 'pattern-operations.js'));
const Variation = require(path.join(root, 'src', 'state', 'pattern-variation.js'));

assert.strictEqual(typeof Variation.applyControlledPatternVariation, 'function');

const patterns = Patterns.createPatternBanks();
const ratchets = Patterns.createRatchetBanks();
const hihatOpenness = Patterns.createHihatOpennessBanks();
const hihatAccent = Patterns.createHihatAccentBanks();

patterns[0] = Ops.createEmptyGrid();
patterns[1] = Ops.createEmptyGrid();
patterns[0].kick[0] = 1;
patterns[0].snare[4] = 1;
patterns[0].hihat[2] = 1;
patterns[0].hihat[3] = 0;
ratchets[0].kick[0] = 3;
hihatOpenness[0][2] = 0.45;
hihatAccent[0][2] = 1;
hihatAccent[0][3] = 1;
hihatAccent[1][3] = 1;

const result = Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  hihatAccent,
  sourceIndex: 0,
  targetIndex: 1,
  edit: {
    trackId: 'hihat',
    stepIndex: 14,
    active: 1,
    ratchet: 2,
    hihatOpen: 0.45,
  },
});

assert.strictEqual(result.targetIndex, 1, 'returns the target pattern index');
assert.strictEqual(result.patterns[1].kick[0], 1, 'target starts as a copy of source pattern');
assert.strictEqual(result.patterns[1].snare[4], 1, 'target preserves source hits');
assert.strictEqual(result.ratchets[1].kick[0], 3, 'target copies source ratchets');
assert.strictEqual(result.hihatOpenness[1][2], 0.45, 'target copies source hihat openness');
assert.strictEqual(result.hihatAccent[1][2], 1, 'target copies source hihat accent for active hihat step');
assert.strictEqual(result.hihatAccent[1][3], 0, 'target clears stale/source hihat accents for inactive hihat steps');
assert.strictEqual(result.patterns[1].hihat[14], 1, 'variation activates requested hihat step');
assert.strictEqual(result.ratchets[1].hihat[14], 2, 'variation applies requested ratchet');
assert.strictEqual(result.hihatOpenness[1][14], 0.45, 'variation applies requested hihat openness');
assert.strictEqual(result.hihatAccent[1][14], 0, 'new hihat step starts without stale accent');
assert.strictEqual(patterns[1].hihat[14], 0, 'input target bank is not mutated');
assert.strictEqual(patterns[0].hihat[14], 0, 'source bank is not mutated');
assert.strictEqual(hihatAccent[1][3], 1, 'input target accent bank is not mutated');
assert.notStrictEqual(result.patterns, patterns, 'returns a new pattern bank array');
assert.notStrictEqual(result.patterns[1], patterns[1], 'returns a cloned target pattern');
assert.notStrictEqual(result.ratchets[1], ratchets[1], 'returns a cloned target ratchet grid');
assert.notStrictEqual(result.hihatOpenness[1], hihatOpenness[1], 'returns a cloned target hihat openness grid');
assert.notStrictEqual(result.hihatAccent[1], hihatAccent[1], 'returns a cloned target hihat accent grid');

const removed = Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  hihatAccent,
  sourceIndex: 0,
  targetIndex: 2,
  edit: {
    trackId: 'kick',
    stepIndex: 0,
    active: 0,
  },
});
assert.strictEqual(removed.patterns[2].kick[0], 0, 'active: 0 removes requested hit');
assert.strictEqual(removed.ratchets[2].kick[0], 1, 'removing a hit resets target ratchet');

const removedHat = Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  hihatAccent,
  sourceIndex: 0,
  targetIndex: 3,
  edit: {
    trackId: 'hihat',
    stepIndex: 2,
    active: 0,
  },
});
assert.strictEqual(removedHat.patterns[3].hihat[2], 0, 'active: 0 removes requested hihat hit');
assert.strictEqual(removedHat.hihatAccent[3][2], 0, 'removing a hihat hit clears copied accent');

assert.throws(() => Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  sourceIndex: 0,
  targetIndex: 0,
  edit: { trackId: 'kick', stepIndex: 0, active: 1 },
}), /source|target|same/i, 'same source/target is rejected');
assert.throws(() => Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  sourceIndex: -1,
  targetIndex: 1,
  edit: { trackId: 'kick', stepIndex: 0, active: 1 },
}), /source|pattern|index/i, 'bad source index is rejected');
assert.throws(() => Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  sourceIndex: 0,
  targetIndex: 4,
  edit: { trackId: 'kick', stepIndex: 0, active: 1 },
}), /target|pattern|index/i, 'bad target index is rejected');
assert.throws(() => Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  sourceIndex: 0,
  targetIndex: 1,
  edit: { trackId: 'rim', stepIndex: 0, active: 1 },
}), /unknown track/i, 'unknown track is rejected');
assert.throws(() => Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  sourceIndex: 0,
  targetIndex: 1,
  edit: { trackId: 'kick', stepIndex: 16, active: 1 },
}), /step/i, 'bad step index is rejected');
assert.throws(() => Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  sourceIndex: 0,
  targetIndex: 1,
  edit: { trackId: 'kick', stepIndex: 0, active: 1, ratchet: 4 },
}), /ratchet|1.*2.*3/i, 'bad ratchet count is rejected');
assert.throws(() => Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  sourceIndex: 0,
  targetIndex: 1,
  edit: { trackId: 'kick', stepIndex: 0, active: 1, hihatOpen: 1 },
}), /hihat|openness/i, 'hihat openness on non-hihat track is rejected');

console.log('pattern variation issue010 tests passed');
