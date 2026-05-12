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
  let bodyStart = js.indexOf('{', start);
  assert(bodyStart !== -1, `${name} function has body`);
  for (let i = bodyStart; i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') depth--;
    if (depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`${name} function body did not close`);
}

const routeVoice = extractFunction('routeVoice');
assert(
  /if\s*\(tr\.revS\)\s*\{[\s\S]*?out\.connect\(rs\);\s*rs\.connect\(N\.revGate\);[\s\S]*?triggerGate\(t\);[\s\S]*?\}/.test(routeVoice),
  'track reverb sends must feed N.revGate so gated reverb cannot be bypassed',
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
assert(/e\.target\.value\s*=\s*['"]['"]/.test(sampleHandler), 'oversized sample rejection clears file input for retry');

console.log('Mission 006 audio runtime checks passed.');
