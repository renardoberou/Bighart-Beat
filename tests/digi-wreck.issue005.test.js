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
  curve: 'pixel',
  threshold: -24,
  tone: 0.65,
  mix: 0.35,
  out: 0.85,
  order: 'comp-wreck',
}, 'default fx includes compact DIGI WRECK digital-destruction state');
assert(!Object.keys(fx).includes('geiger'), 'fx state must avoid protected/clone branding');

const appState = createAppState();
const tracks = createDefaultTracks();
const patterns = createPatternBanks();
fx.wreck.on = true;
fx.wreck.bits = 6;
fx.wreck.rate = 0.3;
fx.wreck.curve = 'glass';
fx.wreck.threshold = -18;
fx.wreck.tone = 0.42;
fx.wreck.mix = 0.8;
fx.wreck.out = 0.74;
fx.wreck.order = 'wreck-comp';
const serialized = serializeProject({ appState, tracks, fx, patterns });
assert.deepStrictEqual(serialized.fx.wreck, fx.wreck, 'serializeProject persists DIGI WRECK settings');
const parsed = parseProjectImport(serialized);
assert.strictEqual(parsed.ok, true, 'parseProjectImport accepts valid DIGI WRECK settings');
assert.deepStrictEqual(parsed.value.fx.wreck, fx.wreck, 'parseProjectImport round-trips DIGI WRECK settings');

const legacy = serializeProject({ appState, tracks, fx, patterns });
legacy.fx.wreck.curve = 'fold';
delete legacy.fx.wreck.threshold;
const legacyParsed = parseProjectImport(legacy);
assert.strictEqual(legacyParsed.ok, true, 'parseProjectImport accepts legacy DIGI WRECK saves');
assert.strictEqual(legacyParsed.value.fx.wreck.curve, 'glass', 'legacy fold curve migrates to synth-digital glass mode');
assert.strictEqual(legacyParsed.value.fx.wreck.threshold, -24, 'legacy DIGI WRECK saves hydrate threshold default');

function rejected(mutator, pattern, label) {
  const bad = serializeProject({ appState, tracks, fx, patterns });
  mutator(bad);
  const result = parseProjectImport(bad);
  assert.strictEqual(result.ok, false, label + ' is rejected');
  assert(result.errors.some(e => pattern.test(e)), label + ' reports expected error: ' + result.errors.join('; '));
}

rejected(p => { p.fx.wreck.bits = 3; }, /fx\.wreck\.bits|between/i, 'too-low bit depth');
rejected(p => { p.fx.wreck.rate = 1.1; }, /fx\.wreck\.rate|between/i, 'too-high downsample rate');
rejected(p => { p.fx.wreck.threshold = -81; }, /fx\.wreck\.threshold|between/i, 'too-low threshold');
rejected(p => { p.fx.wreck.threshold = 1; }, /fx\.wreck\.threshold|between/i, 'too-high threshold');
rejected(p => { p.fx.wreck.curve = 'geiger'; }, /fx\.wreck\.curve|pixel|glass|shard/i, 'clone-branded/unknown curve mode');
rejected(p => { p.fx.wreck.order = 'sideways'; }, /fx\.wreck\.order|comp-wreck|wreck-comp/i, 'unknown DIGI WRECK wet-return order');
rejected(p => { p.fx.wreck.extra = 1; }, /fx\.wreck\.extra|unknown/i, 'unknown DIGI WRECK field');

console.log('Issue 005 DIGI WRECK state/persistence checks passed.');
