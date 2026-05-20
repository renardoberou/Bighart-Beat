#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(/styles\/main\.css\?v=[^"]+/.test(html), 'index busts the stylesheet cache for the current mobile sequencer CSS contract');
assert(/<style\s+id="mobileCriticalScrollFix">[\s\S]*MOBILE-CRITICAL-SCROLL-FIX[\s\S]*<\/style>/.test(html), 'index includes inline critical mobile scroll fallback for Telegram webviews');
assert(/MOBILE-CRITICAL-SCROLL-FIX[\s\S]*html,\s*body\s*\{[\s\S]*height\s*:\s*100%\s*!important[\s\S]*overflow\s*:\s*hidden\s*!important/.test(html), 'inline fallback locks the document so Telegram does not fight the app scroller');
assert(/MOBILE-CRITICAL-SCROLL-FIX[\s\S]*#app,\s*body\.running #app\s*\{[\s\S]*height\s*:\s*100dvh\s*!important[\s\S]*overflow-y\s*:\s*auto\s*!important[\s\S]*-webkit-overflow-scrolling\s*:\s*touch[\s\S]*touch-action\s*:\s*pan-y/.test(html), 'inline fallback makes the running app the mobile vertical scroll container');
assert(/MOBILE-CRITICAL-SCROLL-FIX[\s\S]*\.seq\s*\{[\s\S]*height\s*:\s*clamp\(256px,\s*38svh,\s*340px\)\s*!important[\s\S]*touch-action\s*:\s*pan-x\s+pan-y/.test(html), 'inline fallback lets vertical swipes over the sequencer scroll the page while preserving eight playable rows');
assert(/MOBILE-SCROLL-ACCESS-FIX[\s\S]*\.seq\s*\{[\s\S]*height\s*:\s*clamp\(256px,\s*38svh,\s*340px\)[\s\S]*touch-action\s*:\s*pan-x\s+pan-y/.test(css), 'external CSS mobile sequencer also allows vertical page pan while preserving eight playable rows');

console.log('mobile critical inline scroll issue013 checks passed');
