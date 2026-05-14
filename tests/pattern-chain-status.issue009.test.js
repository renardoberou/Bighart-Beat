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
