#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = js.indexOf(marker);
  assert(start !== -1, `${name} function exists`);
  let depth = 0;
  const bodyStart = js.indexOf('{', start);
  for (let i = bodyStart; i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') depth--;
    if (depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`${name} function body did not close`);
}

function extractConst(name) {
  const match = js.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)\\s*;`));
  assert(match, `${name} constant exists`);
  return Number(match[1]);
}

function makeNode(name, connections) {
  return {
    name,
    gain: { value: 0 },
    connect(target) {
      connections.push({ from: name, to: target.name });
      return target;
    },
  };
}

function runRouteVoiceWithReverb(reverbConfig, track = { id: 'snare', vol: 0.8, dlyS: false, revS: true }, cleanupTailSec = 0) {
  const connections = [];
  const gateTriggers = [];
  let gainIndex = 0;
  const context = {
    TRACKS: [track],
    FX: { dly: { on: false, wet: 0 }, rev: reverbConfig },
    REV_SEND_TRIM: extractConst('REV_SEND_TRIM'),
    REV_GATE_SOURCE_TAIL_MAX_EXTRA_SEC: extractConst('REV_GATE_SOURCE_TAIL_MAX_EXTRA_SEC'),
    clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); },
    A: {
      createGain() {
        gainIndex += 1;
        return makeNode(`gain${gainIndex}`, connections);
      },
    },
    N: {
      bus: makeNode('bus', connections),
      dlyLine: makeNode('dlyLine', connections),
      revSend: makeNode('revSend', connections),
      revGate: makeNode('revGate', connections),
      conv: makeNode('conv', connections),
    },
    resolveReverbGateTailHoldSec: undefined,
    triggerGate(t, tailHoldSec) { gateTriggers.push([t, tailHoldSec]); },
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction('resolveReverbGateTailHoldSec')}; ${extractFunction('routeVoice')}; routeVoice(1, 0, ${cleanupTailSec});`, context);
  return { connections, gateTriggers };
}

