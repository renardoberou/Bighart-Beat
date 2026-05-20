#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

function cssBlockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert(match, `${selector} CSS block exists`);
  return match[1];
}

function declaration(block, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`${escaped}\\s*:\\s*([^;]+)`));
  assert(match, `${property} declaration exists`);
  return match[1].trim();
}

function px(value, label) {
  const match = value.match(/^(\d+(?:\.\d+)?)px$/);
  assert(match, `${label} is an explicit px value, got ${value}`);
  return Number(match[1]);
}

const synthPanelMatch = main.match(/syn\.innerHTML\s*=\s*`([\s\S]*?)`;\s*pn\.appendChild\(syn\)/);
assert(synthPanelMatch, 'SYN voice panel template is discoverable');
const synthPanel = synthPanelMatch[1];

[
  'data-synth-test',
  'data-synth-note-prev',
  'data-synth-note-next',
  'data-synth-note-edit',
  'data-synth-prev-step',
  'data-synth-next-step',
  'data-synth-rnd-step',
  'data-synth-root-step',
  'data-synth-rnd-harm'
].forEach((hook) => {
  assert(synthPanel.includes(hook), `SYN note controls preserve ${hook} hook`);
});

assert(/class="[^"]*syn-note-controls[^"]*"/.test(synthPanel), 'SYN note controls have a scoped wrapper class');
assert(/data-synth-note-controls="1"/.test(synthPanel), 'SYN note controls expose a stable wrapper data hook');
assert(/class="[^"]*syn-note-controls__row[^"]*syn-note-controls__row--performance[^"]*"[\s\S]*data-synth-test[\s\S]*data-synth-note-prev[\s\S]*data-synth-note-next/.test(synthPanel), 'performance row groups TEST SYN and step navigation');
assert(/class="[^"]*syn-note-controls__row[^"]*syn-note-controls__row--edit[^"]*"[\s\S]*data-synth-note-edit[\s\S]*data-synth-prev-step[\s\S]*data-synth-next-step[\s\S]*data-synth-rnd-step[\s\S]*data-synth-root-step/.test(synthPanel), 'edit row groups NOTE EDIT, harmonic decrement/increment, random selected step, and root reset');
assert(/class="[^"]*syn-note-controls__row[^"]*syn-note-controls__row--tools[^"]*"[\s\S]*data-synth-rnd-harm/.test(synthPanel), 'tool row separates whole-pattern harmonic randomize action');
assert(/class="[^"]*syn-note-controls__btn[^"]*"[\s\S]*data-synth-test/.test(synthPanel), 'SYN note buttons have a scoped button class');
assert(/class="[^"]*syn-note-controls__btn[^"]*syn-note-controls__btn--random[^"]*"[\s\S]*data-synth-rnd-step/.test(synthPanel), 'random selected-step action is visually distinguishable');
assert(/class="[^"]*syn-note-controls__btn[^"]*syn-note-controls__btn--reset[^"]*"[\s\S]*data-synth-root-step/.test(synthPanel), 'root/reset action is visually distinguishable');
assert(/class="[^"]*syn-note-controls__btn[^"]*syn-note-controls__btn--random[^"]*"[\s\S]*data-synth-rnd-harm/.test(synthPanel), 'whole-pattern random harmonic action is visually distinguishable');
assert(/ROOT(?: STEP)?<\/button>/.test(synthPanel), 'root reset button keeps a clear root label');
assert(/RND HARM<\/button>/.test(synthPanel), 'whole-pattern random harmonic label remains explicit');
assert(/HARM ▲<\/button>/.test(synthPanel), 'selected-step next harmonic button keeps the compact harmonic-up label');
assert(/data-synth-next-step="1"[^>]*title="[^"]*(Advance|advance|Up|up)[^"]*harmonic[^"]*selected synth step[^"]*"[^>]*aria-label="[^"]*(Advance|advance|Up|up)[^"]*harmonic[^"]*selected synth step[^"]*"/.test(synthPanel), 'selected-step next harmonic button has accessible title and aria-label');

const wrapper = cssBlockFor('.syn-note-controls');
const row = cssBlockFor('.syn-note-controls__row');
const button = cssBlockFor('.syn-note-controls__btn');
assert(/display\s*:\s*(?:grid|flex)\b/.test(wrapper), 'SYN note controls wrapper uses a layout container');
assert(/display\s*:\s*flex\b/.test(row), 'SYN note control rows use flex layout');
assert(/flex-wrap\s*:\s*wrap\b/.test(row), 'SYN note control rows wrap instead of overflowing on mobile');
assert(/\.syn-note-controls__btn--random\s*\{[\s\S]*border-color\s*:/.test(css), 'random controls have scoped safer visual styling');
assert(/\.syn-note-controls__btn--reset\s*\{[\s\S]*border-color\s*:/.test(css), 'root/reset control has scoped safer visual styling');

const coarseMediaMatch = css.match(/@media\s*[^\{]*pointer\s*:\s*coarse[\s\S]*?(\.(?:syn-note-controls\s+\.syn-note-controls__btn|syn-note-controls__btn\.mstr-btn))\s*\{([\s\S]*?)\}/);
assert(coarseMediaMatch, 'CSS includes pointer: coarse SYN note button rules with enough specificity to beat .mstr-btn');
assert(coarseMediaMatch[1].includes('syn-note-controls'), 'coarse SYN note button selector stays scoped to note controls');
const coarseButtonBlock = coarseMediaMatch[2];
assert(/min-height\s*:\s*(\d+(?:\.\d+)?)px/.test(coarseButtonBlock), 'coarse pointer CSS scopes min-height to SYN note buttons');
assert(px(declaration(coarseButtonBlock, 'min-height'), 'coarse SYN note button min-height') >= 44, 'coarse SYN note buttons are at least 44px tall');

console.log('mobile synth note controls static checks passed');
