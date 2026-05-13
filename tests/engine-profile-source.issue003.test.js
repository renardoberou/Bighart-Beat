#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const persistence = require(path.join(root, 'src', 'state', 'persistence.js'));

const profilesPath = path.join(root, 'src', 'rhythm', 'engine-profiles.js');
assert(fs.existsSync(profilesPath), 'shared engine profile module exists');

const shared = require(profilesPath);
const hihatVoice = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));

assert(shared && typeof shared === 'object', 'engine profile module exports an API object');
assert(shared.ENGINE_PROFILES && typeof shared.ENGINE_PROFILES === 'object', 'shared ENGINE_PROFILES exported');
assert(shared.HIHAT_ENGINE_PROFILES && typeof shared.HIHAT_ENGINE_PROFILES === 'object', 'shared HIHAT_ENGINE_PROFILES exported');

assert.deepStrictEqual(
  Object.keys(shared.ENGINE_PROFILES),
  persistence.ENGINES,
  'shared full engine profiles use the canonical engine order',
);

assert.deepStrictEqual(
  Object.keys(shared.HIHAT_ENGINE_PROFILES),
  persistence.ENGINES,
  'shared hihat profiles use the canonical engine order',
);

for (const engine of persistence.ENGINES) {
  const full = shared.ENGINE_PROFILES[engine];
  const hat = shared.HIHAT_ENGINE_PROFILES[engine];

  assert(full, `${engine}: full profile exists`);
  assert(full.kick && typeof full.kick === 'object', `${engine}: kick profile exists`);
  assert(full.snare && typeof full.snare === 'object', `${engine}: snare profile exists`);
  assert(full.hihat && typeof full.hihat === 'object', `${engine}: hihat profile exists`);

  assert(hat, `${engine}: normalized hihat profile exists`);
  ['noise', 'tone', 'bright', 'decay', 'instability', 'glitchChance', 'chokeClosedTau', 'chokeOpenTau'].forEach(key => {
    assert(Number.isFinite(hat[key]), `${engine}: hihat ${key} is finite`);
  });
  assert(Array.isArray(hat.ratios), `${engine}: hihat ratios array exists`);
  assert(hat.ratios.length > 0 && hat.ratios.length <= 6, `${engine}: hihat ratios are bounded`);
  assert(hat.ratios.every(Number.isFinite), `${engine}: hihat ratios are finite`);
  assert(['square', 'sawtooth', 'triangle'].includes(hat.oscType), `${engine}: hihat oscType is safe`);

  assert.strictEqual(hat.noise, full.hihat.noise, `${engine}: hihat noise comes from shared full profile`);
  assert.strictEqual(hat.tone, full.hihat.tone, `${engine}: hihat tone comes from shared full profile`);
  assert.strictEqual(hat.bright, full.hihat.bright, `${engine}: hihat bright comes from shared full profile`);
  assert.strictEqual(hat.decay, full.hihat.decay, `${engine}: hihat decay comes from shared full profile`);
}

assert.strictEqual(
  hihatVoice.HIHAT_ENGINE_PROFILES,
  shared.HIHAT_ENGINE_PROFILES,
  'hihat voice resolver exports the shared hihat profile object, not a private duplicate',
);

const hihatSource = fs.readFileSync(path.join(root, 'src', 'rhythm', 'hihat-voice.js'), 'utf8');
assert(
  !/const\s+HIHAT_ENGINE_PROFILES\s*=\s*\{/.test(hihatSource),
  'hihat-voice.js must not redeclare private hihat profile data',
);

console.log('Issue 003 shared engine profile source checks passed.');
