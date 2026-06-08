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

function analyze(pattern) {
  return analyzeRhythm({ bpm: 120, swing: 0, tracks: [], pattern, stepsPerBar: 16 });
}

function labelsFor(pattern) {
  return analyze(pattern).labels;
}

function assertLabels(name, pattern, expected) {
  const labels = labelsFor(pattern);
  assert.deepStrictEqual(labels, expected, `${name} labels are deterministic and explainable`);
}

function assertInterpretation(name, pattern, expected) {
  const analysis = analyze(pattern);
  assert.strictEqual(analysis.interpretation, expected, `${name} has deterministic plain-language interpretation`);
  assert(analysis.interpretation.length <= 120, `${name} interpretation stays compact for mobile`);
  assert(!/\n/.test(analysis.interpretation), `${name} interpretation is one compact paragraph`);
  for (const banned of ['syncopation', 'meterConfidence', 'surpriseTension', 'recoverability', 'movementDrive', 'salience', 'neural', 'cognitive']) {
    assert(!analysis.interpretation.includes(banned), `${name} interpretation avoids jargon: ${banned}`);
  }
}

const emptyPattern = createEmptyGrid();
const fourOnFloorPattern = gridWith({
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hihat: [0, 2, 4, 6, 8, 10, 12, 14],
});
const offbeatTensePattern = gridWith({
  kick: [1, 7, 10, 15],
  snare: [3, 6, 11, 14],
  hihat: [1, 3, 5, 7, 9, 11, 13, 15],
  clap: [6, 11, 15],
});
const denseAllStepsPattern = gridWith({
  kick: Array.from({ length: 16 }, (_, i) => i),
  snare: Array.from({ length: 16 }, (_, i) => i),
  hihat: Array.from({ length: 16 }, (_, i) => i),
  clap: Array.from({ length: 16 }, (_, i) => i),
  input: Array.from({ length: 16 }, (_, i) => i),
  ether: Array.from({ length: 16 }, (_, i) => i),
});

assertLabels('empty pattern', emptyPattern, {
  sync: 'broken',
  anchor: 'lost',
  tension: 'low',
  recover: 'unstable',
  drive: 'flat',
});
assertInterpretation('empty pattern', emptyPattern, 'Add a kick or snare anchor to give the rhythm a center.');

assertLabels('four-on-floor backbeat', fourOnFloorPattern, {
  sync: 'straight',
  anchor: 'locked',
  tension: 'low',
  recover: 'recovers',
  drive: 'moving',
});
assertInterpretation('four-on-floor backbeat', fourOnFloorPattern, 'Feels steady and clear; the beat is easy to follow.');

assertLabels('offbeat tense pattern', offbeatTensePattern, {
  sync: 'tense',
  anchor: 'wobbly',
  tension: 'high',
  recover: 'wobbles',
  drive: 'moving',
});
assertInterpretation('offbeat tense pattern', offbeatTensePattern, 'Feels off-center and tense, but still has a recoverable pulse.');

assertLabels('dense all-steps pattern', denseAllStepsPattern, {
  sync: 'broken',
  anchor: 'lost',
  tension: 'red',
  recover: 'unstable',
  drive: 'flat',
});
assertInterpretation('dense all-steps pattern', denseAllStepsPattern, 'Feels overloaded; the main pulse is hard to read.');

const analysis = analyzeRhythm({ bpm: 96, pattern: gridWith({ kick: [0], snare: [4] }) });
for (const metric of ['syncopation', 'meterConfidence', 'surpriseTension', 'recoverability', 'movementDrive']) {
  assert.strictEqual(typeof analysis[metric], 'number', `${metric} is numeric`);
  assert(analysis[metric] >= 0 && analysis[metric] <= 1, `${metric} is normalized`);
}
assert.strictEqual(analysis.stepMetrics.length, 16, 'stepMetrics covers the 16-step bar');
assert.strictEqual(analysis.stepMetrics[0].step, 0, 'stepMetrics expose step indexes');

const synthlessPattern = gridWith({ kick: [0], snare: [4] });
const synthPattern = gridWith({ kick: [0], snare: [4], synth: [0] });
const synthlessAnalysis = analyze(synthlessPattern);
const synthAnalysis = analyze(synthPattern);
assert(synthAnalysis.stepMetrics[0].hits.includes('synth'), 'synth hits surface in stepMetrics');
for (const metric of ['syncopation', 'meterConfidence', 'surpriseTension', 'recoverability', 'movementDrive', 'density']) {
  assert.strictEqual(synthAnalysis[metric], synthlessAnalysis[metric], `synth ostinato does not alter ${metric}`);
}
assert.deepStrictEqual(synthAnalysis.labels, synthlessAnalysis.labels, 'synth ostinato keeps the groove labels unchanged');
assert.strictEqual(synthAnalysis.stepMetrics[0].weight, synthlessAnalysis.stepMetrics[0].weight, 'synth ostinato stays visible without changing drum step weight');

console.log('Rhythm intelligence MVP checks passed.');
