#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = js.indexOf(marker);
  assert(start !== -1, `${name} function exists`);
  const bodyStart = js.indexOf('{', start);
  assert(bodyStart !== -1, `${name} function has body`);
  let depth = 0;
  for (let i = bodyStart; i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') depth--;
    if (depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`${name} function body did not close`);
}

function extractEngineSelectorBlock() {
  const marker = "$('engineSel').querySelectorAll('[data-engine]').forEach";
  const start = js.indexOf(marker);
  assert(start !== -1, 'engine selector click wiring exists');
  const endMarker = '  // delay';
  const end = js.indexOf(endMarker, start);
  assert(end !== -1, 'engine selector block ends before delay wiring');
  return js.slice(start, end);
}

const previewEngineKit = extractFunction('previewEngineKit');
assert(/if\s*\(\s*S\.playing\s*\)\s*return/.test(previewEngineKit), 'previewEngineKit is silent while transport is already playing');
assert(/initAudio\(\)/.test(previewEngineKit), 'previewEngineKit initializes/resumes audio before auditioning');
assert(/A\.currentTime\s*\+\s*\.0?\d+/.test(previewEngineKit), 'previewEngineKit schedules at a tiny currentTime offset');
assert(/TRACKS\[0\]/.test(previewEngineKit), 'previewEngineKit uses current kick track settings');
assert(/TRACKS\[1\]/.test(previewEngineKit), 'previewEngineKit uses current snare track settings');
assert(/TRACKS\[2\]/.test(previewEngineKit), 'previewEngineKit uses current hihat track settings');
assert(/synthKick\s*\(/.test(previewEngineKit), 'previewEngineKit auditions kick through real synthKick');
assert(/synthSnare\s*\(/.test(previewEngineKit), 'previewEngineKit auditions snare through real synthSnare');
assert(/synthHihat\s*\(/.test(previewEngineKit), 'previewEngineKit auditions hihat through real synthHihat');
assert(/triggerCompGate\s*\([^)]*kick\.id/.test(previewEngineKit), 'previewEngineKit opens comp gate for kick audition');
assert(/triggerCompGate\s*\([^)]*snare\.id/.test(previewEngineKit), 'previewEngineKit opens comp gate for snare audition');
assert(/triggerCompGate\s*\([^)]*hihat\.id/.test(previewEngineKit), 'previewEngineKit opens comp gate for hihat audition');
assert(/(?:Object\.assign\s*\(\s*\{\s*\}\s*,\s*hihat\.p\s*,\s*\{\s*open\s*:\s*HHT_PLACE|\{\s*\.\.\.\s*hihat\.p\s*,\s*open\s*:\s*HHT_PLACE\s*\})/.test(previewEngineKit), 'previewEngineKit auditions hihat with current quick placement openness');
assert(!/\b(?:play|runSch)\s*\(/.test(previewEngineKit), 'previewEngineKit must not start the transport/scheduler');
assert(!/S\.playing\s*=\s*true/.test(previewEngineKit), 'previewEngineKit must not mark transport as playing');
assert(!/PATTERNS\s*\[/.test(previewEngineKit), 'previewEngineKit must not mutate pattern data');

const engineBlock = extractEngineSelectorBlock();
assert(/State\.ENGINES\.includes\(b\.dataset\.engine\)/.test(engineBlock), 'engine selector still validates canonical engines before mutation');
assert(/S\.engine\s*=\s*b\.dataset\.engine/.test(engineBlock), 'engine selector assigns selected engine');
assert(/syncEngineSelector\(\)/.test(engineBlock), 'engine selector still updates visual selected state');
assert(/previewEngineKit\(\)/.test(engineBlock), 'engine selector auditions the newly selected engine');
assert(engineBlock.indexOf('S.engine = b.dataset.engine') < engineBlock.indexOf('previewEngineKit()'), 'engine audition happens after the new engine is assigned');
assert(/autosave\(\)/.test(engineBlock), 'engine selector still persists selection');

console.log('Issue 003 engine audition checks passed.');
