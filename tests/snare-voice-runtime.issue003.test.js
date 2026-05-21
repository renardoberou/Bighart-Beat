#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function scriptIndex(src) {
  const escapedSrc = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const index = html.search(new RegExp(`src="${escapedSrc}(?:\\?v=[^"]+)?"`));
  assert(index !== -1, `${src} is loaded by static page`);
  return index;
}

assert(
  scriptIndex('src/rhythm/engine-profiles.js') < scriptIndex('src/rhythm/snare-voice.js'),
  'snare voice resolver loads after shared engine profiles',
);
assert(
  scriptIndex('src/rhythm/snare-voice.js') < scriptIndex('src/main.js'),
  'snare voice resolver loads before main runtime',
);

assert(
  /const\s+SnareVoice\s*=\s*window\.BighartBeatSnare/.test(main),
  'main runtime reads shared snare voice resolver from static page global',
);
assert(
  /SnareVoice\.resolveSnareVoiceSpec\s*\(\s*S\.engine\s*,\s*p\s*,\s*v\s*\)/.test(main),
  'synthSnare resolves bounded engine-aware snare spec from selected engine, params, and velocity',
);
assert(
  !/const\s+ep\s*=\s*engineProfile\(\)\.snare/.test(main),
  'synthSnare no longer reads raw snare engine multipliers directly',
);
assert(
  /nf\.frequency\.value\s*=\s*spec\.noiseBandpassHz/.test(main),
  'synthSnare uses resolved noise bandpass frequency',
);
assert(
  /nhp\.frequency\.value\s*=\s*spec\.noiseHighpassHz/.test(main),
  'synthSnare uses resolved noise highpass frequency',
);
assert(
  /ng\.gain\.linearRampToValueAtTime\(spec\.noisePeakGain/.test(main),
  'synthSnare uses resolved bounded noise peak gain',
);
assert(
  /ng\.gain\.exponentialRampToValueAtTime\(\.001,\s*t \+ spec\.noiseDecaySec\)/.test(main),
  'synthSnare uses resolved noise decay',
);
assert(
  /ns\.stop\(t \+ spec\.noiseStopSec\)/.test(main),
  'synthSnare uses resolved noise stop time',
);
assert(
  /t1\.frequency\.value\s*=\s*spec\.shellFundHz/.test(main),
  'synthSnare uses resolved shell fundamental',
);
assert(
  /t2\.frequency\.value\s*=\s*spec\.shellOvertoneHz/.test(main),
  'synthSnare uses resolved shell overtone',
);
assert(
  /tg\.gain\.linearRampToValueAtTime\(spec\.shellPeakGain/.test(main),
  'synthSnare uses resolved bounded shell peak gain',
);
assert(
  /tg\.gain\.exponentialRampToValueAtTime\(\.001,\s*t \+ spec\.shellDecaySec\)/.test(main),
  'synthSnare uses resolved shell decay',
);
assert(
  /t1\.stop\(t \+ spec\.shellStopSec\)/.test(main) && /t2\.stop\(t \+ spec\.shellStopSec\)/.test(main),
  'synthSnare uses resolved shell stop time',
);
assert(
  /cf\.frequency\.value\s*=\s*spec\.crackHighpassHz/.test(main),
  'synthSnare uses resolved crack highpass frequency',
);
assert(
  /cg\.gain\.setValueAtTime\(spec\.crackPeakGain/.test(main),
  'synthSnare uses resolved bounded crack peak gain',
);
assert(
  /cg\.gain\.exponentialRampToValueAtTime\(\.001,\s*t \+ spec\.crackDecaySec\)/.test(main),
  'synthSnare uses resolved crack decay',
);
assert(
  /cr\.stop\(t \+ spec\.crackStopSec\)/.test(main),
  'synthSnare uses resolved crack stop time',
);
assert(
  /const\s+dest\s*=\s*routeVoice\(t,\s*1,\s*Math\.max\(spec\.noiseStopSec,\s*spec\.shellStopSec,\s*spec\.crackStopSec\)\)/.test(main),
  'snare remains routed through the track send router with its resolved tail',
);

console.log('Issue 003 snare voice runtime wiring checks passed.');
