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
appState.engine = '909';
appState.mstVol = 0.64;
const tracks = createDefaultTracks();
tracks[0].mute = true;
tracks[0].p.pitch = 123;
const fx = createDefaultFxState();
fx.dly.on = true;
assert.deepStrictEqual(fx.comp, {
  on: false,
  threshold: -24,
  ratio: 4,
  attack: 8,
  release: 280,
  detector: 'rms',
  gateOn: false,
  gateThreshold: -60,
  gateRate: 120,
  gateAnalog: 0.35,
}, 'default fx includes Alesis 3630-inspired compressor/gate state with auto makeup only');
assert.strictEqual(Object.prototype.hasOwnProperty.call(fx.comp, 'makeup'), false, 'compressor state does not expose manual makeup gain');
assert.strictEqual(Object.prototype.hasOwnProperty.call(fx.comp, 'output'), false, 'compressor state does not expose manual output gain');
const patterns = createPatternBanks();
patterns[2].ether[15] = 1;

const serialized = serializeProject({ appState, tracks, fx, patterns });
assert.deepStrictEqual(Object.keys(serialized), ['schemaVersion', 'bpm', 'patt', 'engine', 'mstVol', 'patterns', 'tracks', 'fx', 'meta'], 'serializeProject uses deterministic v4-compatible top-level shape');
assert.strictEqual(serialized.schemaVersion, 1);
assert.deepStrictEqual(serialized.meta, { app: 'bighart-beat-v4' }, 'serializeProject omits volatile timestamps unless provided');
assert.strictEqual(serialized.bpm, 132);
assert.strictEqual(serialized.patt, 2);
assert.strictEqual(serialized.engine, '909', 'serializeProject persists selected drum-machine engine');
assert.strictEqual(serialized.mstVol, 0.64);
assert.strictEqual(serialized.tracks[0].mute, true);
assert.strictEqual(serialized.tracks[0].p.pitch, 123);
assert.strictEqual(serialized.patterns[2].ether[15], 1);
assert.strictEqual(serialized.tracks[0].n, undefined, 'serialized tracks include only runtime save/import fields');
assert.strictEqual(serialized.tracks[4].smp, undefined, 'serialized tracks omit sample buffers');

const serializedCloneProbe = serializeProject({ appState, tracks, fx, patterns });
serializedCloneProbe.patterns[0].kick[0] = 0;
serializedCloneProbe.tracks[0].p.pitch = 999;
serializedCloneProbe.fx.dly.on = false;
assert.strictEqual(patterns[0].kick[0], 1, 'serializeProject clones patterns');
assert.strictEqual(tracks[0].p.pitch, 123, 'serializeProject clones track params');
assert.strictEqual(fx.dly.on, true, 'serializeProject clones fx');

assert.deepStrictEqual(validateProjectData(serializeProject({ appState, tracks, fx, patterns })), { ok: true, errors: [] }, 'valid serialized project validates');

const parsedFromObject = parseProjectImport(serializeProject({ appState, tracks, fx, patterns }));
assert.strictEqual(parsedFromObject.ok, true, 'parseProjectImport accepts valid objects');
assert.strictEqual(parsedFromObject.value.engine, '909', 'parseProjectImport round-trips valid engine values');
assert.strictEqual(parsedFromObject.value.patterns[2].ether[15], 1);
parsedFromObject.value.patterns[2].ether[15] = 0;
assert.strictEqual(patterns[2].ether[15], 1, 'parseProjectImport returns cloned data');

const parsedFromString = parseProjectImport(JSON.stringify(serializeProject({ appState, tracks, fx, patterns })));
assert.strictEqual(parsedFromString.ok, true, 'parseProjectImport accepts JSON strings');

['808', '909', 'reznor', 'aphex'].forEach(engine => {
  const project = serializeProject({ appState: { ...appState, engine }, tracks, fx, patterns });
  const parsed = parseProjectImport(project);
  assert.strictEqual(parsed.ok, true, 'parseProjectImport accepts engine ' + engine);
  assert.strictEqual(parsed.value.engine, engine, 'parseProjectImport hydrates engine ' + engine);
});

