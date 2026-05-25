#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'main.css'), 'utf8');

function extractMediaBlocks(source) {
  const blocks = [];
  const mediaPattern = /@media\s*([^\{]+)\{/g;
  let match;
  while ((match = mediaPattern.exec(source))) {
    const prelude = match[1].trim();
    const open = mediaPattern.lastIndex - 1;
    let depth = 0;
    for (let i = open; i < source.length; i += 1) {
      if (source[i] === '{') depth += 1;
      if (source[i] === '}') depth -= 1;
      if (depth === 0) {
        blocks.push({ prelude, body: source.slice(open + 1, i) });
        mediaPattern.lastIndex = i + 1;
        break;
      }
    }
  }
  return blocks;
}

function rulesForSelectorInMobile(selector) {
  const rulePattern = /(^|})\s*([^{}@][^{}]*)\s*\{([^{}]*)\}/g;
  return extractMediaBlocks(css)
    .filter(({ prelude }) => /pointer\s*:\s*coarse/.test(prelude) || /max-width\s*:\s*640px/.test(prelude))
    .flatMap(({ prelude, body }) => {
      const rules = [];
      let match;
      while ((match = rulePattern.exec(body))) {
        const selectors = match[2].split(',').map((item) => item.trim());
        if (selectors.includes(selector)) {
          rules.push({ prelude, block: match[3] });
        }
      }
      return rules;
    });
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

const sharedRules = rulesForSelectorInMobile('.div-b');
assert(sharedRules.length > 0, 'shared .div-b has a coarse-pointer/mobile rule (not only #engineSel .div-b)');
assert(sharedRules.some(({ block }) => px(declaration(block, 'min-height')) >= 44), 'shared .div-b coarse-pointer/mobile rule sets min-height: 44px or larger');
assert(sharedRules.some(({ block }) => /touch-action\s*:\s*manipulation\b/.test(block)), 'shared .div-b coarse-pointer/mobile rule sets touch-action: manipulation');

const engineRules = rulesForSelectorInMobile('#engineSel .div-b');
assert(engineRules.length > 0, 'existing #engineSel .div-b coarse-pointer/mobile override remains present');
assert(engineRules.some(({ block }) => px(declaration(block, 'min-height')) >= 44), 'engine selector mobile override does not drop below the shared 44px target');

console.log('mobile shared division button touch targets ok');
