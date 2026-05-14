#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { createAppState } = require(path.join(root, 'src', 'state', 'app-state.js'));
const { createDefaultTracks } = require(path.join(root, 'src', 'state', 'tracks.js'));
const { createDefaultFxState } = require(path.join(root, 'src', 'state', 'fx-state.js'));
const { createPatternBanks } = require(path.join(root, 'src', 'state', 'patterns.js'));
const { serializeProject, parseProjectImport } = require(path.join(root, 'src', 'state', 'persistence.js'));

const appState = createAppState();
assert.strictEqual(appState.swing, 0, 'default swing is straight timing');
appState.swing = 0.42;

const project = serializeProject({
  appState,
  tracks: createDefaultTracks(),
  fx: createDefaultFxState(),
  patterns: createPatternBanks(),
});
assert.strictEqual(project.swing, 0.42, 'serializeProject persists swing');

const parsed = parseProjectImport(project);
assert.strictEqual(parsed.ok, true, 'project with swing imports successfully: ' + (parsed.errors || []).join(', '));
assert.strictEqual(parsed.value.swing, 0.42, 'parseProjectImport hydrates swing');

const legacy = { ...project };
delete legacy.swing;
const parsedLegacy = parseProjectImport(legacy);
assert.strictEqual(parsedLegacy.ok, true, 'legacy project without swing imports successfully');
assert.strictEqual(parsedLegacy.value.swing, 0, 'legacy project defaults missing swing to straight timing');

const invalid = parseProjectImport({ ...project, swing: 2 });
assert.strictEqual(invalid.ok, false, 'out-of-range swing is rejected on import');
assert(invalid.errors.some(error => error.includes('swing')), 'invalid swing reports a swing validation error');

console.log('Issue 008 swing persistence checks passed.');