const legacyShape = {
  bpm: 118,
  mstVol: 0.5,
  patterns,
  tracks: tracks.map(t => ({ id: t.id, mute: t.mute, vol: t.vol, dlyS: t.dlyS, revS: t.revS, p: t.p })),
  fx,
};
assert.strictEqual(parseProjectImport(legacyShape).ok, true, 'parseProjectImport accepts current v4 export shape without schemaVersion');
assert.strictEqual(parseProjectImport({ ...legacyShape, patt: 1 }).ok, true, 'parseProjectImport accepts legacy shape with patt and without schemaVersion');
assert.strictEqual(parseProjectImport(legacyShape).value.engine, 'aphex', 'legacy imports without engine default to aphex');

function assertImportRejected(project, pattern, label) {
  const result = parseProjectImport(project);
  assert.strictEqual(result.ok, false, label + ' is rejected');
  assert(result.errors.some(e => pattern.test(e)), label + ' reports expected validation error: ' + result.errors.join('; '));
}

assertImportRejected({ ...serialized, bpm: undefined }, /bpm/i, 'missing bpm');
assertImportRejected({ ...serialized, mstVol: undefined }, /mstVol/i, 'missing mstVol');
assertImportRejected({ ...serialized, patterns: undefined }, /patterns/i, 'missing patterns');
assertImportRejected({ ...serialized, tracks: undefined }, /tracks/i, 'missing tracks');
assertImportRejected({ ...serialized, fx: undefined }, /fx/i, 'missing top-level fx');
assertImportRejected({ ...serialized, fx: null }, /fx.*object/i, 'non-object top-level fx');
assertImportRejected({ ...serialized, fx: { dly: serialized.fx.dly } }, /fx\.rev|missing/i, 'missing fx.rev object');
assertImportRejected({ ...serialized, fx: { rev: serialized.fx.rev } }, /fx\.dly|missing/i, 'missing fx.dly object');
assertImportRejected({ ...serialized, fx: { dly: serialized.fx.dly, rev: serialized.fx.rev } }, /fx\.comp|missing/i, 'missing fx.comp object');

assertImportRejected({ ...serialized, tracks: serialized.tracks.slice(0, 5) }, /six|6|exactly/i, 'short tracks array');
assertImportRejected({ ...serialized, tracks: [...serialized.tracks, { ...serialized.tracks[0] }] }, /six|6|exactly/i, 'long tracks array');
assertImportRejected({ ...serialized, tracks: serialized.tracks.map((t, i) => i === 1 ? { ...t, id: 'kick' } : t) }, /duplicate|missing|exactly once/i, 'duplicate track id');
assertImportRejected({ ...serialized, tracks: serialized.tracks.map((t, i) => i === 1 ? { ...t, id: 'rim' } : t) }, /unknown|known|canonical/i, 'unknown track id');

const patternWithExtraTrack = serializeProject({ appState, tracks, fx, patterns });
patternWithExtraTrack.patterns[0].rim = Array(16).fill(0);
assertImportRejected(patternWithExtraTrack, /unknown|extra|track key/i, 'pattern bank with unknown extra track key');

const patternWithMissingTrack = serializeProject({ appState, tracks, fx, patterns });
delete patternWithMissingTrack.patterns[0].ether;
assertImportRejected(patternWithMissingTrack, /ether|missing|16/i, 'pattern bank with missing canonical track');

assertImportRejected({ ...serialized, schemaVersion: 2 }, /schemaVersion/i, 'unsupported schema version');
assertImportRejected({ ...serialized, engine: 'linndrum' }, /engine|808|909|reznor|aphex/i, 'unknown engine');
assertImportRejected({ ...serialized, meta: 'not-meta' }, /meta/i, 'non-object meta');
assertImportRejected({ ...serialized, meta: { app: 'not-bighart' } }, /meta\.app|bighart-beat-v4/i, 'wrong meta app');
assert.strictEqual(parseProjectImport({ ...serialized, extraHarmlessTopLevel: true }).ok, true, 'parseProjectImport remains lenient for harmless top-level extras');

const badFxDelayField = serializeProject({ appState, tracks, fx, patterns });
badFxDelayField.fx.dly.fb = 'bad';
assertImportRejected(badFxDelayField, /fx\.dly\.fb|finite number/i, 'malformed delay feedback field');

