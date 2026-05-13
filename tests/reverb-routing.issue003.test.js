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
assert(!/N\.bus\.connect\(N\.revSend\)/.test(buildGraph), 'full dry bus must not feed the reverb send');
assert(!/N\.bus\.connect\(N\.revGate\)/.test(buildGraph), 'full dry bus must never connect directly to the reverb gate');
assert(!/N\.bus\.connect\(N\.conv\)/.test(buildGraph), 'full dry bus must never connect directly to the convolver');
assert(/N\.revSend\.connect\(N\.revGate\)/.test(buildGraph), 'reverb send remains the only intentional input to the gated convolver path');
assert(/Reverb input is per-track only/.test(buildGraph), 'code documents intentional per-track-only reverb routing');
assert(/const\s+reverbSendActive\s*=\s*tr\.revS\s*&&\s*FX\.rev\.on\s*&&\s*FX\.rev\.wet\s*>\s*0/.test(routeVoice), 'routeVoice blocks fresh reverb injection when global reverb is off or wet is zero');
assert(/if\s*\(reverbSendActive\)\s*\{[\s\S]*?out\.connect\(rs\);\s*rs\.connect\(N\.revSend\);[\s\S]*?triggerGate\(t\);[\s\S]*?\}/.test(routeVoice), 'routeVoice injects new reverb signal only when track/global reverb is live, through the attenuated revSend');
assert(!/rs\.connect\(N\.revGate\)/.test(routeVoice), 'per-hit reverb sends should not bypass revSend attenuation');
assert(/out\.connect\(N\.bus\)/.test(routeVoice), 'voices still feed the dry bus regardless of reverb send');

console.log('Issue 003 reverb per-channel send isolation checks passed.');
