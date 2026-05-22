#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} exists`);
  let depth = 0;
  let seenBody = false;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') {
      depth += 1;
      seenBody = true;
    } else if (source[i] === '}') {
      depth -= 1;
      if (seenBody && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} body not found`);
}

function extractNumberConstant(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)\\s*;`));
  assert(match, `${name} constant exists`);
  return Number(match[1]);
}

const normalVelocity = extractNumberConstant(main, 'HIHAT_NORMAL_VELOCITY');
const accentVelocity = extractNumberConstant(main, 'HIHAT_ACCENT_VELOCITY');
assert(normalVelocity > 0 && normalVelocity < accentVelocity && accentVelocity <= 1, 'stable hihat velocities are normalized and accent is louder/brighter than normal');
assert(/function\s+getHihatAccentVelocity\s*\(\s*accented\s*\)/.test(main), 'runtime exposes a small hihat accent-to-velocity helper independent of mixer volume');

const fireBody = extractFunction(main, 'fire');
const routeVoiceBody = extractFunction(main, 'routeVoice');
assert(/case\s+['"]hihat['"]:[\s\S]*synthHihat\(t,\s*getStepHihatVelocity\(firingStep\),\s*\{\s*\.\.\.tr\.p,\s*open:\s*getStepHihatOpen\(firingStep\)\s*\}\);\s*break;/.test(fireBody), 'fire dispatches hihat with accent-derived velocity and per-step openness');
assert(!/case\s+['"]hihat['"]:[\s\S]*synthHihat\(t,\s*(?:v|tr\.vol)\s*,/.test(fireBody), 'fire does not pass the HHT mixer fader as hihat tone velocity');
assert(/out\.gain\.value\s*=\s*tr\.vol/.test(routeVoiceBody), 'routeVoice remains the single post-voice mixer trim for track volume');

const firedHihats = [];
const compGateHits = [];
const context = {
  HIHAT_NORMAL_VELOCITY: normalVelocity,
  HIHAT_ACCENT_VELOCITY: accentVelocity,
  S: { patt: 0 },
  firingStep: 6,
  HHT_ACCENT: [Array(16).fill(0)],
  HHT_OPENNESS: [Array(16).fill(0)],
  TRACKS: [
    { id: 'kick', vol: 0.91, p: {}, mute: false },
    { id: 'snare', vol: 0.82, p: {}, mute: false },
    { id: 'hihat', vol: 0.37, p: { open: 0.12, metal: 0.4 }, mute: false },
  ],
  State: {
    getHihatAccent(grid, step) { return grid[step] ? 1 : 0; },
    getHihatOpenness(grid, step) { return grid[step] || 0; },
  },
  synthHihat(t, v, p) { firedHihats.push({ t, v, p }); },
  synthKick() { throw new Error('kick should not fire'); },
  synthSnare() { throw new Error('snare should not fire'); },
  synthClap() { throw new Error('clap should not fire'); },
  synthInput() { throw new Error('input should not fire'); },
  synthEther() { throw new Error('ether should not fire'); },
  synthSynth() { throw new Error('synth should not fire'); },
  triggerCompGate(t, id) { compGateHits.push({ t, id }); },
  getTrackVoiceVelocity() { throw new Error('hihat fire should not consume non-hihat velocity'); },
};
vm.createContext(context);
vm.runInContext(`
  ${extractFunction(main, 'getHihatAccentVelocity')}
  ${extractFunction(main, 'getStepHihatOpen')}
  ${extractFunction(main, 'getStepHihatVelocity')}
  ${fireBody}
`, context);

context.fire(2, 12.5);
assert.strictEqual(firedHihats.length, 1, 'normal hihat hit fired once');
assert.strictEqual(firedHihats[0].v, normalVelocity, 'normal hihat hit uses stable normal velocity, not HHT fader value');
assert.notStrictEqual(firedHihats[0].v, context.TRACKS[2].vol, 'normal hihat velocity is decoupled from HHT fader');
assert.strictEqual(firedHihats[0].p.open, 0, 'normal hihat hit still uses per-step openness');
assert.deepStrictEqual(compGateHits[0], { t: 12.5, id: 'hihat' }, 'hihat still triggers compressor gate by track id');

context.HHT_ACCENT[0][6] = 1;
context.HHT_OPENNESS[0][6] = 0.78;
context.TRACKS[2].vol = 0.19;
context.fire(2, 13);
assert.strictEqual(firedHihats.length, 2, 'accented hihat hit fired once');
assert.strictEqual(firedHihats[1].v, accentVelocity, 'accented hihat hit uses stable accent velocity, not HHT fader value');
assert.notStrictEqual(firedHihats[1].v, context.TRACKS[2].vol, 'accented hihat velocity remains decoupled from HHT fader changes');
assert.strictEqual(firedHihats[1].p.open, 0.78, 'accented hihat hit preserves per-step openness');

const gains = [];
function makeGain(label) {
  return {
    label,
    gain: { value: undefined },
    connections: [],
    connect(node) { this.connections.push(node); },
  };
}
const routeContext = {
  TRACKS: [null, null, { vol: 0.23, dlyS: true, revS: true, wreckS: true }],
  A: { createGain() { const gain = makeGain(`gain-${gains.length}`); gains.push(gain); return gain; } },
  N: { bus: { label: 'bus' }, dlyLine: { label: 'delay' }, revSend: { label: 'reverb' }, wreckIn: { label: 'wreck' } },
  FX: { dly: { on: true, wet: 0.5 }, rev: { on: true, wet: 0.5 } },
  DLY_SEND_TRIM: 0.31,
  REV_SEND_TRIM: 0.21,
  WRECK_SEND_TRIM: 0.11,
  shouldFeedWreckProcessor() { return true; },
  triggerGate() {},
  scheduleRouteVoiceCleanup() {},
};
vm.createContext(routeContext);
vm.runInContext(`${routeVoiceBody}; this.dest = routeVoice(20, 2, 0.5);`, routeContext);
assert.strictEqual(routeContext.dest, gains[0], 'routeVoice returns the per-hit post-voice output gain');
assert.strictEqual(gains[0].gain.value, 0.23, 'routeVoice applies HHT fader exactly once as the post-voice output gain');
assert.deepStrictEqual(gains.slice(1).map((gain) => gain.gain.value), [0.31, 0.21, 0.11], 'delay/reverb/WRECK sends keep their send trims, not an extra hihat velocity multiplier');
assert(gains[0].connections.some((node) => node.label === 'bus'), 'routeVoice still feeds the dry bus');
assert(gains[0].connections.some((node) => node === gains[1]), 'routeVoice still feeds delay send from the post-voice output');
assert(gains[0].connections.some((node) => node === gains[2]), 'routeVoice still feeds reverb send from the post-voice output');
assert(gains[0].connections.some((node) => node === gains[3]), 'routeVoice still feeds WRECK send from the post-voice output');

console.log('Issue 003 hihat gain staging checks passed.');