const badFxDelayToggle = serializeProject({ appState, tracks, fx, patterns });
badFxDelayToggle.fx.dly.on = 1;
assertImportRejected(badFxDelayToggle, /fx\.dly\.on|boolean/i, 'malformed delay on field');

const badTrackMute = serializeProject({ appState, tracks, fx, patterns });
badTrackMute.tracks[0].mute = 'false';
assertImportRejected(badTrackMute, /tracks\[0\]\.mute|boolean/i, 'malformed track mute field');

const badTrackDelaySend = serializeProject({ appState, tracks, fx, patterns });
badTrackDelaySend.tracks[3].dlyS = 'true';
assertImportRejected(badTrackDelaySend, /tracks\[3\]\.dlyS|boolean/i, 'malformed track delay send field');

const badTrackReverbSend = serializeProject({ appState, tracks, fx, patterns });
badTrackReverbSend.tracks[5].revS = 'true';
assertImportRejected(badTrackReverbSend, /tracks\[5\]\.revS|boolean/i, 'malformed track reverb send field');

const missingTrackBoolean = serializeProject({ appState, tracks, fx, patterns });
delete missingTrackBoolean.tracks[1].mute;
assertImportRejected(missingTrackBoolean, /tracks\[1\]\.mute|boolean/i, 'missing persisted track boolean field');

const badFxReverbField = serializeProject({ appState, tracks, fx, patterns });
badFxReverbField.fx.rev.gate = Infinity;
assertImportRejected(badFxReverbField, /fx\.rev\.gate|finite number/i, 'malformed reverb gate field');

const badFxCompDetector = serializeProject({ appState, tracks, fx, patterns });
badFxCompDetector.fx.comp.detector = 'vca';
assertImportRejected(badFxCompDetector, /fx\.comp\.detector|peak|rms/i, 'malformed compressor detector mode');

const badFxCompToggle = serializeProject({ appState, tracks, fx, patterns });
badFxCompToggle.fx.comp.gateOn = 1;
assertImportRejected(badFxCompToggle, /fx\.comp\.gateOn|boolean/i, 'malformed compressor gate toggle');

const unknownFxField = serializeProject({ appState, tracks, fx, patterns });
unknownFxField.fx.dly.extra = 0.2;
assertImportRejected(unknownFxField, /fx\.dly\.extra|unknown/i, 'unknown delay field');

const partialFx = serializeProject({ appState, tracks, fx, patterns });
partialFx.fx = { dly: { fb: 0.25 }, rev: { on: false }, comp: { on: false } };
assert.strictEqual(parseProjectImport(partialFx).ok, true, 'parseProjectImport allows valid partial fx subfields for legacy saves');

function assertImportRejectedAt(pathLabel, mutate, pattern) {
  const project = serializeProject({ appState, tracks, fx, patterns });
  mutate(project);
  assertImportRejected(project, pattern || new RegExp(pathLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '|range|between', 'i'), 'out-of-range ' + pathLabel);
}

