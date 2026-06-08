#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const { ENGINES } = require(path.join(root, 'src', 'state', 'persistence.js'));

const ENGINE_LABELS = {
  '808': '808-inspired drum engine',
  '909': '909-inspired drum engine',
  reznor: 'Reznor/NIN-inspired industrial drum engine',
  aphex: 'Aphex-inspired IDM drum engine',
};

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = main.indexOf(marker);
  assert(start !== -1, `${name} function exists`);
  const bodyStart = main.indexOf('{', start);
  assert(bodyStart !== -1, `${name} function has an opening brace`);
  let depth = 0;
  for (let i = bodyStart; i < main.length; i++) {
    if (main[i] === '{') depth++;
    if (main[i] === '}') depth--;
    if (depth === 0) return main.slice(start, i + 1);
  }
  throw new Error(`${name} function body did not close`);
}

function buttonAttrs(engine) {
  const match = index.match(new RegExp(`<button\\b(?=[^>]*\\bdata-engine="${engine}")[^>]*>`, 'i'));
  assert(match, `engine selector button exists for ${engine}`);
  return match[0];
}

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return match && match[1];
}

assert.deepStrictEqual(ENGINES, ['808', '909', 'reznor', 'aphex'], 'canonical engine list is stable');

for (const engine of ENGINES) {
  assert(index.includes(`data-engine="${engine}"`), `index exposes an engine selector button for ${engine}`);
}

for (const engine of ENGINES) {
  const attrs = buttonAttrs(engine);
  const ariaLabel = attrValue(attrs, 'aria-label');
  assert(ariaLabel, `${engine} engine button has an accessible aria-label`);
  assert(ariaLabel.includes(ENGINE_LABELS[engine]), `${engine} aria-label is descriptive (${ariaLabel})`);
}

assert.strictEqual(attrValue(buttonAttrs('808'), 'aria-pressed'), 'true', '808 engine starts pressed in markup');
for (const engine of ['909', 'reznor', 'aphex']) {
  assert.strictEqual(attrValue(buttonAttrs(engine), 'aria-pressed'), 'false', `${engine} engine starts unpressed in markup`);
}

[
  '808-inspired',
  '909-inspired',
  'Reznor/NIN-inspired',
  'Aphex-inspired',
].forEach(label => {
  assert(index.includes(label), `engine selector uses legally safe, descriptive label: ${label}`);
});

assert(
  !/>\s*(REZNOR|APHEX)\s*</.test(index),
  'engine selector avoids clone-brand shorthand labels without the inspired qualifier'
);

const wire = extractFunction('wire');
const engineSelectorStart = wire.indexOf("$('engineSel')");
assert(engineSelectorStart !== -1, 'wire binds the engine selector');
const delayStart = wire.indexOf('// delay', engineSelectorStart);
assert(delayStart !== -1, 'engine selector block appears before delay wiring');
const engineSelectorBlock = wire.slice(engineSelectorStart, delayStart);

assert(/querySelectorAll\('\[data-engine\]'\)/.test(engineSelectorBlock), 'engine selector binds data-engine buttons');
assert(
  /State\.ENGINES\.includes\(\s*b\.dataset\.engine\s*\)/.test(engineSelectorBlock),
  'engine selector ignores unknown data-engine values before mutating S.engine'
);
assert(
  engineSelectorBlock.indexOf('State.ENGINES.includes') !== -1 &&
  engineSelectorBlock.indexOf('State.ENGINES.includes') < engineSelectorBlock.indexOf('S.engine = b.dataset.engine'),
  'engine selector validates candidate engine before assigning S.engine'
);
assert(/syncEngineSelector\(\)/.test(engineSelectorBlock), 'valid engine click refreshes selected engine UI');
assert(/autosave\(\)/.test(engineSelectorBlock), 'valid engine click persists selected engine');

const syncEngineSelector = extractFunction('syncEngineSelector');
assert(/setAttribute\(\s*['\"]aria-pressed['\"]\s*,\s*String\(/.test(syncEngineSelector), 'engine selector updates aria-pressed for the active button');
assert(/classList\.toggle\(\s*['\"]on['\"]/.test(syncEngineSelector), 'syncEngineSelector still updates the existing .on class');

console.log('Issue 003 engine selector regression checks passed.');
