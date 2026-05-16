#!/usr/bin/env node
'use strict';

const assert = require('assert');
const State = require('../src/state/pattern-chain.js');
const Patterns = require('../src/state/patterns.js');
const Tracks = require('../src/state/tracks.js');
const Fx = require('../src/state/fx-state.js');
const App = require('../src/state/app-state.js');
const Persistence = require('../src/state/persistence.js');

function assertDeepFrozenCopy(value, expected, message) {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(value)), expected, message);
}

const defaultChain = State.createDefaultPatternChain();
assertDeepFrozenCopy(defaultChain, {
  enabled: false,
  position: 0,
  barCount: 0,
  manualOverridePattern: null,
  items: [
    { pattern: 0, bars: 1 },
    { pattern: 1, bars: 1 },
    { pattern: 2, bars: 1 },
    { pattern: 3, bars: 1 },
  ],
}, 'default pattern chain is disabled A→B→C→D with one bar per item');

let disabled = State.advancePatternChainBar(defaultChain, 2);
assert.strictEqual(disabled.pattern, 2, 'disabled chain keeps current manual pattern on bar advance');
assert.strictEqual(disabled.changed, false, 'disabled chain reports no pattern change');

let chain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 0,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 3, bars: 1 }],
});
let result = State.advancePatternChainBar(chain, 0);
assert.strictEqual(result.pattern, 1, 'enabled chain advances A→B on first one-bar boundary');
assert.strictEqual(result.chain.position, 1, 'chain cursor moves to B');
result = State.advancePatternChainBar(result.chain, result.pattern);
assert.strictEqual(result.pattern, 2, 'enabled chain advances B→C on next boundary');
result = State.advancePatternChainBar(result.chain, result.pattern);
assert.strictEqual(result.pattern, 3, 'enabled chain advances C→D on next boundary');
result = State.advancePatternChainBar(result.chain, result.pattern);
assert.strictEqual(result.pattern, 0, 'enabled chain wraps D→A');

const legacyDefaultChain = State.normalizePatternChain({
  enabled: true,
  position: 2,
  barCount: 0,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 0, bars: 1 }],
});
assert.deepStrictEqual(legacyDefaultChain, {
  enabled: true,
  position: 2,
  barCount: 0,
  manualOverridePattern: null,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 3, bars: 1 }],
}, 'exact legacy default A→B→C→A chain normalizes to A→B→C→D while preserving flags and cursor');

const customRepeatedAChain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 1,
  items: [{ pattern: 0, bars: 2 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 0, bars: 1 }],
});
assert.deepStrictEqual(customRepeatedAChain.items, [{ pattern: 0, bars: 2 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 0, bars: 1 }], 'custom chains that are not the exact old one-bar default are not migrated');

chain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 0,
  items: [{ pattern: 0, bars: 2 }, { pattern: 3, bars: 1 }],
});
result = State.advancePatternChainBar(chain, 0);
assert.strictEqual(result.pattern, 0, 'two-bar chain item holds pattern through first boundary');
assert.strictEqual(result.changed, false, 'two-bar hold does not report a changed pattern');
result = State.advancePatternChainBar(result.chain, result.pattern);
assert.strictEqual(result.pattern, 3, 'two-bar chain item advances on second boundary');
assert.strictEqual(result.changed, true, 'two-bar completion reports changed pattern');

chain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 1,
  items: [{ pattern: 0, bars: 2 }, { pattern: 2, bars: 1 }, { pattern: 0, bars: 1 }],
});
result = State.cuePatternChain(chain, 2);
assert.strictEqual(result.pattern, 2, 'manual cue returns selected pattern immediately');
assert.strictEqual(result.chain.position, 1, 'manual cue rebases cursor to matching chain item');
assert.strictEqual(result.chain.barCount, 0, 'manual cue resets elapsed bar count');
assert.deepStrictEqual(result.chain.items, chain.items, 'manual cue does not mutate programmed chain queue');
result = State.advancePatternChainBar(result.chain, result.pattern);
assert.strictEqual(result.pattern, 0, 'manual cue continues chain after selected item duration');

