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

function mobileRulesFor(selector) {
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

function assertMobileTouchTarget(selector, pixels, label, { requireWidth = false } = {}) {
  const rules = mobileRulesFor(selector);
  assert(rules.length > 0, `${label} has a coarse-pointer/mobile CSS rule`);
  assert(
    rules.some(({ block }) => px(declaration(block, 'min-height')) >= pixels),
    `${label} mobile rule sets min-height: ${pixels}px or larger`,
  );
  if (requireWidth) {
    assert(
      rules.some(({ block }) => {
        const minWidth = px(declaration(block, 'min-width'));
        const width = px(declaration(block, 'width'));
        return minWidth >= pixels || width >= pixels;
      }),
      `${label} mobile rule sets min-width or width: ${pixels}px or larger`,
    );
  }
  assert(
    rules.some(({ block }) => /touch-action\s*:\s*manipulation\b/.test(block)),
    `${label} mobile rule sets touch-action: manipulation`,
  );
}

assertMobileTouchTarget('#engineSel .div-b', 40, 'engine selector buttons');
assertMobileTouchTarget('.hht-place-b', 44, 'hihat quick place buttons', { requireWidth: true });
assertMobileTouchTarget('.hat-test-b', 44, 'hihat test buttons', { requireWidth: true });
assertMobileTouchTarget('.hat-place-b', 44, 'hihat place buttons', { requireWidth: true });

assert(/@media\s*\(max-width:\s*380px\)\s*\{[\s\S]*#engineSel\s*\{\s*flex-basis:\s*100%;\s*\}/.test(css), 'engine selector still wraps to a full-width row on narrow phones');

console.log('mobile hihat and engine touch targets ok');
