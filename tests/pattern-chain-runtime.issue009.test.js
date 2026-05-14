#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/main.css'), 'utf8');

assert(html.includes('src="src/state/pattern-chain.js"'), 'index.html loads the pattern-chain state module before main.js');
assert(html.includes('id="chainToggle"'), 'UI exposes a chain on/off toggle');
assert(html.includes('id="songQueue"'), 'UI exposes a song queue strip');
assert(html.includes('data-chain-pattern="0"') && html.includes('data-chain-pattern="3"'), 'UI exposes chain slots that can cycle A-D patterns');
assert(html.includes('id="patt"') && html.includes('class="patt-b on" data-p="0"') && html.includes('data-p="3"'), 'manual pattern buttons remain present');

assert(main.includes('function selectPattern('), 'runtime centralizes manual and chain pattern changes in selectPattern');
assert(/selectPattern\(parseInt\(b\.dataset\.p\)[\s\S]*source: 'manual'/.test(main), 'manual pattern buttons route through selectPattern as manual cues');
assert(main.includes("opts.source === 'manual' && S.patternChain && S.patternChain.enabled"), 'manual pattern buttons only rebase the chain cursor while CHAIN is enabled');
assert(main.includes('State.cuePatternChain'), 'manual pattern cue rebases the active chain instead of corrupting the queue');
assert(main.includes('function maybeAdvancePatternChain()'), 'runtime has a chain advancement hook');
assert(/const wasLastStep = sch === 15;[\s\S]*maybeAdvancePatternChain\(\)/.test(main), 'scheduler advances chain only after step 15 boundary');
assert(/maybeAdvancePatternChain\(\)[\s\S]*State\.advancePatternChainBar/.test(main), 'chain advancement uses pure State.advancePatternChainBar helper');
assert(/selectPattern\(result\.pattern,[\s\S]*source: 'chain'/.test(main), 'queued chain transitions reuse selectPattern');
assert(/selectPattern[\s\S]*syncPatternButtons\(\)[\s\S]*buildSeq\(\)[\s\S]*restorePatternFxScene\(S\.patt\)[\s\S]*renderRhythmIntelligence\(\)/.test(main), 'selectPattern keeps UI, FX latches, and rhythm intelligence in sync');
assert(main.includes('patternChain: S.patternChain'), 'autosave/export includes the pattern chain state');
assert(main.includes('S.patternChain = State.normalizePatternChain(d.patternChain'), 'imports normalize and apply pattern chain state');
assert(main.includes('function cyclePatternChainSlotBars(slot)'), 'runtime exposes a chain slot bar-length cycler');
assert(/cyclePatternChainSlotBars[\s\S]*State\.setPatternChainItem\(chain, slot, \{ pattern: item\.pattern, bars: nextBars \}\)/.test(main), 'bar-length cycler preserves pattern and updates only bars');
assert(/const CHAIN_SLOT_BAR_CHOICES = \[1, 2, 4, 8, 16\]/.test(main), 'bar-length cycler uses compact playable 1/2/4/8/16 bar choices');
assert(/data-chain-slot[\s\S]*pointerdown[\s\S]*setTimeout\([\s\S]*cyclePatternChainSlotBars/.test(main), 'chain slots support long-press to change bar length');
assert(/click[\s\S]*chainSlotLongPressed/.test(main), 'long-press bar change suppresses the follow-up click pattern cycle');
assert(/b\.title = 'Tap: pattern; hold: bars/.test(main), 'chain slots tell players tap changes pattern and hold changes bars');
assert(/b\.setAttribute\('aria-label', 'Pattern chain slot/.test(main), 'chain slots expose tap/hold behavior to assistive tech');
assert(/contextmenu[\s\S]*preventDefault/.test(main), 'chain slot long-press prevents native mobile context menus');

assert(css.includes('.chain-strip'), 'CSS defines mobile-friendly chain strip styling');
assert(css.includes('.chain-slot-b'), 'CSS defines touch targets for chain slots');

console.log('pattern chain runtime issue009 tests passed');
