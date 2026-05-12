#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { analyzeRhythm, analyzePumpArousal } = require(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'));
const { createEmptyGrid } = require(path.join(root, 'src', 'state', 'pattern-operations.js'));

function gridWith(hits) {
  const grid = createEmptyGrid();
  for (const [track, steps] of Object.entries(hits)) {
    for (const step of steps) grid[track][step] = 1;
  }
  return grid;
}

function assertCompactCue(name, cue) {
  assert.strictEqual(typeof cue, 'string', `${name} cue is text`);
  assert(cue.length <= 96, `${name} cue stays compact for mobile`);
  assert(!/\n/.test(cue), `${name} cue is one compact paragraph`);
  for (const banned of ['DynamicsCompressorNode', 'threshold', 'ratio', 'neural', 'cognitive']) {
    assert(!cue.includes(banned), `${name} cue avoids technical jargon: ${banned}`);
  }
}

const off = analyzePumpArousal({ on: false, ratio: 12, release: 520, gateOn: true, gateRate: 420 });
assert.strictEqual(off.arousal, 0, 'compressor off has no pump arousal');
assert.strictEqual(off.breath, 'still', 'compressor off is still');
assert.strictEqual(off.value, '--', 'compressor off renders inactive breath value');
assertCompactCue('compressor off', off.cue);

const pump = analyzePumpArousal({ on: true, threshold: -46, ratio: 12, attack: 2, release: 520, gateOn: true, gateRate: 420 });
assert(pump.arousal >= 0.75 && pump.arousal <= 1, 'pump macro has high bounded arousal');
assert.strictEqual(pump.breath, 'heaving', 'pump macro classifies as heaving breath');
assert.strictEqual(pump.value, '420ms EXHALE', 'pump macro exposes gate breath timing');
assert(/exhale|breath/i.test(pump.cue), 'pump cue uses embodied breathing language');
assertCompactCue('pump macro', pump.cue);

const frenchHouse = analyzePumpArousal({ on: true, threshold: -36, ratio: 8, attack: 3, release: 560, gateOn: true, gateRate: 680 });
assert.strictEqual(frenchHouse.value, '680ms EXHALE', 'French House preset exposes slower gate breath timing');
assert(frenchHouse.arousal >= 0.55 && frenchHouse.arousal <= 1, 'French House preset remains bounded and active');
assertCompactCue('French House preset', frenchHouse.cue);

const fastGate = analyzePumpArousal({ on: true, threshold: -24, ratio: 4, attack: 8, release: 280, gateOn: true, gateRate: 10 });
assert.strictEqual(fastGate.value, '10ms EXHALE', 'minimum gate timing matches the UI/audio range');
assertCompactCue('fast gate input', fastGate.cue);

const extreme = analyzePumpArousal({ on: true, threshold: -999, ratio: 999, attack: -20, release: 99999, gateOn: true, gateRate: 99999 });
assert(extreme.arousal >= 0 && extreme.arousal <= 1, 'extreme compressor input clamps arousal');
assert.strictEqual(extreme.value, '2000ms EXHALE', 'extreme gate timing clamps to UI range');
assertCompactCue('extreme input', extreme.cue);

const pattern = gridWith({ kick: [0, 4, 8, 12], snare: [4, 12], hihat: [0, 2, 4, 6, 8, 10, 12, 14] });
const dryAnalysis = analyzeRhythm({ pattern, fx: { comp: { on: false } } });
const pumpedAnalysis = analyzeRhythm({ pattern, fx: { comp: { on: true, threshold: -46, ratio: 12, release: 520, gateOn: true, gateRate: 420 } } });
assert.deepStrictEqual(pumpedAnalysis.labels, dryAnalysis.labels, 'pump arousal does not change core rhythm labels');
assert.strictEqual(pumpedAnalysis.pumpArousal.value, '420ms EXHALE', 'analyzeRhythm includes pump arousal cue');

console.log('Issue 001 rhythm pump arousal checks passed.');
