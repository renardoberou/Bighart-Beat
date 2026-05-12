#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const rhythm = fs.readFileSync(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'), 'utf8');

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
const interpretationIndex = html.indexOf('id="riInterpretation"');
assert(riPanelStart >= 0, 'RI panel exists');
assert(interpretationIndex > riPanelStart, 'RI interpretation is rendered inside/after the RI label rows');
assert(html.includes('aria-live="polite"'), 'RI panel remains polite for accessible updates');
assert(/class="[^"]*ri-read[^"]*"[^>]*id="riInterpretation"/.test(html), 'RI interpretation has compact styling hook');

const renderRI = extractFunction(main, 'renderRhythmIntelligence');
assert(/const\s+analysis\s*=\s*Rhythm\.analyzeRhythm/.test(renderRI), 'render keeps the full analysis object');
assert(/const\s+labels\s*=\s*analysis\.labels/.test(renderRI), 'render derives labels from the analysis object');
assert(renderRI.includes("$('riInterpretation')"), 'render targets the RI interpretation element');
assert(/\$\('riInterpretation'\)\.textContent\s*=\s*analysis\.interpretation/.test(renderRI), 'render writes interpretation with textContent');

assert(!/^export\s+/m.test(rhythm), 'rhythm intelligence remains browser script compatible');
assert(rhythm.includes('root.BighartBeatRhythm'), 'browser global rhythm API remains exposed');
assert(/labels,\s*interpretation:\s*makeInterpretation\(metrics, labels, totalWeight\)/.test(rhythm), 'analysis returns labels plus interpretation');

console.log('Rhythm intelligence UI interpretation checks passed.');
