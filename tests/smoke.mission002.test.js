#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = '/storage/emulated/0/Download/bighart-beat-v4-studio-2.html';
const indexPath = path.join(root, 'index.html');
const jsPath = path.join(root, 'src', 'main.js');
const cssPath = path.join(root, 'styles', 'main.css');

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  }
}

function readRequired(filePath) {
  assert(fs.existsSync(filePath), `${path.relative(root, filePath)} exists`);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function extractBetween(text, start, end, label) {
  const startIdx = text.indexOf(start);
  const endIdx = text.indexOf(end, startIdx + start.length);
  assert(startIdx !== -1 && endIdx !== -1, `canonical source has ${label}`);
  return startIdx !== -1 && endIdx !== -1
    ? text.slice(startIdx + start.length, endIdx).trim()
    : '';
}

const source = readRequired(sourcePath);
const index = readRequired(indexPath);
const js = readRequired(jsPath);
const css = readRequired(cssPath);

const canonicalCss = extractBetween(source, '<style>', '</style>', 'inline style block');
const canonicalJs = extractBetween(source, '<script>', '</script>', 'inline script block');
assert(css.trim() === canonicalCss, 'styles/main.css exactly matches canonical <style> content');
assert(js.trim() === canonicalJs, 'src/main.js exactly matches canonical <script> content');

assert(index.includes('<link rel="stylesheet" href="styles/main.css">'), 'index links styles/main.css');
assert(index.includes('<script src="src/main.js" defer></script>'), 'index loads src/main.js with defer');
assert(!index.includes('<style>'), 'index has no inline style block');
assert(!index.includes('<script>'), 'index has no inline script block');

const requiredIndexMarkers = [
  'RESONANT SYSTEMS',
  'BIGHART BEAT',
  'ENGAGE',
  'id="startBtn"',
  'id="playBtn"',
  'id="stopBtn"',
  'id="seq"',
  'id="mix"',
  'id="vePanel"',
  'class="fx-grid"',
  'id="ovu"',
  'id="smpFile"'
];
for (const marker of requiredIndexMarkers) {
  assert(index.includes(marker), `index preserves canonical marker ${marker}`);
  assert(source.includes(marker), `canonical source contains marker ${marker}`);
}

const requiredJsRegexes = [
  [/\bconst\s+TRACKS\b/, 'const TRACKS'],
  [/\bconst\s+PATTERNS\b/, 'const PATTERNS'],
  [/\bconst\s+FX\b/, 'const FX'],
  [/\bconst\s+S\b/, 'const S'],
  [/\bfunction\s+initAudio\b/, 'function initAudio'],
  [/\bfunction\s+play\b/, 'function play'],
  [/\bfunction\s+stopPlay\b/, 'function stopPlay'],
  [/\bfunction\s+runSch\b/, 'function runSch'],
  [/\bfunction\s+fire\b/, 'function fire'],
  [/\bfunction\s+routeVoice\b/, 'function routeVoice'],
  [/\bfunction\s+buildSeq\b/, 'function buildSeq'],
  [/\bfunction\s+buildMix\b/, 'function buildMix'],
  [/\bfunction\s+buildVE\b/, 'function buildVE'],
  [/\bfunction\s+exportJSON\b/, 'function exportJSON'],
  [/\bfunction\s+importJSON\b/, 'function importJSON'],
  [/bighart_beat_v4_1/, 'bighart_beat_v4_1']
];
for (const [regex, label] of requiredJsRegexes) {
  assert(regex.test(js), `src/main.js preserves canonical ${label}`);
  assert(regex.test(source), `canonical source contains ${label}`);
}

const requiredCssRegexes = [
  [/:root\b/, ':root'],
  [/--amber\b/, '--amber'],
  [/#ss\b/, '#ss'],
  [/\.tx\b/, '.tx'],
  [/\.seq\b/, '.seq'],
  [/\.ctrl\b/, '.ctrl'],
  [/\.step\b/, '.step'],
  [/\.mix\b/, '.mix'],
  [/\.ve\b/, '.ve'],
  [/\.panel\b/, '.panel']
];
for (const [regex, label] of requiredCssRegexes) {
  assert(regex.test(css), `styles/main.css preserves canonical ${label}`);
  assert(regex.test(source), `canonical source contains CSS ${label}`);
}

assert(!/^\s*import\s+.*from\s+/m.test(js), 'main.js has no ES module import declarations');
assert(!/^\s*export\s+/m.test(js), 'main.js has no ES module export declarations');
assert(!index.includes('Mission 002 smoke marker aliases'), 'index has no fake smoke aliases');
assert(!js.includes('Mission 002 smoke marker aliases'), 'main.js has no fake smoke aliases');
assert(!css.includes('Mission 002 smoke marker aliases'), 'css has no fake smoke aliases');

if (process.exitCode) process.exit(process.exitCode);
console.log('Mission 002 smoke/parity checks passed.');
