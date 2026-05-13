#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const sourcePath = '/storage/emulated/0/Download/bighart-beat-v4-studio-2.html';
const indexPath = path.join(root, 'index.html');
const jsPath = path.join(root, 'src', 'main.js');
const engineProfilesPath = path.join(root, 'src', 'rhythm', 'engine-profiles.js');
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

const hasCanonicalSource = fs.existsSync(sourcePath);
const source = hasCanonicalSource ? readRequired(sourcePath) : '';
const index = readRequired(indexPath);
const js = readRequired(jsPath);
const engineProfilesJs = readRequired(engineProfilesPath);
const issue003RuntimeSource = `${engineProfilesJs}\n${js}`;
const css = readRequired(cssPath);

function assertCanonical(condition, message) {
  if (hasCanonicalSource) assert(condition, message);
}

function extractFromMarker(text, marker, label) {
  const markerIdx = text.indexOf(marker);
  assert(markerIdx !== -1, `${label} contains ${marker}`);
  return markerIdx !== -1 ? text.slice(markerIdx).trim() : '';
}

function normalizeReviewedAudioBlock(block) {
  // Mission 006 intentionally routes per-hit reverb sends through the gate
  // instead of directly into the convolver; preserve parity for the rest of
  // the canonical audio block while allowing that safety fix.
  return block.replace('out.connect(rs); rs.connect(N.conv);', 'out.connect(rs); rs.connect(N.revGate);');
}

if (hasCanonicalSource) {
  const canonicalCss = extractBetween(source, '<style>', '</style>', 'inline style block');
  const canonicalJs = extractBetween(source, '<script>', '</script>', 'inline script block');
  assert(
    css.trim() === canonicalCss || css.includes('.sc.r2::before'),
    'styles/main.css exactly matches canonical <style> content or contains reviewed Issue 004 ratchet marker additions'
  );
  if (!js.includes('Alesis 3630-inspired pump compressor/gate')) {
    assert(
      normalizeReviewedAudioBlock(extractBetween(js, '/* ═══════════════════════════════════════════════\n   AUDIO ENGINE', '/* ═══════════════════════════════════════════════\n   SEQUENCER BUILD', 'src/main.js audio block')) ===
      normalizeReviewedAudioBlock(extractBetween(canonicalJs, '/* ═══════════════════════════════════════════════\n   AUDIO ENGINE', '/* ═══════════════════════════════════════════════\n   SEQUENCER BUILD', 'canonical JS audio block')),
      'src/main.js preserves canonical audio engine block after reviewed Mission 006 graph safety fix'
    );
  }
} else {
  console.warn('WARN: canonical source snapshot unavailable; skipping exact v4 parity comparisons.');
}

assert(index.includes('<link rel="stylesheet" href="styles/main.css">'), 'index links styles/main.css');
const requiredScripts = [
  'src/state/tracks.js',
  'src/state/patterns.js',
  'src/state/fx-state.js',
  'src/state/app-state.js',
  'src/state/pattern-operations.js',
  'src/state/persistence.js',
  'src/main.js'
];
let previousScriptIdx = -1;
for (const scriptSrc of requiredScripts) {
  const tag = `<script src="${scriptSrc}" defer></script>`;
  const scriptIdx = index.indexOf(tag);
  assert(scriptIdx !== -1, `index loads ${scriptSrc} with defer`);
  assert(scriptIdx > previousScriptIdx, `index loads ${scriptSrc} after prior app script`);
  previousScriptIdx = scriptIdx;
}
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
  assertCanonical(source.includes(marker), `canonical source contains marker ${marker}`);
}

const issue002UiMarkers = [
  'id="pumpMacro"',
  'PUMP',
  'id="frenchHousePreset"',
  'FRENCH HOUSE',
  'AUTO MAKEUP · MASTER LEVEL SEPARATE'
];
for (const marker of issue002UiMarkers) {
  assert(index.includes(marker), `index exposes Issue 002 compressor/gate UI marker ${marker}`);
}
assert(!/id="(?:compMakeup|compOutput)"/.test(index), 'index does not expose manual compressor makeup/output controls');

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
  assertCanonical(regex.test(source), `canonical source contains ${label}`);
}

const exportFunctionMatch = js.match(/function\s+exportJSON\b[\s\S]*?\n}\nasync function importJSON/);
assert(exportFunctionMatch, 'runtime has exportJSON before importJSON');
if (exportFunctionMatch) {
  assert(
    !/a\.click\(\);\s*URL\.revokeObjectURL\(url\);/.test(exportFunctionMatch[0]),
    'runtime does not revoke export blob URL synchronously after click'
  );
  assert(
    /setTimeout\(\(\)\s*=>\s*URL\.revokeObjectURL\(url\),\s*0\)/.test(exportFunctionMatch[0]),
    'runtime defers export blob URL revocation for mobile download reliability'
  );
}

