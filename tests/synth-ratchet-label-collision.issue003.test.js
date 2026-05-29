#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function selectorBlocksWithContentAttr(source, attrName) {
  const blocks = [];
  const blockPattern = /([^{}]+)\{([^{}]*content\s*:\s*attr\(([^)]+)\)[^{}]*)\}/g;
  let match;
  while ((match = blockPattern.exec(source)) !== null) {
    if (match[3].trim() === attrName) {
      blocks.push({ selector: match[1].trim(), body: match[2] });
    }
  }
  return blocks;
}

const noteBlocks = selectorBlocksWithContentAttr(css, 'data-note');
assert(
  noteBlocks.some(block => block.selector.includes('.row[data-id="synth"] .sc.syn-note::before')),
  'SYN harmonic note marker remains on ::before and reads from data-note'
);

const ratchetBeforeBlocks = selectorBlocksWithContentAttr(css, 'data-r')
  .filter(block => block.selector.includes('::before'));
assert(
  ratchetBeforeBlocks.some(block => block.selector.includes('.row:not([data-id="synth"]) .sc.r2::before')),
  'non-SYN r2 ratchet badges still exist on ::before'
);
assert(
  ratchetBeforeBlocks.some(block => block.selector.includes('.row:not([data-id="synth"]) .sc.r3::before')),
  'non-SYN r3 ratchet badges still exist on ::before'
);
assert(
  ratchetBeforeBlocks.every(block => block.selector.includes(':not([data-id="synth"])')),
  `ratchet ::before rules must exclude the SYN row so data-note and data-r do not collide on SYN cells; found: ${ratchetBeforeBlocks.map(block => block.selector).join(' | ')}`
);

const ratchetAfterBlocks = selectorBlocksWithContentAttr(css, 'data-r')
  .filter(block => block.selector.includes('::after'));
assert(
  ratchetAfterBlocks.some(block => block.selector.includes('.row[data-id="synth"] .sc.r2::after') && block.selector.includes('.row[data-id="synth"] .sc.r3::after')),
  'SYN ratchet badges use ::after so they can coexist with SYN harmonic note ::before labels'
);

assert(
  /c\.dataset\.note\s*=\s*State\.formatSynthNoteMarkerLabelWithPitch\s*\(ratio/.test(js),
  'runtime writes SYN harmonic marker text with pitch note name to data-note'
);
assert(
  /c\.dataset\.r\s*=\s*ratchet\s*\+\s*'x'/.test(js),
  'runtime still writes ratchet badge text to data-r'
);
assert(
  !/\.sc\.ph::after\s*\{[\s\S]*?content\s*:\s*''/.test(css),
  'playhead overlay must not occupy ::after, leaving SYN ratchet ::after visible during playback'
);
assert(
  /\.sc\.ph\s*\{[\s\S]*?(background-image|filter|outline|box-shadow)\s*:/.test(css),
  'playhead overlay remains visible through a non-pseudo-element visual style'
);

console.log('Issue 003 SYN note + ratchet label collision checks passed.');
