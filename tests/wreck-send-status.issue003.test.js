#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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

assert(html.includes('id="wreckSendStatus"'), 'DIGI WRECK panel exposes a visible W send status/readout');
assert(/W SENDS OFF/.test(html), 'DIGI WRECK send status has neutral default copy');

const status = extractFunction('wreckSendStatusText');
assert(/TRACKS\.some\([^)]*wreckS/.test(status), 'status helper detects when any track has W enabled');
assert(/shouldFeedWreckProcessor\(\)/.test(status), 'status helper uses the same audible return predicate as routing');
assert(/WRECK RETURN OFF/.test(status), 'status helper warns when W sends are enabled but return is inaudible');
assert(/WRECK SEND (READY|ACTIVE)/.test(status), 'status helper reports an active/ready state when return is audible');
assert(/W SENDS OFF/.test(status), 'status helper reports neutral state when no W sends are enabled');

const update = extractFunction('updateWreckSendStatus');
assert(/\$\('wreckSendStatus'\)/.test(update), 'runtime updates the W send status element');
assert(/wreck-send-status--warn/.test(update), 'runtime applies an obvious warning state class');
assert(/wreck-send-status--active/.test(update), 'runtime applies an obvious active state class');

const buildMix = extractFunction('buildMix');
assert(/if\s*\(k\s*===\s*'wreckS'\)\s*updateWreckSendStatus\(\)/.test(buildMix), 'W button toggles refresh the W send status immediately');

const syncFxControls = extractFunction('syncFxControls');
assert(/updateWreckSendStatus\(\)/.test(syncFxControls), 'global FX sync refreshes W send status');

console.log('Issue 003 WRECK send status checks passed.');
