#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { analyzeRhythm } = require(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'));
const { createEmptyGrid } = require(path.join(root, 'src', 'state', 'pattern-operations.js'));

function gridWith(hits) {
  const grid = createEmptyGrid();
  for (const [track, steps] of Object.entries(hits)) {
    for (const step of steps) grid[track][step] = 1;
  }
  return grid;
}

function assertPredictiveTimingShape(name, analysis) {
  assert(analysis.predictiveTiming, `${name} exposes predictiveTiming`);
  assert.strictEqual(typeof analysis.predictiveTiming.predictionError, 'number', `${name} predictionError is numeric`);
  assert(
    analysis.predictiveTiming.predictionError >= 0 && analysis.predictiveTiming.predictionError <= 1,
    `${name} predictionError is normalized`
  );
  assert.strictEqual(typeof analysis.predictiveTiming.timingBias, 'string', `${name} timingBias is text`);
  assert.strictEqual(typeof analysis.predictiveTiming.cue, 'string', `${name} cue is text`);
  assert(analysis.predictiveTiming.cue.length <= 96, `${name} cue stays compact for mobile`);
  assert(!/\n/.test(analysis.predictiveTiming.cue), `${name} cue is one compact sentence`);
}

const lockedBackbeat = gridWith({
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hihat: [0, 2, 4, 6, 8, 10, 12, 14],
});

const anticipatedBackbeat = gridWith({
  kick: [15, 3, 7, 11],
  snare: [3, 11],
  hihat: [1, 3, 5, 7, 9, 11, 13, 15],
});

const locked = analyzeRhythm({ bpm: 120, swing: 0, pattern: lockedBackbeat, stepsPerBar: 16 });
const anticipated = analyzeRhythm({ bpm: 120, swing: 0, pattern: anticipatedBackbeat, stepsPerBar: 16 });

assertPredictiveTimingShape('locked backbeat', locked);
assertPredictiveTimingShape('anticipated backbeat', anticipated);

assert(
  locked.predictiveTiming.predictionError < 0.25,
  'locked backbeat has low prediction error'
);
assert(
  anticipated.predictiveTiming.predictionError >= locked.predictiveTiming.predictionError + 0.2,
  'consistent anticipation raises prediction error versus locked timing'
);
assert.strictEqual(
  anticipated.predictiveTiming.timingBias,
  'early',
  'anticipated hits are classified as early timing bias'
);

console.log('Issue 001 predictive timing regression checks passed.');
