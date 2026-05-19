#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const actionVariationStart = main.indexOf('function createRhythmActionVariation()');
assert(actionVariationStart >= 0, 'runtime defines the Brain Loop rhythm action variation path');
const controlledVariationStart = main.indexOf('function createControlledPatternVariation()', actionVariationStart);
assert(controlledVariationStart > actionVariationStart, 'runtime keeps the controlled pattern variation after the Brain Loop action path');
const actionVariationBody = main.slice(actionVariationStart, controlledVariationStart);

assert(
  /action\.edit\.trackId\s*===\s*'hihat'[\s\S]*action\.edit\.active/.test(actionVariationBody),
  'Brain Loop detects active hihat edits after applying an analysis action'
);
assert(
  /const\s+hihatPreviewOpen\s*=\s*action\.edit\.hihatOpen\s*\?\?\s*HHT_PLACE/.test(actionVariationBody),
  'Brain Loop hihat audition uses the exact hihat openness written by the action when available'
);
assert(
  /previewHihat\(hihatPreviewOpen\)/.test(actionVariationBody),
  'Brain Loop hihat additions audition through the real hihat preview path'
);
assert(
  /heard\s+hat/i.test(actionVariationBody),
  'Brain Loop toast tells mobile players the hihat action was audibly confirmed'
);

console.log('Brain Loop hihat audition issue001/003 checks passed');
