#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');

const toggleHandlerMatch = main.match(/\$\('chainToggle'\)\.addEventListener\('click', \(\) => \{[\s\S]*?\n  \}\);/);
assert(toggleHandlerMatch, 'chain toggle click handler exists');
const toggleHandler = toggleHandlerMatch[0];

assert(/const\s+nextEnabled\s*=\s*!S\.patternChain\.enabled/.test(toggleHandler), 'chain toggle captures the target enabled state before toggling');
assert(/State\.setPatternChainEnabled\(S\.patternChain,\s*nextEnabled\)/.test(toggleHandler), 'chain toggle applies the captured enabled state');
assert(/if\s*\(nextEnabled\)\s*\{[\s\S]*State\.cuePatternChain\(S\.patternChain,\s*S\.patt\)\.chain[\s\S]*\}/.test(toggleHandler), 'enabling chain rebases the queue cursor to the currently selected pattern');
assert(!/selectPattern\(/.test(toggleHandler), 'enabling chain must not jump or rebuild the audible pattern directly');
assert(/syncPatternChainControls\(\)/.test(toggleHandler), 'chain toggle still refreshes queue controls');
assert(/autosave\(\)/.test(toggleHandler), 'chain toggle still persists the queue state');

console.log('pattern chain enable-current cue issue009 checks passed');
