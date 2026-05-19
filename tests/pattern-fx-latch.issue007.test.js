#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const {
  createDefaultFxState,
  createPatternFxScenes,
  capturePatternFxScene,
  clonePatternFxScene,
  applyPatternFxScene,
} = require(path.join(root, 'src', 'state', 'fx-state.js'));
const { createDefaultTracks } = require(path.join(root, 'src', 'state', 'tracks.js'));
const { createAppState } = require(path.join(root, 'src', 'state', 'app-state.js'));
const { createPatternBanks } = require(path.join(root, 'src', 'state', 'patterns.js'));
const { serializeProject, parseProjectImport } = require(path.join(root, 'src', 'state', 'persistence.js'));

const scenes = createPatternFxScenes();
assert.deepStrictEqual(scenes, [null, null, null, null], 'pattern FX scenes default to empty per-bank memory');

const appState = createAppState();
appState.engine = '909';
appState.mstVol = 0.61;
const tracks = createDefaultTracks();
tracks[0].mute = true;
tracks[1].vol = 0.42;
tracks[2].dlyS = true;
tracks[2].wreckS = true;
tracks[3].revS = true;
tracks[4].wreckS = true;
const fx = createDefaultFxState();
fx.dly.on = true;
fx.dly.fb = 0.67;
fx.rev.on = true;
fx.rev.gate = 240;
fx.comp.on = true;
fx.comp.detector = 'peak';
fx.wreck.on = true;
fx.wreck.curve = 'shard';

const scene = capturePatternFxScene({ appState, tracks, fx });
assert.strictEqual(scene.fx.dly.on, true, 'captured scene stores delay enabled state');
assert.strictEqual(scene.fx.dly.fb, 0.67, 'captured scene stores delay feedback');
assert.strictEqual(scene.fx.wreck.curve, 'shard', 'captured scene stores digi-wreck mode');
assert.deepStrictEqual(scene.mix[2], { id: 'hihat', mute: false, vol: tracks[2].vol, dlyS: true, revS: false, wreckS: true }, 'captured scene stores per-track mix/sends');
assert.strictEqual(scene.engine, '909', 'captured scene stores selected engine');
assert.strictEqual(scene.mstVol, 0.61, 'captured scene stores master level');

fx.dly.fb = 0.1;
tracks[2].dlyS = false;
appState.engine = 'aphex';
assert.strictEqual(scene.fx.dly.fb, 0.67, 'captured scene is independent from later FX mutations');
assert.strictEqual(scene.mix[2].dlyS, true, 'captured scene is independent from later mix mutations');
assert.strictEqual(scene.mix[2].wreckS, true, 'captured scene is independent from later Wreck-send mutations');
assert.strictEqual(scene.engine, '909', 'captured scene is independent from later engine mutations');

const targetAppState = createAppState();
const targetTracks = createDefaultTracks();
const targetFx = createDefaultFxState();
assert.strictEqual(applyPatternFxScene(scene, { appState: targetAppState, tracks: targetTracks, fx: targetFx }), true, 'latched scene applies successfully');
assert.strictEqual(targetFx.dly.on, true, 'applied scene restores delay toggle');
assert.strictEqual(targetFx.dly.fb, 0.67, 'applied scene restores delay feedback');
assert.strictEqual(targetFx.wreck.curve, 'shard', 'applied scene restores digi-wreck mode');
assert.strictEqual(targetTracks[2].dlyS, true, 'applied scene restores track delay send');
assert.strictEqual(targetTracks[2].wreckS, true, 'applied scene restores track Digi Wreck send');
assert.strictEqual(targetTracks[3].revS, true, 'applied scene restores track reverb send');
assert.strictEqual(targetTracks[0].mute, true, 'applied scene restores mix mute');
assert.strictEqual(targetAppState.engine, '909', 'applied scene restores engine');
assert.strictEqual(targetAppState.mstVol, 0.61, 'applied scene restores master level');

