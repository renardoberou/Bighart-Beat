#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const { ENGINES } = require(path.join(root, 'src', 'state', 'persistence.js'));

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

assert.deepStrictEqual(ENGINES, ['808', '909', 'reznor', 'aphex'], 'canonical engine list is stable');

for (const engine of ENGINES) {
  assert(index.includes(`data-engine="${engine}"`), `index exposes an engine selector button for ${engine}`);
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

console.log('Issue 003 engine selector regression checks passed.');
