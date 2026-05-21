#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

function extractFunctionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} function exists`);
  const open = source.indexOf('{', start);
  assert(open >= 0, `${name} has a body`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`${name} body is closed`);
}

function declaration(block, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`${escaped}\\s*:\\s*([^;]+)`));
  return match && match[1].trim();
}

function px(value) {
  const match = String(value || '').match(/(\d+(?:\.\d+)?)px/);
  return match ? Number(match[1]) : 0;
}

function parseRepeatColumns(value) {
  const match = String(value || '').match(/^repeat\(\s*(\d+)\s*,\s*(?:minmax\(\s*)?(\d+(?:\.\d+)?)px/);
  assert(match, `mobile/coarse .mt-toggles uses repeat(count, px), got: ${value}`);
  return { count: Number(match[1]), width: Number(match[2]) };
}

function parseMobileMixerColumns(value) {
  const match = String(value || '').match(/^\s*(\d+(?:\.\d+)?)px\s+minmax\(\s*(\d+(?:\.\d+)?)(?:px)?\s*,\s*1fr\s*\)\s+(\d+(?:\.\d+)?)px\s*$/);
  assert(match, `mobile/coarse .mt uses a narrow-safe 3-column grid, got: ${value}`);
  return { label: Number(match[1]), faderMin: Number(match[2]), value: Number(match[3]) };
}

function coarseBlockContaining(selector) {
  const mediaRe = /@media\s*([^\{]*(?:max-width\s*:\s*\d+px|pointer\s*:\s*coarse)[^\{]*)\{/g;
  let match;
  while ((match = mediaRe.exec(css))) {
    const open = css.indexOf('{', match.index);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      if (depth === 0) {
        const media = match[1];
        const body = css.slice(open + 1, i);
        if (/pointer\s*:\s*coarse/.test(media) && body.includes(selector)) return body;
        mediaRe.lastIndex = i + 1;
        break;
      }
    }
  }
  return '';
}

function cssRuleBlock(block, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert(match, `mobile/coarse CSS includes ${selector}`);
  return match[1];
}

const buildMix = extractFunctionBody(main, 'buildMix');

[
  { key: 'mute', label: 'Mute ${tr.n}', state: 'tr.mute' },
  { key: 'dlyS', label: 'Delay send ${tr.n}', state: 'tr.dlyS' },
  { key: 'revS', label: 'Reverb send ${tr.n}', state: 'tr.revS' },
  { key: 'wreckS', label: 'Digi Wreck send ${tr.n}', state: 'tr.wreckS' }
].forEach(({ key, label, state }) => {
  assert(buildMix.includes(`data-k="${key}"`), `buildMix renders ${key} MIX button`);
  assert(buildMix.includes(`aria-label="${label}"`), `${key} MIX button has per-track aria-label ${label}`);
  assert(buildMix.includes(`aria-pressed="${'${'}${state}?`), `${key} MIX button initializes aria-pressed from ${state}`);
});

assert(/classList\.toggle\(\s*['"]on['"]\s*,\s*tr\[k\]\s*\)/.test(buildMix), 'MIX button click handler syncs .on from the actual track state');
assert(/setAttribute\(\s*['"]aria-pressed['"]\s*,\s*String\(\s*!!tr\[k\]\s*\)\s*\)/.test(buildMix), 'MIX button click handler updates aria-pressed from the actual track state');

const coarse = coarseBlockContaining('.mt-btn');
assert(coarse, 'CSS includes a pointer: coarse/mobile override for MIX strip buttons');

const mtBtn = cssRuleBlock(coarse, '.mt-btn');
assert(px(declaration(mtBtn, 'min-width')) >= 44 || px(declaration(mtBtn, 'width')) >= 44, 'mobile/coarse .mt-btn is at least 44px wide');
assert(px(declaration(mtBtn, 'min-height')) >= 44 || px(declaration(mtBtn, 'height')) >= 44, 'mobile/coarse .mt-btn is at least 44px tall');
assert(/touch-action\s*:\s*manipulation\b/.test(mtBtn), 'mobile/coarse .mt-btn uses touch-action: manipulation');

const mtToggles = cssRuleBlock(coarse, '.mt-toggles');
const columns = declaration(mtToggles, 'grid-template-columns') || '';
assert(/repeat\(\s*4\s*,\s*(?:minmax\(\s*)?44px/.test(columns), 'mobile/coarse .mt-toggles reserves four 44px columns');
assert(/grid-area\s*:\s*toggles\b/.test(mtToggles), 'mobile/coarse .mt-toggles is assigned to its own wrapping row');
assert(/width\s*:\s*max-content\b/.test(mtToggles), 'mobile/coarse .mt-toggles keeps its four 44px targets at intrinsic width');

const baseMtToggles = cssRuleBlock(css, '.mt-toggles');
const toggleGrid = parseRepeatColumns(columns);
const toggleGap = px(declaration(mtToggles, 'gap') || declaration(baseMtToggles, 'gap'));
const requiredToggleWidth = (toggleGrid.count * toggleGrid.width) + ((toggleGrid.count - 1) * toggleGap);

const mt = cssRuleBlock(coarse, '.mt');
const mtColumns = declaration(mt, 'grid-template-columns') || '';
const mtGridAreas = declaration(mt, 'grid-template-areas') || '';
const mtGrid = parseMobileMixerColumns(mtColumns);
assert(mtGrid.label === 28 && mtGrid.value === 30, `mobile/coarse .mt preserves compact label/value columns (${mtColumns})`);
assert(mtGrid.faderMin === 0, `mobile/coarse .mt lets the fader shrink within the available row width (${mtColumns})`);
assert(/"name\s+fader\s+value"/.test(mtGridAreas) && /"toggles\s+toggles\s+toggles"/.test(mtGridAreas), 'mobile/coarse .mt wraps MIX toggles to a full-width second row');

const mtFader = cssRuleBlock(coarse, '.mt .fdr');
assert(/grid-area\s*:\s*fader\b/.test(mtFader), 'mobile/coarse .mt fader is assigned to the first row fader area');
assert(/min-width\s*:\s*0\b/.test(mtFader), 'mobile/coarse .mt fader can shrink without forcing row overflow');

const realisticPanelWidth = 320;
const mtPadding = 10; // .mt has 5px left/right padding.
const mtBorder = 2;
const mtColumnGaps = 2 * 4; // 3 columns have two 4px gaps.
const minFirstRowWidth = mtGrid.label + mtGrid.faderMin + mtGrid.value + mtColumnGaps + mtPadding + mtBorder;
const minToggleRowWidth = requiredToggleWidth + mtPadding + mtBorder;
assert(minFirstRowWidth <= realisticPanelWidth, `mobile/coarse .mt first row fits a ${realisticPanelWidth}px panel (${minFirstRowWidth}px <= ${realisticPanelWidth}px)`);
assert(minToggleRowWidth <= realisticPanelWidth, `mobile/coarse .mt toggle row fits four ${toggleGrid.width}px MIX buttons in a ${realisticPanelWidth}px panel (${minToggleRowWidth}px <= ${realisticPanelWidth}px)`);

console.log('mobile MIX strip accessibility static checks passed');