const cloned = clonePatternFxScene(scene);
cloned.fx.dly.fb = 0.2;
assert.strictEqual(scene.fx.dly.fb, 0.67, 'clonePatternFxScene returns an isolated copy');

scenes[1] = scene;
const patterns = createPatternBanks();
const serialized = serializeProject({ appState: targetAppState, tracks: targetTracks, fx: targetFx, patterns, patternFxScenes: scenes });
assert.strictEqual(serialized.patternFxScenes[1].fx.dly.fb, 0.67, 'serializeProject persists latched pattern FX scene');
assert.strictEqual(serialized.patternFxScenes[0], null, 'serializeProject preserves unlatched pattern as null');
serialized.patternFxScenes[1].fx.dly.fb = 0.3;
assert.strictEqual(scenes[1].fx.dly.fb, 0.67, 'serializeProject clones pattern FX scenes');

const parsed = parseProjectImport(serializeProject({ appState: targetAppState, tracks: targetTracks, fx: targetFx, patterns, patternFxScenes: scenes }));
assert.strictEqual(parsed.ok, true, 'parseProjectImport accepts valid latched pattern FX scenes');
assert.strictEqual(parsed.value.patternFxScenes[1].fx.dly.fb, 0.67, 'parseProjectImport round-trips latched scene FX');
assert.strictEqual(parsed.value.patternFxScenes[1].mix[2].dlyS, true, 'parseProjectImport round-trips latched scene mix');
assert.strictEqual(parsed.value.patternFxScenes[1].mix[2].wreckS, true, 'parseProjectImport round-trips latched scene DIGI WRECK send');

const legacyParsed = parseProjectImport(serializeProject({ appState: targetAppState, tracks: targetTracks, fx: targetFx, patterns }));
assert.strictEqual(legacyParsed.ok, true, 'legacy projects without patternFxScenes still import');
assert.deepStrictEqual(legacyParsed.value.patternFxScenes, [null, null, null, null], 'legacy imports hydrate empty pattern FX scenes');

const badScene = serializeProject({ appState: targetAppState, tracks: targetTracks, fx: targetFx, patterns, patternFxScenes: scenes });
badScene.patternFxScenes[1].fx.dly.fb = 2;
const badResult = parseProjectImport(badScene);
assert.strictEqual(badResult.ok, false, 'out-of-range latched FX scene is rejected');
assert(badResult.errors.some(error => /patternFxScenes\[1\]\.fx\.dly\.fb|range|between/i.test(error)), 'rejection points at latched FX scene field');

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
assert(index.includes('id="latchFxBtn"'), 'UI exposes LATCH FX button');
assert(index.includes('LATCH FX'), 'UI button is labeled LATCH FX');
assert(js.includes('restorePatternFxScene(S.patt)'), 'pattern select restores latched scene');
assert(js.includes('State.capturePatternFxScene'), 'runtime latches current FX scene through state helper');
assert(/function\s+syncLatchFxButton\s*\([^)]*\)\s*\{[\s\S]*const hasAnyPatternLatch\s*=\s*PATTERN_FX_SCENES\.some\(Boolean\)[\s\S]*UNLATCH FX/.test(js), 'runtime shows UNLATCH FX whenever any pattern has a latched scene');
assert(/function\s+clearAllPatternFxScenes\s*\([^)]*\)\s*\{[\s\S]*PATTERN_FX_SCENES\[i\]\s*=\s*null[\s\S]*syncPatternButtons\(\)[\s\S]*autosave\(\)[\s\S]*toast/.test(js), 'unlatch clears every pattern FX scene and persists the shared state');
assert(/function\s+latchCurrentPatternFxScene\s*\([^)]*\)\s*\{[\s\S]*if \(PATTERN_FX_SCENES\.some\(Boolean\)\)[\s\S]*clearAllPatternFxScenes\(\)/.test(js), 'clicking the latch button resets all pattern latches whenever any latch exists');
assert(css.includes('.patt-b.latched'), 'latched patterns get a visible UI marker');