assertImportRejectedAt('bpm', p => { p.bpm = 39; }, /bpm|range|between/i);
assertImportRejectedAt('bpm', p => { p.bpm = 241; }, /bpm|range|between/i);
assertImportRejectedAt('mstVol', p => { p.mstVol = 1.01; }, /mstVol|range|between/i);
assertImportRejectedAt('tracks[0].vol', p => { p.tracks[0].vol = -0.01; }, /tracks\[0\]\.vol|range|between/i);
assertImportRejectedAt('fx.dly.mult', p => { p.fx.dly.mult = 0.125; }, /fx\.dly\.mult|range|between/i);
assertImportRejectedAt('fx.dly.fb', p => { p.fx.dly.fb = 1.01; }, /fx\.dly\.fb|range|between/i);
assertImportRejectedAt('fx.rev.gate', p => { p.fx.rev.gate = 601; }, /fx\.rev\.gate|range|between/i);
assertImportRejectedAt('fx.comp.threshold', p => { p.fx.comp.threshold = -81; }, /fx\.comp\.threshold|range|between/i);
assertImportRejectedAt('fx.comp.ratio', p => { p.fx.comp.ratio = 25; }, /fx\.comp\.ratio|range|between/i);
assertImportRejectedAt('fx.comp.attack', p => { p.fx.comp.attack = 0; }, /fx\.comp\.attack|range|between/i);
assertImportRejectedAt('fx.comp.release', p => { p.fx.comp.release = 2001; }, /fx\.comp\.release|range|between/i);
assertImportRejectedAt('fx.comp.gateThreshold', p => { p.fx.comp.gateThreshold = 1; }, /fx\.comp\.gateThreshold|range|between/i);
assertImportRejectedAt('fx.comp.gateRate', p => { p.fx.comp.gateRate = 2001; }, /fx\.comp\.gateRate|range|between/i);
assertImportRejectedAt('fx.comp.gateAnalog', p => { p.fx.comp.gateAnalog = 1.01; }, /fx\.comp\.gateAnalog|range|between/i);
assertImportRejectedAt('tracks[0].p.pitch', p => { p.tracks[0].p.pitch = 59; }, /tracks\[0\]\.p\.pitch|range|between/i);
assertImportRejectedAt('tracks[1].p.decay', p => { p.tracks[1].p.decay = 0.51; }, /tracks\[1\]\.p\.decay|range|between/i);
assertImportRejectedAt('tracks[2].p.freq', p => { p.tracks[2].p.freq = 14001; }, /tracks\[2\]\.p\.freq|range|between/i);
assertImportRejectedAt('tracks[2].p.decay', p => { p.tracks[2].p.decay = 0.081; }, /tracks\[2\]\.p\.decay|range|between/i);
assertImportRejectedAt('tracks[3].p.spread', p => { p.tracks[3].p.spread = 1; }, /tracks\[3\]\.p\.spread|range|between/i);
assertImportRejectedAt('tracks[4].p.pitch', p => { p.tracks[4].p.pitch = 3.01; }, /tracks\[4\]\.p\.pitch|range|between/i);
assertImportRejectedAt('tracks[5].p.freq', p => { p.tracks[5].p.freq = 19; }, /tracks\[5\]\.p\.freq|range|between/i);

const badKickParam = serializeProject({ appState, tracks, fx, patterns });
badKickParam.tracks[0].p.pitch = 'bad';
assertImportRejected(badKickParam, /tracks\[0\]\.p\.pitch|finite number/i, 'malformed kick pitch param');

const unknownKickParam = serializeProject({ appState, tracks, fx, patterns });
unknownKickParam.tracks[0].p.rim = 1;
assertImportRejected(unknownKickParam, /tracks\[0\]\.p\.rim|unknown/i, 'unknown kick param');

const badEtherMode = serializeProject({ appState, tracks, fx, patterns });
badEtherMode.tracks[5].p.mode = 'bad';
assertImportRejected(badEtherMode, /tracks\[5\]\.p\.mode|ether|hum|clock|wifi/i, 'malformed ether mode param');

['hum', 'clock', 'wifi', 'ether'].forEach(mode => {
  const validEtherMode = serializeProject({ appState, tracks, fx, patterns });
  validEtherMode.tracks[5].p.mode = mode;
  const parsed = parseProjectImport(validEtherMode);
  assert.strictEqual(parsed.ok, true, 'parseProjectImport accepts ether mode ' + mode);
  assert.strictEqual(parsed.value.tracks[5].p.mode, mode, 'parseProjectImport round-trips ether mode ' + mode);
});

const badEtherNumericParam = serializeProject({ appState, tracks, fx, patterns });
badEtherNumericParam.tracks[5].p.freq = NaN;
assertImportRejected(badEtherNumericParam, /tracks\[5\]\.p\.freq|finite number/i, 'malformed ether numeric param');

const partialParams = serializeProject({ appState, tracks, fx, patterns });
partialParams.tracks = partialParams.tracks.map(t => ({ ...t, p: t.id === 'ether' ? { mode: 'ether' } : {} }));
assert.strictEqual(parseProjectImport(partialParams).ok, true, 'parseProjectImport allows missing track params for legacy saves while validating present keys');

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
