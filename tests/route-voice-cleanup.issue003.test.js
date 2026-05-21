#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainJsPath = process.env.MAIN_JS_PATH || path.join(root, 'src', 'main.js');
const js = fs.readFileSync(mainJsPath, 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = js.indexOf(marker);
  assert(start !== -1, `${name} function exists`);

  let paramDepth = 0;
  let paramsEnd = -1;
  for (let i = start + marker.length - 1; i < js.length; i++) {
    if (js[i] === '(') paramDepth++;
    if (js[i] === ')') paramDepth--;
    if (paramDepth === 0) {
      paramsEnd = i;
      break;
    }
  }
  assert(paramsEnd !== -1, `${name} parameter list closes`);

  let depth = 0;
  const bodyStart = js.indexOf('{', paramsEnd);
  assert(bodyStart !== -1, `${name} function body opens`);
  for (let i = bodyStart; i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') depth--;
    if (depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`${name} function body did not close`);
}

const routeVoice = extractFunction('routeVoice');
const cleanup = extractFunction('scheduleRouteVoiceCleanup');

assert(/const\s+out\s*=\s*A\.createGain\(\)/.test(routeVoice), 'routeVoice creates the per-hit output gain');
assert(/const\s+ds\s*=\s*A\.createGain\(\)/.test(routeVoice), 'routeVoice creates an optional per-hit delay send gain');
assert(/const\s+rs\s*=\s*A\.createGain\(\)/.test(routeVoice), 'routeVoice creates an optional per-hit reverb send gain');
assert(/const\s+ws\s*=\s*A\.createGain\(\)/.test(routeVoice), 'routeVoice creates an optional per-hit WRECK send gain');
assert(/out\.connect\(N\.bus\)/.test(routeVoice), 'routeVoice keeps the dry track route to the bus');
assert(/out\.connect\(ds\);\s*ds\.connect\(N\.dlyLine\)/.test(routeVoice), 'routeVoice keeps the delay send route');
assert(/out\.connect\(rs\);\s*rs\.connect\(N\.revSend\)/.test(routeVoice), 'routeVoice keeps the reverb send route');
assert(/out\.connect\(ws\);\s*ws\.connect\(N\.wreckIn\)/.test(routeVoice), 'routeVoice keeps the WRECK send route');

assert(/ROUTE_VOICE_DEFAULT_CLEANUP_TAIL_SEC/.test(js), 'runtime declares a default routeVoice cleanup tail');
assert(!/const\s+ROUTE_VOICE_CLEANUP_TAIL_SEC\s*=\s*3\s*;/.test(js), 'runtime no longer hard-codes every cleanup at 3 seconds');
assert(/function\s+scheduleRouteVoiceCleanup\s*\(\s*nodes\s*,\s*t\s*,\s*cleanupTailSec\s*\)/.test(js), 'cleanup helper accepts a per-hit cleanup tail');
assert(/function\s+routeVoice\s*\(\s*t\s*,\s*ti\s*,\s*cleanupTailSec\s*\)/.test(js), 'routeVoice accepts a per-hit cleanup tail');

assert(/Number\.isFinite\(\s*cleanupTailSec\s*\)/.test(cleanup), 'cleanup guards invalid tails');
assert(/Math\.max\(\s*0\s*,\s*cleanupTailSec\s*\)/.test(cleanup), 'cleanup clamps negative tails to zero');
assert(/Math\.max\(\s*0\s*,\s*t\s*-\s*A\.currentTime\s*\)/.test(cleanup), 'cleanup delay is based on the scheduled hit time and never negative');
assert(/setTimeout\s*\(/.test(cleanup), 'cleanup is scheduled asynchronously with setTimeout');
assert(/nodes\.forEach\s*\(\s*node\s*=>/.test(cleanup), 'cleanup iterates only the routeVoice-owned gain nodes');
assert(/try\s*\{\s*node\.disconnect\(\)\s*;?\s*\}/.test(cleanup), 'cleanup disconnects each route-owned node');
assert(/catch\s*\([^)]*\)\s*\{\s*\}/.test(cleanup), 'cleanup ignores already-disconnected node errors');

assert(/const\s+routeNodes\s*=\s*\[\s*out\s*\]/.test(routeVoice), 'routeVoice tracks the output gain for later cleanup');
assert(/routeNodes\.push\(ds\)/.test(routeVoice), 'routeVoice tracks optional delay send gain for later cleanup');
assert(/routeNodes\.push\(rs\)/.test(routeVoice), 'routeVoice tracks optional reverb send gain for later cleanup');
assert(/routeNodes\.push\(ws\)/.test(routeVoice), 'routeVoice tracks optional WRECK send gain for later cleanup');
assert(/scheduleRouteVoiceCleanup\(\s*routeNodes\s*,\s*t\s*,\s*cleanupTailSec\s*\)/.test(routeVoice), 'routeVoice schedules cleanup with the per-hit cleanup tail');
assert(!/routeNodes\.push\([^)]*(?:src|osc|noise|buf|player|source)/i.test(routeVoice), 'routeVoice does not add source-owned nodes to cleanup');

const voiceTailExpectations = [
  ['synthKick', /routeVoice\(\s*t\s*,\s*0\s*,\s*Math\.max\(\s*spec\.oscStopSec\s*,\s*spec\.subStopSec\s*,\s*\.025\s*\)\s*\)/],
  ['synthSnare', /routeVoice\(\s*t\s*,\s*1\s*,\s*Math\.max\(\s*spec\.noiseStopSec\s*,\s*spec\.shellStopSec\s*,\s*spec\.crackStopSec\s*\)\s*\)/],
  ['synthHihat', /routeVoice\(\s*t\s*,\s*2\s*,\s*hihatTailSec\s*\)/],
  ['synthClap', /routeVoice\(\s*t\s*,\s*3\s*,\s*clapTailSec\s*\)/],
  ['synthInput', /routeVoice\(\s*t\s*,\s*4\s*,\s*stopAt\s*-\s*t\s*\)/],
  ['synthEther', /routeVoice\(\s*t\s*,\s*5\s*,\s*etherTailSec\s*\)/],
  ['synthSynth', /routeVoice\(\s*t\s*,\s*6\s*,\s*spec\.stopSec\s*\)/],
];
for (const [name, pattern] of voiceTailExpectations) {
  assert(pattern.test(extractFunction(name)), `${name} passes its bounded voice tail to routeVoice`);
}

function createMockGain(name, disconnectLog) {
  return {
    name,
    gain: { value: 0 },
    connections: [],
    connect(target) { this.connections.push(target); return target; },
    disconnect() { disconnectLog.push(name); },
  };
}

const disconnectLog = [];
const createdGains = [];
const scheduled = [];
let gateTriggerTime = null;
const context = {
  A: {
    currentTime: 10,
    createGain() {
      const node = createMockGain(`gain${createdGains.length}`, disconnectLog);
      createdGains.push(node);
      return node;
    },
  },
  TRACKS: [
    { vol: 0.75, dlyS: true, revS: true, wreckS: true },
  ],
  FX: {
    dly: { on: true, wet: 0.8 },
    rev: { on: true, wet: 0.9 },
  },
  N: {
    bus: { name: 'bus' },
    dlyLine: { name: 'dlyLine' },
    revSend: { name: 'revSend' },
    wreckIn: { name: 'wreckIn' },
  },
  DLY_SEND_TRIM: 0.55,
  REV_SEND_TRIM: 0.5,
  WRECK_SEND_TRIM: 0.7,
  ROUTE_VOICE_DEFAULT_CLEANUP_TAIL_SEC: 3,
  Number,
  Math,
  setTimeout(fn, delayMs) { scheduled.push({ fn, delayMs }); },
  shouldFeedWreckProcessor() { return true; },
  triggerGate(t) { gateTriggerTime = t; },
};
vm.createContext(context);
vm.runInContext(`${cleanup}\n${routeVoice}\nthis.dest = routeVoice(12, 0, 4.2);`, context);

assert.strictEqual(createdGains.length, 4, 'behavior: routeVoice creates out plus active delay/reverb/wreck sends');
assert.strictEqual(context.dest, createdGains[0], 'behavior: routeVoice returns the output gain');
assert.strictEqual(createdGains[0].gain.value, 0.75, 'behavior: output gain uses track volume');
assert.deepStrictEqual(createdGains[0].connections.map(n => n.name), ['bus', 'gain1', 'gain2', 'gain3'], 'behavior: out connects to dry bus and all active sends');
assert.deepStrictEqual(createdGains[1].connections.map(n => n.name), ['dlyLine'], 'behavior: delay send connects to delay line');
assert.deepStrictEqual(createdGains[2].connections.map(n => n.name), ['revSend'], 'behavior: reverb send connects to reverb send');
assert.deepStrictEqual(createdGains[3].connections.map(n => n.name), ['wreckIn'], 'behavior: wreck send connects to WRECK input');
assert.strictEqual(gateTriggerTime, 12, 'behavior: reverb send still triggers the gate at hit time');
assert.strictEqual(scheduled.length, 1, 'behavior: routeVoice schedules one cleanup');
assert.strictEqual(scheduled[0].delayMs, 6200, 'behavior: cleanup delay uses scheduled hit offset plus provided tail, not a fixed 3s tail');
scheduled[0].fn();
assert.deepStrictEqual(disconnectLog, ['gain0', 'gain1', 'gain2', 'gain3'], 'behavior: scheduled cleanup disconnects out, ds, rs, and ws');

const fallbackScheduled = [];
const fallbackContext = {
  A: { currentTime: 5 },
  ROUTE_VOICE_DEFAULT_CLEANUP_TAIL_SEC: 3,
  Number,
  Math,
  setTimeout(fn, delayMs) { fallbackScheduled.push(delayMs); },
};
vm.createContext(fallbackContext);
vm.runInContext(`${cleanup}\nscheduleRouteVoiceCleanup([], 4, -2);\nscheduleRouteVoiceCleanup([], 4, NaN);`, fallbackContext);
assert.deepStrictEqual(fallbackScheduled, [0, 3000], 'behavior: cleanup clamps negative tails and defaults invalid tails');

console.log('Issue 003 routeVoice cleanup checks passed.');
