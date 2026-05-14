#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/main.css'), 'utf8');

assert(/id="chainStatus"/.test(html), 'chain strip exposes a compact chainStatus readout');
assert(/id="chainStatus"[^>]*aria-live="polite"/.test(html), 'chainStatus uses polite live updates for accessibility');
assert(/class="chain-status"/.test(html), 'chainStatus has a dedicated compact CSS class');
assert(/chainStatus/.test(main), 'runtime references the chainStatus element');
assert(/State\.describePatternChainStatus\(chain\)/.test(main), 'runtime uses pure State.describePatternChainStatus helper');
assert(/\$\('chainStatus'\)\.textContent = State\.describePatternChainStatus\(chain\)/.test(main), 'syncPatternChainControls writes current status text');
assert(/maybeAdvancePatternChain\(\)[\s\S]*syncPatternChainControls\(\)/.test(main), 'bar-boundary chain advancement refreshes status');
assert(/selectPattern[\s\S]*syncPatternChainControls\(\)[\s\S]*syncPatternButtons/.test(main), 'manual cue path refreshes status before rebuilding pattern UI');
assert(/chainToggle[\s\S]*syncPatternChainControls\(\)/.test(main), 'chain toggle refreshes status');
assert(/cyclePatternChainSlot\(slot\)[\s\S]*syncPatternChainControls\(\)/.test(main), 'slot pattern tap refreshes status');
assert(/cyclePatternChainSlotBars\(slot\)[\s\S]*syncPatternChainControls\(\)/.test(main), 'slot bar hold refreshes status');
assert(/\.chain-status/.test(css), 'CSS defines compact chain status styling');
assert(/\.chain-status[\s\S]*white-space:\s*nowrap/.test(css), 'chain status stays one-line for mobile top controls');
assert(/\.chain-status[\s\S]*font-size/.test(css), 'chain status uses explicit compact text sizing');

console.log('pattern chain status runtime issue009 tests passed');
