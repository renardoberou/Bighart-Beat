#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'main.css'), 'utf8');

function mediaBlockContaining(marker) {
  const markerIndex = css.indexOf(marker);
  assert(markerIndex !== -1, `${marker} marker exists for deploy verification`);

  const mediaStart = css.lastIndexOf('@media', markerIndex);
  assert(mediaStart !== -1, `${marker} sits inside a media query`);

  const firstBrace = css.indexOf('{', mediaStart);
  assert(firstBrace !== -1 && firstBrace < markerIndex, 'mobile media query opens before marker');

  let depth = 0;
  for (let i = firstBrace; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') depth -= 1;
    if (depth === 0) return css.slice(mediaStart, i + 1);
  }

  assert.fail('mobile media query closes');
}

function assertRule(block, selectorPattern, declarationsPattern, message) {
  const rule = new RegExp(`${selectorPattern}\\s*\\{[\\s\\S]*?${declarationsPattern}[\\s\\S]*?\\}`);
  assert(rule.test(block), message);
}

const mobileScroll = mediaBlockContaining('MOBILE-SCROLL-ACCESS-FIX');

assert(/@media\s*\(max-width:\s*640px\)/.test(mobileScroll), 'mobile scroll contract is scoped to the existing 640px breakpoint');
assertRule(
  mobileScroll,
  'html,\\s*body',
  'min-height\\s*:\\s*100%[\\s\\S]*?height\\s*:\\s*auto[\\s\\S]*?overflow-x\\s*:\\s*hidden[\\s\\S]*?overflow-y\\s*:\\s*auto[\\s\\S]*?overscroll-behavior-y\\s*:\\s*contain',
  'mobile document scroll is enabled vertically while preventing horizontal page drift'
);
assertRule(
  mobileScroll,
  '#app,\\s*body\\.running #app',
  'min-height\\s*:\\s*100dvh[\\s\\S]*?height\\s*:\\s*auto[\\s\\S]*?overflow-y\\s*:\\s*visible',
  'running app shell can grow with content instead of clipping controls below the fold'
);
assertRule(
  mobileScroll,
  '\\.seq',
  'flex\\s*:\\s*0\\s+0\\s+auto[\\s\\S]*?height\\s*:\\s*clamp\\(300px,\\s*44vh,\\s*420px\\)[\\s\\S]*?overflow-x\\s*:\\s*auto[\\s\\S]*?overflow-y\\s*:\\s*hidden[\\s\\S]*?touch-action\\s*:\\s*pan-x',
  'mobile sequencer keeps horizontal panning but no longer consumes a fixed half viewport flex slot'
);
assertRule(
  mobileScroll,
  '\\.ctrl',
  'flex\\s*:\\s*0\\s+0\\s+auto[\\s\\S]*?overflow\\s*:\\s*visible[\\s\\S]*?padding-bottom\\s*:\\s*calc\\(24px\\s*\\+\\s*env\\(safe-area-inset-bottom\\)\\)',
  'mobile control panels participate in the document scroll with safe-area bottom padding'
);

assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.swing-strip\s*\{[\s\S]*margin-top\s*:\s*8px[\s\S]*padding\s*:\s*8px[\s\S]*gap\s*:\s*8px/.test(css), 'mobile swing strip is compact enough to avoid dominating the vertical viewport');
assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.swing-step\s*\{[\s\S]*min-height\s*:\s*48px[\s\S]*\.swing-knob-control\s*\{[\s\S]*min-width\s*:\s*84px[\s\S]*min-height\s*:\s*84px/.test(css), 'mobile swing controls stay touch-friendly while reducing vertical pressure');

console.log('mobile scroll access issue012 checks passed');
