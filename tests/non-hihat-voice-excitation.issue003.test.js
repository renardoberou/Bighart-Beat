#!/usr/bin/env node
'use strict';

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

const stableVelocityConstants = {
  KICK_VOICE_VELOCITY: extractNumberConstant(main, 'KICK_VOICE_VELOCITY'),
  SNARE_VOICE_VELOCITY: extractNumberConstant(main, 'SNARE_VOICE_VELOCITY'),
  CLAP_VOICE_VELOCITY: extractNumberConstant(main, 'CLAP_VOICE_VELOCITY'),
  INPUT_VOICE_VELOCITY: extractNumberConstant(main, 'INPUT_VOICE_VELOCITY'),
  ETHER_VOICE_VELOCITY: extractNumberConstant(main, 'ETHER_VOICE_VELOCITY'),
  SYNTH_VOICE_VELOCITY: extractNumberConstant(main, 'SYNTH_VOICE_VELOCITY'),
};
for (const [name, value] of Object.entries(stableVelocityConstants)) {
  assert(value > 0 && value <= 1, `${name} is a normalized conservative excitation velocity`);
}

const fireBody = extractFunction(main, 'fire');
const previewVoiceBody = extractFunction(main, 'previewVoice');
const previewSynthBody = extractFunction(main, 'previewSynth');
const previewEngineKitBody = extractFunction(main, 'previewEngineKit');
const routeVoiceBody = extractFunction(main, 'routeVoice');

