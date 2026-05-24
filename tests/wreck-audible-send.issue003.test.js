#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = js.indexOf(marker);
  assert(start !== -1, `${name} function exists`);
  let depth = 0;
  const bodyStart = js.indexOf('{', start);
  for (let i = bodyStart; i < js.length; i++) {
    if (js[i] === '{') depth++;
    if (js[i] === '}') depth--;
    if (depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`${name} function body did not close`);
}

const hasWreckSend = extractFunction('hasWreckSend');
const hasAudibleWreckSend = extractFunction('hasAudibleWreckSend');
const shouldFeedWreckProcessor = extractFunction('shouldFeedWreckProcessor');
const wreckSendStatusText = extractFunction('wreckSendStatusText');
const routeVoice = extractFunction('routeVoice');
const buildMix = extractFunction('buildMix');

assert(/TRACKS\.some\([^)]*wreckS/.test(hasWreckSend), 'hasWreckSend remains a toggle predicate so the UI can distinguish no W sends from silent W sends');
assert(/TRACKS\.some\([^)]*wreckS[\s\S]*!\s*tr\.mute[\s\S]*tr\.vol\s*>\s*0/.test(hasAudibleWreckSend), 'hasAudibleWreckSend requires W enabled, unmuted, and non-zero track volume');
assert(/hasAudibleWreckSend\(\)/.test(shouldFeedWreckProcessor), 'processor feed predicate uses audible W sends, not mere W toggles');
assert(/!hasWreckSend\(\)/.test(wreckSendStatusText), 'status still reports the no-W-toggles case');
assert(/hasWreckSend\(\)[\s\S]*!hasAudibleWreckSend\(\)/.test(wreckSendStatusText), 'status distinguishes W toggled but currently silent');
assert(/W SENDS SILENT/.test(wreckSendStatusText), 'status has legible copy for muted/zero-volume W sends');
assert(/tr\.wreckS\s*&&\s*!\s*tr\.mute\s*&&\s*tr\.vol\s*>\s*0\s*&&\s*shouldFeedWreckProcessor\(\)/.test(routeVoice), 'routeVoice only connects the per-hit W send for audible W-enabled tracks');

const context = {
  TRACKS: [],
  FX: { wreck: { on: true, mix: 0.7, out: 0.8 } },
};
vm.runInNewContext(`${hasWreckSend}\n${hasAudibleWreckSend}\n${shouldFeedWreckProcessor}\n${wreckSendStatusText}\nthis.hasWreckSend = hasWreckSend;\nthis.hasAudibleWreckSend = hasAudibleWreckSend;\nthis.shouldFeedWreckProcessor = shouldFeedWreckProcessor;\nthis.wreckSendStatusText = wreckSendStatusText;`, context);

context.TRACKS = [{ wreckS: false, mute: false, vol: 1 }];
assert.strictEqual(context.hasWreckSend(), false, 'no W toggle is still detected separately');
assert.strictEqual(context.hasAudibleWreckSend(), false, 'a track without W enabled is not an audible W send');
assert.strictEqual(context.shouldFeedWreckProcessor(), false, 'processor does not feed when no W sends are toggled');
assert.strictEqual(context.wreckSendStatusText(), 'W SENDS OFF', 'status says off when no W sends are toggled');

context.TRACKS = [{ wreckS: true, mute: true, vol: 1 }];
assert.strictEqual(context.hasWreckSend(), true, 'muted W-enabled track still counts as toggled');
assert.strictEqual(context.hasAudibleWreckSend(), false, 'muted W-enabled track is not audible');
assert.strictEqual(context.shouldFeedWreckProcessor(), false, 'muted W-enabled track does not keep the processor fed');
assert.strictEqual(context.wreckSendStatusText(), 'W SENDS SILENT', 'status identifies muted W sends as silent rather than return-off');

context.TRACKS = [{ wreckS: true, mute: false, vol: 0 }];
assert.strictEqual(context.hasAudibleWreckSend(), false, 'zero-volume W-enabled track is not audible');
assert.strictEqual(context.shouldFeedWreckProcessor(), false, 'zero-volume W-enabled track does not keep the processor fed');
assert.strictEqual(context.wreckSendStatusText(), 'W SENDS SILENT', 'status identifies zero-volume W sends as silent');

context.TRACKS = [{ wreckS: true, mute: false, vol: 0.5 }];
assert.strictEqual(context.hasAudibleWreckSend(), true, 'unmuted non-zero W-enabled track is audible');
assert.strictEqual(context.shouldFeedWreckProcessor(), true, 'audible W send feeds processor when return is enabled');
assert.strictEqual(context.wreckSendStatusText(), 'WRECK SEND READY', 'status reports ready when send and return are audible');

context.FX.wreck.out = 0;
assert.strictEqual(context.shouldFeedWreckProcessor(), false, 'processor still respects inaudible WRECK return output');
assert.strictEqual(context.wreckSendStatusText(), 'WRECK RETURN OFF', 'audible W sends with inaudible return still report return off');

assert(/if\s*\(k\s*===\s*'wreckS'\s*\|\|\s*k\s*===\s*'mute'\)/.test(buildMix), 'W toggle and mute toggle refresh WRECK status/feed');
assert(/tr\.vol\s*=\s*fdr\.value\s*\/\s*100[\s\S]*updateWreckSendStatus\(\)[\s\S]*updateWreckProcessorFeed\(shouldFeedWreckProcessor\(\)\)/.test(buildMix), 'volume changes refresh WRECK status/feed');

console.log('Issue 003 audible WRECK send checks passed.');
