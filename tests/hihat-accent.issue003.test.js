#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const patterns = require(path.join(root, 'src', 'state', 'patterns.js'));
const ops = require(path.join(root, 'src', 'state', 'pattern-operations.js'));
const { analyzeRhythm } = require(path.join(root, 'src', 'rhythm', 'rhythm-intelligence.js'));
const { createAppState } = require(path.join(root, 'src', 'state', 'app-state.js'));
const { createDefaultTracks } = require(path.join(root, 'src', 'state', 'tracks.js'));
const { createDefaultFxState } = require(path.join(root, 'src', 'state', 'fx-state.js'));
const { serializeProject, parseProjectImport } = require(path.join(root, 'src', 'state', 'persistence.js'));

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

assert.strictEqual(typeof patterns.createDefaultHihatAccentGrid, 'function', 'patterns exposes default hihat accent grid');
assert.strictEqual(typeof patterns.createHihatAccentBanks, 'function', 'patterns exposes hihat accent banks');
assert.strictEqual(typeof patterns.cloneHihatAccentGrid, 'function', 'patterns exposes accent grid clone/normalize');
assert.strictEqual(typeof ops.getHihatAccent, 'function', 'operations exposes getHihatAccent');
assert.strictEqual(typeof ops.setHihatAccent, 'function', 'operations exposes setHihatAccent');
assert.strictEqual(typeof ops.toggleHihatAccent, 'function', 'operations exposes toggleHihatAccent');
assert.strictEqual(typeof ops.clearHihatAccent, 'function', 'operations exposes clearHihatAccent');

