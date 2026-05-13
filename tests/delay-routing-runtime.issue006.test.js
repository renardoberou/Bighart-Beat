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

function runRouteVoiceWithDelay(delayConfig) {
  const connections = [];
  let gainIndex = 0;
  const context = {
    TRACKS: [{ vol: 0.8, dlyS: true, revS: false }],
    FX: { dly: delayConfig },
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
    },
    triggerGate() {},
  };
  vm.createContext(context);
  vm.runInContext(`${extractFunction('routeVoice')}; routeVoice(1, 0);`, context);
  return connections;
}

for (const delayConfig of [{ on: false, wet: 100 }, { on: true, wet: 0 }]) {
  const connections = runRouteVoiceWithDelay(delayConfig);
  assert.strictEqual(
    connections.filter((connection) => connection.to === 'dlyLine').length,
    0,
    'delay off/wet=0 must not inject fresh hits into delay line; only existing feedback tails may remain',
  );
}

const liveDelayConnections = runRouteVoiceWithDelay({ on: true, wet: 65 });
assert.strictEqual(
  liveDelayConnections.filter((connection) => connection.to === 'dlyLine').length,
  1,
  'enabled nonzero delay wet should still receive per-track delay sends',
);

console.log('Issue 006 delay runtime off/zero-wet routing checks passed.');
