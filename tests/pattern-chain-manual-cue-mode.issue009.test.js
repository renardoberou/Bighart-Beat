#!/usr/bin/env node
'use strict';

const assert = require('assert');
const State = require('../src/state/pattern-chain.js');

const defaultChain = State.createDefaultPatternChain();
assert.strictEqual(defaultChain.manualCueMode, 'continue', 'pattern chain defaults to continuing after manual cues');

const legacyChain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 0,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }],
});
assert.strictEqual(legacyChain.manualCueMode, 'continue', 'legacy chains without manualCueMode hydrate to continue mode');

assert.throws(
  () => State.normalizePatternChain({
    enabled: true,
    position: 0,
    barCount: 0,
    manualCueMode: 'pause',
    items: [{ pattern: 0, bars: 1 }],
  }),
  /patternChain\.manualCueMode/,
  'invalid manual cue modes are rejected'
);

assert.strictEqual(typeof State.setPatternChainManualCueMode, 'function', 'manual cue mode setter is exported');

const programmed = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 0,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }],
});
const holdChain = State.setPatternChainManualCueMode(programmed, 'hold');
assert.strictEqual(holdChain.manualCueMode, 'hold', 'setter applies hold mode');
assert.strictEqual(programmed.manualCueMode, 'continue', 'setter does not mutate the source chain');
assert.deepStrictEqual(holdChain.items, programmed.items, 'setter preserves the programmed queue');

let result = State.cuePatternChain(holdChain, 1);
assert.strictEqual(result.pattern, 1, 'hold mode queued manual cue jumps immediately');
assert.strictEqual(result.chain.position, 1, 'hold mode queued manual cue can rebase to the matching item');
assert.strictEqual(result.chain.manualOverridePattern, 1, 'hold mode stores the held manual pattern even when it is queued');
let advanced = State.advancePatternChainBar(result.chain, result.pattern);
assert.strictEqual(advanced.pattern, 1, 'hold mode keeps the manually cued queued pattern on bar advance');
assert.strictEqual(advanced.changed, false, 'hold mode reports no change while holding the current pattern');
assert.strictEqual(advanced.chain.position, 1, 'hold mode does not advance the chain cursor');
assert.strictEqual(advanced.chain.manualOverridePattern, 1, 'hold mode keeps the held queued manual override');

result = State.cuePatternChain(holdChain, 3);
assert.strictEqual(result.pattern, 3, 'hold mode non-queued manual cue jumps immediately');
assert.strictEqual(result.chain.position, 0, 'hold mode non-queued manual cue preserves the programmed cursor');
assert.strictEqual(result.chain.manualOverridePattern, 3, 'hold mode stores non-queued manual cue as held override');
advanced = State.advancePatternChainBar(result.chain, result.pattern);
assert.strictEqual(advanced.pattern, 3, 'hold mode keeps non-queued manual cue on bar advance');
assert.strictEqual(advanced.changed, false, 'hold mode non-queued hold reports no pattern change');
assert.strictEqual(advanced.chain.position, 0, 'hold mode non-queued cue does not advance cursor');
assert.strictEqual(advanced.chain.manualOverridePattern, 3, 'hold mode keeps non-queued held override');
assert(/D/.test(State.describePatternChainStatus(advanced.chain)) && /HOLD/.test(State.describePatternChainStatus(advanced.chain)), 'hold mode status names the held pattern and HOLD state');

const resume = State.setPatternChainManualCueMode(advanced.chain, 'continue');
advanced = State.advancePatternChainBar(resume, 3);
assert.strictEqual(advanced.chain.manualOverridePattern, null, 'switching hold to continue clears held override at the next bar boundary');
assert.strictEqual(advanced.pattern, 1, 'switching hold to continue resumes the programmed chain on the next bar boundary');

assert.throws(() => State.setPatternChainManualCueMode(programmed, 'pause'), /patternChain\.manualCueMode/, 'setter rejects invalid mode');

console.log('pattern chain manual cue mode issue009 tests passed');