const empty = patterns.createDefaultHihatAccentGrid();
assert.deepStrictEqual(empty, Array(16).fill(0));
const banks = patterns.createHihatAccentBanks();
assert.strictEqual(banks.length, 4);
banks[0][2] = 1;
assert.strictEqual(banks[1][2], 0, 'accent banks are independent');
assert.deepStrictEqual(patterns.cloneHihatAccentGrid([1, true, '1', 0, 2, -1, null]), [1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'clone normalizes truthy accent steps safely');

let grid = ops.createDefaultHihatAccentGrid();
assert.strictEqual(ops.getHihatAccent(grid, 5), 0);
grid = ops.setHihatAccent(grid, 5, 1);
assert.strictEqual(ops.getHihatAccent(grid, 5), 1);
grid = ops.toggleHihatAccent(grid, 5);
assert.strictEqual(ops.getHihatAccent(grid, 5), 0);
grid = ops.toggleHihatAccent(grid, 5);
assert.strictEqual(ops.getHihatAccent(grid, 5), 1);
grid = ops.clearHihatAccent(grid, 5);
assert.strictEqual(ops.getHihatAccent(grid, 5), 0);
assert.throws(() => ops.setHihatAccent(grid, 16, 1), /step/i);
assert.throws(() => ops.setHihatAccent(grid, 0, 2), /accent/i);

const appState = createAppState();
const tracks = createDefaultTracks();
const fx = createDefaultFxState();
const patternBanks = patterns.createPatternBanks();
const accentBanks = patterns.createHihatAccentBanks();
accentBanks[2][7] = 1;
const serialized = serializeProject({ appState, tracks, fx, patterns: patternBanks, hihatAccent: accentBanks });
assert.deepStrictEqual(serialized.hihatAccent, accentBanks, 'serialize includes hihat accent banks');
serialized.hihatAccent[2][7] = 0;
assert.strictEqual(accentBanks[2][7], 1, 'serialize clones hihat accent banks');
const roundTrip = parseProjectImport(serializeProject({ appState, tracks, fx, patterns: patternBanks, hihatAccent: accentBanks }));
assert.strictEqual(roundTrip.ok, true, roundTrip.errors && roundTrip.errors.join('; '));
assert.strictEqual(roundTrip.value.hihatAccent[2][7], 1, 'import round-trips hihat accent banks');
const legacy = parseProjectImport(serializeProject({ appState, tracks, fx, patterns: patternBanks }));
assert.strictEqual(legacy.ok, true);
assert.deepStrictEqual(legacy.value.hihatAccent, patterns.createHihatAccentBanks(), 'legacy import hydrates empty accent banks');
const normalized = parseProjectImport({ ...serializeProject({ appState, tracks, fx, patterns: patternBanks }), hihatAccent: [[1, true, '1', 0, 2], [], [], []] });
assert.strictEqual(normalized.ok, true, normalized.errors && normalized.errors.join('; '));
assert.deepStrictEqual(normalized.value.hihatAccent[0].slice(0, 5), [1, 1, 1, 0, 0], 'import safely clamps/normalizes hihat accent banks');

function gridWith(hits) {
  const rhythmGrid = ops.createEmptyGrid();
  for (const [track, steps] of Object.entries(hits)) {
    for (const step of steps) rhythmGrid[track][step] = 1;
  }
  return rhythmGrid;
}

function accentsAt(steps) {
  const accentGrid = Array.from({ length: 16 }, () => 0);
  for (const step of steps) accentGrid[step] = 1;
  return accentGrid;
}

const rhythmPattern = gridWith({
  kick: [0, 8],
  snare: [4, 12],
  hihat: [2, 6, 10, 14],
});
const baseRhythm = analyzeRhythm({ bpm: 112, swing: 0, pattern: rhythmPattern, stepsPerBar: 16 });
const accentedRhythm = analyzeRhythm({
  bpm: 112,
  swing: 0,
  pattern: rhythmPattern,
  stepsPerBar: 16,
  hihatAccent: accentsAt([2, 3]),
});
assert.strictEqual(accentedRhythm.stepMetrics[2].hihatAccent, true, 'active accented hihat exposes hihatAccent marker');
assert.strictEqual(accentedRhythm.stepMetrics[3].hihatAccent, undefined, 'stale hihat accent on an inactive step is hidden');
assert(accentedRhythm.stepMetrics[2].weight > baseRhythm.stepMetrics[2].weight, 'active hihat accent increases the accented step weight');
assert(accentedRhythm.density > baseRhythm.density, 'active hihat accent contributes a small bounded weight to density');
assert(accentedRhythm.surpriseTension >= baseRhythm.surpriseTension, 'active offbeat hihat accent can add tension/drive effect');
assert(
  /hat (accent|spark)|spark/i.test(accentedRhythm.brainLoop.line),
  'Brain Loop line surfaces active hat accents in compact copy'
);
assert(accentedRhythm.brainLoop.line.length <= 90, 'Brain Loop accent copy stays compact for mobile');

const falsePositiveAccentGrid = accentsAt([]);
falsePositiveAccentGrid[2] = '0';
falsePositiveAccentGrid[6] = 'false';
const falsePositiveRhythm = analyzeRhythm({
  bpm: 112,
  swing: 0,
  pattern: rhythmPattern,
  stepsPerBar: 16,
  hihatAccent: falsePositiveAccentGrid,
});
assert.strictEqual(falsePositiveRhythm.stepMetrics[2].hihatAccent, undefined, 'string "0" hihat accent value does not expose marker on active hihat');
assert.strictEqual(falsePositiveRhythm.stepMetrics[6].hihatAccent, undefined, 'string "false" hihat accent value does not expose marker on active hihat');
assert.strictEqual(falsePositiveRhythm.stepMetrics[2].weight, baseRhythm.stepMetrics[2].weight, 'string "0" hihat accent value does not boost active hihat weight');
assert.strictEqual(falsePositiveRhythm.stepMetrics[6].weight, baseRhythm.stepMetrics[6].weight, 'string "false" hihat accent value does not boost active hihat weight');
assert.strictEqual(falsePositiveRhythm.density, baseRhythm.density, 'string falsey hihat accent values do not affect analysis density');
assert(!/hat (accent|spark)|spark/i.test(falsePositiveRhythm.brainLoop.line), 'string falsey hihat accent values do not surface in Brain Loop copy');

const staleOnlyRhythm = analyzeRhythm({
  bpm: 112,
  swing: 0,
  pattern: rhythmPattern,
  stepsPerBar: 16,
  hihatAccent: accentsAt([3, 7]),
});
assert.deepStrictEqual(
  staleOnlyRhythm.stepMetrics.map(metric => metric.hihatAccent),
  baseRhythm.stepMetrics.map(metric => metric.hihatAccent),
  'stale accents do not create step markers'
);
assert.strictEqual(staleOnlyRhythm.density, baseRhythm.density, 'stale accents do not affect analysis weight');
assert(!/hat (accent|spark)|spark/i.test(staleOnlyRhythm.brainLoop.line), 'stale accents do not surface in Brain Loop copy');

const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const renderRhythmIntelligence = extractFunction(main, 'renderRhythmIntelligence');
const analyzeCurrentRhythm = extractFunction(main, 'analyzeCurrentRhythm');
assert(/const\s+HHT_ACCENT\s*=\s*State\.createHihatAccentBanks\(\)/.test(main), 'runtime creates accent banks');
assert(/function\s+getStepHihatVelocity\s*\(\s*step\s*\)/.test(main), 'runtime has per-step hihat velocity helper');
assert(/State\.getHihatAccent\(HHT_ACCENT\[S\.patt\],\s*step\)/.test(main), 'velocity helper reads hihat accent grid');
assert(/case\s+['"]hihat['"]:[\s\S]*synthHihat\(t,\s*getStepHihatVelocity\(firingStep\)/.test(main), 'hihat runtime passes per-step velocity, not track volume, into synthHihat');
assert(!/case\s+['"]hihat['"]:[\s\S]*synthHihat\(t,\s*v,\s*\{\s*\.\.\.tr\.p,\s*open:\s*getStepHihatOpen/.test(main), 'hihat runtime no longer uses track vol as hihat character velocity');
assert(/previewHihat[\s\S]*synthHihat\(t,\s*HIHAT_NORMAL_VELOCITY/.test(main), 'hihat preview uses stable normal velocity');
assert(/hihatAccent:\s*HHT_ACCENT/.test(main), 'autosave/export include accent banks');
assert(/hihatAccent:\s*HHT_ACCENT\[S\.patt\]/.test(renderRhythmIntelligence), 'renderRhythmIntelligence passes current hihat accent grid into analysis');
assert(/hihatAccent:\s*HHT_ACCENT\[S\.patt\]/.test(analyzeCurrentRhythm), 'analyzeCurrentRhythm passes current hihat accent grid into action/quick analysis');
assert(/HHT_ACCENT\[i\]\s*=\s*State\.cloneHihatAccentGrid\(d\.hihatAccent\s*&&\s*d\.hihatAccent\[i\]\)/.test(main), 'applyProjectData clones imported accent banks');
assert(/HHT_ACCENT\[S\.patt\]\s*=\s*State\.createDefaultHihatAccentGrid\(\)/.test(main), 'clear pattern resets accent grid');
assert(/classList\.add\(['"]hht-accent['"]\)/.test(main), 'UI adds hht-accent marker class');
assert(/dataset\.acc\s*=\s*['"]ACC['"]/.test(main), 'UI adds data-acc marker');
assert(/toggleHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\)/.test(main), 'selected matching hihat tap toggles accent');
const openHihatClickBranch = main.match(/if \(isOpenHihatRow\) \{([\s\S]*?)\n        \}\n        if \(trackId === ['"]synth['"]/);
assert(openHihatClickBranch, 'OHH row click branch is present');
assert(/trackId\s*===\s*['"]hihat['"]\s*&&\s*wasOn/.test(openHihatClickBranch[1]), 'active OHH row click is handled before generic OHH off toggle even when another track is selected');
assert(/toggleHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\)/.test(openHihatClickBranch[1]), 'selected active OHH row click toggles accent');
assert(openHihatClickBranch[1].indexOf('toggleHihatAccent') < openHihatClickBranch[1].indexOf('toggleStep'), 'selected active OHH accent toggle runs before OHH row can toggle the step off');
assert(/clearHihatAccent\(HHT_ACCENT\[S\.patt\],\s*i\)/.test(main), 'turning hihat step off clears accent');
assert(/\.sc\.hht-accent/.test(css), 'accent marker has CSS');
assert(/hihat-open-body-20260522/.test(html), 'cache bust/version marker updated after hihat open-body slice');
console.log('Issue 003 hihat accent checks passed.');
