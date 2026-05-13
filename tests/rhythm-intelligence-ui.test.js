#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const rhythm = fs.readFileSync(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

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
assert(html.indexOf('id="riBreath"') > riPanelStart, 'RI panel exposes pump breath cue');
assert(/<div class="ve-lbl">PUMP<\/div>/.test(html), 'RI pump cue uses compact PUMP label');
const riNoteMatch = html.match(/<div class="ri-note" id="riResearchNote">([^<]+)<\/div>/);
assert(riNoteMatch, 'RI panel exposes a compact in-app neuroscience research note');
const riNote = riNoteMatch[1];
assert(riNote.length <= 140, 'RI research note stays compact for the performance surface');
assert(/Groove/i.test(riNote), 'RI note names groove');
assert(/prediction error/i.test(riNote), 'RI note explains structured prediction error');
assert(/motor entrainment/i.test(riNote), 'RI note explains motor entrainment');
assert(/tension\/release/i.test(riNote), 'RI note names tension/release');
assert(!/(meterConfidence|surpriseTension|recoverability|neural|cognitive)/.test(riNote), 'RI note avoids internal or academic clutter');
assert(/\.ri-note\s*\{[\s\S]*?font-size:\s*10px[\s\S]*?line-height:\s*1\.35/.test(css), 'RI note has a compact mobile-safe styling hook');
assert(/grid-template-columns:\s*58px\s+1fr\s+7[6-9]px/.test(css), 'RI/voice value column fits breath timings on mobile');

const renderRI = extractFunction(main, 'renderRhythmIntelligence');
assert(/const\s+analysis\s*=\s*Rhythm\.analyzeRhythm/.test(renderRI), 'render keeps the full analysis object');
assert(/const\s+labels\s*=\s*analysis\.labels/.test(renderRI), 'render derives labels from the analysis object');
assert(/fx:\s*\{\s*comp:\s*FX\.comp\s*\}/.test(renderRI), 'render passes compressor state into rhythm analysis');
assert(renderRI.includes("$('riInterpretation')"), 'render targets the RI interpretation element');
assert(renderRI.includes("$('riBreath')"), 'render targets the RI breath cue element');
assert(/\$\('riInterpretation'\)\.textContent\s*=\s*analysis\.interpretation/.test(renderRI), 'render writes interpretation with textContent');
assert(/\$\('riBreath'\)\.textContent\s*=\s*analysis\.pumpArousal\.value/.test(renderRI), 'render writes pump breath cue with textContent');

const applyFXState = extractFunction(main, 'applyFXState');
assert(applyFXState.includes('renderRhythmIntelligence();'), 'FX changes refresh RI pump breath cue even before audio starts');

assert(!/^export\s+/m.test(rhythm), 'rhythm intelligence remains browser script compatible');
assert(rhythm.includes('root.BighartBeatRhythm'), 'browser global rhythm API remains exposed');
assert(/labels,\s*interpretation:\s*makeInterpretation\(metrics, labels, totalWeight\),\s*pumpArousal:/.test(rhythm), 'analysis returns labels, interpretation, and pump arousal');
assert(/const\s+api\s*=\s*\{\s*analyzeRhythm,\s*analyzePumpArousal,/.test(rhythm), 'pump arousal helper is exposed for tests and browser use');

console.log('Rhythm intelligence UI interpretation checks passed.');
