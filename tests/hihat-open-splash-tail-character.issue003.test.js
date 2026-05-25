#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const { resolveHihatVoiceSpec, resolveHihatRenderBudget } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));

const stableRand = () => 0.5;
const playableOpen = { freq: 9300, decay: 0.15, open: 0.88, metal: 0.82 };
const closed = { ...playableOpen, open: 0 };

function assertSplashBounds(spec, label) {
  ['openSplashGain', 'openSplashTailSec', 'openSplashHz', 'openSplashQ', 'openSplashHold'].forEach((key) => {
    assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`);
  });
  assert(spec.openSplashGain >= 0 && spec.openSplashGain <= 0.055, `${label}: open splash gain stays headroom-safe`);
  assert(spec.openSplashTailSec >= 0.006 && spec.openSplashTailSec <= 0.20, `${label}: open splash tail stays bounded for mobile playback`);
  assert(spec.openSplashHz >= 4500 && spec.openSplashHz <= 18000, `${label}: open splash filter stays audible and bounded`);
  assert(spec.openSplashQ >= 0.7 && spec.openSplashQ <= 4.8, `${label}: open splash Q stays musical and bounded`);
  assert(spec.openSplashHold >= 0.42 && spec.openSplashHold <= 0.78, `${label}: open splash hold stays in a playable tail window`);
}

const classic909 = resolveHihatVoiceSpec('909', playableOpen, stableRand, 0.75);
const aphexSoft = resolveHihatVoiceSpec('aphex', playableOpen, stableRand, 0.42);
const aphexAccent = resolveHihatVoiceSpec('aphex', playableOpen, stableRand, 1.0);
const reznorAccent = resolveHihatVoiceSpec('reznor', playableOpen, stableRand, 1.0);
const aphexClosed = resolveHihatVoiceSpec('aphex', closed, stableRand, 1.0);

assertSplashBounds(classic909, 'classic 909 open hihat');
assertSplashBounds(aphexSoft, 'aphex soft open hihat');
assertSplashBounds(aphexAccent, 'aphex accented open hihat');
assertSplashBounds(reznorAccent, 'reznor accented open hihat');
assertSplashBounds(aphexClosed, 'aphex accented closed hihat');

assert(aphexAccent.openSplashGain > classic909.openSplashGain * 1.55, 'aphex open hihat adds a clearly stronger engine-specific splash than 909');
assert(aphexAccent.openSplashHz > classic909.openSplashHz + 1800, 'aphex open hihat splash is measurably brighter than classic 909');
assert(aphexAccent.openSplashQ > classic909.openSplashQ + 0.75, 'aphex open hihat splash is more tightly focused than classic 909');
assert(reznorAccent.openSplashTailSec > aphexAccent.openSplashTailSec * 1.18, 'reznor open hihat splash hangs longer and dirtier than aphex');
assert(reznorAccent.openSplashHz < classic909.openSplashHz - 1200, 'reznor open hihat splash is measurably darker than classic 909');
assert(aphexClosed.openSplashGain <= 0.001, 'closed aphex hihat keeps open splash effectively silent');
assert(aphexAccent.openSplashGain > aphexClosed.openSplashGain + 0.03, 'open aphex hihat exposes splash only when open');

assert(aphexAccent.openSplashGain > aphexSoft.openSplashGain * 1.25, 'aphex accent increases open splash presence over a soft hit');
assert(aphexSoft.openSplashTailSec > aphexAccent.openSplashTailSec * 1.20, 'aphex soft open hit lets the splash tail bloom longer than accent');
assert(aphexAccent.openSplashHz > aphexSoft.openSplashHz + 600, 'aphex accent brightens the splash transient over soft velocity');

const budget = resolveHihatRenderBudget(aphexAccent, { maxOptionalSources: 6 });
assert.strictEqual(budget.useOpenSplash, true, 'render budget exposes the open splash layer when the resolver makes it audible');

const synthMatch = main.match(/function\s+synthHihat\s*\(\s*t,\s*v,\s*p\s*\)\s*\{([\s\S]*?)\n\}\n\nfunction\s+previewHihat/);
assert(synthMatch, 'synthHihat runtime body is discoverable');
const synth = synthMatch[1];
const splashBlock = synth.match(/if\s*\(hihatBudget\.useOpenSplash[\s\S]*?splash\.start\(t\);\s*splash\.stop\([^;]+\);\s*\}/);
assert(splashBlock, 'runtime has a dedicated optional open splash layer');
assert(/splashFilter\.frequency\.value\s*=\s*spec\.openSplashHz/.test(splashBlock[0]), 'runtime drives open splash filter frequency from resolver');
assert(/splashFilter\.Q\.value\s*=\s*spec\.openSplashQ/.test(splashBlock[0]), 'runtime drives open splash Q from resolver');
assert(/splashGain\.gain\.linearRampToValueAtTime\(clamp\(v\s*\*\s*spec\.openSplashGain/.test(splashBlock[0]), 'runtime drives open splash gain from resolver and velocity');
assert(/splashGain\.gain\.setTargetAtTime\(\.001,\s*t\s*\+\s*spec\.openSplashTailSec\s*\*\s*spec\.openSplashHold,\s*spec\.tailReleaseTau/.test(splashBlock[0]), 'runtime uses resolver splash tail/hold for the release target');
assert(/splash\.stop\(t\s*\+\s*spec\.openSplashTailSec\s*\+\s*spec\.tailReleaseTau\s*\*\s*4\)/.test(splashBlock[0]), 'runtime keeps open splash source alive through the release tail');
assert(/const\s+hihatTailSec\s*=\s*Math\.max\([\s\S]*useOpenSplash[\s\S]*spec\.openSplashTailSec\s*\+\s*spec\.tailReleaseTau\s*\*\s*4/.test(synth), 'route lifetime accounts for open splash release tail');

console.log('Issue 003 hihat open splash/tail character checks passed.');
