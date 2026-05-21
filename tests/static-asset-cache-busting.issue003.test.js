#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));

const EXPECTED_TOKEN = 'v=boost-week-20260521-bpmnudge';
const localAssetTokenPattern = /[?&]v=boost-week-\d{8}(?:-[a-z0-9-]+)?/g;

function assertExactlyOneCurrentToken(assetUrl) {
  const tokenMatches = assetUrl.match(localAssetTokenPattern) || [];
  assert.deepStrictEqual(
    tokenMatches,
    [`?${EXPECTED_TOKEN}`],
    `${assetUrl} has exactly one current boost-week cache token`,
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
  'index.html loads local stylesheet with the current boost-week cache token',
);
localStylesheets.forEach(assertExactlyOneCurrentToken);

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
].map((unversionedPath) => `${unversionedPath}?${EXPECTED_TOKEN}`);

assert.deepStrictEqual(
  scriptSrcs,
  expectedScriptSrcs,
  'cache busting preserves static script execution order and gives every local script exactly one current boost-week token',
);
scriptSrcs.forEach(assertExactlyOneCurrentToken);

console.log('Static asset cache-busting checks passed.');
