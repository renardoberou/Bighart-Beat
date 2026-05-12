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

function labelsFor(pattern) {
  return analyzeRhythm({ bpm: 120, swing: 0, tracks: [], pattern, stepsPerBar: 16 }).labels;
}

function assertLabels(name, pattern, expected) {
  const labels = labelsFor(pattern);
  assert.deepStrictEqual(labels, expected, `${name} labels are deterministic and explainable`);
}

assertLabels('empty pattern', createEmptyGrid(), {
  sync: 'broken',
  anchor: 'lost',
  tension: 'low',
  recover: 'unstable',
  drive: 'flat',
});

assertLabels('four-on-floor backbeat', gridWith({
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hihat: [0, 2, 4, 6, 8, 10, 12, 14],
}), {
  sync: 'straight',
  anchor: 'locked',
  tension: 'low',
  recover: 'recovers',
  drive: 'moving',
});

assertLabels('offbeat tense pattern', gridWith({
  kick: [1, 7, 10, 15],
  snare: [3, 6, 11, 14],
  hihat: [1, 3, 5, 7, 9, 11, 13, 15],
  clap: [6, 11, 15],
}), {
  sync: 'tense',
  anchor: 'wobbly',
  tension: 'high',
  recover: 'wobbles',
  drive: 'moving',
});

assertLabels('dense all-steps pattern', gridWith({
  kick: Array.from({ length: 16 }, (_, i) => i),
  snare: Array.from({ length: 16 }, (_, i) => i),
  hihat: Array.from({ length: 16 }, (_, i) => i),
  clap: Array.from({ length: 16 }, (_, i) => i),
  input: Array.from({ length: 16 }, (_, i) => i),
  ether: Array.from({ length: 16 }, (_, i) => i),
}), {
  sync: 'broken',
  anchor: 'lost',
  tension: 'red',
  recover: 'unstable',
  drive: 'flat',
});

const analysis = analyzeRhythm({ bpm: 96, pattern: gridWith({ kick: [0], snare: [4] }) });
for (const metric of ['syncopation', 'meterConfidence', 'surpriseTension', 'recoverability', 'movementDrive']) {
  assert.strictEqual(typeof analysis[metric], 'number', `${metric} is numeric`);
  assert(analysis[metric] >= 0 && analysis[metric] <= 1, `${metric} is normalized`);
}
assert.strictEqual(analysis.stepMetrics.length, 16, 'stepMetrics covers the 16-step bar');
assert.strictEqual(analysis.stepMetrics[0].step, 0, 'stepMetrics expose step indexes');

console.log('Rhythm intelligence MVP checks passed.');
