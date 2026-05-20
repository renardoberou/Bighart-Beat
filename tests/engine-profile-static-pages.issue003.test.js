#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const hihatVoice = fs.readFileSync(path.join(root, 'src', 'rhythm', 'hihat-voice.js'), 'utf8');

function scriptIndex(src) {
  const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return index.search(new RegExp(`<script src="${escapedSrc}(?:\\?v=[^"]+)?" defer><\\/script>`));
}

const engineProfilesIdx = scriptIndex('src/rhythm/engine-profiles.js');
const hihatVoiceIdx = scriptIndex('src/rhythm/hihat-voice.js');
const mainIdx = scriptIndex('src/main.js');

assert(engineProfilesIdx !== -1, 'index.html loads shared engine-profiles helper');
assert(hihatVoiceIdx !== -1, 'index.html loads hihat voice helper');
assert(mainIdx !== -1, 'index.html loads main runtime');

assert(
  engineProfilesIdx < hihatVoiceIdx,
  'shared engine profiles load before hihat voice for GitHub Pages',
);
assert(
  engineProfilesIdx < mainIdx,
  'shared engine profiles load before main.js for GitHub Pages',
);
assert(
  hihatVoiceIdx < mainIdx,
  'hihat voice helper still loads before main.js',
);

assert(
  !/^\s*import\s+.*from\s+/m.test(main + hihatVoice),
  'runtime helpers stay static-page compatible with no ES module imports',
);
assert(
  !/^\s*export\s+/m.test(main + hihatVoice),
  'runtime helpers stay static-page compatible with no ES module exports',
);

assert(
  /BighartBeatEngineProfiles/.test(main),
  'main.js reads engine profiles from the static global helper',
);
assert(
  /BighartBeatEngineProfiles/.test(hihatVoice),
  'hihat-voice.js reads hihat profiles from the static global helper',
);

console.log('Issue 003 static shared engine profile checks passed.');
