#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainPath = path.join(root, 'src', 'main.js');
const main = fs.readFileSync(mainPath, 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = main.indexOf(marker);
  assert(start !== -1, `${name} function exists`);
  let depth = 0;
  const bodyStart = main.indexOf('{', start);
  assert(bodyStart !== -1, `${name} function has body`);
  for (let i = bodyStart; i < main.length; i++) {
    if (main[i] === '{') depth++;
    if (main[i] === '}') depth--;
    if (depth === 0) return main.slice(start, i + 1);
  }
  throw new Error(`${name} function body did not close`);
}

const genRevIRSource = extractFunction('genRevIR');
const scheduleRevIRRebuildSource = extractFunction('scheduleRevIRRebuild');

const wireSource = extractFunction('wire');
const revSizeBinding = wireSource.match(/bindF\('revSize',[\s\S]*?\);/);
const revDampBinding = wireSource.match(/bindF\('revDamp',[\s\S]*?\);/);
const revWetBinding = wireSource.match(/bindF\('revWet',[\s\S]*?\);/);
assert(revSizeBinding, 'revSize fader binding exists');
assert(revDampBinding, 'revDamp fader binding exists');
assert(revWetBinding, 'revWet fader binding exists');
assert(/scheduleRevIRRebuild\(\)/.test(revSizeBinding[0]), 'revSize input schedules a coalesced IR rebuild');
assert(/scheduleRevIRRebuild\(\)/.test(revDampBinding[0]), 'revDamp input schedules a coalesced IR rebuild');
assert(!/genRevIR\(\)/.test(revSizeBinding[0]), 'revSize input must not synchronously regenerate the IR on every event');
assert(!/genRevIR\(\)/.test(revDampBinding[0]), 'revDamp input must not synchronously regenerate the IR on every event');
assert(/applyFXState\(\)/.test(revWetBinding[0]), 'revWet remains live via applyFXState');
assert(!/scheduleRevIRRebuild\(\)/.test(revWetBinding[0]), 'revWet does not wait on the IR rebuild debounce');

const timers = [];
const sandbox = {
  Math,
  Number,
  FX: { rev: { size: 0.25, damp: 0.4 } },
  N: { conv: { buffer: null } },
  A: null,
  setTimeout(fn, ms) {
    const timer = { fn, ms, cleared: false };
    timers.push(timer);
    return timer;
  },
  clearTimeout(timer) {
    if (timer) timer.cleared = true;
  }
};
let createBufferCalls = 0;
function installAudio(sampleRate = 100) {
  sandbox.A = {
    sampleRate,
    createBuffer(channels, length, rate) {
      createBufferCalls++;
      return {
        channels,
        length,
        sampleRate: rate,
        getChannelData() { return new Float32Array(length); }
      };
    }
  };
}
installAudio();
vm.createContext(sandbox);
vm.runInContext(`
let A = this.A;
const N = this.N;
const FX = this.FX;
const REV_IR_REBUILD_DEBOUNCE_MS = 50;
let revIRRebuildTimer = null;
let lastRevIRParams = null;
${genRevIRSource}
${scheduleRevIRRebuildSource}
this.api = {
  scheduleRevIRRebuild,
  genRevIR,
  setAudio(nextA) { A = nextA; },
  getLastRevIRParams() { return lastRevIRParams; }
};
`, sandbox);

sandbox.api.scheduleRevIRRebuild();
sandbox.FX.rev.size = 0.55;
sandbox.api.scheduleRevIRRebuild();
sandbox.FX.rev.damp = 0.7;
sandbox.api.scheduleRevIRRebuild();
assert.strictEqual(timers.length, 3, 'rapid reverb edits can request multiple debounce timers');
assert.strictEqual(timers.filter(timer => !timer.cleared).length, 1, 'rapid reverb edits coalesce to one pending rebuild');
timers.filter(timer => !timer.cleared).forEach(timer => timer.fn());
assert.strictEqual(createBufferCalls, 1, 'coalesced rapid Size/Damp changes allocate only one final IR');
const rebuiltParams = sandbox.api.getLastRevIRParams();
assert.strictEqual(rebuiltParams.size, 0.55, 'final rebuild uses the latest Size value');
assert.strictEqual(rebuiltParams.damp, 0.7, 'final rebuild uses the latest Damp value');
assert.strictEqual(rebuiltParams.sampleRate, 100, 'final rebuild caches the current sampleRate');

sandbox.api.genRevIR();
assert.strictEqual(createBufferCalls, 1, 'identical Size/Damp/sampleRate skips allocating a new IR');
installAudio(200);
sandbox.api.setAudio(sandbox.A);
sandbox.api.genRevIR();
assert.strictEqual(createBufferCalls, 2, 'sample-rate changes invalidate the IR cache');

console.log('Issue 003 reverb IR regeneration regression checks passed.');