function runTriggerGate({ gateMs, extraHoldSec, hasGate = true }) {
  const events = [];
  const gateParam = {
    value: 0,
    cancelAndHoldAtTime(t) { events.push(['cancelAndHoldAtTime', t]); },
    linearRampToValueAtTime(value, time) { events.push(['linearRampToValueAtTime', value, time]); },
    setValueAtTime(value, time) { events.push(['setValueAtTime', value, time]); },
  };
  const rev = { on: true };
  if (hasGate) rev.gate = gateMs;
  const context = {
    FX: { rev },
    N: { revGate: { gain: gateParam } },
    REV_GATE_SOURCE_TAIL_MAX_TOTAL_SEC: extractConst('REV_GATE_SOURCE_TAIL_MAX_TOTAL_SEC'),
    cancelAndHoldOrSmoothParam(param, t) { param.cancelAndHoldAtTime(t); },
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction('triggerGate')}; triggerGate(2, ${extraHoldSec});`, context);
  return events;
}

function getGateHoldSec(events) {
  const gateHoldEvent = events.find((event) => event[0] === 'setValueAtTime' && event[1] === 1);
  assert(gateHoldEvent, 'triggerGate schedules the open-hold plateau');
  return Number((gateHoldEvent[2] - 2 - 0.003).toFixed(3));
}

for (const reverbConfig of [{ on: false, wet: 0.28 }, { on: true, wet: 0 }]) {
  const { connections, gateTriggers } = runRouteVoiceWithReverb(reverbConfig);
  assert.strictEqual(
    connections.filter((connection) => connection.to === 'revSend').length,
    0,
    'reverb off/wet=0 must not inject fresh hits into reverb send',
  );
  assert.strictEqual(
    gateTriggers.length,
    0,
    'reverb off/wet=0 must not open the reverb gate',
  );
}

const liveReverb = runRouteVoiceWithReverb({ on: true, wet: 0.65 });
assert.strictEqual(
  liveReverb.connections.filter((connection) => connection.to === 'revSend').length,
  1,
  'enabled nonzero reverb wet should still receive per-track reverb sends',
);
assert.strictEqual(
  liveReverb.connections.filter((connection) => connection.to === 'revGate').length,
  0,
  'per-hit reverb must enter revSend, not bypass directly to the gate',
);
assert.strictEqual(
  liveReverb.connections.filter((connection) => connection.to === 'conv').length,
  0,
  'per-hit reverb must not bypass directly to the convolver',
);
assert.deepStrictEqual(liveReverb.gateTriggers, [[1, 0]], 'enabled nonzero reverb should open the gate once with no extra tail hold for short drums');

const hihatReverb = runRouteVoiceWithReverb(
  { on: true, wet: 0.65 },
  { id: 'hihat', n: 'HHT', vol: 0.8, dlyS: false, revS: true },
  0.9,
);
assert.strictEqual(hihatReverb.gateTriggers.length, 1, 'hihat reverb send opens one gate');
assert.strictEqual(
  hihatReverb.gateTriggers[0][1],
  0.35,
  'hihat extra reverb tail hold is conservatively capped exactly',
);

for (const invalidCleanupTailSec of [NaN, Infinity, -Infinity, -0.1]) {
  const invalidTailReverb = runRouteVoiceWithReverb(
    { on: true, wet: 0.65 },
    { id: 'hihat', n: 'HHT', vol: 0.8, dlyS: false, revS: true },
    invalidCleanupTailSec,
  );
  assert.deepStrictEqual(
    invalidTailReverb.gateTriggers,
    [[1, 0]],
    `invalid hihat cleanupTailSec ${invalidCleanupTailSec} must not produce negative/non-finite source-tail hold`,
  );
}

const synthReverb = runRouteVoiceWithReverb(
  { on: true, wet: 0.65 },
  { id: 'synth', n: 'SYN', vol: 0.8, dlyS: false, revS: true },
  0.42,
);
assert.strictEqual(
  synthReverb.gateTriggers[0][1],
  0.35,
  'mono synth reverb gate passes source tail hold through the same conservative cap',
);

const kickReverb = runRouteVoiceWithReverb(
  { on: true, wet: 0.65 },
  { id: 'kick', n: 'KCK', vol: 0.8, dlyS: false, revS: true },
  1.2,
);
assert.deepStrictEqual(
  kickReverb.gateTriggers,
  [[1, 0]],
  'other drum tracks keep the existing short reverb gate regardless of cleanup tail',
);

const gateEvents = runTriggerGate({ gateMs: 180, extraHoldSec: 0.9 });
assert.strictEqual(
  getGateHoldSec(gateEvents),
  0.75,
  'triggerGate adds source tail hold to FX.rev.gate while capping total hold conservatively',
);

for (const invalidGateCase of [
  { gateMs: undefined, hasGate: false, expectedHold: 0.2, label: 'missing' },
  { gateMs: NaN, expectedHold: 0.2, label: 'NaN' },
  { gateMs: Infinity, expectedHold: 0.2, label: 'Infinity' },
  { gateMs: -25, expectedHold: 0.2, label: 'negative' },
]) {
  const invalidGateEvents = runTriggerGate({
    gateMs: invalidGateCase.gateMs,
    hasGate: invalidGateCase.hasGate,
    extraHoldSec: 0.2,
  });
  assert.strictEqual(
    getGateHoldSec(invalidGateEvents),
    invalidGateCase.expectedHold,
    `invalid FX.rev.gate ${invalidGateCase.label} must fall back to zero base hold before source-tail hold`,
  );
}

assert.strictEqual(
  getGateHoldSec(runTriggerGate({ gateMs: 1200, extraHoldSec: 0 })),
  0.75,
  'valid but oversized FX.rev.gate is clamped to the conservative total hold cap',
);

assert.strictEqual(
  getGateHoldSec(runTriggerGate({ gateMs: 180, extraHoldSec: NaN })),
  0.18,
  'non-finite source tail hold falls back to zero extra hold',
);

assert.strictEqual(
  getGateHoldSec(runTriggerGate({ gateMs: 180, extraHoldSec: -0.5 })),
  0.18,
  'negative source tail hold is clamped to zero extra hold',
);

console.log('Issue 003 reverb runtime off/zero-wet routing and source-tail gate checks passed.');
