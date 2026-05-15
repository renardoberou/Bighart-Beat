#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(/<button class="btn btn-play" id="playBtn">PLAY<\/button>/.test(html), 'PLAY remains an explicit transport button');
assert(/<button class="btn btn-stop" id="stopBtn">STOP<\/button>/.test(html), 'STOP remains an explicit transport button');
assert(/<button class="bpm-btn" id="bpmDn">/.test(html) && /<button class="bpm-btn" id="bpmUp">/.test(html), 'BPM +/- remain explicit buttons');
assert(/<button class="btn tap-btn" id="tapBtn">TAP<\/button>/.test(html), 'TAP remains an explicit tempo button');
assert((html.match(/class="patt-b/g) || []).length === 4, 'pattern A-D buttons remain explicit controls');

assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.btn-play\s*,\s*\.btn-stop\s*,\s*\.tap-btn\s*\{[\s\S]*min-height\s*:\s*44px[\s\S]*touch-action\s*:\s*manipulation[\s\S]*\}/.test(css), 'mobile PLAY/STOP/TAP get 44px touch targets without relying on visual padding');
assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.bpm-btn\s*\{[\s\S]*min-width\s*:\s*44px[\s\S]*min-height\s*:\s*44px[\s\S]*touch-action\s*:\s*manipulation[\s\S]*\}/.test(css), 'mobile BPM +/- get 44px touch targets for tempo nudging');
assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.patt-b\s*\{[\s\S]*min-width\s*:\s*40px[\s\S]*min-height\s*:\s*40px[\s\S]*touch-action\s*:\s*manipulation[\s\S]*\}/.test(css), 'mobile pattern A-D buttons get large enough cue targets');
assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.chain-toggle\s*,\s*\.chain-slot-b\s*\{[\s\S]*min-width\s*:\s*40px[\s\S]*min-height\s*:\s*40px[\s\S]*touch-action\s*:\s*manipulation[\s\S]*\}/.test(css), 'mobile pattern-chain controls get large enough song-mode targets');
assert(/@media\s*\(max-width:\s*640px\)\s*\{[\s\S]*\.bpm-box\s*\{[\s\S]*align-items\s*:\s*stretch[\s\S]*\}/.test(css), 'mobile BPM box stretches enlarged +/- buttons instead of creating tiny islands');
const baseBpmCenter = css.lastIndexOf('.bpm-box {\n  display: flex; align-items: center;');
const mobileBpmStretch = css.lastIndexOf('.bpm-box {\n    align-items: stretch;\n  }');
assert(mobileBpmStretch > baseBpmCenter, 'mobile BPM stretch override must appear after the base align-items:center rule so the cascade applies it');
const laterChainOverride = css.lastIndexOf('.chain-toggle, .chain-slot-b {\n    min-width: 40px;\n    min-height: 40px;\n    touch-action: manipulation;\n  }');
const baseChainSize = css.indexOf('.chain-toggle,\n.chain-slot-b {');
const narrowChainSize = css.indexOf('.chain-toggle, .chain-slot-b { min-width: 36px; height: 32px; }');
assert(laterChainOverride > baseChainSize && laterChainOverride > narrowChainSize, 'mobile chain control 40px min-width override must appear after base and extra-narrow chain sizing rules');

console.log('mobile transport touch target issue014 checks passed');
