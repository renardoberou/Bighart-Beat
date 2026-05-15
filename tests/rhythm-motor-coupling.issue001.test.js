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

function analyze(pattern, swing = 0) {
  return analyzeRhythm({ bpm: 120, swing, tracks: [], pattern, stepsPerBar: 16 });
}

function assertMotorCue(name, pattern, swing, expectedValue, expectedCue) {
  const analysis = analyze(pattern, swing);
  assert(analysis.motorCoupling, `${name} exposes a motorCoupling readout`);
  assert.deepStrictEqual(Object.keys(analysis.motorCoupling), ['score', 'value', 'cue'], `${name} motorCoupling shape is compact and stable`);
  assert(Number.isFinite(analysis.motorCoupling.score), `${name} motor score is numeric`);
  assert(analysis.motorCoupling.score >= 0 && analysis.motorCoupling.score <= 1, `${name} motor score is normalized`);
  assert.strictEqual(analysis.motorCoupling.value, expectedValue, `${name} motor value`);
  assert.strictEqual(analysis.motorCoupling.cue, expectedCue, `${name} motor cue`);
  assert(analysis.motorCoupling.value.length <= 16, `${name} value fits compact mobile RI row`);
  assert(analysis.motorCoupling.cue.length <= 96, `${name} cue fits mobile panel`);
  assert(!/\n/.test(analysis.motorCoupling.cue), `${name} cue is one compact sentence`);
  for (const banned of ['prediction error', 'entrainment', 'motor coupling', 'neural', 'cognitive', 'meterConfidence', 'surpriseTension']) {
    assert(!analysis.motorCoupling.cue.includes(banned), `${name} motor cue avoids jargon: ${banned}`);
  }
}

const emptyPattern = createEmptyGrid();
const anchoredPattern = gridWith({
  kick: [0, 4, 8, 12],
  snare: [4, 12],
  hihat: [0, 2, 4, 6, 8, 10, 12, 14],
});
const offbeatPattern = gridWith({
  kick: [0, 7, 8, 15],
  snare: [4, 12],
  hihat: [1, 3, 5, 7, 9, 11, 13, 15],
});
const denseAllStepsPattern = gridWith({
  kick: Array.from({ length: 16 }, (_, i) => i),
  snare: Array.from({ length: 16 }, (_, i) => i),
  hihat: Array.from({ length: 16 }, (_, i) => i),
  clap: Array.from({ length: 16 }, (_, i) => i),
  input: Array.from({ length: 16 }, (_, i) => i),
  ether: Array.from({ length: 16 }, (_, i) => i),
});

assertMotorCue('empty pattern', emptyPattern, 0, 'STILL', 'Add a clear pulse so the body has somewhere to land.');
assertMotorCue('straight anchored pattern', anchoredPattern, 0, 'EVEN', 'Even grid: stable pulse, little body sway.');
assertMotorCue('light swing anchored pattern', anchoredPattern, 0.25, 'LIGHT PUSH', 'A small offbeat delay adds a subtle head-nod cue.');
assertMotorCue('deep swing anchored pattern', anchoredPattern, 0.75, 'TRIPLET POCKET', 'Deep swing: strong lilt. Keep anchors clear so the pulse stays readable.');
assertMotorCue('offbeat body pocket', offbeatPattern, 0.5, 'BODY POCKET', 'Late offbeats give the body a place to lean into the groove.');
assertMotorCue('dense all-steps pattern', denseAllStepsPattern, 0.5, 'JAMMED', 'Too many hits blur the pulse; clear space before adding swing.');

const straight = analyze(anchoredPattern, 0).motorCoupling;
const swung = analyze(anchoredPattern, 0.75).motorCoupling;
assert.notStrictEqual(straight.value, swung.value, 'swing amount changes the motor-coupling state');
assert.notStrictEqual(straight.cue, swung.cue, 'swing amount changes the motor-coupling cue');
assert(swung.score > straight.score, 'deep swing raises body pocket score on an anchored beat');

const riPanelStart = html.indexOf('id="riPanel"');
assert(riPanelStart >= 0, 'RI panel exists');
assert(html.indexOf('id="riMotor"') > riPanelStart, 'RI panel exposes MOTOR value');
assert(/<div class="ve-lbl">MOTOR<\/div>/.test(html), 'RI panel labels the motor row compactly');
assert(html.indexOf('id="riMotorLine"') > riPanelStart, 'RI panel exposes a motor-coupling cue sentence');
assert(/\$\('riMotor'\)\.textContent\s*=\s*analysis\.motorCoupling\.value/.test(main), 'render writes motor value with textContent');
assert(/\$\('riMotorLine'\)\.textContent\s*=\s*analysis\.motorCoupling\.cue/.test(main), 'render writes motor cue with textContent');
assert(/swing:\s*S\.swing/.test(main), 'Rhythm Intelligence receives current swing');

console.log('Issue 001 motor-coupling rhythm cognition checks passed.');
