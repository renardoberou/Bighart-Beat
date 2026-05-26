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
  'v=hihat-open-decay-20260524',
  'v=synth-note-edit-audition-20260524',
  'v=hihat-metal-air-20260524',
  'v=hihat-place-silent-20260524',
  'v=comp-detector-truth-20260524',
  'v=hihat-sizzle-tail-20260524',
  'v=hihat-open-velocity-tail-20260524',
  'v=hihat-aphex-micro-glitch-20260525',
];
const PREVIOUS_STYLESHEET_TOKENS = [
  ...PREVIOUS_TOKENS,
  'v=hihat-flutter-20260523',
];
const EXPECTED_TOKEN = 'v=hihat-flutter-20260523';
const STYLESHEET_TOKEN = 'v=hihat-touch-targets-20260525';
const HIHAT_METALLIC_RATTLE_PAN_TOKEN = 'v=hihat-metallic-rattle-pan-20260526';
const HIHAT_VOICE_TOKEN = HIHAT_METALLIC_RATTLE_PAN_TOKEN;
const SYNTH_808_BODY_TOKEN = 'v=synth-808-body-20260524';
const SYNTH_VOICE_TOKEN = SYNTH_808_BODY_TOKEN;
const MAIN_JS_TOKEN = HIHAT_METALLIC_RATTLE_PAN_TOKEN;
const CLAP_STEREO_WIDTH_TOKEN = 'v=clap-stereo-width-20260526';
const CLAP_STEREO_WIDTH_PREVIOUS_TOKENS = [
  ...PREVIOUS_TOKENS,
  EXPECTED_TOKEN,
  'v=input-playback-rate-safety-20260526',
];
const localAssetTokenPattern = /[?&]v=(?:boost-week|hihat-accent(?:-bloom)?|hihat-open-contract|hihat-gain-stage|hihat-open-body|hihat-open-decay|hihat-open-velocity-tail|hihat-open-metal-air|hihat-open-splash(?:-runtime)?|hihat-aphex-micro-glitch|hihat-metallic-rattle-pan|hihat-flutter(?:-velocity)?|hihat-touch-targets|hihat-metal-budget|hihat-metal-air|hihat-velocity-tail|hihat-place-audition|hihat-place-silent|hihat-sizzle-tail|comp-detector-truth|brain-loop-hihat-guard|wreck-audible-send|ether-mode-audition|ratchet-edit-audition|input-playback-rate-safety|clap-stereo-width|synth-cleanup|synth-note-engine-status|synth-note-edit-audition|synth-808-body|syn-pitch-cap|hihat-idm-spark)-\d{8}(?:-[a-z0-9-]+)?/g;

function assertExactlyOneCurrentToken(assetUrl, expectedToken = EXPECTED_TOKEN, previousTokens = PREVIOUS_TOKENS) {
  assert(
    !assetUrl.includes(STALE_TOKEN) && previousTokens.every((token) => !assetUrl.includes(token)),
    `${assetUrl} must not use stale cache token ${STALE_TOKEN} or previous tokens ${previousTokens.join(', ')}`,
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
  [`styles/main.css?${STYLESHEET_TOKEN}`],
  'index.html loads local stylesheet with the current hihat touch-target cache token',
);
localStylesheets.forEach((href) => assertExactlyOneCurrentToken(href, STYLESHEET_TOKEN, PREVIOUS_STYLESHEET_TOKENS));

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
  if (unversionedPath === 'src/rhythm/synth-voice.js') return `${unversionedPath}?${SYNTH_VOICE_TOKEN}`;
  if (unversionedPath === 'src/rhythm/engine-profiles.js') return `${unversionedPath}?${CLAP_STEREO_WIDTH_TOKEN}`;
  if (unversionedPath === 'src/rhythm/clap-voice.js') return `${unversionedPath}?${CLAP_STEREO_WIDTH_TOKEN}`;
  if (unversionedPath === 'src/main.js') return `${unversionedPath}?${MAIN_JS_TOKEN}`;
  return `${unversionedPath}?${EXPECTED_TOKEN}`;
});

assert.deepStrictEqual(
  scriptSrcs,
  expectedScriptSrcs,
  'cache busting preserves static script execution order and gives hihat-voice.js and synth-voice.js their live deploy markers',
);
scriptSrcs.forEach((src) => {
  let expectedToken = EXPECTED_TOKEN;
  let previousTokens = PREVIOUS_TOKENS;
  if (src.startsWith('src/rhythm/hihat-voice.js?')) expectedToken = HIHAT_VOICE_TOKEN;
  if (src.startsWith('src/rhythm/synth-voice.js?')) expectedToken = SYNTH_VOICE_TOKEN;
  if (
    src.startsWith('src/rhythm/engine-profiles.js?')
    || src.startsWith('src/rhythm/clap-voice.js?')
  ) {
    expectedToken = CLAP_STEREO_WIDTH_TOKEN;
    previousTokens = CLAP_STEREO_WIDTH_PREVIOUS_TOKENS;
  }
  if (src.startsWith('src/main.js?')) {
    expectedToken = MAIN_JS_TOKEN;
    previousTokens = CLAP_STEREO_WIDTH_PREVIOUS_TOKENS;
  }
  assertExactlyOneCurrentToken(src, expectedToken, previousTokens);
});

console.log('Static asset cache-busting checks passed.');
