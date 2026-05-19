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

function runRouteVoiceWithReverb(reverbConfig) {
  const connections = [];
  const gateTriggers = [];
  let gainIndex = 0;
  const context = {
    TRACKS: [{ vol: 0.8, dlyS: false, revS: true }],
    FX: { dly: { on: false, wet: 0 }, rev: reverbConfig },
    REV_SEND_TRIM: extractConst('REV_SEND_TRIM'),
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
    triggerGate(t) { gateTriggers.push(t); },
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction('routeVoice')}; routeVoice(1, 0);`, context);
  return { connections, gateTriggers };
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
assert.deepStrictEqual(liveReverb.gateTriggers, [1], 'enabled nonzero reverb should open the gate once');

console.log('Issue 003 reverb runtime off/zero-wet routing checks passed.');
