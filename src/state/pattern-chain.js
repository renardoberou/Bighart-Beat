'use strict';

(function (root) {
  const BANK_COUNT = 4;
  const MIN_BARS = 1;
  const MAX_BARS = 16;

  function clonePatternChain(chain) {
    return normalizePatternChain(chain || createDefaultPatternChain());
  }

  function createDefaultPatternChain() {
    return {
      enabled: false,
      position: 0,
      barCount: 0,
      items: [
        { pattern: 0, bars: 1 },
        { pattern: 1, bars: 1 },
        { pattern: 2, bars: 1 },
        { pattern: 3, bars: 1 },
      ],
    };
  }

  function isLegacyDefaultPatternChain(items) {
    return items.length === 4 &&
      items[0].pattern === 0 && items[0].bars === 1 &&
      items[1].pattern === 1 && items[1].bars === 1 &&
      items[2].pattern === 2 && items[2].bars === 1 &&
      items[3].pattern === 0 && items[3].bars === 1;
  }

  function assertPatternIndex(pattern, path) {
    if (!Number.isInteger(pattern) || pattern < 0 || pattern >= BANK_COUNT) {
      throw new TypeError(path + '.pattern must be an integer from 0 to 3');
    }
  }

  function assertBars(bars, path) {
    if (!Number.isInteger(bars) || bars < MIN_BARS || bars > MAX_BARS) {
      throw new TypeError(path + '.bars must be an integer from 1 to 16');
    }
  }

  function normalizePatternChain(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new TypeError('patternChain must be an object');
    }
    if (typeof input.enabled !== 'boolean') {
      throw new TypeError('patternChain.enabled must be a boolean');
    }
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 8) {
      throw new TypeError('patternChain.items must contain 1 to 8 items');
    }
    const items = input.items.map((item, index) => {
      const path = 'patternChain.items[' + index + ']';
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new TypeError(path + ' must be an object');
      }
      assertPatternIndex(item.pattern, path);
      assertBars(item.bars, path);
      return { pattern: item.pattern, bars: item.bars };
    });
    if (!Number.isInteger(input.position) || input.position < 0 || input.position >= items.length) {
      throw new TypeError('patternChain.position must point at an item');
    }
    const activeBars = items[input.position].bars;
    if (!Number.isInteger(input.barCount) || input.barCount < 0 || input.barCount >= activeBars) {
      throw new TypeError('patternChain.barCount must be within the active item duration');
    }
    if (isLegacyDefaultPatternChain(items)) items[3] = { pattern: 3, bars: 1 };
    return {
      enabled: input.enabled,
      position: input.position,
      barCount: input.barCount,
      items,
    };
  }

  function setPatternChainEnabled(chain, enabled) {
    const normalized = normalizePatternChain(chain);
    normalized.enabled = !!enabled;
    normalized.barCount = 0;
    return normalized;
  }

  function setPatternChainItem(chain, index, item) {
    const normalized = normalizePatternChain(chain);
    if (!Number.isInteger(index) || index < 0 || index >= normalized.items.length) {
      throw new TypeError('patternChain item index is out of range');
    }
    assertPatternIndex(item && item.pattern, 'patternChain.items[' + index + ']');
    assertBars(item && item.bars, 'patternChain.items[' + index + ']');
    normalized.items[index] = { pattern: item.pattern, bars: item.bars };
    if (normalized.position === index && normalized.barCount >= item.bars) normalized.barCount = 0;
    return normalized;
  }

  function advancePatternChainBar(chain, currentPattern) {
    const normalized = normalizePatternChain(chain);
    if (!normalized.enabled) {
      return { chain: normalized, pattern: currentPattern, changed: false };
    }
    const item = normalized.items[normalized.position];
    const nextBarCount = normalized.barCount + 1;
    if (nextBarCount < item.bars) {
      normalized.barCount = nextBarCount;
      return { chain: normalized, pattern: currentPattern, changed: false };
    }
    normalized.position = (normalized.position + 1) % normalized.items.length;
    normalized.barCount = 0;
    const pattern = normalized.items[normalized.position].pattern;
    return { chain: normalized, pattern, changed: pattern !== currentPattern };
  }

  function cuePatternChain(chain, pattern) {
    const normalized = normalizePatternChain(chain);
    assertPatternIndex(pattern, 'patternChain.manualCue');
    const match = normalized.items.findIndex(item => item.pattern === pattern);
    if (match >= 0) normalized.position = match;
    normalized.barCount = 0;
    return { chain: normalized, pattern, changed: true };
  }

  function describePatternChainStatus(chain) {
    const normalized = normalizePatternChain(chain);
    if (!normalized.enabled) return 'CHAIN OFF';
    const item = normalized.items[normalized.position];
    const nextItem = normalized.items[(normalized.position + 1) % normalized.items.length];
    return 'ABCD'[item.pattern] + ' ' + (normalized.barCount + 1) + '/' + item.bars + ' → ' + 'ABCD'[nextItem.pattern];
  }

  const api = {
    createDefaultPatternChain,
    clonePatternChain,
    normalizePatternChain,
    setPatternChainEnabled,
    setPatternChainItem,
    advancePatternChainBar,
    cuePatternChain,
    describePatternChainStatus,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BighartBeatState = Object.assign(root.BighartBeatState || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
