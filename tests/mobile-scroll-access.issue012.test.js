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

assert(/@media\s*\(max-width:\s*900px\),\s*\(pointer:\s*coarse\)/.test(mobileScroll), 'mobile scroll contract covers Telegram custom tabs and coarse-pointer webviews');
assertRule(
  mobileScroll,
  'html,\\s*body',
  'width\\s*:\\s*100%[\\s\\S]*?min-height\\s*:\\s*100%[\\s\\S]*?height\\s*:\\s*100%[\\s\\S]*?overflow\\s*:\\s*hidden[\\s\\S]*?overscroll-behavior-y\\s*:\\s*contain',
  'mobile document is locked so Telegram does not fight an internal app scroller'
);
assertRule(
  mobileScroll,
  '#app,\\s*body\\.running #app',
  'min-height\\s*:\\s*100dvh[\\s\\S]*?height\\s*:\\s*100dvh[\\s\\S]*?max-height\\s*:\\s*100dvh[\\s\\S]*?overflow-x\\s*:\\s*hidden[\\s\\S]*?overflow-y\\s*:\\s*auto[\\s\\S]*?-webkit-overflow-scrolling\\s*:\\s*touch[\\s\\S]*?touch-action\\s*:\\s*pan-y',
  'running app shell is the reliable vertical scroll container in Telegram webviews'
);
assertRule(
  mobileScroll,
  '\\.seq',
  'flex\\s*:\\s*0\\s+0\\s+auto[\\s\\S]*?height\\s*:\\s*clamp\\(220px,\\s*32svh,\\s*300px\\)[\\s\\S]*?overflow-x\\s*:\\s*auto[\\s\\S]*?overflow-y\\s*:\\s*hidden[\\s\\S]*?touch-action\\s*:\\s*pan-x\\s+pan-y',
  'mobile sequencer keeps horizontal panning while allowing vertical page scroll gestures'
);
assertRule(
  mobileScroll,
  '\\.ctrl',
  'flex\\s*:\\s*0\\s+0\\s+auto[\\s\\S]*?overflow\\s*:\\s*visible[\\s\\S]*?padding-bottom\\s*:\\s*calc\\(48px\\s*\\+\\s*env\\(safe-area-inset-bottom\\)\\)',
  'mobile control panels participate in the document scroll with safe-area bottom padding'
);

assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.swing-strip\s*\{[\s\S]*grid-template-columns\s*:\s*minmax\(44px, max-content\) 30px 40px 30px[\s\S]*width\s*:\s*fit-content[\s\S]*margin-top\s*:\s*6px[\s\S]*padding\s*:\s*5px 6px[\s\S]*gap\s*:\s*6px/.test(css), 'mobile swing strip stays compact and avoids dominating the vertical viewport');
assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.swing-step\s*\{[\s\S]*min-height\s*:\s*30px[\s\S]*\.swing-knob-control\s*\{[\s\S]*min-width\s*:\s*40px[\s\S]*min-height\s*:\s*40px/.test(css), 'mobile swing controls stay proportional while preserving button/slider semantics');

console.log('mobile scroll access issue012 checks passed');
