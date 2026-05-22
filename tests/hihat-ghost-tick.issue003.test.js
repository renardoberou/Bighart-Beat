#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const hihatVoice = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const { resolveHihatVoiceSpec, resolveHihatRenderBudget } = hihatVoice;

const baseParams = { freq: 9000, decay: 0.04, open: 0, metal: 0.55 };

function assertGhostTickBounds(spec, label) {
  assert(spec && typeof spec === 'object', `${label}: spec object returned`);
  ['ghostTickGain', 'ghostTickTailSec', 'ghostTickHz', 'ghostTickQ'].forEach((key) => {
    assert(Number.isFinite(spec[key]), `${label}: ${key} is finite`);
  });
  assert(spec.ghostTickGain >= 0 && spec.ghostTickGain <= 0.04, `${label}: ghost tick gain is headroom-safe`);
  assert(spec.ghostTickTailSec >= 0.003 && spec.ghostTickTailSec <= 0.018, `${label}: ghost tick tail stays short/mobile-safe`);
  assert(spec.ghostTickHz >= 6500 && spec.ghostTickHz <= 16000, `${label}: ghost tick frequency is bright but bounded`);
  assert(spec.ghostTickQ >= 2.5 && spec.ghostTickQ <= 9, `${label}: ghost tick Q is focused but bounded`);
}

function assertBudgetShape(budget, label) {
  assert(budget && typeof budget === 'object', `${label}: budget object returned`);
  assert.strictEqual(typeof budget.useGhostTick, 'boolean', `${label}: useGhostTick is a boolean`);
  assert(Number.isFinite(budget.optionalSourceCount), `${label}: optionalSourceCount is finite`);
  assert(Number.isFinite(budget.availableOptionalSourceCount), `${label}: availableOptionalSourceCount is finite`);
  assert(budget.optionalSourceCount <= budget.maxOptionalSources, `${label}: optional source count respects cap`);
}

const softClosed = resolveHihatVoiceSpec('909', { ...baseParams, open: 0 }, () => 0.5, 0.18);
const normalClosed = resolveHihatVoiceSpec('909', { ...baseParams, open: 0 }, () => 0.5, 0.75);
const softTight = resolveHihatVoiceSpec('909', { ...baseParams, open: 0.34 }, () => 0.5, 0.18);
const normalTight = resolveHihatVoiceSpec('909', { ...baseParams, open: 0.34 }, () => 0.5, 0.75);
const softOpen = resolveHihatVoiceSpec('909', { ...baseParams, open: 1 }, () => 0.5, 0.18);
const accentedOpen = resolveHihatVoiceSpec('909', { ...baseParams, open: 1 }, () => 0.5, 1.0);

[softClosed, normalClosed, softTight, normalTight, softOpen, accentedOpen].forEach((spec, i) => assertGhostTickBounds(spec, `ghost tick spec ${i}`));

assert(softClosed.ghostTickGain > 0.006, 'soft closed hihat gets an audible quiet ghost tick');
assert(softClosed.ghostTickGain > normalClosed.ghostTickGain, 'soft closed hihat ghost tick is stronger than normal closed articulation');
assert(softTight.ghostTickGain > 0.003, 'soft tight hihat gets a readable short ghost tick');
assert(softTight.ghostTickGain < softClosed.ghostTickGain, 'tight hats get less ghost tick than fully closed hats to avoid tail buildup');
assert(normalTight.ghostTickGain < softTight.ghostTickGain, 'normal tight hats keep less extra tick than soft tight hats');
assert(softOpen.ghostTickGain <= 0.001, 'fully open soft hihat does not add extra ghost tick mud');
assert(accentedOpen.ghostTickGain <= 0.001, 'fully open accented hihat does not add extra ghost tick mud');
assert(softClosed.ghostTickTailSec <= normalClosed.ghostTickTailSec + 0.006, 'soft closed ghost tick remains a short articulation, not a long tail');

const closedBudget = resolveHihatRenderBudget(softClosed, { maxOptionalSources: 1 });
assertBudgetShape(closedBudget, 'closed hihat render budget');
assert.strictEqual(closedBudget.useGhostTick, true, 'closed low-velocity ghost tick survives a one-source optional budget');
assert.strictEqual(closedBudget.optionalSourceCount, 1, 'closed low-velocity hihat only spends one optional source on the ghost tick');

const openBudget = resolveHihatRenderBudget(softOpen, { maxOptionalSources: 4 });
assertBudgetShape(openBudget, 'open hihat render budget');
assert.strictEqual(openBudget.useGhostTick, false, 'open hihat render budget does not enable ghost tick');

const denseOpenBudget = resolveHihatRenderBudget(softOpen, { mobile: true, denseRatchet: true, maxOptionalSources: 1 });
assertBudgetShape(denseOpenBudget, 'dense open render budget');
assert.strictEqual(denseOpenBudget.useGhostTick, false, 'dense mobile open hats still avoid ghost tick mud');

assert(/Math\.max\([\s\S]*hihatBudget\.useGhostTick\s*&&\s*spec\.ghostTickGain\s*>\s*0\.001\s*\?\s*spec\.ghostTickTailSec\s*\+\s*spec\.tailReleaseTau/.test(main), 'hihat tail budget accounts for ghost tick only when budgeted and audible');
assert(/if \(hihatBudget\.useGhostTick && spec\.ghostTickGain > 0\.001\)/.test(main), 'synthHihat gates ghost tick through render budget and resolver gain');
assert(/ghostFilter\.frequency\.value\s*=\s*spec\.ghostTickHz/.test(main), 'ghost tick filter uses resolver frequency');
assert(/ghostFilter\.Q\.value\s*=\s*spec\.ghostTickQ/.test(main), 'ghost tick filter uses resolver Q');
assert(/ghostGain\.gain\.linearRampToValueAtTime\(clamp\(v \* spec\.ghostTickGain,\s*0,\s*\.04\),\s*t \+ Math\.min\(\.0012,\s*spec\.attackSec\)\)/.test(main), 'ghost tick gain uses velocity, resolver gain, and headroom cap');
assert(/ghostTick\.connect\(ghostFilter\);\s*ghostFilter\.connect\(ghostGain\);\s*ghostGain\.connect\(choke\);/.test(main), 'ghost tick routes through the shared hihat choke/polish path');
assert(/ghostTick\.stop\(t \+ spec\.ghostTickTailSec \+ spec\.tailReleaseTau\)/.test(main), 'ghost tick stops after its bounded short tail');

console.log('Issue 003 hihat ghost tick checks passed.');
