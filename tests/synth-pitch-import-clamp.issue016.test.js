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
const tracks = createDefaultTracks();
const fx = createDefaultFxState();
const patterns = createPatternBanks();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function synthTrack(project) {
  return project.tracks.find(track => track.id === 'synth');
}

const baseProject = serializeProject({ appState, tracks, fx, patterns });
const legacyBoostedSynthProject = clone(baseProject);
const legacySynth = synthTrack(legacyBoostedSynthProject);
legacySynth.mute = true;
legacySynth.vol = 0.31;
legacySynth.dlyS = false;
legacySynth.revS = true;
legacySynth.wreckS = true;
legacySynth.p = { pitch: 10000, decay: 1.25, tone: 0.75, shape: 0.2 };

const legacyParsed = parseProjectImport(legacyBoostedSynthProject);
assert.strictEqual(legacyParsed.ok, true, 'legacy boosted synth pitch imports still parse');
assert.deepStrictEqual(synthTrack(legacyParsed.value), {
  id: 'synth',
  mute: true,
  vol: 0.31,
  dlyS: false,
  revS: true,
  wreckS: true,
  p: { pitch: 550, decay: 1.25, tone: 0.75, shape: 0.2 },
}, 'legacy boosted synth pitch is narrowly clamped while valid synth fields are preserved');

const validSynthProject = clone(baseProject);
synthTrack(validSynthProject).p.pitch = 124;
synthTrack(validSynthProject).p.decay = 0.9;
synthTrack(validSynthProject).p.tone = 0.6;
synthTrack(validSynthProject).p.shape = 0.4;
const validParsed = parseProjectImport(validSynthProject);
assert.strictEqual(validParsed.ok, true, 'valid synth pitch below the canonical ceiling imports');
assert.strictEqual(synthTrack(validParsed.value).p.pitch, 124, 'valid synth pitch is preserved exactly');
assert.deepStrictEqual(synthTrack(validParsed.value).p, { pitch: 124, decay: 0.9, tone: 0.6, shape: 0.4 }, 'valid synth params are preserved');

console.log('Issue 016 synth pitch import clamp checks passed.');