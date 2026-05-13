#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function scriptIndex(src) {
  const index = html.indexOf(`src="${src}"`);
  assert(index !== -1, `${src} is loaded by static page`);
  return index;
}

assert(
  scriptIndex('src/rhythm/engine-profiles.js') < scriptIndex('src/rhythm/kick-voice.js'),
  'kick voice resolver loads after shared engine profiles',
);
assert(
  scriptIndex('src/rhythm/kick-voice.js') < scriptIndex('src/main.js'),
  'kick voice resolver loads before main runtime',
);

assert(
  /const\s+KickVoice\s*=\s*window\.BighartBeatKick/.test(main),
  'main runtime reads shared kick voice resolver from static page global',
);
assert(
  /KickVoice\.resolveKickVoiceSpec\s*\(\s*S\.engine\s*,\s*p\s*,\s*v\s*\)/.test(main),
  'synthKick resolves bounded engine-aware kick spec from selected engine, params, and velocity',
);
assert(
  !/const\s+ep\s*=\s*engineProfile\(\)\.kick/.test(main),
  'synthKick no longer reads raw kick engine multipliers directly',
);
assert(
  /o\.frequency\.setValueAtTime\(spec\.attackHz/.test(main),
  'synthKick uses resolved attack frequency',
);
assert(
  /ng\.gain\.setValueAtTime\(spec\.clickGain/.test(main),
  'synthKick uses resolved bounded click gain',
);
assert(
  /nf\.frequency\.value\s*=\s*spec\.clickHighpassHz/.test(main),
  'synthKick uses resolved engine-aware click highpass frequency',
);

console.log('Issue 003 kick voice runtime wiring checks passed.');
