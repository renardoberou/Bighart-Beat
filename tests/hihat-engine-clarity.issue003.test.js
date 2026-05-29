#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

const hihatBranchStart = main.indexOf("} else if (tr.id === 'hihat') {");
assert(hihatBranchStart >= 0, 'buildVE has a hihat voice-edit branch');
const hihatBranchEnd = main.indexOf("} else if (tr.id === 'clap')", hihatBranchStart);
assert(hihatBranchEnd > hihatBranchStart, 'hihat branch can be inspected');
const hihatBranch = main.slice(hihatBranchStart, hihatBranchEnd);

assert(/hat-help/.test(hihatBranch), 'hihat editor renders a compact engine/help readout');
assert(/State\.abbreviateEngineId\(S\.engine\)/.test(hihatBranch) || /\$\{S\.engine\.toUpperCase\(\)\}/.test(hihatBranch), 'hihat readout shows the currently selected engine');
assert(/HAT TEST USES SELECTED ENGINE/.test(hihatBranch), 'hihat readout explains auditions use the selected engine');
assert(/OPENNESS IS PER STEP:\s*PLACE\/OHH ROW/.test(hihatBranch), 'hihat readout explains per-step openness placement via PLACE/OHH row');
assert(/HHT\/OHH:\s*TAP ACTIVE = ACC\s*·\s*DOUBLE-TAP CLEAR\s*·\s*HOLD = RATCHET/.test(hihatBranch), 'hihat readout explains active HHT/OHH tap/hold workflow');
assert(/data-open="0"/.test(hihatBranch) && /data-open="\.45"/.test(hihatBranch) && /data-open="1"/.test(hihatBranch), 'hihat audition closed/tight/open buttons remain present');
assert(/PLACE CLOSED/.test(hihatBranch) && /PLACE TIGHT/.test(hihatBranch) && /PLACE OPEN/.test(hihatBranch), 'hihat placement closed/tight/open buttons remain present');

const engineClickStart = main.indexOf("$('engineSel').querySelectorAll('[data-engine]')");
assert(engineClickStart >= 0, 'engine selector click handler exists');
const engineClickEnd = main.indexOf('\n\n  // delay', engineClickStart);
assert(engineClickEnd > engineClickStart, 'engine selector click handler can be inspected');
const engineClickBlock = main.slice(engineClickStart, engineClickEnd);
assert(/State\.ENGINES\.includes\(b\.dataset\.engine\)/.test(engineClickBlock), 'engine selector validates engine ids');
assert(/syncEngineSelector\(\)/.test(engineClickBlock), 'engine selector syncs button state');
assert(/TRACKS\[S\.sel\]\.id\s*===\s*['"]hihat['"][\s\S]*buildVE\(\)/.test(engineClickBlock), 'engine selector refreshes hihat editor readout when hihat is selected');
assert(/autosave\(\)/.test(engineClickBlock), 'engine selector still persists state');

assert(/\.hat-help\s*\{/.test(css), 'CSS styles the hihat engine/help readout');
assert(/\.hat-help-engine\s*\{/.test(css), 'CSS highlights the hihat engine label');
assert(/\.hat-test-b,\s*\n\.hat-place-b\s*\{[\s\S]*min-height:\s*40px/.test(css), 'hihat buttons keep thumb-friendly height');

console.log('Issue 003 hihat engine clarity checks passed.');
