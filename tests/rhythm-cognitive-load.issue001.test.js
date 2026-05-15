#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const Ops = require(path.join(root, 'src', 'state', 'pattern-operations.js'));
const Rhythm = require(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'));

function analyze(pattern) {
  return Rhythm.analyzeRhythm({
    pattern,
    ratchets: Ops.createDefaultRatchetGrid(),
    hihatOpenness: Ops.createDefaultHihatOpennessGrid(),
    stepsPerBar: 16,
  });
}

const empty = analyze(Ops.createEmptyGrid());
assert.deepStrictEqual(
  Object.keys(empty.cognitiveLoad),
  ['score', 'value', 'cue'],
  'cognitiveLoad exposes only the player-facing score, value, and cue'
);
assert.strictEqual(empty.cognitiveLoad.score, 0, 'empty pattern has zero attention load');
assert.strictEqual(empty.cognitiveLoad.value, 'EMPTY', 'empty pattern is labelled EMPTY');
assert.match(empty.cognitiveLoad.cue, /clear pulse/i, 'empty cue asks for a clear pulse');

const lockedPattern = Ops.createEmptyGrid();
[0, 4, 8, 12].forEach(step => { lockedPattern.kick[step] = 1; });
[4, 12].forEach(step => { lockedPattern.snare[step] = 1; });
const locked = analyze(lockedPattern);
assert.strictEqual(locked.cognitiveLoad.value, 'CLEAR', 'locked anchors are easy to follow');
assert.ok(locked.cognitiveLoad.score > 0 && locked.cognitiveLoad.score < 0.35, 'clear groove has low attention load');
assert.match(locked.cognitiveLoad.cue, /easy to follow/i, 'clear cue uses plain player language');

const sweetPattern = Ops.createEmptyGrid();
[0, 8].forEach(step => { sweetPattern.kick[step] = 1; });
[4, 12].forEach(step => { sweetPattern.snare[step] = 1; });
[3, 7, 10, 14].forEach(step => { sweetPattern.hihat[step] = 1; });
const sweet = analyze(sweetPattern);
assert.strictEqual(sweet.cognitiveLoad.value, 'SWEET SPOT', 'recoverable surprise is labelled as the useful sweet spot');
assert.ok(sweet.cognitiveLoad.score > locked.cognitiveLoad.score, 'sweet spot asks for more attention than a locked groove');
assert.ok(sweet.cognitiveLoad.score < 0.72, 'sweet spot stays below overload territory');
assert.match(sweet.cognitiveLoad.cue, /surprise.*readable|readable.*surprise/i, 'sweet spot cue explains readable surprise');

const earlyPattern = Ops.createEmptyGrid();
earlyPattern.kick[15] = 1;
earlyPattern.snare[4] = 1;
earlyPattern.snare[12] = 1;
const early = analyze(earlyPattern);
assert.ok(early.cognitiveLoad.score > locked.cognitiveLoad.score, 'prediction misses raise attention load versus locked anchors');

const densePattern = Ops.createEmptyGrid();
Ops.TRACK_IDS.forEach(trackId => {
  for (let step = 0; step < 16; step++) densePattern[trackId][step] = 1;
});
const dense = analyze(densePattern);
assert.strictEqual(dense.cognitiveLoad.value, 'OVERLOAD', 'dense all-step rhythm overloads attention');
assert.ok(dense.cognitiveLoad.score >= 0.9 && dense.cognitiveLoad.score <= 1, 'overload score is normalized near the top');
assert.match(dense.cognitiveLoad.cue, /too crowded|blurs the pulse/i, 'overload cue warns the player about crowding');

[empty, locked, sweet, early, dense].forEach((analysis, index) => {
  assert.ok(analysis.cognitiveLoad.score >= 0 && analysis.cognitiveLoad.score <= 1, `analysis ${index} score is normalized`);
  assert.ok(analysis.cognitiveLoad.cue.length <= 96, `analysis ${index} cue stays compact for mobile`);
  assert.doesNotMatch(analysis.cognitiveLoad.cue, /neural|cognitive|prediction error|syncopation|meter/i, `analysis ${index} cue avoids internal jargon`);
});

console.log('Issue 001 cognitive load rhythm checks passed.');
