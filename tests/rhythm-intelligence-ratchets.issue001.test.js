#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { analyzeRhythm } = require(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'));
const { createEmptyGrid } = require(path.join(root, 'src', 'state', 'pattern-operations.js'));
const { createDefaultRatchetGrid } = require(path.join(root, 'src', 'state', 'patterns.js'));

function gridWith(hits) {
  const grid = createEmptyGrid();
  for (const [track, steps] of Object.entries(hits)) {
    for (const step of steps) grid[track][step] = 1;
  }
  return grid;
}

const pattern = gridWith({
  kick: [0, 8],
  snare: [4, 12],
  hihat: [2, 6, 10, 14],
});
const plain = analyzeRhythm({ bpm: 118, pattern, stepsPerBar: 16 });
const oneX = analyzeRhythm({ bpm: 118, pattern, ratchets: createDefaultRatchetGrid(), stepsPerBar: 16 });
assert.deepStrictEqual(
  {
    density: oneX.density,
    surpriseTension: oneX.surpriseTension,
    stepWeight: oneX.stepMetrics[2].weight,
    labels: oneX.labels,
  },
  {
    density: plain.density,
    surpriseTension: plain.surpriseTension,
    stepWeight: plain.stepMetrics[2].weight,
    labels: plain.labels,
  },
  'omitting ratchets is identical to an all-1x ratchet grid'
);

const ratchets = createDefaultRatchetGrid();
ratchets.hihat[2] = 3;
ratchets.hihat[6] = 3;
ratchets.hihat[10] = 3;
ratchets.hihat[14] = 3;
const ratcheted = analyzeRhythm({ bpm: 118, pattern, ratchets, stepsPerBar: 16 });
assert(ratcheted.density > plain.density, 'ratcheted hits increase rhythm density');
assert(ratcheted.surpriseTension > plain.surpriseTension, 'ratcheted offbeat hits increase tension');
assert(ratcheted.stepMetrics[2].weight > plain.stepMetrics[2].weight, 'ratcheted step exposes extra micro-hit weight');
assert(ratcheted.stepMetrics[2].ratchets.hihat === 3, 'step metrics expose active ratchet counts for explanation');
assert(!ratcheted.stepMetrics[0].ratchets, 'plain 1x hits do not clutter step metrics with ratchets');

const extremeRatchets = createDefaultRatchetGrid();
extremeRatchets.kick[0] = 999;
extremeRatchets.snare[4] = 'bad';
const bounded = analyzeRhythm({ bpm: 118, pattern, ratchets: extremeRatchets, stepsPerBar: 16 });
for (const metric of ['density', 'syncopation', 'meterConfidence', 'surpriseTension', 'recoverability', 'movementDrive']) {
  assert(Number.isFinite(bounded[metric]), `${metric} remains finite with bad imported ratchets`);
  assert(bounded[metric] >= 0 && bounded[metric] <= 1, `${metric} remains normalized with bad imported ratchets`);
}

const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
assert(/Rhythm\.analyzeRhythm\(\{[\s\S]*?pattern:\s*PATTERNS\[S\.patt\][\s\S]*?ratchets:\s*RATCHETS\[S\.patt\][\s\S]*?\}\)/.test(js), 'renderRhythmIntelligence passes current ratchet grid into analysis');

console.log('Rhythm intelligence ratchet checks passed.');