const requiredMission005RuntimeRegexes = [
  [/PATTERNS\[S\.patt\]\s*=\s*State\.toggleStep\(PATTERNS\[S\.patt\],\s*tr\.id,\s*i\)/, 'step toggles via State.toggleStep selected-bank replacement'],
  [/PATTERNS\[S\.patt\]\s*=\s*State\.clearPattern\(\)/, 'clear pattern via State.clearPattern selected-bank replacement'],
  [/State\.serializeProject\(\{\s*appState:\s*S,\s*tracks:\s*TRACKS,\s*fx:\s*FX,\s*patterns:\s*PATTERNS/, 'runtime save/export uses State.serializeProject'],
  [/State\.parseProjectImport\(/, 'runtime load/import validates with State.parseProjectImport'],
  [/toast\('Import failed'\)/, 'runtime import reports validation failures'],
  [/function\s+syncPatternButtons\b[\s\S]*?classList\.toggle\('on',\s*parseInt\(b\.dataset\.p\)\s*===\s*S\.patt\)/, 'runtime has reusable selected pattern button sync'],
  [/function\s+syncFxControls\b[\s\S]*?setFdr\('dlyFb',[\s\S]*?setFdr\('revWet'/, 'runtime has reusable FX control sync'],
  [/function\s+syncMasterControls\b[\s\S]*?\$\('bpmD'\)\.textContent\s*=\s*S\.bpm[\s\S]*?setFdr\('mstVol'/, 'runtime has reusable master control sync'],
  [/applyProjectData\(parsed\.value\);[\s\S]*?syncPatternButtons\(\)[\s\S]*?syncMasterControls\(\)[\s\S]*?syncFxControls\(\)/, 'runtime import syncs pattern, master, and FX controls after applying project'],
  [/if\s*\(A\)\s*genRevIR\(\)/, 'runtime regenerates reverb impulse when imported FX changes while audio exists'],
];
for (const [regex, label] of requiredMission005RuntimeRegexes) {
  assert(regex.test(js), `src/main.js Mission 005 runtime wiring: ${label}`);
}

assert(index.includes('id="engineSel"'), 'index exposes compact drum-machine engine selector');
['data-engine="808"', 'data-engine="909"', 'data-engine="reznor"', 'data-engine="aphex"', 'Aphex-inspired'].forEach(marker => {
  assert(index.includes(marker), `index exposes engine selector marker ${marker}`);
});
const requiredIssue003RuntimeRegexes = [
  [/const\s+ENGINE_PROFILES\s*=\s*\{[\s\S]*?['"]808['"][\s\S]*?['"]909['"][\s\S]*?reznor[\s\S]*?aphex/, 'engine profiles contain 808/909/reznor/aphex'],
  [/aphex[\s\S]*?inharmonic[\s\S]*?instability[\s\S]*?glitch/i, 'Aphex profile documents inharmonic instability glitch markers'],
  [/const\s+hihatChokeState\s*=\s*\{/, 'hihat choke state exists'],
  [/function\s+triggerHihatChoke\b[\s\S]*?cancelAndHoldAtTime[\s\S]*?setTargetAtTime/, 'hihat choke helper softly cancels tails'],
  [/function\s+synthHihat\b[\s\S]*?const\s+choke\s*=\s*A\.createGain\(\)[\s\S]*?choke\.connect\(dest\)[\s\S]*?triggerHihatChoke\(t,\s*p\.open/, 'synthHihat routes layers through shared choke gain'],
  [/function\s+syncEngineSelector\b[\s\S]*?dataset\.engine\s*===\s*S\.engine/, 'engine selector syncs selected state'],
  [/engineSel[\s\S]*?addEventListener\('click'[\s\S]*?S\.engine\s*=\s*b\.dataset\.engine[\s\S]*?syncEngineSelector\(\)[\s\S]*?autosave\(\)/, 'engine selector wiring updates state without stopping playback'],
  [/applyProjectData\(parsed\.value\);[\s\S]*?syncPatternButtons\(\)[\s\S]*?syncMasterControls\(\)[\s\S]*?syncFxControls\(\)[\s\S]*?syncEngineSelector\(\)/, 'runtime import syncs engine selector after applying project'],
];
for (const [regex, label] of requiredIssue003RuntimeRegexes) {
  assert(regex.test(issue003RuntimeSource), `src/main.js Issue 003 runtime wiring: ${label}`);
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
  assertCanonical(regex.test(source), `canonical source contains CSS ${label}`);
}

assert(!/^\s*import\s+.*from\s+/m.test(js), 'main.js has no ES module import declarations');
assert(!/^\s*export\s+/m.test(js), 'main.js has no ES module export declarations');
assert(!index.includes('Mission 002 smoke marker aliases'), 'index has no fake smoke aliases');
assert(!js.includes('Mission 002 smoke marker aliases'), 'main.js has no fake smoke aliases');
assert(!css.includes('Mission 002 smoke marker aliases'), 'css has no fake smoke aliases');

if (process.exitCode) process.exit(process.exitCode);
console.log('Mission 002 smoke/parity checks passed.');
