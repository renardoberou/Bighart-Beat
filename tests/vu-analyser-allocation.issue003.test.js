#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function functionBody(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start !== -1, `${name}() should exist`);
  const open = source.indexOf('{', start);
  assert(open !== -1, `${name}() should have a body`);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) return source.slice(open + 1, i);
  }
  assert.fail(`${name}() body should close`);
}

const uiLoopBody = functionBody(js, 'uiLoop');

assert(
  !/new\s+Uint8Array\s*\(/.test(uiLoopBody),
  'uiLoop hot path must reuse a cached analyser frequency buffer instead of allocating Uint8Array every frame'
);

assert(
  !/querySelectorAll\s*\(\s*['"]\.ovu-s['"]\s*\)/.test(uiLoopBody),
  'uiLoop hot path must reuse cached .ovu-s segment refs instead of querying them every frame'
);

assert(
  /function\s+(resetOutputVuCache|refreshOutputVuCache|ensureOutputVuCache)\s*\(/.test(js),
  'output VU caching should have a named cache/reset helper for maintainability'
);

assert(
  /getByteFrequencyData\s*\(\s*[^)]*vu/i.test(uiLoopBody) || /getByteFrequencyData\s*\(\s*[^)]*output/i.test(uiLoopBody),
  'uiLoop should still feed analyser data into the cached VU buffer each frame'
);

assert(
  /\.classList\.toggle\s*\(\s*['"]on['"]/.test(uiLoopBody) || /\.classList\.(?:add|remove)\s*\(\s*['"]on['"]/.test(uiLoopBody),
  'uiLoop should continue toggling .on state on output VU segments'
);

console.log('Issue 003 output VU analyser allocation/cache checks passed.');
