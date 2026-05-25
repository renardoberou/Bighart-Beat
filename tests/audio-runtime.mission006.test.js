#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function stripJsComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = js.indexOf(marker);
  assert(start !== -1, `${name} function exists`);
  let depth = 0;
  let bodyStart = js.indexOf('{', start);
  assert(bodyStart !== -1, `${name} function has body`);
  for (let i = bodyStart; i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') depth--;
    if (depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`${name} function body did not close`);
}

const routeVoice = stripJsComments(extractFunction('routeVoice'));
assert(
  /const\s+reverbSendActive\s*=\s*tr\.revS\s*&&\s*FX\.rev\.on\s*&&\s*FX\.rev\.wet\s*>\s*0[\s\S]*?if\s*\(reverbSendActive\)\s*\{[\s\S]*?out\.connect\(rs\);\s*rs\.connect\(N\.revSend\);[\s\S]*?const\s+reverbTailHoldSec\s*=[\s\S]*?resolveReverbGateTailHoldSec\(tr,\s*cleanupTailSec\)[\s\S]*?triggerGate\(t,\s*reverbTailHoldSec\);[\s\S]*?\}/.test(routeVoice),
  'live track reverb sends must feed N.revSend so send attenuation is preserved before the gated reverb path',
);
assert(
  !/rs\.connect\(N\.conv\)/.test(routeVoice),
  'routeVoice must not connect per-hit reverb sends directly to the convolver',
);

const play = extractFunction('play');
assert(/if\s*\(S\.playing\)\s*return;/.test(play), 'play() guards against duplicate scheduler starts');
assert(/S\.playing\s*=\s*true/.test(play), 'play() marks transport running before scheduling');
assert(/runSch\(\)/.test(play), 'play() starts scheduler once after transport state changes');

const stopPlay = extractFunction('stopPlay');
assert(/if\s*\(!S\.playing\)\s*return;/.test(stopPlay), 'stopPlay() is idempotent');
assert(/S\.playing\s*=\s*false/.test(stopPlay), 'stopPlay() marks transport stopped');
assert(/clearTimeout\(schTimer\)/.test(stopPlay), 'stopPlay() clears scheduler timer');

const maxSampleBytesIndex = js.indexOf('MAX_SAMPLE_BYTES');
assert(maxSampleBytesIndex !== -1, 'sample loader defines a mobile-safe file size limit');
const maxSampleSecondsIndex = js.indexOf('MAX_SAMPLE_SECONDS');
assert(maxSampleSecondsIndex !== -1, 'sample loader defines a decoded-duration limit for mobile memory safety');

