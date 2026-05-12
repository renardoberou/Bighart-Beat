#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { createDefaultFxState } = require(path.join(root, 'src', 'state', 'fx-state.js'));
const { createAppState } = require(path.join(root, 'src', 'state', 'app-state.js'));
const { createDefaultTracks } = require(path.join(root, 'src', 'state', 'tracks.js'));
const { createPatternBanks } = require(path.join(root, 'src', 'state', 'patterns.js'));
const { serializeProject, parseProjectImport } = require(path.join(root, 'src', 'state', 'persistence.js'));

const fx = createDefaultFxState();
assert.deepStrictEqual(fx.wreck, {
  on: false,
  bits: 12,
  rate: 0.75,
  curve: 'clip',
  tone: 0.65,
  mix: 0.35,
  out: 0.9,
}, 'default fx includes compact DIGI WRECK digital-destruction state');
assert(!Object.keys(fx).includes('geiger'), 'fx state must avoid protected/clone branding');

const appState = createAppState();
const tracks = createDefaultTracks();
const patterns = createPatternBanks();
fx.wreck.on = true;
fx.wreck.bits = 6;
fx.wreck.rate = 0.3;
fx.wreck.curve = 'fold';
fx.wreck.tone = 0.42;
fx.wreck.mix = 0.8;
fx.wreck.out = 0.74;
const serialized = serializeProject({ appState, tracks, fx, patterns });
assert.deepStrictEqual(serialized.fx.wreck, fx.wreck, 'serializeProject persists DIGI WRECK settings');
const parsed = parseProjectImport(serialized);
assert.strictEqual(parsed.ok, true, 'parseProjectImport accepts valid DIGI WRECK settings');
assert.deepStrictEqual(parsed.value.fx.wreck, fx.wreck, 'parseProjectImport round-trips DIGI WRECK settings');

function rejected(mutator, pattern, label) {
  const bad = serializeProject({ appState, tracks, fx, patterns });
  mutator(bad);
  const result = parseProjectImport(bad);
  assert.strictEqual(result.ok, false, label + ' is rejected');
  assert(result.errors.some(e => pattern.test(e)), label + ' reports expected error: ' + result.errors.join('; '));
}

rejected(p => { p.fx.wreck.bits = 3; }, /fx\.wreck\.bits|between/i, 'too-low bit depth');
rejected(p => { p.fx.wreck.rate = 1.1; }, /fx\.wreck\.rate|between/i, 'too-high downsample rate');
rejected(p => { p.fx.wreck.curve = 'geiger'; }, /fx\.wreck\.curve|clip|fold|crush/i, 'clone-branded/unknown curve mode');
rejected(p => { p.fx.wreck.extra = 1; }, /fx\.wreck\.extra|unknown/i, 'unknown DIGI WRECK field');

console.log('Issue 005 DIGI WRECK state/persistence checks passed.');
