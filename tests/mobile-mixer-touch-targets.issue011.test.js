#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function blockFor(selector) {
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

function pixelValue(value, label) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/);
  assert(match, `${label} is an explicit px value, got: ${value}`);
  return Number(match[1]);
}

function parseMixerColumns(value) {
  const match = value.match(/^(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+minmax\((\d+(?:\.\d+)?)px,\s*1fr\)\s+(\d+(?:\.\d+)?)px$/);
  assert(match, `.mt grid-template-columns uses explicit px columns plus minmax(..., 1fr), got: ${value}`);
  return match.slice(1).map(Number);
}

function parseRepeatColumns(value) {
  const match = value.match(/^repeat\((\d+),\s*(\d+(?:\.\d+)?)px\)$/);
  assert(match, `.mt-toggles grid-template-columns uses repeat(count, px), got: ${value}`);
  return { count: Number(match[1]), width: Number(match[2]) };
}

function parsePair(value, label) {
  const parts = value.split(/\s+/).filter(Boolean);
  assert(parts.length === 1 || parts.length === 2, `${label} has one or two px values, got: ${value}`);
  const first = pixelValue(parts[0], label);
  return { block: first, inline: pixelValue(parts[1] || parts[0], label) };
}

const mixerRow = blockFor('.mt');
const toggles = blockFor('.mt-toggles');
const mixerButton = blockFor('.mt-btn');

const mixerColumns = declaration(mixerRow, 'grid-template-columns');
const [nameCol, togglesCol, faderMinCol, valueCol] = parseMixerColumns(mixerColumns);
const rowGap = pixelValue(declaration(mixerRow, 'gap'), '.mt gap');
const rowPadding = parsePair(declaration(mixerRow, 'padding'), '.mt padding');

const toggleColumns = declaration(toggles, 'grid-template-columns');
const toggleGrid = parseRepeatColumns(toggleColumns);
const toggleGap = pixelValue(declaration(toggles, 'gap'), '.mt-toggles gap');
const requiredToggleWidth = (toggleGrid.count * toggleGrid.width) + ((toggleGrid.count - 1) * toggleGap);
const minimumRowWidth = nameCol + togglesCol + faderMinCol + valueCol + (3 * rowGap) + (2 * rowPadding.inline);

assert(/display\s*:\s*grid\b/.test(toggles), 'mixer M/D/R/W toggles use a stable grid instead of shrinking flex buttons');
assert.strictEqual(toggleGrid.count, 4, 'mixer toggles reserve four explicit columns for M/D/R/W');
assert.strictEqual(toggleGrid.width, 36, 'each mixer toggle column keeps a 36px mobile touch target');
assert(togglesCol >= requiredToggleWidth, `.mt toggle column (${togglesCol}px) reserves enough width for four 36px buttons plus gaps (${requiredToggleWidth}px)`);
assert(minimumRowWidth <= 320, `.mt minimum row width (${minimumRowWidth}px) fits a 320px viewport`);
assert(/min-width\s*:\s*36px/.test(mixerButton) && /min-height\s*:\s*36px/.test(mixerButton), 'mixer buttons are at least 36px in both dimensions');
assert(/width\s*:\s*36px/.test(mixerButton) && /height\s*:\s*36px/.test(mixerButton), 'mixer buttons keep an explicit 36px square footprint');
assert(/data-k="mute"[\s\S]*>M<\/button>/.test(main), 'mixer markup keeps an explicit M mute button');
assert(/data-k="dlyS"[\s\S]*>D<\/button>/.test(main), 'mixer markup keeps an explicit D delay-send button');
assert(/data-k="revS"[\s\S]*>R<\/button>/.test(main), 'mixer markup keeps an explicit R reverb-send button');
assert(/data-k="wreckS"[\s\S]*>W<\/button>/.test(main), 'mixer markup keeps an explicit W digi-wreck-send button');

console.log('mobile mixer touch target checks passed');