assert(/function\s+autoMakeupGainDb\s*\(/.test(js), 'runtime defines autoMakeupGainDb helper');
assert(!/compMakeup[^\n]*(?:makeup|output)[^\n]*=/.test(js), 'runtime does not expose manual compressor makeup/output gain');

const buildGraph = extractFunction('buildGraph');
assert(/N\.compGate\s*=\s*A\.createGain\(\)/.test(buildGraph), 'master chain creates compressor gate gain node');
assert(/N\.mstComp\s*=\s*A\.createDynamicsCompressor\(\)/.test(buildGraph), 'master chain creates pump compressor node');
assert(/N\.compMakeup\s*=\s*A\.createGain\(\)/.test(buildGraph), 'master chain creates auto-makeup gain node');
assert(/N\.mstSum\.connect\(N\.compGate\)/.test(buildGraph), 'master sum feeds compressor gate first');
assert(/N\.compGate\.connect\(N\.mstComp\)/.test(buildGraph), 'compressor gate feeds compressor');
assert(/N\.mstComp\.connect\(N\.compMakeup\)/.test(buildGraph), 'compressor feeds auto-makeup gain');
assert(/N\.compMakeup\.connect\(N\.(?:wreckIn|mstSat)\)/.test(buildGraph), 'auto-makeup feeds the next pre-master stage');
assert(!/N\.mstComp\.connect\(N\.mstSat\)/.test(buildGraph), 'compressor no longer bypasses auto-makeup node');

const compDetectorSettings = extractFunction('compDetectorSettings');
assert(/const\s+mode\s*=\s*comp\.detector\s*===\s*['"]peak['"]\s*\?\s*['"]peak['"]\s*:\s*['"]rms['"]/.test(compDetectorSettings), 'detector helper normalizes detector mode to peak/rms');
assert(/mode\s*===\s*['"]peak['"][\s\S]*?knee:\s*6[\s\S]*?attack:[\s\S]*?0\.[1-8][\s\S]*?release:[\s\S]*?0\.[6-9]/.test(compDetectorSettings), 'peak detector is harder, faster, and tighter than the fader base');
assert(/mode\s*===\s*['"]rms['"][\s\S]*?knee:\s*12[\s\S]*?attack:[\s\S]*?1\.[2-9][\s\S]*?release:[\s\S]*?1\.[1-9]/.test(compDetectorSettings), 'rms detector is softer, slower, and smoother than peak');
assert(/clamp\(\s*\(comp\.attack\s*\/\s*1000\)\s*\*\s*profile\.attack/.test(compDetectorSettings), 'detector helper scales attack from user fader base and clamps it');
assert(/clamp\(\s*\(comp\.release\s*\/\s*1000\)\s*\*\s*profile\.release/.test(compDetectorSettings), 'detector helper scales release from user fader base and clamps it');

assert(/const\s+detectorSettings\s*=\s*compDetectorSettings\(FX\.comp\)/.test(buildGraph), 'buildGraph derives initial compressor detector settings through helper');
assert(/N\.mstComp\.knee\.value\s*=\s*detectorSettings\.knee/.test(buildGraph), 'buildGraph applies helper knee');
assert(/N\.mstComp\.attack\.value\s*=\s*detectorSettings\.attack/.test(buildGraph), 'buildGraph applies helper attack');
assert(/N\.mstComp\.release\.value\s*=\s*detectorSettings\.release/.test(buildGraph), 'buildGraph applies helper release');

const applyFXState = extractFunction('applyFXState');
assert(/N\.mstComp\.threshold\.setTargetAtTime\(FX\.comp\.on\s*\?\s*FX\.comp\.threshold\s*:\s*0/.test(applyFXState), 'compressor threshold follows enabled state');
assert(/N\.mstComp\.ratio\.setTargetAtTime\(FX\.comp\.on\s*\?\s*FX\.comp\.ratio\s*:\s*1/.test(applyFXState), 'compressor ratio follows enabled state');
assert(/const\s+detectorSettings\s*=\s*compDetectorSettings\(FX\.comp\)/.test(applyFXState), 'applyFXState derives runtime compressor detector settings through helper');
assert(/N\.mstComp\.attack\.setTargetAtTime\(detectorSettings\.attack/.test(applyFXState), 'compressor attack applies detector-scaled seconds');
assert(/N\.mstComp\.release\.setTargetAtTime\(detectorSettings\.release/.test(applyFXState), 'compressor release applies detector-scaled seconds for pump');
assert(/N\.mstComp\.knee\.setTargetAtTime\(detectorSettings\.knee/.test(applyFXState), 'detector mode is represented by helper knee response');
assert(/N\.compMakeup\.gain\.setTargetAtTime\(dbToGain\(autoMakeupGainDb\(FX\.comp\)\)/.test(applyFXState), 'auto makeup gain is applied after compressor');

const fire = extractFunction('fire');
assert(/triggerCompGate\(t,\s*tr\.id\)/.test(fire), 'scheduled hits trigger compressor gate envelope with track id context');

const triggerCompGate = extractFunction('triggerCompGate');
assert(/if\s*\(\s*!FX\.comp\.gateOn\s*\|\|\s*!N\.compGate\s*\)\s*return;/.test(triggerCompGate), 'compressor gate can be disabled safely');
assert(/FX\.comp\.gateRate\s*\/\s*1000/.test(triggerCompGate), 'compressor gate rate maps ms to seconds');
assert(/const\s+KICK_PUMP_WEIGHT\s*=\s*1(?:\.0+)?\b/.test(js), 'runtime defines kick as full-priority pump trigger');
assert(/const\s+NON_KICK_PUMP_WEIGHT\s*=\s*0\.[1-6]/.test(js), 'runtime defines reduced non-kick pump trigger weight');
assert(/trackId\s*===\s*['"]kick['"]\s*\?\s*KICK_PUMP_WEIGHT\s*:\s*NON_KICK_PUMP_WEIGHT/.test(triggerCompGate), 'compressor gate weights kick hits stronger than non-kick hits');
assert(/weightedClosed\s*=\s*clamp\(closed\s*\+\s*\(1\s*-\s*closed\)\s*\*\s*\(1\s*-\s*weight\)/.test(triggerCompGate), 'non-kick hits are blended toward open so dense hats/noise do not over-flatten the pump');
assert(/GATE_ANALOG_JITTER_MS/.test(js) && /GATE_ANALOG_CLOSED_DB/.test(js), 'runtime defines bounded analog gate looseness constants');
assert(/analogJitter/.test(triggerCompGate) && /analogClosedDb/.test(triggerCompGate), 'compressor gate applies bounded timing and closed-level analogization');

const applyPumpMacro = extractFunction('applyPumpMacro');
assert(/FX\.comp\.on\s*=\s*true/.test(applyPumpMacro), 'PUMP macro enables compressor');
assert(/threshold:\s*-4[02468]|FX\.comp\.threshold\s*=\s*-4[02468]/.test(applyPumpMacro), 'PUMP macro uses low threshold for hard pumping');
assert(/ratio:\s*(?:10|12)|FX\.comp\.ratio\s*=\s*(?:10|12)/.test(applyPumpMacro), 'PUMP macro uses high ratio');
assert(/toast\(['"]PUMP ARMED['"]\)/.test(applyPumpMacro), 'PUMP macro gives visual feedback');

const applyFrenchHousePreset = extractFunction('applyFrenchHousePreset');
assert(/threshold:\s*-3[2-9]|FX\.comp\.threshold\s*=\s*-3[2-9]/.test(applyFrenchHousePreset), 'French House preset threshold is in aggressive filtered-house range');
assert(/ratio:\s*[6-9]|FX\.comp\.ratio\s*=\s*[6-9]/.test(applyFrenchHousePreset), 'French House preset ratio is in 6:1-10:1 range');
assert(/gateOn:\s*true|FX\.comp\.gateOn\s*=\s*true/.test(applyFrenchHousePreset), 'French House preset lightly enables gate');

['togComp','compDetector','togCompGate','pumpMacro','frenchHousePreset'].forEach(id => {
  assert(js.includes(`$('${id}')`), `runtime wires compressor UI control ${id}`);
});
['compThresh','compRatio','compAttack','compRelease','compGateThresh','compGateRate'].forEach(id => {
  assert(js.includes(`bindF('${id}'`) && js.includes(`setFdr('${id}'`), `runtime binds and syncs compressor fader ${id}`);
});

const sampleHandlerStart = js.indexOf("$('smpFile').addEventListener('change'");
assert(sampleHandlerStart !== -1, 'sample file change handler exists');
const sampleHandler = js.slice(sampleHandlerStart, js.indexOf("  });", sampleHandlerStart) + 6);
const sizeGuardIndex = sampleHandler.search(/f\.size\s*>\s*MAX_SAMPLE_BYTES/);
const initAudioIndex = sampleHandler.indexOf('initAudio()');
const arrayBufferIndex = sampleHandler.indexOf('f.arrayBuffer()');
assert(sizeGuardIndex !== -1, 'sample loader rejects files larger than MAX_SAMPLE_BYTES');
assert(initAudioIndex !== -1, 'sample loader still initializes audio for accepted samples');
assert(arrayBufferIndex !== -1, 'sample loader still decodes accepted sample files');
assert(sizeGuardIndex < initAudioIndex, 'sample size guard runs before unlocking/initializing audio');
assert(sizeGuardIndex < arrayBufferIndex, 'sample size guard runs before reading large files into memory');
assert(/toast\(['"]Sample too large/.test(sampleHandler), 'oversized sample rejection gives clear user feedback');
assert(/e\.target\.value\s*=\s*['"]["']/.test(sampleHandler), 'oversized sample rejection clears file input for retry');
const decodeIndex = sampleHandler.indexOf('A.decodeAudioData(buf)');
const durationGuardIndex = sampleHandler.search(/ab\.duration\s*>\s*MAX_SAMPLE_SECONDS/);
const sampleAssignIndex = sampleHandler.indexOf('TRACKS[4].smp = ab');
assert(decodeIndex !== -1, 'sample loader decodes accepted sample files');
assert(durationGuardIndex !== -1, 'sample loader rejects decoded buffers longer than MAX_SAMPLE_SECONDS');
assert(sampleAssignIndex !== -1, 'sample loader still assigns accepted decoded buffers');
assert(decodeIndex < durationGuardIndex, 'sample duration guard runs after decode so compressed long files are caught');
assert(durationGuardIndex < sampleAssignIndex, 'sample duration guard runs before assigning the input-track sample');
assert(/toast\(['"]Sample too long/.test(sampleHandler), 'overlong decoded sample rejection gives clear user feedback');

console.log('Mission 006 audio runtime checks passed.');
