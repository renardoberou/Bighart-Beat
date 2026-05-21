#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

const FX_TOGGLES = [
  { id: 'togDly', statePath: 'FX.dly.on', label: /delay/i },
  { id: 'togRev', statePath: 'FX.rev.on', label: /reverb/i },
  { id: 'togComp', statePath: 'FX.comp.on', label: /comp/i },
  { id: 'togCompGate', statePath: 'FX.comp.gateOn', label: /gate/i },
  { id: 'togWreck', statePath: 'FX.wreck.on', label: /wreck/i }
];

function attrsForButton(id) {
  const match = html.match(new RegExp(`<button\\b(?=[^>]*\\bid="${id}")[^>]*>`, 'i'));
  assert(match, `${id} button exists in index.html`);
  return match[0];
}

function attrValue(attrs, name) {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`, 'i'));
  return match && match[1];
}

function cssBlockFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`));
  assert(match, `${selector} CSS block exists`);
  return match[1];
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

FX_TOGGLES.forEach(({ id, label }) => {
  const attrs = attrsForButton(id);
  const ariaLabel = attrValue(attrs, 'aria-label');
  assert(ariaLabel, `${id} has an accessible aria-label`);
  assert(label.test(ariaLabel), `${id} aria-label describes the FX toggle (${ariaLabel})`);
  assert.strictEqual(attrValue(attrs, 'aria-pressed'), 'false', `${id} starts with aria-pressed="false"`);
});

const syncFxControls = extractFunctionBody(main, 'syncFxControls');
const ariaPressedSetter = /setAttribute\(\s*['"]aria-pressed['"]\s*,\s*String\(/.test(main)
  || /setAttribute\(\s*['"]aria-pressed['"]/.test(syncFxControls)
  || /\.ariaPressed\s*=/.test(main);
assert(ariaPressedSetter, 'main.js contains logic to update aria-pressed');

FX_TOGGLES.forEach(({ id, statePath }) => {
  assert(syncFxControls.includes(`'${id}'`) || syncFxControls.includes(`"${id}"`) || syncFxControls.includes(`$(${JSON.stringify(id)})`) || syncFxControls.includes(`$('${id}')`), `syncFxControls references ${id}`);
  assert(syncFxControls.includes(statePath), `syncFxControls uses ${statePath} for ${id}`);
});
assert(/classList\.toggle\(\s*['"]on['"]/.test(syncFxControls), 'syncFxControls still updates the existing .on class');

const baseToggle = cssBlockFor('.fx-tog');
const knob = cssBlockFor('.fx-tog::after');
assert.strictEqual(declaration(baseToggle, 'width'), '28px', 'base .fx-tog keeps compact switch width');
assert.strictEqual(declaration(baseToggle, 'height'), '14px', 'base .fx-tog keeps compact switch height');
assert.strictEqual(declaration(knob, 'width'), '12px', 'base .fx-tog knob remains compact');
assert.strictEqual(declaration(knob, 'height'), '12px', 'base .fx-tog knob remains compact');

const coarseMatch = css.match(/@media\s*[^\{]*pointer\s*:\s*coarse[\s\S]*?\.fx-tog\s*\{([^\}]*min-(?:width|height)[^\}]*)\}/);
assert(coarseMatch, 'CSS includes a coarse-pointer/mobile .fx-tog hit-area rule');
const coarseToggle = coarseMatch[1];
const minWidth = px(declaration(coarseToggle, 'min-width'));
const minHeight = px(declaration(coarseToggle, 'min-height'));
const padding = declaration(coarseToggle, 'padding');
const paddingPx = padding ? padding.split(/\s+/).map(px) : [];
const has44MinDimension = minWidth >= 44 || minHeight >= 44;
const hasHitAreaPadding = paddingPx.some((value) => value >= 8) && (minWidth || px(declaration(baseToggle, 'width'))) >= 28;
assert(has44MinDimension || hasHitAreaPadding, 'coarse-pointer .fx-tog provides a 44px hit area via min-width/min-height or meaningful padding');
assert(/touch-action\s*:\s*manipulation\b/.test(coarseToggle), 'coarse-pointer .fx-tog uses touch-action: manipulation');

console.log('mobile FX toggle accessibility static checks passed');
