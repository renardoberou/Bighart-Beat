#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

const buildGraph = extractFunction('buildGraph');
const routeVoice = extractFunction('routeVoice');

assert(/N\.bus\.connect\(N\.mstSum\)/.test(buildGraph), 'dry bus still feeds the master sum');
assert(!/N\.bus\.connect\(N\.dlySend\)/.test(buildGraph), 'full dry bus must not feed the delay send');
assert(!/N\.dlySend\.connect\(N\.dlyLine\)/.test(buildGraph), 'removed global delay-send-to-line path');
assert(!/N\.bus\.connect\(N\.dlyLine\)/.test(buildGraph), 'full dry bus must never connect directly to delay line');
assert(/N\.dlyFB\.connect\(N\.dlyLine\)/.test(buildGraph), 'delay feedback tails remain intentional and documented');
assert(/Delay input is per-track only/.test(buildGraph), 'code documents intentional per-track-only delay routing');
assert(/if\s*\(tr\.dlyS\)\s*\{[\s\S]*?out\.connect\(ds\);\s*ds\.connect\(N\.dlyLine\);[\s\S]*?\}/.test(routeVoice), 'routeVoice injects new delay signal only when track dlyS is on');
assert(/out\.connect\(N\.bus\)/.test(routeVoice), 'voices still feed the dry bus regardless of delay send');

console.log('Issue 006 delay per-channel send isolation checks passed.');
