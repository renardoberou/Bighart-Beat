#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function extractFunction(name) {
  const start = main.search(new RegExp(`function\\s+${name}\\s*\\(`));
  assert(start >= 0, `${name}() exists`);
  const open = main.indexOf('{', start);
  assert(open >= 0, `${name}() has a body`);
  let depth = 0;
  for (let i = open; i < main.length; i += 1) {
    if (main[i] === '{') depth += 1;
    if (main[i] === '}') depth -= 1;
    if (depth === 0) return main.slice(open + 1, i);
  }
  throw new Error(`${name}() body did not close`);
}

const previewInputBody = extractFunction('previewInput');
const guardIndex = previewInputBody.search(/if\s*\(\s*!\s*TRACKS\s*\[\s*4\s*\]\s*\.\s*smp\s*\)/);
const toastIndex = previewInputBody.search(/toast\s*\(\s*['"][^'"]*load[^'"]*sample[^'"]*first[^'"]*['"]\s*\)/i);
const returnAfterToastIndex = previewInputBody.slice(Math.max(0, toastIndex)).search(/return\s*;/);
const previewIndex = previewInputBody.search(/previewVoice\s*\(\s*4\s*,\s*synthInput\s*\)/);

assert(guardIndex >= 0, 'TEST INP empty path checks TRACKS[4].smp before previewing');
assert(toastIndex > guardIndex, 'TEST INP empty path shows load-a-sample feedback after the missing-sample guard');
assert(returnAfterToastIndex >= 0, 'TEST INP empty path returns after toast feedback');
assert(previewIndex > toastIndex, 'TEST INP loaded path remains after the empty-sample guard');
assert(previewInputBody.indexOf('initAudio') === -1, 'previewInput guard helper does not initialize/resume audio itself');
assert(previewInputBody.indexOf('triggerCompGate') === -1, 'previewInput guard helper does not trigger compressor itself');
assert(previewInputBody.indexOf('synthInput') === previewIndex + previewInputBody.slice(previewIndex).indexOf('synthInput'), 'previewInput reaches synthInput only through previewVoice on the loaded path');

assert(/querySelector\(\s*['"]\[data-voice-test="input"\]['"]\s*\)\.addEventListener\(\s*['"]click['"]\s*,\s*\(\s*\)\s*=>\s*previewInput\s*\(\s*\)\s*\)/.test(main), 'TEST INP button uses the sample-aware previewInput helper');

console.log('Issue 003 input TEST sample-aware static checks passed.');