chain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 0,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }],
});
result = State.cuePatternChain(chain, 3);
assert.strictEqual(result.pattern, 3, 'manual cue outside the programmed queue still jumps immediately');
assert.strictEqual(result.chain.position, 0, 'manual cue outside the queue preserves the programmed chain cursor');
assert.strictEqual(result.chain.manualOverridePattern, 3, 'manual cue outside the queue stores a temporary visible override');
result = State.advancePatternChainBar(result.chain, result.pattern);
assert.strictEqual(result.pattern, 1, 'manual cue outside the queue continues to the next programmed chain item after one bar');
assert.strictEqual(result.chain.position, 1, 'manual cue outside the queue advances the programmed chain cursor after the override bar');
assert.strictEqual(result.chain.manualOverridePattern, null, 'manual cue override clears after chain continuation');

assert.throws(() => State.normalizePatternChain({ enabled: true, position: 0, barCount: 0, items: [{ pattern: 4, bars: 1 }] }), /pattern/i, 'invalid pattern index is rejected');
assert.throws(() => State.normalizePatternChain({ enabled: true, position: 0, barCount: 0, items: [{ pattern: 1, bars: 0 }] }), /bars/i, 'invalid bars count is rejected');
assert.throws(() => State.normalizePatternChain({ enabled: true, position: 0, barCount: 0, manualOverridePattern: 4, items: [{ pattern: 0, bars: 1 }] }), /manualOverridePattern/i, 'invalid manual override pattern is rejected');

const appState = App.createAppState();
appState.patternChain = State.normalizePatternChain({ enabled: true, position: 1, barCount: 0, items: [{ pattern: 0, bars: 1 }, { pattern: 3, bars: 2 }] });
const serialized = Persistence.serializeProject({
  appState,
  tracks: Tracks.createDefaultTracks(),
  fx: Fx.createDefaultFxState(),
  patterns: Patterns.createPatternBanks(),
});
assert.deepStrictEqual(serialized.patternChain, appState.patternChain, 'serializeProject persists patternChain from appState');
const parsed = Persistence.parseProjectImport(JSON.stringify(serialized));
assert.strictEqual(parsed.ok, true, 'parseProjectImport accepts serialized patternChain');
assert.deepStrictEqual(parsed.value.patternChain, appState.patternChain, 'parseProjectImport round-trips patternChain');

const legacyPersisted = JSON.parse(JSON.stringify(serialized));
legacyPersisted.patternChain = {
  enabled: true,
  position: 3,
  barCount: 0,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 0, bars: 1 }],
};
const parsedLegacyPersisted = Persistence.parseProjectImport(JSON.stringify(legacyPersisted));
assert.strictEqual(parsedLegacyPersisted.ok, true, 'legacy persisted default patternChain imports successfully');
assert.deepStrictEqual(parsedLegacyPersisted.value.patternChain, {
  enabled: true,
  position: 3,
  barCount: 0,
  manualOverridePattern: null,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 3, bars: 1 }],
}, 'legacy persisted default patternChain imports as A→B→C→D without losing enabled/cursor state');

delete serialized.patternChain;
const legacy = Persistence.parseProjectImport(JSON.stringify(serialized));
assert.strictEqual(legacy.ok, true, 'legacy project without patternChain imports successfully');
assert.deepStrictEqual(legacy.value.patternChain, State.createDefaultPatternChain(), 'legacy import hydrates default disabled pattern chain');

const malformed = JSON.parse(JSON.stringify(serialized));
malformed.patternChain = { enabled: 'yes', position: 0, barCount: 0, items: [{ pattern: 0, bars: 1 }] };
const rejected = Persistence.parseProjectImport(JSON.stringify(malformed));
assert.strictEqual(rejected.ok, false, 'malformed patternChain is rejected');
assert(rejected.errors.some(error => /patternChain\.enabled/.test(error)), 'malformed patternChain reports enabled validation error');

console.log('pattern chain issue009 tests passed');
