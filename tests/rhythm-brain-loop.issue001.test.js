#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { analyzeRhythm } = require(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'));
const { createEmptyGrid } = require(path.join(root, 'src', 'state', 'pattern-operations.js'));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

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

function assertBrainLoop(name, pattern, expectedValue, expectedLine) {
  const analysis = analyze(pattern);
  assert(analysis.brainLoop, `${name} exposes a brainLoop readout`);
  assert.deepStrictEqual(Object.keys(analysis.brainLoop), ['value', 'line'], `${name} brainLoop shape is compact and stable`);
  assert.strictEqual(analysis.brainLoop.value, expectedValue, `${name} brainLoop value`);
  assert.strictEqual(analysis.brainLoop.line, expectedLine, `${name} brainLoop line`);
  assert(analysis.brainLoop.value.length <= 16, `${name} value fits compact mobile RI row`);
  assert(analysis.brainLoop.line.length <= 90, `${name} line fits mobile panel`);
  assert(!/\n/.test(analysis.brainLoop.line), `${name} line is one compact sentence`);
  for (const banned of ['prediction error', 'entrainment', 'motor coupling', 'neural', 'cognitive', 'meterConfidence', 'surpriseTension']) {
    assert(!analysis.brainLoop.line.includes(banned), `${name} brainLoop line avoids jargon: ${banned}`);
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

assertBrainLoop('empty pattern', emptyPattern, 'LOST', 'Add an anchor so your body knows where the pulse starts.');
assertBrainLoop('four-on-floor backbeat', fourOnFloorPattern, 'CLEAR', 'Your body can predict this pulse.');
assertBrainLoop('offbeat tense pattern', offbeatTensePattern, 'USEFUL SURPRISE', 'The beat surprises you but still pulls back.');
assertBrainLoop('dense all-steps pattern', denseAllStepsPattern, 'OVERLOADED', 'Too many hits blur the pulse.');

const riPanelStart = html.indexOf('id="riPanel"');
assert(riPanelStart >= 0, 'RI panel exists');
assert(html.indexOf('id="riBrainLoop"') > riPanelStart, 'RI panel exposes BRAIN LOOP value');
assert(/<div class="ve-lbl">BRAIN LOOP<\/div>/.test(html), 'RI panel labels the new neuroscience row compactly');
assert(html.indexOf('id="riBrainLoopLine"') > riPanelStart, 'RI panel exposes a brain-loop sentence');
assert(main.includes("$('riBrainLoop')"), 'render targets the brain-loop value');
assert(main.includes("$('riBrainLoopLine')"), 'render targets the brain-loop sentence');
assert(/\$\('riBrainLoop'\)\.textContent\s*=\s*analysis\.brainLoop\.value/.test(main), 'render writes brain-loop value with textContent');
assert(/\$\('riBrainLoopLine'\)\.textContent\s*=\s*analysis\.brainLoop\.line/.test(main), 'render writes brain-loop line with textContent');

console.log('Issue 001 brain-loop rhythm cognition checks passed.');
