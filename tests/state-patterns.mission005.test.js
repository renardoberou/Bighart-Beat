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

const trackIds = ['kick', 'snare', 'hihat', 'clap', 'input', 'ether'];

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
assert.throws(() => toggleStep(original, 'kick', 1.5), /step/i, 'toggleStep rejects non-integer steps');

const cleared = clearPattern(original);
assert.deepStrictEqual(cleared, createEmptyGrid(), 'clearPattern returns a canonical empty grid');
assert.strictEqual(original.kick[0], 1, 'clearPattern leaves input grid unchanged');
assert.notStrictEqual(cleared.kick, original.kick, 'clearPattern returns independent nested arrays');

console.log('Mission 005 pattern operation checks passed.');
