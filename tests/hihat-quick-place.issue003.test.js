#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(/id="quickHhtPlace"/.test(html), 'sequencer-adjacent quick HHT placement strip exists');
assert(/HHT\s*PLACE/i.test(html), 'quick strip labels the hihat placement mode explicitly');
assert(/data-quick-hht-place="0"[^>]*>CLOSED</.test(html), 'quick strip exposes CLOSED placement');
assert(/data-quick-hht-place="\.45"[^>]*>TIGHT</.test(html), 'quick strip exposes TIGHT placement');
assert(/data-quick-hht-place="1"[^>]*>OPEN</.test(html), 'quick strip exposes OPEN placement');

assert(/function\s+setHihatPlacement\s*\(\s*value\s*\)/.test(main), 'central HHT placement setter exists');
assert(/\[0,\s*\.45,\s*1\]\.includes\(next\)/.test(main), 'placement setter allows only closed/tight/open playback values');
assert(/function\s+syncHihatPlacementControls\s*\(\s*\)/.test(main), 'quick and voice placement controls share a sync function');
assert(/querySelectorAll\('\[data-place\],\s*\[data-quick-hht-place\]'\)/.test(main), 'sync covers both voice panel and quick strip buttons');
assert(/querySelectorAll\('\[data-quick-hht-place\]'\)\.forEach/.test(main), 'quick strip click handlers are wired');
const quickWireBody = main.match(/function\s+wireQuickHihatPlacement\s*\(\s*\)\s*\{([\s\S]*?)\n\}/)[1];
assert(!/initAudio\(/.test(quickWireBody), 'quick placement changes do not initialize audio');

assert(/\.hht-place-strip/.test(css), 'quick placement strip has CSS');
assert(/\.hht-place-b/.test(css), 'quick placement buttons have CSS');
assert(/min-height:\s*28px/.test(css), 'quick placement buttons meet mobile touch target minimum');

console.log('Issue 003 quick hihat placement checks passed.');
