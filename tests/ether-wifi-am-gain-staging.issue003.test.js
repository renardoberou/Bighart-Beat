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
  const bodyStart = source.indexOf('{', start);
  assert(bodyStart >= 0, `${name} body opens`);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} body not found`);
}

const helperBody = extractFunction(main, 'createUnipolarModulationCurve');
const synthEtherBody = extractFunction(main, 'synthEther');

const context = { Float32Array };
vm.createContext(context);
vm.runInContext(`${helperBody}; this.curve = createUnipolarModulationCurve(9);`, context);
const curve = Array.from(context.curve);

assert.strictEqual(curve.length, 9, 'unipolar modulation curve has the requested size');
assert.strictEqual(curve[0], 0, 'curve maps oscillator -1 to 0 gain modulation');
assert.strictEqual(curve[curve.length - 1], 1, 'curve maps oscillator +1 to full modulation');
assert(curve.every((value) => value >= 0 && value <= 1), 'curve output is bounded to [0, 1] so WiFi AM cannot subtract gain');

assert(/createWaveShaper\(\)/.test(synthEtherBody), 'WiFi AM path creates a shaping node for unipolar control');
assert(/\.curve\s*=\s*createUnipolarModulationCurve\(\)/.test(synthEtherBody), 'WiFi AM path uses the shared unipolar modulation curve');
assert(/am\.connect\(\s*amUni\s*\);\s*amUni\.connect\(\s*amG\s*\);[\s\S]*?amG\.connect\(\s*env\.gain\s*\)/.test(synthEtherBody), 'square AM is rectified to unipolar before reaching env.gain');
assert(!/am\.connect\(\s*amG\s*\);\s*\n\s*const\s+env\s*=\s*A\.createGain\(\);[\s\S]*?amG\.connect\(\s*env\.gain\s*\)/.test(synthEtherBody), 'bipolar square AM is not connected directly into env.gain');

const bandLevels = [...synthEtherBody.matchAll(/l:\s*([0-9.]+)/g)].map((match) => Number(match[1]));
assert(bandLevels.length >= 2, 'WiFi AM band levels are discoverable');
const baseMultiplier = Number((synthEtherBody.match(/env\.gain\.setValueAtTime\(\s*b\.l\s*\*\s*([0-9.]+)/) || [])[1]);
assert(Number.isFinite(baseMultiplier), 'WiFi envelope base gain multiplier is discoverable');
const amDepth = Number((synthEtherBody.match(/amG\.gain\.value\s*=\s*([0-9.]+)/) || [])[1]);
assert(Number.isFinite(amDepth), 'WiFi AM depth is discoverable');
for (const level of bandLevels) {
  assert(level * baseMultiplier >= 0, `base gain for WiFi band level ${level} is non-negative`);
  assert(amDepth >= 0, 'unipolar AM depth is non-negative/additive only');
}

console.log('Issue 003 ether WiFi AM gain staging checks passed.');
