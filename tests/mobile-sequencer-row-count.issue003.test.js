#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createDefaultTracks } = require('../src/state/tracks.js');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const expectedPlayableRows = createDefaultTracks().length + 1; // virtual OHH row shares hihat backing state

assert(/styles\/main\.css\?v=[^"]+/.test(index), 'index busts the stylesheet cache for the current sequencer CSS contract');

function cssBlockFor(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  assert(match, `${selector} CSS block exists`);
  return match[1];
}

function firstNumber(value, label) {
  const match = value && value.match(/(\d+)/);
  assert(match, `${label} contains a numeric pixel value`);
  return Number(match[1]);
}

const seqBlock = cssBlockFor(css, '.seq');
assert(
  new RegExp(`grid-template-rows\\s*:\\s*repeat\\(\\s*${expectedPlayableRows}\\s*,\\s*minmax\\(\\s*28px\\s*,\\s*1fr\\s*\\)\\s*\\)`).test(seqBlock),
  `sequencer grid reserves ${expectedPlayableRows} rows with at least 28px playable height`
);

const mobileSeqMatches = Array.from(css.matchAll(/@media\s*\(max-width:\s*900px\),\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.seq\s*\{([\s\S]*?)\n\s*\}/g));
assert(mobileSeqMatches.length > 0, 'main CSS has a coarse/mobile .seq override');
const mobileSeqBlock = mobileSeqMatches[mobileSeqMatches.length - 1][1];
const mobileHeightMatch = mobileSeqBlock.match(/height\s*:\s*clamp\(([^,]+),\s*([^,]+),\s*([^\)]+)\)/);
assert(mobileHeightMatch, 'main CSS mobile sequencer height uses clamp');
assert(firstNumber(mobileHeightMatch[1], 'main CSS mobile min height') >= 256, 'main CSS mobile sequencer min height keeps 8 rows tappable');

const criticalSeqMatches = Array.from(index.matchAll(/@media\s*\(max-width:\s*900px\),\s*\(pointer:\s*coarse\)\s*\{[\s\S]*?\.seq\s*\{([\s\S]*?)\n\s*\}/g));
assert(criticalSeqMatches.length > 0, 'inline mobile critical CSS has a .seq override');
const criticalSeqBlock = criticalSeqMatches[criticalSeqMatches.length - 1][1];
const criticalHeightMatch = criticalSeqBlock.match(/height\s*:\s*clamp\(([^,]+),\s*([^,]+),\s*([^\)]+)\)/);
assert(criticalHeightMatch, 'inline mobile critical sequencer height uses clamp');
assert(firstNumber(criticalHeightMatch[1], 'inline mobile min height') >= 256, 'inline critical mobile sequencer min height keeps 8 rows tappable');

console.log('mobile sequencer row count tracks current playable rows');
