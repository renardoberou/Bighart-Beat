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
  scriptIndex('src/rhythm/engine-profiles.js') < scriptIndex('src/rhythm/clap-voice.js'),
  'clap voice resolver loads after shared engine profiles',
);
assert(
  scriptIndex('src/rhythm/clap-voice.js') < scriptIndex('src/main.js'),
  'clap voice resolver loads before main runtime',
);

assert(
  /const\s+ClapVoice\s*=\s*window\.BighartBeatClap/.test(main),
  'main runtime reads shared clap voice resolver from static page global',
);
assert(
  /ClapVoice\.resolveClapVoiceSpec\s*\(\s*S\.engine\s*,\s*p\s*,\s*v\s*\)/.test(main),
  'synthClap resolves bounded engine-aware clap spec from selected engine, params, and velocity',
);
assert(
  /const\s+dest\s*=\s*routeVoice\(t,\s*3\)/.test(main),
  'clap remains routed through the track send router',
);
assert(
  /for\s*\(const\s+b\s+of\s+spec\.bursts\)/.test(main),
  'synthClap uses resolved burst envelope list',
);
assert(
  /bp\.frequency\.value\s*=\s*clamp\(spec\.toneHz\s*\+\s*\(Math\.random\(\)\s*-\s*\.5\)\s*\*\s*spec\.toneJitterHz/.test(main),
  'synthClap uses resolved bounded tone and jitter values',
);
assert(
  /bp\.Q\.value\s*=\s*spec\.filterQ/.test(main),
  'synthClap uses resolved filter Q',
);
assert(
  /hp\.frequency\.value\s*=\s*spec\.highpassHz/.test(main),
  'synthClap uses resolved highpass frequency',
);
assert(
  /g\.gain\.linearRampToValueAtTime\(b\.gain/.test(main),
  'synthClap uses resolved bounded burst gain',
);
assert(
  /g\.gain\.exponentialRampToValueAtTime\(\.001,\s*bt \+ b\.durationSec\)/.test(main),
  'synthClap uses resolved burst duration',
);
assert(
  /ns\.stop\(bt \+ b\.durationSec \+ spec\.stopPaddingSec\)/.test(main),
  'synthClap uses resolved stop padding',
);
assert(
  !/const\s+s\s*=\s*p\.spread\s*\/\s*1000/.test(main),
  'synthClap no longer derives spread directly from raw params',
);
assert(
  !/bp\.frequency\.value\s*=\s*p\.tone/.test(main),
  'synthClap no longer drives filters directly from raw tone params',
);

console.log('Issue 003 clap voice runtime wiring checks passed.');
