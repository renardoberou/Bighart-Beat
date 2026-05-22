#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const hihatVoice = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const { resolveHihatRenderBudget } = hihatVoice;

const highMetalSpec = {
  engine: 'aphex',
  metalGain: 0.28,
  oscillatorGain: 0.5 / 8,
  oscillatorFrequencies: [311, 467, 701, 1051, 1577, 2365, 3547, 5321],
  ghostTickGain: 0.018,
  openShimmerGain: 0.055,
  openBodyGain: 0.070,
  openFlutterGain: 0.032,
  idmSparkGain: 0.058,
  glitchWillFire: true,
  glitchGain: 0.044,
};

function assertBudgetShape(budget, label) {
  assert(budget && typeof budget === 'object', `${label}: budget object returned`);
  assert(Array.isArray(budget.budgetedOscillatorFrequencies), `${label}: exposes budgeted metallic frequencies`);
  assert(Number.isFinite(budget.metallicSourceCount), `${label}: exposes finite metallic source count`);
  assert(Number.isFinite(budget.totalSourceEstimate), `${label}: exposes finite total source estimate`);
  assert.strictEqual(budget.metallicSourceCount, budget.budgetedOscillatorFrequencies.length, `${label}: metallic count matches budgeted frequencies`);
  assert(budget.totalSourceEstimate >= 1 + budget.optionalSourceCount + budget.metallicSourceCount, `${label}: total estimate includes noise, optional layers, and metallic oscillators`);
}

function assertMobileDenseMetalBudget(engine) {
  const spec = { ...highMetalSpec, engine };
  const mobileDense = resolveHihatRenderBudget(spec, { mobile: true, denseRatchet: true });
  const desktop = resolveHihatRenderBudget(spec, { mobile: false, denseRatchet: false });

  assertBudgetShape(mobileDense, `mobile dense ${engine} render budget`);
  assertBudgetShape(desktop, `desktop ${engine} render budget`);

  assert.strictEqual(desktop.metallicSourceCount, spec.oscillatorFrequencies.length, `${engine}: desktop/non-dense budget preserves the full oscillator bank`);
  assert.deepStrictEqual(desktop.budgetedOscillatorFrequencies, spec.oscillatorFrequencies, `${engine}: desktop budget keeps original oscillator frequencies in order`);
  assert(mobileDense.metallicSourceCount < desktop.metallicSourceCount, `${engine}: mobile dense budget selects fewer metallic oscillators than desktop`);
  assert(mobileDense.metallicSourceCount >= 2, `${engine}: mobile dense budget keeps at least two oscillators when metal is audible`);
  assert(mobileDense.budgetedOscillatorFrequencies.every((frequency) => spec.oscillatorFrequencies.includes(frequency)), `${engine}: budgeted frequencies are selected from original metallic bank`);
  assert(mobileDense.totalSourceEstimate < desktop.totalSourceEstimate, `${engine}: mobile dense total source estimate reflects metallic bank reduction`);
}

assertMobileDenseMetalBudget('aphex');
assertMobileDenseMetalBudget('reznor');

const silentMetalBudget = resolveHihatRenderBudget({ ...highMetalSpec, metalGain: 0, oscillatorFrequencies: highMetalSpec.oscillatorFrequencies }, { mobile: true, denseRatchet: true });
assert.strictEqual(silentMetalBudget.metallicSourceCount, 0, 'silent metal spends no metallic oscillator sources');
assert.deepStrictEqual(silentMetalBudget.budgetedOscillatorFrequencies, [], 'silent metal exposes no budgeted metallic frequencies');

assert(/const\s+metallicFrequencies\s*=\s*hihatBudget\.budgetedOscillatorFrequencies/.test(main), 'synthHihat reads metallic frequencies from the render budget');
assert(/for \(const frequency of metallicFrequencies\)/.test(main), 'synthHihat iterates over the budgeted metallic frequencies');
assert(!/for \(const frequency of spec\.oscillatorFrequencies\)/.test(main), 'synthHihat does not iterate over the full spec oscillator bank unconditionally');
assert(/spec\.oscillatorGain\s*\*\s*\(spec\.oscillatorFrequencies\.length\s*\/\s*metallicFrequencies\.length\)/.test(main), 'synthHihat compensates per-oscillator gain for budgeted metallic count while preserving headroom');

console.log('Issue 003 hihat render budget metallic bank checks passed.');
