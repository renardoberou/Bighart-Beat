#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { createAppState } = require(path.join(root, 'src', 'state', 'app-state.js'));
const { createDefaultTracks } = require(path.join(root, 'src', 'state', 'tracks.js'));
const { createDefaultFxState } = require(path.join(root, 'src', 'state', 'fx-state.js'));
const { createPatternBanks } = require(path.join(root, 'src', 'state', 'patterns.js'));
const {
  SCHEMA_VERSION,
  serializeProject,
  parseProjectImport,
  validateProjectData,
} = require(path.join(root, 'src', 'state', 'persistence.js'));

assert.strictEqual(SCHEMA_VERSION, 1, 'schema version is explicit and stable');

const appState = createAppState();
appState.bpm = 132;
appState.patt = 2;
appState.mstVol = 0.64;
const tracks = createDefaultTracks();
tracks[0].mute = true;
tracks[0].p.pitch = 123;
const fx = createDefaultFxState();
fx.dly.on = true;
const patterns = createPatternBanks();
patterns[2].ether[15] = 1;

const serialized = serializeProject({ appState, tracks, fx, patterns });
assert.deepStrictEqual(Object.keys(serialized), ['schemaVersion', 'bpm', 'patt', 'mstVol', 'patterns', 'tracks', 'fx', 'meta'], 'serializeProject uses deterministic v4-compatible top-level shape');
assert.strictEqual(serialized.schemaVersion, 1);
assert.deepStrictEqual(serialized.meta, { app: 'bighart-beat-v4' }, 'serializeProject omits volatile timestamps unless provided');
assert.strictEqual(serialized.bpm, 132);
assert.strictEqual(serialized.patt, 2);
assert.strictEqual(serialized.mstVol, 0.64);
assert.strictEqual(serialized.tracks[0].mute, true);
assert.strictEqual(serialized.tracks[0].p.pitch, 123);
assert.strictEqual(serialized.patterns[2].ether[15], 1);
assert.strictEqual(serialized.tracks[0].n, undefined, 'serialized tracks include only runtime save/import fields');
assert.strictEqual(serialized.tracks[4].smp, undefined, 'serialized tracks omit sample buffers');

serialized.patterns[0].kick[0] = 0;
serialized.tracks[0].p.pitch = 999;
serialized.fx.dly.on = false;
assert.strictEqual(patterns[0].kick[0], 1, 'serializeProject clones patterns');
assert.strictEqual(tracks[0].p.pitch, 123, 'serializeProject clones track params');
assert.strictEqual(fx.dly.on, true, 'serializeProject clones fx');

assert.deepStrictEqual(validateProjectData(serializeProject({ appState, tracks, fx, patterns })), { ok: true, errors: [] }, 'valid serialized project validates');

const parsedFromObject = parseProjectImport(serializeProject({ appState, tracks, fx, patterns }));
assert.strictEqual(parsedFromObject.ok, true, 'parseProjectImport accepts valid objects');
assert.strictEqual(parsedFromObject.value.patterns[2].ether[15], 1);
parsedFromObject.value.patterns[2].ether[15] = 0;
assert.strictEqual(patterns[2].ether[15], 1, 'parseProjectImport returns cloned data');

const parsedFromString = parseProjectImport(JSON.stringify(serializeProject({ appState, tracks, fx, patterns })));
assert.strictEqual(parsedFromString.ok, true, 'parseProjectImport accepts JSON strings');

const legacyShape = {
  bpm: 118,
  mstVol: 0.5,
  patterns,
  tracks: tracks.map(t => ({ id: t.id, mute: t.mute, vol: t.vol, dlyS: t.dlyS, revS: t.revS, p: t.p })),
  fx,
};
assert.strictEqual(parseProjectImport(legacyShape).ok, true, 'parseProjectImport accepts current v4 export shape without schemaVersion');

function assertDangerousProjectJsonRejected(json, label) {
  const beforePolluted = {}.polluted;
  const result = parseProjectImport(json);
  assert.strictEqual(result.ok, false, label + ' is rejected');
  assert(result.errors.some(e => /dangerous key/i.test(e)), label + ' reports a dangerous key');
  assert.strictEqual({}.polluted, beforePolluted, label + ' does not pollute Object.prototype');
}

assertDangerousProjectJsonRejected(
  JSON.stringify(serialized).replace('{', '{"__proto__":{"polluted":true},'),
  'top-level __proto__ import key',
);
assertDangerousProjectJsonRejected(
  JSON.stringify({ ...serialized, tracks: [{ ...serialized.tracks[0], p: JSON.parse('{"constructor":{"polluted":true}}') }] }),
  'nested tracks[].p constructor import key',
);
assertDangerousProjectJsonRejected(
  JSON.stringify({ ...serialized, fx: { ...serialized.fx, dly: JSON.parse('{"prototype":{"polluted":true}}') } }),
  'nested fx.dly prototype import key',
);
assertDangerousProjectJsonRejected(
  JSON.stringify({ ...serialized, fx: { ...serialized.fx, rev: JSON.parse('{"__proto__":{"polluted":true}}') } }),
  'nested fx.rev __proto__ import key',
);
assertDangerousProjectJsonRejected(
  JSON.stringify({ ...serialized, meta: JSON.parse('{"__proto__":{"polluted":true},"app":"bighart-beat-v4"}') }),
  'nested meta __proto__ import key',
);

const serializedWithTs = serializeProject({ appState, tracks, fx, patterns, timestamp: '2026-05-11T13:37:00.000Z' });
assert.deepStrictEqual(serializedWithTs.meta, { app: 'bighart-beat-v4', ts: '2026-05-11T13:37:00.000Z' }, 'serializeProject can document runtime export metadata timestamp compatibility');

const invalid = serializeProject({ appState, tracks, fx, patterns });
invalid.patterns[0].kick = invalid.patterns[0].kick.slice(0, 15);
invalid.patterns[1].snare[0] = 2;
invalid.tracks[0].id = 'rim';
invalid.bpm = 'fast';
const validation = validateProjectData(invalid);
assert.strictEqual(validation.ok, false, 'invalid project data fails validation');
assert(validation.errors.some(e => /bpm/i.test(e)), 'validation reports invalid bpm');
assert(validation.errors.some(e => /kick/i.test(e) && /16/i.test(e)), 'validation reports invalid step count');
assert(validation.errors.some(e => /snare/i.test(e) && /0\/1/i.test(e)), 'validation reports invalid step values');
assert(validation.errors.some(e => /track id/i.test(e)), 'validation reports invalid track id');

const badJson = parseProjectImport('{not json');
assert.strictEqual(badJson.ok, false, 'parseProjectImport reports invalid JSON');
assert(badJson.errors.some(e => /json/i.test(e)));

console.log('Mission 005 persistence checks passed.');
