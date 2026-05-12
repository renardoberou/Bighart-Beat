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

const buildGraph = extractFunction('buildGraph');
assert(/N\.wreckIn\s*=\s*A\.createGain\(\)/.test(buildGraph), 'master graph creates DIGI WRECK input stage');
assert(/N\.wreckDry\s*=\s*A\.createGain\(\)/.test(buildGraph), 'master graph creates DIGI WRECK dry blend');
assert(/N\.wreckWet\s*=\s*A\.createGain\(\)/.test(buildGraph), 'master graph creates DIGI WRECK wet blend');
assert(/N\.wreckDownsample\s*=\s*A\.createScriptProcessor\(/.test(buildGraph), 'master graph creates a real sample-hold/downsample processing stage');
assert(/N\.wreckCrusher\s*=\s*A\.createWaveShaper\(\)/.test(buildGraph), 'master graph creates bounded bit/curve shaper');
assert(/N\.wreckTone\s*=\s*A\.createBiquadFilter\(\)/.test(buildGraph), 'master graph creates DIGI WRECK tone contour filter');
assert(/N\.wreckOut\s*=\s*A\.createGain\(\)/.test(buildGraph), 'master graph creates DIGI WRECK output trim');
assert(/N\.compMakeup\.connect\(N\.wreckIn\)/.test(buildGraph), 'DIGI WRECK is hooked after pump compressor/auto-makeup');
assert(/N\.wreckIn\.connect\(N\.wreckDownsample\)/.test(buildGraph), 'DIGI WRECK wet path enters the sample-hold/downsample stage');
assert(/N\.wreckDownsample\.connect\(N\.wreckCrusher\)/.test(buildGraph), 'sample-hold/downsample stage feeds the crusher instead of only shaping a curve');
assert(/N\.wreckOut\.connect\(N\.mstSat\)/.test(buildGraph), 'DIGI WRECK feeds existing safe saturation/limiter path before master');
assert(!/N\.compMakeup\.connect\(N\.mstSat\)/.test(buildGraph), 'DIGI WRECK cannot be bypassed by old compressor-to-saturation route');

assert(/function\s+mkWreckCurve\s*\(/.test(js), 'runtime defines DIGI WRECK transfer curve helper');
assert(/function\s+wreckHoldStep\s*\(/.test(js), 'runtime defines RATE-to-sample-hold step mapper');
assert(/function\s+processWreckDownsample\s*\(/.test(js), 'runtime defines sample-hold/downsample processor');
assert(/wreckHoldStep\(this\.wreckRate\)/.test(js), 'sample-hold processor reads the RATE-controlled downsample value');
assert(/function\s+wreckToneHz\s*\(/.test(js), 'runtime defines DIGI WRECK tone mapper');

const applyFXState = extractFunction('applyFXState');
assert(/N\.wreckCrusher\.curve\s*=\s*mkWreckCurve\(FX\.wreck\.bits,\s*FX\.wreck\.curve/.test(applyFXState), 'applyFXState updates bit depth and transfer mode');
assert(/N\.wreckDownsample\.wreckRate\s*=\s*FX\.wreck\.rate/.test(applyFXState), 'applyFXState drives the real sample-hold/downsample stage from RATE');
assert(/N\.wreckTone\.frequency\.setTargetAtTime\(wreckToneHz\(FX\.wreck\.tone/.test(applyFXState), 'applyFXState maps DIGI WRECK tone to a filter');
assert(/N\.wreckDry\.gain\.setTargetAtTime\(FX\.wreck\.on\s*\?\s*1\s*-\s*FX\.wreck\.mix\s*:\s*1/.test(applyFXState), 'applyFXState keeps dry signal when DIGI WRECK is bypassed');
assert(/N\.wreckWet\.gain\.setTargetAtTime\(FX\.wreck\.on\s*\?\s*FX\.wreck\.mix\s*:\s*0/.test(applyFXState), 'applyFXState controls wet destruction blend');
assert(/N\.wreckOut\.gain\.setTargetAtTime\(FX\.wreck\.on\s*\?\s*FX\.wreck\.out\s*:\s*1/.test(applyFXState), 'applyFXState keeps bypassed DIGI WRECK output at unity');

const syncFxControls = extractFunction('syncFxControls');
['togWreck','wreckMode'].forEach(id => assert(syncFxControls.includes(`$('${id}')`), `runtime syncs ${id}`));
['wreckBits','wreckRate','wreckTone','wreckMix','wreckOut'].forEach(id => {
  assert(syncFxControls.includes(`setFdr('${id}'`), `runtime syncs DIGI WRECK fader ${id}`);
});

const wire = extractFunction('wire');
['togWreck','wreckMode'].forEach(id => assert(wire.includes(`$('${id}')`), `runtime wires ${id}`));
['wreckBits','wreckRate','wreckTone','wreckMix','wreckOut'].forEach(id => {
  assert(wire.includes(`bindF('${id}'`), `runtime binds DIGI WRECK fader ${id}`);
});

assert(/DIGI WRECK/.test(html), 'UI uses original DIGI WRECK naming');
assert(!/GEIGER/i.test(html), 'UI avoids protected/clone branding');
['togWreck','wreckMode','wreckBits','wreckRate','wreckTone','wreckMix','wreckOut'].forEach(id => {
  assert(html.includes(`id="${id}"`), `UI exposes compact DIGI WRECK control ${id}`);
});

console.log('Issue 005 DIGI WRECK runtime/UI checks passed.');
