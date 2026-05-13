#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { analyzeRhythm } = require(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'));
const { createEmptyGrid } = require(path.join(root, 'src', 'state', 'pattern-operations.js'));
const { createDefaultHihatOpennessGrid } = require(path.join(root, 'src', 'state', 'patterns.js'));

function gridWith(hits) {
  const grid = createEmptyGrid();
  for (const [track, steps] of Object.entries(hits)) {
    for (const step of steps) grid[track][step] = 1;
  }
  return grid;
}

const pattern = gridWith({
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hihat: [2, 6, 10, 14],
});

const closedHats = createDefaultHihatOpennessGrid();
const openHats = createDefaultHihatOpennessGrid();
[2, 6, 10, 14].forEach(step => { openHats[step] = 1; });

const closed = analyzeRhythm({ pattern, hihatOpenness: closedHats, stepsPerBar: 16 });
const open = analyzeRhythm({ pattern, hihatOpenness: openHats, stepsPerBar: 16 });

assert(
  open.density > closed.density,
  'open hihat placements increase analyzed density/energy versus closed hats'
);
assert(
  open.surpriseTension > closed.surpriseTension,
  'open offbeat hihat placements increase rhythm tension versus closed hats'
);
assert.strictEqual(
  open.stepMetrics[2].hihatOpen,
  1,
  'step metrics expose open hihat placement for explanation/debugging'
);

const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
assert(
  /Rhythm\.analyzeRhythm\(\{[\s\S]*?hihatOpenness:\s*HHT_OPENNESS\[S\.patt\]/.test(main),
  'renderRhythmIntelligence passes current hihat openness grid into analysis'
);

console.log('Issue 003 rhythm intelligence hihat openness checks passed.');
