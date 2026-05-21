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
assert(!/N\.wreckDry\s*=\s*A\.createGain\(\)/.test(buildGraph), 'per-track DIGI WRECK send no longer creates an audible dry duplication path');
assert(/N\.wreckWet\s*=\s*A\.createGain\(\)/.test(buildGraph), 'master graph creates DIGI WRECK wet return blend');
assert(/N\.wreckWet\.gain\.value\s*=\s*FX\.wreck\.on\s*\?\s*FX\.wreck\.mix\s*:\s*0/.test(buildGraph), 'buildGraph initializes WRECK wet return from persisted on/mix state before smoothing');
assert(/N\.wreckDownsample\s*=\s*A\.createScriptProcessor\(/.test(buildGraph), 'master graph creates a real sample-hold/downsample processing stage');
assert(/N\.wreckCrusher\s*=\s*A\.createWaveShaper\(\)/.test(buildGraph), 'master graph creates bounded bit/curve shaper');
assert(/N\.wreckTone\s*=\s*A\.createBiquadFilter\(\)/.test(buildGraph), 'master graph creates DIGI WRECK tone contour filter');
assert(/N\.wreckOut\s*=\s*A\.createGain\(\)/.test(buildGraph), 'master graph creates DIGI WRECK output trim');
assert(!/N\.compMakeup\.connect\(N\.wreckIn\)/.test(buildGraph), 'DIGI WRECK is not fed by the full master compressor output');
assert(!/N\.wreckIn\.connect\(N\.wreckDownsample\)/.test(buildGraph), 'bypassed DIGI WRECK must not keep feeding the mobile-costly sample-hold processor');
assert(/updateWreckProcessorFeed\(shouldFeedWreckProcessor\(\)\)/.test(buildGraph), 'initial DIGI WRECK processor feed follows audible wet-feed state');
assert(!/N\.wreckDownsample\.connect\(N\.wreckCrusher\)/.test(buildGraph), 'inactive DIGI WRECK must not leave the sample-hold/downsample processor output connected at build time');
assert(!/N\.wreckCrusher\.connect\(N\.wreckTone\)/.test(buildGraph), 'inactive DIGI WRECK must not leave the downstream processor chain connected at build time');
assert(/N\.wreckOut\.connect\(N\.wreckPreCompGain\)/.test(buildGraph), 'DIGI WRECK return can enter before compressor');
assert(/N\.wreckPreCompGain\.gain\.value\s*=\s*FX\.wreck\.order\s*===\s*'wreck-comp'\s*\?\s*1\s*:\s*0/.test(buildGraph), 'buildGraph initializes pre-compressor WRECK return branch from persisted order');
assert(/N\.wreckPreCompGain\.connect\(N\.mstSum\)/.test(buildGraph), 'wreck-comp order feeds Wreck return into compressed master sum');
assert(/N\.wreckOut\.connect\(N\.wreckPostCompGain\)/.test(buildGraph), 'DIGI WRECK return can enter after compressor');
assert(/N\.wreckPostCompGain\.gain\.value\s*=\s*FX\.wreck\.order\s*===\s*'comp-wreck'\s*\?\s*1\s*:\s*0/.test(buildGraph), 'buildGraph initializes post-compressor WRECK return branch from persisted order');
assert(/N\.wreckPostCompGain\.connect\(N\.mstSat\)/.test(buildGraph), 'comp-wreck order feeds Wreck return before safe saturation/limiter');
assert(/N\.compMakeup\.connect\(N\.mstSat\)/.test(buildGraph), 'dry master path still reaches safe saturation/limiter when Wreck is a send');

assert(/function\s+shouldFeedWreckProcessor\s*\(\)\s*\{/.test(js), 'runtime defines a DIGI WRECK wet-feed predicate');
assert(/function\s+hasWreckSend\s*\(\)\s*\{/.test(js), 'runtime defines a shared active W-send predicate');
assert(/return\s+TRACKS\.some\([^)]*wreckS/.test(extractFunction('hasWreckSend')), 'active W-send predicate detects at least one enabled W send');
assert(/return\s+!!\(FX\.wreck\.on\s*&&\s*FX\.wreck\.mix\s*>\s*0\s*&&\s*FX\.wreck\.out\s*>\s*0\s*&&\s*hasWreckSend\(\)\)/.test(js), 'DIGI WRECK only feeds processor when enabled with audible wet mix/output and at least one W send');
assert(/function\s+updateWreckProcessorFeed\s*\(active\)\s*\{/.test(js), 'runtime defines a gated DIGI WRECK processor-feed helper');
const updateWreckProcessorFeed = extractFunction('updateWreckProcessorFeed');
assert(/N\.wreckIn\.connect\(N\.wreckDownsample\)/.test(updateWreckProcessorFeed), 'processor-feed helper reconnects wet input only when DIGI WRECK wet path is audible');
assert(/N\.wreckDownsample\.connect\(N\.wreckCrusher\)/.test(updateWreckProcessorFeed), 'processor-feed helper reconnects sample-hold/downsample output only when DIGI WRECK wet path is audible');
assert(/N\.wreckCrusher\.connect\(N\.wreckTone\)/.test(updateWreckProcessorFeed), 'processor-feed helper reconnects crusher-to-tone chain only when DIGI WRECK wet path is audible');
assert(/N\.wreckTone\.connect\(N\.wreckWet\)/.test(updateWreckProcessorFeed), 'processor-feed helper reconnects tone-to-wet chain only when DIGI WRECK wet path is audible');
assert(/N\.wreckWet\.connect\(N\.wreckOut\)/.test(updateWreckProcessorFeed), 'processor-feed helper reconnects wet-to-output chain only when DIGI WRECK wet path is audible');
assert(/N\.wreckIn\.disconnect\(N\.wreckDownsample\)/.test(updateWreckProcessorFeed), 'processor-feed helper disconnects wet input when DIGI WRECK is bypassed or zero-wet');
assert(/N\.wreckDownsample\.disconnect\(N\.wreckCrusher\)/.test(updateWreckProcessorFeed), 'processor-feed helper disconnects sample-hold/downsample output when DIGI WRECK is bypassed or zero-wet');
assert(/N\.wreckCrusher\.disconnect\(N\.wreckTone\)/.test(updateWreckProcessorFeed), 'processor-feed helper disconnects crusher-to-tone chain when DIGI WRECK is bypassed or zero-wet');
assert(/N\.wreckTone\.disconnect\(N\.wreckWet\)/.test(updateWreckProcessorFeed), 'processor-feed helper disconnects tone-to-wet chain when DIGI WRECK is bypassed or zero-wet');
assert(/N\.wreckWet\.disconnect\(N\.wreckOut\)/.test(updateWreckProcessorFeed), 'processor-feed helper disconnects wet-to-output chain when DIGI WRECK is bypassed or zero-wet');

const routeVoice = extractFunction('routeVoice');
assert(/tr\.wreckS\s*&&\s*shouldFeedWreckProcessor\(\)/.test(routeVoice), 'routeVoice gates DIGI WRECK send by per-track W state and audible Wreck state');
assert(/ws\.gain\.value\s*=\s*WRECK_SEND_TRIM/.test(routeVoice), 'routeVoice uses a safe per-track Wreck send trim');
assert(/out\.connect\(ws\);\s*ws\.connect\(N\.wreckIn\)/.test(routeVoice), 'selected tracks tap into the Wreck input as a send');

assert(/function\s+mkWreckCurve\s*\(/.test(js), 'runtime defines DIGI WRECK transfer curve helper');
assert(/function\s+wreckHoldStep\s*\(/.test(js), 'runtime defines RATE-to-sample-hold step mapper');
assert(/function\s+processWreckDownsample\s*\(/.test(js), 'runtime defines sample-hold/downsample processor');
assert(/wreckHoldStep\(this\.wreckRate\)/.test(js), 'sample-hold processor reads the RATE-controlled downsample value');
assert(/function\s+wreckToneHz\s*\(/.test(js), 'runtime defines DIGI WRECK tone mapper');

const applyFXState = extractFunction('applyFXState');
assert(/N\.wreckCrusher\.curve\s*=\s*mkWreckCurve\(FX\.wreck\.bits,\s*FX\.wreck\.curve,\s*FX\.wreck\.rate,\s*FX\.wreck\.threshold\)/.test(applyFXState), 'applyFXState updates bit depth, transfer mode, rate, and threshold');
assert(/N\.wreckDownsample\.wreckRate\s*=\s*FX\.wreck\.rate/.test(applyFXState), 'applyFXState drives the real sample-hold/downsample stage from RATE');
assert(/updateWreckProcessorFeed\(shouldFeedWreckProcessor\(\)\)/.test(applyFXState), 'applyFXState gates DIGI WRECK processor feed by audible wet-feed state');
assert(/N\.wreckTone\.frequency\.setTargetAtTime\(wreckToneHz\(FX\.wreck\.tone/.test(applyFXState), 'applyFXState maps DIGI WRECK tone to a filter');
assert(/N\.wreckWet\.gain\.setTargetAtTime\(FX\.wreck\.on\s*\?\s*FX\.wreck\.mix\s*:\s*0/.test(applyFXState), 'applyFXState controls wet destruction send return');
assert(/N\.wreckOut\.gain\.setTargetAtTime\(FX\.wreck\.on\s*\?\s*FX\.wreck\.out\s*:\s*0/.test(applyFXState), 'applyFXState mutes bypassed DIGI WRECK send output');
assert(/N\.wreckPreCompGain\.gain\.setTargetAtTime\(FX\.wreck\.order\s*===\s*'wreck-comp'\s*\?\s*1\s*:\s*0/.test(applyFXState), 'applyFXState opens pre-compressor Wreck return only for wreck-comp order');
assert(/N\.wreckPostCompGain\.gain\.setTargetAtTime\(FX\.wreck\.order\s*===\s*'comp-wreck'\s*\?\s*1\s*:\s*0/.test(applyFXState), 'applyFXState opens post-compressor Wreck return only for comp-wreck order');

const buildMix = extractFunction('buildMix');
assert(/if\s*\(k\s*===\s*'wreckS'\)\s*\{[\s\S]*updateWreckSendStatus\(\)[\s\S]*updateWreckProcessorFeed\(shouldFeedWreckProcessor\(\)\)[\s\S]*\}/.test(buildMix), 'W button toggles immediately refresh the mobile-costly Wreck processor feed');

const syncFxControls = extractFunction('syncFxControls');
['togWreck','wreckMode','wreckOrderToggle'].forEach(id => assert(syncFxControls.includes(`$('${id}')`), `runtime syncs ${id}`));
['wreckBits','wreckRate','wreckThresh','wreckTone','wreckMix','wreckOut'].forEach(id => {
  assert(syncFxControls.includes(`setFdr('${id}'`), `runtime syncs DIGI WRECK fader ${id}`);
});

const wire = extractFunction('wire');
['togWreck','wreckMode','wreckOrderToggle'].forEach(id => assert(wire.includes(`$('${id}')`), `runtime wires ${id}`));
['wreckBits','wreckRate','wreckThresh','wreckTone','wreckMix','wreckOut'].forEach(id => {
  assert(wire.includes(`bindF('${id}'`), `runtime binds DIGI WRECK fader ${id}`);
});

assert(/DIGI WRECK/.test(html), 'UI uses original DIGI WRECK naming');
assert(!/GEIGER/i.test(html + js), 'UI/runtime avoid protected/clone branding');
['togWreck','wreckMode','wreckOrderToggle','wreckBits','wreckRate','wreckThresh','wreckTone','wreckMix','wreckOut'].forEach(id => {
  assert(html.includes(`id="${id}"`), `UI exposes compact DIGI WRECK control ${id}`);
});
['pixel','glass','shard'].forEach(mode => assert(html.includes(`data-curve="${mode}"`), `UI exposes synth-digital ${mode} mode`));
['clip','fold','crush'].forEach(mode => assert(!html.includes(`data-curve="${mode}"`), `UI no longer presents pedal-like ${mode} mode`));
assert(/clamp\([^\n]*,\s*-\.98,\s*\.98\)/.test(js), 'DIGI WRECK transfer is bounded before the master safety chain');

console.log('Issue 005 DIGI WRECK runtime/UI checks passed.');
