#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const Patterns = require(path.join(root, 'src', 'state', 'patterns.js'));
const Ops = require(path.join(root, 'src', 'state', 'pattern-operations.js'));
const Rhythm = require(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'));
const Variation = require(path.join(root, 'src', 'state', 'pattern-variation.js'));

assert.strictEqual(typeof Variation.resolveRhythmMutationAction, 'function', 'exports resolveRhythmMutationAction as a pure state helper');

const patterns = Patterns.createPatternBanks();
const ratchets = Patterns.createRatchetBanks();
const hihatOpenness = Patterns.createHihatOpennessBanks();
patterns[0] = Ops.createEmptyGrid();
ratchets[0] = Ops.createDefaultRatchetGrid();
hihatOpenness[0] = Ops.createDefaultHihatOpennessGrid();

const lostAnalysis = Rhythm.analyzeRhythm({
  pattern: patterns[0],
  ratchets: ratchets[0],
  hihatOpenness: hihatOpenness[0],
  stepsPerBar: 16,
});

const anchorAction = Variation.resolveRhythmMutationAction({
  analysis: lostAnalysis,
  pattern: patterns[0],
  ratchets: ratchets[0],
  hihatOpenness: hihatOpenness[0],
});

assert.deepStrictEqual(anchorAction.edit, {
  trackId: 'kick',
  stepIndex: 0,
  active: 1,
}, 'lost-anchor analysis resolves to a downbeat kick anchor edit');
assert.strictEqual(anchorAction.reason, 'ADD ANCHOR', 'lost-anchor action gives a player-readable reason');

const result = Variation.applyControlledPatternVariation({
  patterns,
  ratchets,
  hihatOpenness,
  sourceIndex: 0,
  targetIndex: 1,
  edit: anchorAction.edit,
});

assert.strictEqual(patterns[0].kick[0], 0, 'source bank is not mutated by resolved action');
assert.strictEqual(result.patterns[1].kick[0], 1, 'resolved action adds kick anchor to target bank');
assert.strictEqual(result.ratchets[1].kick[0], 1, 'resolved anchor edit keeps a safe default ratchet');
const repaired = Rhythm.analyzeRhythm({
  pattern: result.patterns[1],
  ratchets: result.ratchets[1],
  hihatOpenness: result.hihatOpenness[1],
  stepsPerBar: 16,
});
assert.notStrictEqual(repaired.labels.anchor, 'lost', 'target analysis is no longer totally anchor-lost');

const clearPattern = Ops.createEmptyGrid();
[0, 4, 8, 12].forEach(step => { clearPattern.kick[step] = 1; });
[4, 12].forEach(step => { clearPattern.snare[step] = 1; });
const clearAnalysis = Rhythm.analyzeRhythm({
  pattern: clearPattern,
  ratchets: Ops.createDefaultRatchetGrid(),
  hihatOpenness: Ops.createDefaultHihatOpennessGrid(),
  stepsPerBar: 16,
});
const clearAction = Variation.resolveRhythmMutationAction({
  analysis: clearAnalysis,
  pattern: clearPattern,
  ratchets: Ops.createDefaultRatchetGrid(),
  hihatOpenness: Ops.createDefaultHihatOpennessGrid(),
});
assert.strictEqual(clearAction, null, 'clear locked pattern returns no mutation for anchor action');

const overloadedPattern = Ops.createEmptyGrid();
Ops.TRACK_IDS.forEach(trackId => {
  for (let step = 0; step < 16; step++) overloadedPattern[trackId][step] = 1;
});
const overloadedAnalysis = Rhythm.analyzeRhythm({
  pattern: overloadedPattern,
  ratchets: Ops.createDefaultRatchetGrid(),
  hihatOpenness: Ops.createDefaultHihatOpennessGrid(),
  stepsPerBar: 16,
});
assert.strictEqual(overloadedAnalysis.labels.sync, 'broken', 'dense fixture is analyzed as broken');
assert.strictEqual(overloadedAnalysis.labels.anchor, 'lost', 'dense fixture has lost anchor despite occupied kick anchors');
const overloadedAction = Variation.resolveRhythmMutationAction({
  analysis: overloadedAnalysis,
  pattern: overloadedPattern,
  ratchets: Ops.createDefaultRatchetGrid(),
  hihatOpenness: Ops.createDefaultHihatOpennessGrid(),
});
assert.deepStrictEqual(overloadedAction.edit, {
  trackId: 'hihat',
  stepIndex: 1,
  active: 0,
}, 'broken/lost dense rhythm clears a low-priority offbeat hihat when kick anchors are full');
assert.strictEqual(overloadedAction.reason, 'CLEAR SPACE', 'dense broken action gives a truthful player-readable reason');

console.log('rhythm action mutation issue007 tests passed');