assert(/function\s+getTrackVoiceVelocity\s*\(\s*trackIndex\s*\)/.test(main), 'runtime exposes stable non-hihat voice excitation helper');
assert(!/const\s+v\s*=\s*tr\.vol/.test(fireBody), 'fire no longer aliases mixer fader volume as synth velocity');
assert(/const\s+v\s*=\s*getTrackVoiceVelocity\(\s*ti\s*\)/.test(fireBody), 'fire uses stable per-track voice excitation velocity for non-hihat voices');
for (const [id, fn] of [
  ['kick', 'synthKick'],
  ['snare', 'synthSnare'],
  ['clap', 'synthClap'],
  ['input', 'synthInput'],
  ['ether', 'synthEther'],
  ['synth', 'synthSynth'],
]) {
  assert(new RegExp(`case\\s+['"]${id}['"]:[\\s\\S]*${fn}\\(t,\\s*v\\s*,`).test(fireBody), `fire passes stable velocity to ${id}`);
  assert(!new RegExp(`case\\s+['"]${id}['"]:[\\s\\S]*${fn}\\(t,\\s*tr\\.vol\\s*,`).test(fireBody), `fire does not pass mixer fader to ${id}`);
}
assert(/case\s+['"]hihat['"]:[\s\S]*synthHihat\(t,\s*getStepHihatVelocity\(firingStep\),/.test(fireBody), 'hihat still uses per-step accent velocity');
assert(/out\.gain\.value\s*=\s*tr\.vol/.test(routeVoiceBody), 'routeVoice keeps mixer fader as post-voice trim before dry/delay/reverb/WRECK sends');
assert(/synthFn\(\s*t\s*,\s*getTrackVoiceVelocity\(\s*trackIndex\s*\)\s*,\s*tr\.p\s*\)/.test(previewVoiceBody), 'non-hihat voice preview uses stable voice excitation, not mixer fader');
assert(/synthSynth\(t,\s*getTrackVoiceVelocity\(\s*6\s*\),/.test(previewSynthBody), 'synth note preview uses stable synth excitation, not mixer fader');
assert(/synthKick\(t,\s*getTrackVoiceVelocity\(\s*0\s*\),/.test(previewEngineKitBody), 'engine kit kick preview uses stable excitation');
assert(/synthSnare\(t\s*\+\s*\.12,\s*getTrackVoiceVelocity\(\s*1\s*\),/.test(previewEngineKitBody), 'engine kit snare preview uses stable excitation');
assert(/synthHihat\(t\s*\+\s*\.24,\s*HIHAT_NORMAL_VELOCITY,/.test(previewEngineKitBody), 'engine kit hihat preview preserves hihat-specific normal accent velocity and openness');

const fired = [];
const context = {
  ...stableVelocityConstants,
  DEFAULT_VOICE_VELOCITY: 0.75,
  HIHAT_NORMAL_VELOCITY: extractNumberConstant(main, 'HIHAT_NORMAL_VELOCITY'),
  HIHAT_ACCENT_VELOCITY: extractNumberConstant(main, 'HIHAT_ACCENT_VELOCITY'),
  S: { patt: 0 },
  firingStep: 4,
  HHT_ACCENT: [Array(16).fill(0)],
  HHT_OPENNESS: [Array(16).fill(0)],
  SYNTH_NOTES: [Array(16).fill(1)],
  TRACKS: [
    { id: 'kick', vol: 0.01, p: { marker: 'kick' }, mute: false },
    { id: 'snare', vol: 0.02, p: { marker: 'snare' }, mute: false },
    { id: 'hihat', vol: 0.03, p: { marker: 'hihat', open: 0.1 }, mute: false },
    { id: 'clap', vol: 0.04, p: { marker: 'clap' }, mute: false },
    { id: 'input', vol: 0.05, p: { marker: 'input' }, mute: false },
    { id: 'ether', vol: 0.06, p: { marker: 'ether' }, mute: false },
    { id: 'synth', vol: 0.07, p: { marker: 'synth', pitch: 100 }, mute: false },
  ],
  State: {
    getHihatAccent(grid, step) { return grid[step] ? 1 : 0; },
    getHihatOpenness(grid, step) { return grid[step] || 0; },
    getSynthNoteRatio(grid, step) { return grid[step] || 1; },
    synthPitchForStep(rootHz) { return rootHz * 2; },
  },
  triggerCompGate() {},
  synthKick(t, v, p) { fired.push({ id: 'kick', v, p }); },
  synthSnare(t, v, p) { fired.push({ id: 'snare', v, p }); },
  synthHihat(t, v, p) { fired.push({ id: 'hihat', v, p }); },
  synthClap(t, v, p) { fired.push({ id: 'clap', v, p }); },
  synthInput(t, v, p) { fired.push({ id: 'input', v, p }); },
  synthEther(t, v, p) { fired.push({ id: 'ether', v, p }); },
  synthSynth(t, v, p) { fired.push({ id: 'synth', v, p }); },
};
vm.createContext(context);
vm.runInContext(`
  ${extractFunction(main, 'getTrackVoiceVelocity')}
  ${extractFunction(main, 'getHihatAccentVelocity')}
  ${extractFunction(main, 'getStepHihatOpen')}
  ${extractFunction(main, 'getStepHihatVelocity')}
  ${extractFunction(main, 'getStepSynthRatio')}
  ${extractFunction(main, 'getStepSynthPitch')}
  ${fireBody}
`, context);

for (let ti = 0; ti < context.TRACKS.length; ti += 1) context.fire(ti, 10 + ti);
const expectedVelocities = {
  kick: stableVelocityConstants.KICK_VOICE_VELOCITY,
  snare: stableVelocityConstants.SNARE_VOICE_VELOCITY,
  hihat: context.HIHAT_NORMAL_VELOCITY,
  clap: stableVelocityConstants.CLAP_VOICE_VELOCITY,
  input: stableVelocityConstants.INPUT_VOICE_VELOCITY,
  ether: stableVelocityConstants.ETHER_VOICE_VELOCITY,
  synth: stableVelocityConstants.SYNTH_VOICE_VELOCITY,
};
assert.deepStrictEqual(fired.map(hit => [hit.id, hit.v]), Object.entries(expectedVelocities), 'fire dispatches stable velocities for all tracks while preserving hihat accent path');
for (const hit of fired.filter(hit => hit.id !== 'hihat')) {
  const track = context.TRACKS.find(tr => tr.id === hit.id);
  assert.notStrictEqual(hit.v, track.vol, `${hit.id} velocity is decoupled from mixer fader`);
}
context.HHT_ACCENT[0][4] = 1;
context.fire(2, 20);
assert.strictEqual(fired.at(-1).v, context.HIHAT_ACCENT_VELOCITY, 'accented hihat still uses getStepHihatVelocity behavior');

console.log('Issue 003 non-hihat voice excitation gain-staging checks passed.');
