#!/usr/bin/env node
'use strict';

const assert = require('assert');
const State = require('../src/state/pattern-chain.js');

assert.strictEqual(
  State.describePatternChainStatus(State.createDefaultPatternChain()),
  'CHAIN OFF',
  'disabled chain reports CHAIN OFF'
);

let chain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 0,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 3, bars: 1 }],
});
assert.strictEqual(
  State.describePatternChainStatus(chain),
  'A 1/1 → B',
  'enabled one-bar chain reports current bar and next pattern'
);

chain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 1,
  items: [{ pattern: 0, bars: 2 }, { pattern: 1, bars: 4 }, { pattern: 3, bars: 1 }],
});
assert.strictEqual(
  State.describePatternChainStatus(chain),
  'A 2/2 → B',
  'multi-bar chain reports elapsed bar progress using one-based display'
);

chain = State.normalizePatternChain({
  enabled: true,
  position: 2,
  barCount: 0,
  items: [{ pattern: 0, bars: 2 }, { pattern: 1, bars: 4 }, { pattern: 3, bars: 1 }],
});
assert.strictEqual(
  State.describePatternChainStatus(chain),
  'D 1/1 → A',
  'final chain slot status wraps next pattern to the first slot'
);

chain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 1,
  items: [{ pattern: 0, bars: 2 }, { pattern: 2, bars: 1 }, { pattern: 0, bars: 1 }],
});
const cue = State.cuePatternChain(chain, 2);
assert.strictEqual(
  State.describePatternChainStatus(cue.chain),
  'C 1/1 → A',
  'manual cue reset is visible as bar 1 of the selected chain slot'
);

chain = State.normalizePatternChain({
  enabled: true,
  position: 0,
  barCount: 0,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }],
});
const unmatchedCue = State.cuePatternChain(chain, 3);
assert.strictEqual(
  unmatchedCue.pattern,
  3,
  'manual cue can jump to a pattern that is not in the programmed chain'
);
assert.strictEqual(
  State.describePatternChainStatus(unmatchedCue.chain),
  'D 1/1 → B',
  'manual cue outside the queue is visible as the current override before chain continuation'
);
const continuedCue = State.advancePatternChainBar(unmatchedCue.chain, unmatchedCue.pattern);
assert.strictEqual(
  continuedCue.pattern,
  1,
  'after the manual override bar, chain continues to the next programmed item'
);
assert.strictEqual(
  State.describePatternChainStatus(continuedCue.chain),
  'B 1/1 → A',
  'status returns to the programmed chain after the manual override advances'
);

const legacyDefaultChain = State.normalizePatternChain({
  enabled: true,
  position: 3,
  barCount: 0,
  items: [{ pattern: 0, bars: 1 }, { pattern: 1, bars: 1 }, { pattern: 2, bars: 1 }, { pattern: 0, bars: 1 }],
});
assert.strictEqual(
  State.describePatternChainStatus(legacyDefaultChain),
  'D 1/1 → A',
  'legacy default A/B/C/A import status normalizes safely to D then A'
);

console.log('pattern chain status issue009 tests passed');
