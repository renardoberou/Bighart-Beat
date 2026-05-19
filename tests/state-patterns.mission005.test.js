#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { createDefaultGrid } = require(path.join(root, 'src', 'state', 'patterns.js'));
const {
  createEmptyGrid,
  clonePatternGrid,
  toggleStep,
  clearPattern,
} = require(path.join(root, 'src', 'state', 'pattern-operations.js'));

const trackIds = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether', 'synth'];

const empty = createEmptyGrid();
assert.deepStrictEqual(Object.keys(empty), trackIds, 'createEmptyGrid preserves canonical track order');
for (const id of trackIds) {
  assert.deepStrictEqual(empty[id], Array(16).fill(0), `${id} starts with sixteen empty steps`);
}
empty.kick[0] = 1;
assert.strictEqual(createEmptyGrid().kick[0], 0, 'createEmptyGrid returns fresh nested arrays');

const original = createDefaultGrid();
const clone = clonePatternGrid(original);
assert.deepStrictEqual(clone, original, 'clonePatternGrid preserves step values');
assert.notStrictEqual(clone, original, 'clonePatternGrid returns a new grid object');
assert.notStrictEqual(clone.kick, original.kick, 'clonePatternGrid clones nested step arrays');
clone.kick[0] = 0;
assert.strictEqual(original.kick[0], 1, 'clonePatternGrid does not mutate source grid');

const toggledOff = toggleStep(original, 'kick', 0);
assert.strictEqual(toggledOff.kick[0], 0, 'toggleStep flips 1 to 0');
assert.strictEqual(original.kick[0], 1, 'toggleStep leaves input grid unchanged');
assert.notStrictEqual(toggledOff, original, 'toggleStep returns a new grid object');
assert.notStrictEqual(toggledOff.kick, original.kick, 'toggleStep clones changed track steps');
assert.notStrictEqual(toggledOff.snare, original.snare, 'toggleStep returns fully independent nested arrays');

const toggledOn = toggleStep(original, 'snare', 1);
assert.strictEqual(toggledOn.snare[1], 1, 'toggleStep flips 0 to 1');
assert.throws(() => toggleStep(original, 'rim', 0), /unknown track/i, 'toggleStep rejects unknown tracks');
assert.throws(() => toggleStep(original, 'kick', 16), /step/i, 'toggleStep rejects out-of-range steps');
assert.throws(() => toggleStep(original, 'kick', -1), /step/i, 'toggleStep rejects negative steps');
assert.throws(() => toggleStep(original, 'kick', 1.5), /step/i, 'toggleStep rejects non-integer steps');
assert.throws(() => toggleStep(original, 'kick', '1'), /step/i, 'toggleStep rejects string steps');
assert.throws(() => toggleStep(original, 'kick', NaN), /step/i, 'toggleStep rejects NaN steps');

const partialGrid = { kick: [1, 0, 1], snare: [1] };
const normalizedPartial = clonePatternGrid(partialGrid);
assert.deepStrictEqual(normalizedPartial.kick, [1, 0, 1, ...Array(13).fill(0)], 'clonePatternGrid pads short track arrays');
assert.deepStrictEqual(normalizedPartial.snare, [1, ...Array(15).fill(0)], 'clonePatternGrid pads partial grid tracks');
assert.deepStrictEqual(normalizedPartial.hihat, Array(16).fill(0), 'clonePatternGrid fills missing canonical tracks');
assert.deepStrictEqual(normalizedPartial.synth, Array(16).fill(0), 'clonePatternGrid fills missing synth track');

const longGrid = createEmptyGrid();
longGrid.kick = Array(20).fill(1);
const normalizedLong = clonePatternGrid(longGrid);
assert.strictEqual(normalizedLong.kick.length, 16, 'clonePatternGrid truncates long track arrays');
assert.deepStrictEqual(normalizedLong.kick, Array(16).fill(1), 'clonePatternGrid preserves first sixteen long-grid steps');

const banks = [createEmptyGrid(), createEmptyGrid(), createEmptyGrid(), createEmptyGrid()];
banks[1].kick[0] = 1;
banks[1] = toggleStep(banks[1], 'kick', 0);
assert.strictEqual(banks[1].kick[0], 0, 'toggleStep updates selected bank result');
assert.strictEqual(banks[0].kick[0], 0, 'toggleStep selected bank leaves bank A unchanged');
assert.strictEqual(banks[2].kick[0], 0, 'toggleStep selected bank leaves bank C unchanged');

const cleared = clearPattern(original);
assert.deepStrictEqual(cleared, createEmptyGrid(), 'clearPattern returns a canonical empty grid');
assert.strictEqual(original.kick[0], 1, 'clearPattern leaves input grid unchanged');
assert.notStrictEqual(cleared.kick, original.kick, 'clearPattern returns independent nested arrays');
banks[2].snare[4] = 1;
banks[2] = clearPattern(banks[2]);
assert.deepStrictEqual(banks[2], createEmptyGrid(), 'clearPattern clears the selected bank result');
assert.strictEqual(banks[1].kick[0], 0, 'clearPattern selected bank leaves bank B unchanged');
assert.strictEqual(banks[3].snare[4], 0, 'clearPattern selected bank leaves bank D unchanged');

console.log('Mission 005 pattern operation checks passed.');
