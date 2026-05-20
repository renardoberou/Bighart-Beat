#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function mediaBlocks() {
  const blocks = [];
  const mediaRe = /@media\s*([^{}]*?(?:pointer\s*:\s*coarse|max-width\s*:\s*(?:640|700|768|900)px)[^{}]*)\{/g;
  let match;
  while ((match = mediaRe.exec(css))) {
    let depth = 1;
    let end = mediaRe.lastIndex;
    while (end < css.length && depth > 0) {
      if (css[end] === '{') depth += 1;
      if (css[end] === '}') depth -= 1;
      end += 1;
    }
    blocks.push({ query: match[1], body: css.slice(mediaRe.lastIndex, end - 1) });
    mediaRe.lastIndex = end;
  }
  return blocks;
}

function ruleBlock(mediaBlock, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = mediaBlock.body.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, 'm'));
  return match && match[1];
}

function pixelValue(block, property, label) {
  const escapedProperty = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`(?:^|;)\\s*${escapedProperty}\\s*:\\s*(\\d+)px\\b`, 'm'));
  assert(match, `${label} declares ${property} in px`);
  return Number(match[1]);
}

const faderMedia = mediaBlocks().find(block => ruleBlock(block, '.fdr'));
assert(faderMedia, 'a mobile/coarse-pointer media query overrides .fdr sizing');
assert(/pointer\s*:\s*coarse|max-width\s*:\s*(?:640|700|768|900)px/.test(faderMedia.query), 'fader override is scoped to coarse pointers or mobile widths');

const fader = ruleBlock(faderMedia, '.fdr');
assert(pixelValue(fader, 'height', '.fdr mobile hit target') >= 40, '.fdr mobile hit target is at least 40px high');
assert(/touch-action\s*:\s*pan-y\b/.test(fader), '.fdr preserves vertical page/app scroll on touch devices');
assert(!/touch-action\s*:\s*pan-x\b/.test(fader), '.fdr does not block vertical scrolling with pan-x on touch devices');

const webkitThumb = ruleBlock(faderMedia, '.fdr::-webkit-slider-thumb');
assert(webkitThumb, 'mobile/coarse-pointer webkit fader thumb override exists');
assert(pixelValue(webkitThumb, 'width', 'webkit fader thumb') >= 24, 'webkit fader thumb is at least 24px wide');
assert(pixelValue(webkitThumb, 'height', 'webkit fader thumb') >= 32, 'webkit fader thumb is at least 32px high');

const mozThumb = ruleBlock(faderMedia, '.fdr::-moz-range-thumb');
assert(mozThumb, 'mobile/coarse-pointer moz fader thumb override exists');
assert(pixelValue(mozThumb, 'width', 'moz fader thumb') >= 24, 'moz fader thumb is at least 24px wide');
assert(pixelValue(mozThumb, 'height', 'moz fader thumb') >= 32, 'moz fader thumb is at least 32px high');

assert(/<link\s+[^>]*href="styles\/main\.css\?v=[^"]+"/.test(html), 'index.html cache-busts the fader touch-target CSS slice');

console.log('mobile fader touch target issue003 checks passed');
