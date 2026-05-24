#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const etherBranchStart = main.indexOf("} else if (tr.id === 'ether') {");
assert(etherBranchStart >= 0, 'VOICE EDIT has an ETH branch');
const etherBranchEnd = main.indexOf("} else if (tr.id === 'synth') {", etherBranchStart);
assert(etherBranchEnd > etherBranchStart, 'ETH branch can be inspected independently from SYNTH branch');
const etherBranch = main.slice(etherBranchStart, etherBranchEnd);

['hum', 'clock', 'wifi', 'ether'].forEach(mode => {
  assert(etherBranch.includes(`data-m="${mode}"`), `ETH mode button exposes ${mode}`);
});

const modeClickStart = etherBranch.indexOf("b.addEventListener('click', () => {");
assert(modeClickStart >= 0, 'ETH mode buttons have a click handler');
const modeClickEnd = etherBranch.indexOf('\n      });', modeClickStart);
assert(modeClickEnd > modeClickStart, 'ETH mode button click handler can be inspected');
const modeClickHandler = etherBranch.slice(modeClickStart, modeClickEnd);

assert(/tr\.p\.mode\s*=\s*b\.dataset\.m/.test(modeClickHandler), 'ETH mode click persists the selected mode on the current track params');
assert(/autosave\s*\(\s*\)/.test(modeClickHandler), 'ETH mode click preserves autosave behavior');
assert(/initAudio\s*\(\s*\)\s*;[\s\S]*scheduleVoiceEditAudition\s*\(\s*tr\.id\s*\)/.test(modeClickHandler), 'ETH mode click unlocks audio and uses the stopped-state voice-edit audition path');
assert(!/previewVoice\s*\(/.test(modeClickHandler), 'ETH mode click does not bypass the shared stopped-state audition scheduler');
assert(!/S\.playing\s*=\s*true|startTransport\s*\(|play\s*\(/.test(modeClickHandler), 'ETH mode click must not start transport');
assert(!/PATTERNS\s*\[|\.steps\b/.test(modeClickHandler), 'ETH mode click must not mutate pattern steps');

console.log('Issue 003 ETH mode audition static checks passed.');
