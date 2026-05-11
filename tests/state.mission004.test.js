#!/usr/bin/env node
const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { createDefaultTracks } = require(path.join(root, 'src', 'state', 'tracks.js'));
const { createDefaultGrid, createPatternBanks } = require(path.join(root, 'src', 'state', 'patterns.js'));
const { createDefaultFxState } = require(path.join(root, 'src', 'state', 'fx-state.js'));
const { createAppState } = require(path.join(root, 'src', 'state', 'app-state.js'));

const canonicalGrid = {
  kick:  [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
  snare: [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
  hihat: [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
  clap:  [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  input: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ether: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
};

const canonicalTracks = [
  { id:'kick',  n:'KCK', col:'r', mute:false, vol:.78, dlyS:false, revS:false,
    p:{ pitch:150, end:42, decay:.45, click:.42, drive:.32 } },
  { id:'snare', n:'SNR', col:'o', mute:false, vol:.68, dlyS:false, revS:true,
    p:{ tone:210, snap:.70, decay:.18, body:.55 } },
  { id:'hihat', n:'HHT', col:'a', mute:false, vol:.46, dlyS:false, revS:false,
    p:{ freq:8200, decay:.055, open:.0, metal:.30 } },
  { id:'clap',  n:'CLP', col:'b', mute:false, vol:.58, dlyS:true,  revS:true,
    p:{ spread:10, decay:.14, tone:1700 } },
  { id:'input', n:'INP', col:'g', mute:false, vol:.70, dlyS:false, revS:false,
    p:{ pitch:1.0, decay:1.0 }, smp:null, smpN:null },
  { id:'ether', n:'ETH', col:'e', mute:false, vol:.62, dlyS:true,  revS:true,
    p:{ mode:'ether', freq:55, harmonics:.5, texture:.5, decay:.28, grit:.4 } },
];

function assertIndependent(makeA, makeB, mutate, read, label) {
  const a = makeA();
  const b = makeB ? makeB() : makeA();
  mutate(a);
  assert.notDeepStrictEqual(read(a), read(b), `${label} mutation changes only mutated instance`);
}

const grid = createDefaultGrid();
assert.deepStrictEqual(Object.keys(grid), ['kick', 'snare', 'hihat', 'clap', 'input', 'ether']);
assert.deepStrictEqual(grid, canonicalGrid, 'createDefaultGrid returns canonical v4 default pattern');
for (const [trackId, steps] of Object.entries(grid)) {
  assert.strictEqual(steps.length, 16, `${trackId} has 16 steps`);
}
assertIndependent(createDefaultGrid, null, g => { g.kick[0] = 0; }, g => g, 'createDefaultGrid');

const banks = createPatternBanks();
assert.strictEqual(banks.length, 4, 'createPatternBanks returns four banks');
for (const bank of banks) assert.deepStrictEqual(bank, canonicalGrid, 'each pattern bank starts canonical');
banks[0].kick[0] = 0;
assert.strictEqual(banks[1].kick[0], 1, 'pattern banks are independent arrays');
banks[1].ether[15] = 1;
assert.strictEqual(banks[2].ether[15], 0, 'pattern banks do not share nested track arrays');

const tracks = createDefaultTracks();
assert.deepStrictEqual(tracks, canonicalTracks, 'createDefaultTracks returns canonical six track objects');
assert.strictEqual(tracks.length, 6, 'createDefaultTracks returns six tracks');
assert.deepStrictEqual(tracks.map(t => t.id), ['kick', 'snare', 'hihat', 'clap', 'input', 'ether']);
assert.strictEqual(tracks[4].smp, null, 'input sample buffer starts null');
assert.strictEqual(tracks[4].smpN, null, 'input sample name starts null');
assertIndependent(createDefaultTracks, null, t => { t[0].p.pitch = 999; t[4].smpN = 'sample'; }, t => [t[0].p.pitch, t[4].smpN], 'createDefaultTracks');

const fx = createDefaultFxState();
assert.deepStrictEqual(fx, {
  dly: { on:false, mult:0.75, fb:.32, tone:.55, wet:.26 },
  rev: { on:false, size:.60, damp:.55, gate:180, wet:.28 },
}, 'createDefaultFxState returns canonical delay/reverb defaults');
assertIndependent(createDefaultFxState, null, f => { f.dly.on = true; f.rev.wet = .99; }, f => [f.dly.on, f.rev.wet], 'createDefaultFxState');

const appState = createAppState();
assert.deepStrictEqual(appState, {
  bpm: 120,
  playing: false,
  patt: 0,
  sel: 0,
  mstVol: .72,
}, 'createAppState returns canonical app defaults');
assertIndependent(createAppState, null, s => { s.bpm = 140; }, s => s.bpm, 'createAppState');

console.log('Mission 004 state helper checks passed.');
