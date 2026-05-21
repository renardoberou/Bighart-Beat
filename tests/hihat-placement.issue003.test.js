#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const patternsModule = require(path.join(root, 'src', 'state', 'patterns.js'));
const ops = require(path.join(root, 'src', 'state', 'pattern-operations.js'));
const { createAppState } = require(path.join(root, 'src', 'state', 'app-state.js'));
const { createDefaultTracks } = require(path.join(root, 'src', 'state', 'tracks.js'));
const { createDefaultFxState } = require(path.join(root, 'src', 'state', 'fx-state.js'));
const { serializeProject, parseProjectImport } = require(path.join(root, 'src', 'state', 'persistence.js'));

const {
  createHihatOpennessBanks,
  createDefaultHihatOpennessGrid,
  cloneHihatOpennessGrid,
} = patternsModule;
const {
  getHihatOpenness,
  setHihatOpenness,
  clearHihatOpenness,
} = ops;

assert.strictEqual(typeof createDefaultHihatOpennessGrid, 'function', 'default hihat openness grid factory exported');
assert.strictEqual(typeof createHihatOpennessBanks, 'function', 'hihat openness bank factory exported');
assert.strictEqual(typeof cloneHihatOpennessGrid, 'function', 'hihat openness clone exported');
assert.deepStrictEqual(createDefaultHihatOpennessGrid(), Array(16).fill(0), 'defaults closed/0 for every HHT step');
const banks = createHihatOpennessBanks();
assert.strictEqual(banks.length, 4, 'one hihat openness bank per pattern');
banks[0][2] = 1;
assert.strictEqual(banks[1][2], 0, 'openness banks are independent and do not disturb pattern banks');
const cloned = cloneHihatOpennessGrid([0, .45, 1, .7, 'open']);
assert.deepStrictEqual(cloned.slice(0, 5), [0, .45, 1, 0, 0], 'clone keeps only exact allowed playback values');

let openGrid = createDefaultHihatOpennessGrid();
assert.strictEqual(getHihatOpenness(openGrid, 0), 0);
openGrid = setHihatOpenness(openGrid, 3, .45);
assert.strictEqual(getHihatOpenness(openGrid, 3), .45, 'tight openness stored exactly as playback value');
openGrid = setHihatOpenness(openGrid, 7, 1);
assert.strictEqual(getHihatOpenness(openGrid, 7), 1, 'open openness stored exactly as playback value');
assert.deepStrictEqual(clearHihatOpenness(openGrid), createDefaultHihatOpennessGrid(), 'clear resets hihat openness to closed');
[.44, .5, 2, -1, '1', NaN].forEach(bad => assert.throws(() => setHihatOpenness(openGrid, 0, bad), /openness|0.*0\.45.*1/i));
assert.throws(() => setHihatOpenness(openGrid, 16, 0), /step/i);

const appState = createAppState();
const tracks = createDefaultTracks();
const fx = createDefaultFxState();
const patterns = patternsModule.createPatternBanks();
const hihatOpenness = createHihatOpennessBanks();
hihatOpenness[2][5] = .45;
hihatOpenness[2][9] = 1;
const serialized = serializeProject({ appState, tracks, fx, patterns, hihatOpenness });
assert.deepStrictEqual(serialized.hihatOpenness, hihatOpenness, 'serialize includes hihatOpenness when supplied');
serialized.hihatOpenness[2][5] = 0;
assert.strictEqual(hihatOpenness[2][5], .45, 'serialize clones hihatOpenness');
const roundTrip = parseProjectImport(serializeProject({ appState, tracks, fx, patterns, hihatOpenness }));
assert.strictEqual(roundTrip.ok, true);
assert.strictEqual(roundTrip.value.hihatOpenness[2][5], .45, 'import round-trips tight');
assert.strictEqual(roundTrip.value.hihatOpenness[2][9], 1, 'import round-trips open');
const legacy = serializeProject({ appState, tracks, fx, patterns });
assert.strictEqual(Object.prototype.hasOwnProperty.call(legacy, 'hihatOpenness'), false, 'legacy export shape is undisturbed without hihat openness input');
const legacyParsed = parseProjectImport(legacy);
assert.strictEqual(legacyParsed.ok, true);
assert.deepStrictEqual(legacyParsed.value.hihatOpenness, createHihatOpennessBanks(), 'legacy imports hydrate closed hihat openness defaults');
function reject(mutator, label) {
  const p = serializeProject({ appState, tracks, fx, patterns, hihatOpenness });
  mutator(p);
  const result = parseProjectImport(p);
  assert.strictEqual(result.ok, false, label);
  assert(result.errors.some(e => /hihatOpenness|dangerous key/i.test(e)), result.errors.join('; '));
}
reject(p => { p.hihatOpenness = p.hihatOpenness.slice(0, 3); }, 'short hihat openness banks');
reject(p => { p.hihatOpenness[0] = p.hihatOpenness[0].slice(0, 15); }, 'short hihat openness steps');
[.44, .5, 2, -1, '1'].forEach(bad => reject(p => { p.hihatOpenness[0][0] = bad; }, `bad openness ${bad}`));

const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
assert(/const\s+HHT_OPENNESS\s*=\s*State\.createHihatOpennessBanks\(\)/.test(main), 'main initializes per-pattern HHT openness bank');
assert(/HHT_PLACE/.test(main) && /PLACE CLOSED/.test(main) && /PLACE TIGHT/.test(main) && /PLACE OPEN/.test(main), 'voice panel exposes HHT placement mode');
assert(/setHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i,\s*HHT_PLACE\)/.test(main), 'turning HHT step on stores selected placement openness');
assert(/clearHihatOpenness\(HHT_OPENNESS\[S\.patt\],\s*i\)/.test(main), 'turning HHT step off clears/ignores openness');
assert(/dataset\.hat/.test(main) && /hht-tight/.test(main) && /hht-open/.test(main), 'active HHT cells render visible tight/open markers');
assert(/synthHihat\(t,\s*getStepHihatVelocity\(firingStep\),\s*\{\s*\.\.\.tr\.p,\s*open:\s*getStepHihatOpen\(firingStep\)/.test(main), 'playback passes per-step openness into synthHihat');
assert(/hihatOpenness:\s*HHT_OPENNESS/.test(main), 'autosave/export includes hihatOpenness');
assert(/State\.cloneHihatOpennessGrid\(d\.hihatOpenness\[i\]\)/.test(main), 'import applies hihatOpenness banks');
assert(/\.sc\.hht-tight/.test(css) && /\.sc\.hht-open/.test(css), 'CSS renders tight/open markers for mobile visibility');

console.log('Issue 003 hihat placement checks passed.');
