#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} exists`);
  let depth = 0;
  let seenBody = false;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') {
      depth++;
      seenBody = true;
    } else if (source[i] === '}') {
      depth--;
      if (seenBody && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} body not found`);
}

const riPanelStart = html.indexOf('id="riPanel"');
assert(riPanelStart >= 0, 'RI panel exists');
assert(/<div class="ve-lbl">PUMP<\/div>/.test(html), 'RI pump/arousal row is labeled PUMP, not a separate neuroscience row');
assert(html.indexOf('id="riPumpCue"') > riPanelStart, 'RI panel exposes a compact pump/body cue sentence');
assert(/class="[^"]*ri-read[^"]*"[^>]*id="riPumpCue"/.test(html), 'pump cue uses compact RI readout styling');

const renderRI = extractFunction(main, 'renderRhythmIntelligence');
assert(renderRI.includes("$('riPumpCue')"), 'render targets the pump cue sentence');
assert(/\$\('riPumpCue'\)\.textContent\s*=\s*analysis\.pumpArousal\.cue/.test(renderRI), 'render writes embodied pump cue with textContent');
assert(!/new\s+AudioContext|webkitAudioContext|initAudio\(|A\.resume\(|runSch\(|S\.playing\s*=\s*true/.test(renderRI), 'RI pump cue rendering stays pure and never unlocks audio');

console.log('Issue 001 RI pump cue UI checks passed.');
