#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));

const STALE_TOKEN = 'v=boost-week-20260521-cachefresh';
const PREVIOUS_TOKENS = [
  'v=hihat-open-body-20260522',
  'v=hihat-flutter-20260522',
  'v=hihat-metal-budget-20260522',
  'v=hihat-accent-bloom-20260523',
  'v=hihat-velocity-tail-20260523',
  'v=hihat-place-audition-20260523',
  'v=synth-cleanup-20260523',
];
const EXPECTED_TOKEN = 'v=hihat-flutter-20260523';
const HIHAT_VOICE_TOKEN = 'v=hihat-open-decay-20260524';
const MAIN_JS_TOKEN = 'v=ether-mode-audition-20260524';
const localAssetTokenPattern = /[?&]v=(?:boost-week|hihat-accent(?:-bloom)?|hihat-open-contract|hihat-gain-stage|hihat-open-body|hihat-open-decay|hihat-flutter(?:-velocity)?|hihat-metal-budget|hihat-velocity-tail|hihat-place-audition|ether-mode-audition|synth-cleanup|syn-pitch-cap|hihat-idm-spark)-\d{8}(?:-[a-z0-9-]+)?/g;

function assertExactlyOneCurrentToken(assetUrl, expectedToken = EXPECTED_TOKEN) {
  assert(
    !assetUrl.includes(STALE_TOKEN) && PREVIOUS_TOKENS.every((token) => !assetUrl.includes(token)),
    `${assetUrl} must not use stale cache token ${STALE_TOKEN} or previous tokens ${PREVIOUS_TOKENS.join(', ')}`,
  );

  const tokenMatches = assetUrl.match(localAssetTokenPattern) || [];
  assert.deepStrictEqual(
    tokenMatches,
    [`?${expectedToken}`],
    `${assetUrl} has exactly one expected cache token`,
  );
}

const stylesheetMatches = [...head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
const stylesheetHrefs = stylesheetMatches
  .map((match) => match[0].match(/\bhref="([^"]+)"/))
  .filter(Boolean)
  .map((match) => match[1]);
const localStylesheets = stylesheetHrefs.filter((href) => href.startsWith('styles/'));

assert.deepStrictEqual(
  localStylesheets,
  [`styles/main.css?${EXPECTED_TOKEN}`],
  'index.html loads local stylesheet with the current hihat-flutter cache token',
);
localStylesheets.forEach((href) => assertExactlyOneCurrentToken(href));

const googleFontHrefs = stylesheetHrefs.filter((href) => href.startsWith('https://fonts.googleapis.com/'));
assert(
  googleFontHrefs.length > 0,
  'index.html keeps the external Google Fonts stylesheet link',
);
for (const href of googleFontHrefs) {
  assert(
    !/[?&]v=/.test(href),
    'external Google Fonts links are not assigned a local app cache token',
  );
}

const scriptSrcs = [...head.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*\bdefer\b[^>]*><\/script>/g)]
  .map((match) => match[1])
  .filter((src) => src.startsWith('src/'));

const expectedScriptSrcs = [
  'src/state/tracks.js',
  'src/state/patterns.js',
  'src/state/fx-state.js',
  'src/state/synth-notes.js',
  'src/state/pattern-chain.js',
  'src/state/pattern-variation.js',
  'src/state/app-state.js',
  'src/state/pattern-operations.js',
  'src/state/persistence.js',
  'src/rhythm/rhythm-intelligence.js',
  'src/rhythm/groove-timing.js',
  'src/rhythm/swing-knob.js',
  'src/rhythm/engine-profiles.js',
  'src/rhythm/hihat-voice.js',
  'src/rhythm/synth-voice.js',
  'src/rhythm/kick-voice.js',
  'src/rhythm/snare-voice.js',
  'src/rhythm/clap-voice.js',
  'src/main.js',
].map((unversionedPath) => {
  if (unversionedPath === 'src/rhythm/hihat-voice.js') return `${unversionedPath}?${HIHAT_VOICE_TOKEN}`;
  if (unversionedPath === 'src/main.js') return `${unversionedPath}?${MAIN_JS_TOKEN}`;
  return `${unversionedPath}?${EXPECTED_TOKEN}`;
});

assert.deepStrictEqual(
  scriptSrcs,
  expectedScriptSrcs,
  'cache busting preserves static script execution order and gives hihat-voice.js the live deploy marker',
);
scriptSrcs.forEach((src) => {
  let expectedToken = EXPECTED_TOKEN;
  if (src.startsWith('src/rhythm/hihat-voice.js?')) expectedToken = HIHAT_VOICE_TOKEN;
  if (src.startsWith('src/main.js?')) expectedToken = MAIN_JS_TOKEN;
  assertExactlyOneCurrentToken(src, expectedToken);
});

console.log('Static asset cache-busting checks passed.');
