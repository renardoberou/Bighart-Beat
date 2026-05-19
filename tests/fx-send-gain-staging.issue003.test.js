#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function extractConst(name) {
  const match = js.match(new RegExp(`const\\s+${name}\\s*=\\s*([0-9.]+)\\s*;`));
  assert(match, `${name} constant should document wet-send headroom trim`);
  return Number(match[1]);
}

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

function runRouteVoice() {
  const connections = [];
  const createdGains = [];
  let gainIndex = 0;
  const context = {
    TRACKS: [{ vol: 0.8, dlyS: true, revS: true }],
    FX: { dly: { on: true, wet: 65 }, rev: { on: true, wet: 0.65 } },
    A: {
      createGain() {
        gainIndex += 1;
        const node = makeNode(`gain${gainIndex}`, connections);
        createdGains.push(node);
        return node;
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
  vm.runInContext(`
    const DLY_SEND_TRIM = ${extractConst('DLY_SEND_TRIM')};
    const REV_SEND_TRIM = ${extractConst('REV_SEND_TRIM')};
    ${extractFunction('routeVoice')};
    routeVoice(1, 0);
  `, context);
  return { connections, createdGains };
}

const dlyTrim = extractConst('DLY_SEND_TRIM');
const revTrim = extractConst('REV_SEND_TRIM');
assert(dlyTrim > 0 && dlyTrim <= 0.75, 'delay send trim should preserve wet-path headroom');
assert(revTrim > 0 && revTrim <= 0.75, 'reverb send trim should preserve wet-path headroom');

const { connections, createdGains } = runRouteVoice();
assert(connections.some((connection) => connection.to === 'bus'), 'routeVoice still feeds the dry bus');
assert(connections.some((connection) => connection.to === 'dlyLine'), 'active delay send still feeds delay line');
assert(connections.some((connection) => connection.to === 'revSend'), 'active reverb send still feeds reverb send');
assert.strictEqual(createdGains[1].gain.value, dlyTrim, 'delay send gain uses bounded headroom trim, not unity');
assert.strictEqual(createdGains[2].gain.value, revTrim, 'reverb send gain uses bounded headroom trim, not unity');

console.log('Issue 003 FX send gain staging checks passed.');
