#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/main.css'), 'utf8');

assert(/nextSlot\s*=\s*\(chain\.position\s*\+\s*1\)\s*%\s*chain\.items\.length/.test(main), 'syncPatternChainControls computes the next queued slot');
assert(/classList\.toggle\('next'\s*,\s*chain\.enabled\s*&&\s*slot\s*===\s*nextSlot\)/.test(main), 'syncPatternChainControls marks the next queued slot');
assert(/queueHint[\s\S]*Next queued slot[\s\S]*aria-label[\s\S]*queueHint/.test(main), 'next queued slot is announced in its aria-label');
assert(/\.chain-slot-b\.next/.test(css), 'CSS styles the next queued chain slot');
assert(/\.chain-slot-b\.next[\s\S]*border-color:\s*var\(--amber\)/.test(css), 'next queued slot has a visible amber border distinct from active');
assert(/\.chain-slot-b\.next[\s\S]*box-shadow/.test(css), 'next queued slot has a subtle visible glow');

console.log('pattern chain next-slot marker issue009 tests passed');
