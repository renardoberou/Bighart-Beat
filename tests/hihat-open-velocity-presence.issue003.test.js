#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { resolveHihatVoiceSpec } = require(path.join(root, 'src', 'rhythm', 'hihat-voice.js'));

const stableRand = () => 0.5;

const openPresenceParams = { freq: 9300, decay: 0.18, open: 0.85, metal: 0.75 };
const closedPresenceParams = { freq: 9300, decay: 0.04, open: 0.08, metal: 0.75 };

// ─── 1. Accented open shimmer is clearly stronger than soft open shimmer ───
for (const engine of ['909', 'aphex']) {
  const openSoft = resolveHihatVoiceSpec(engine, openPresenceParams, stableRand, 0.35);
  const openAccent = resolveHihatVoiceSpec(engine, openPresenceParams, stableRand, 1.0);
  const openNormal = resolveHihatVoiceSpec(engine, openPresenceParams, stableRand, 0.75);

  [
    'decaySec', 'noiseTailSec', 'metalTailSec', 'airLowpassHz',
    'openShimmerGain', 'openShimmerTailSec', 'openBodyGain', 'openBodyTailSec',
    'openAccentBloom', 'outputTrim', 'tailHeadroomTrim', 'transientGain',
    'openFlutterGain', 'openFlutterTailSec', 'openSizzleTailBias'
  ].forEach((key) => assert(Number.isFinite(openAccent[key])));
  assert(openAccent.decaySec >= 0.006 && openAccent.decaySec <= 0.70);

  assert(
    openAccent.openShimmerGain > openSoft.openShimmerGain * 1.6,
    `${engine}: accented open hat shimmer gain is clearly stronger than soft (accent-driven bloom)`
  );
  assert(
    openAccent.openShimmerGain > openNormal.openShimmerGain * 1.15,
    `${engine}: accented open hat shimmer is meaningfully above normal open (accent tilt)`
  );
}

// ─── 2. Closed hats keep shimmer effectively silent (no bloom bleed) ───
for (const engine of ['909', 'aphex']) {
  const closedAccent = resolveHihatVoiceSpec(engine, closedPresenceParams, stableRand, 1.0);
  const openAccent = resolveHihatVoiceSpec(engine, openPresenceParams, stableRand, 1.0);

  assert(closedAccent.openShimmerGain <= 0.01, `${engine}: accented closed hat keeps shimmer effectively silent`);
  assert(closedAccent.openBodyGain <= 0.01, `${engine}: accented closed hat keeps body effectively silent`);
  assert(closedAccent.openSizzleTailBias <= 0.01, `${engine}: accented closed hat keeps sizzle tail effectively silent`);
  assert(closedAccent.openFlutterGain <= 0.01, `${engine}: accented closed hat keeps flutter effectively silent`);

  assert(
    closedAccent.noiseTailSec < openAccent.noiseTailSec * 0.35,
    `${engine}: accented closed hat noise tail is much shorter than accented open hat`
  );
}

// ─── 3. Musical resonance: openness AND accent together raise shimmer ───
{
  const highOpenSoft = resolveHihatVoiceSpec('aphex', { freq: 9300, decay: 0.18, open: 0.85, metal: 0.75 }, stableRand, 0.35);
  const lowOpenAccent = resolveHihatVoiceSpec('aphex', { freq: 9300, decay: 0.18, open: 0.30, metal: 0.75 }, stableRand, 1.0);
  const highOpenAccent = resolveHihatVoiceSpec('aphex', { freq: 9300, decay: 0.18, open: 0.85, metal: 0.75 }, stableRand, 1.0);

  assert(
    highOpenAccent.openShimmerGain > lowOpenAccent.openShimmerGain * 1.3,
    'aphex: high-open accented shimmer exceeds low-open accented (openness contribution)'
  );
  assert(
    highOpenAccent.openShimmerGain > highOpenSoft.openShimmerGain * 1.6,
    'aphex: high-open accented shimmer exceeds high-open soft (accent contribution)'
  );
}

// ─── 4. Open hat shimmer tail: soft keeps airy tail ───
{
  const openSoft909 = resolveHihatVoiceSpec('909', openPresenceParams, stableRand, 0.35);
  const openAccent909 = resolveHihatVoiceSpec('909', openPresenceParams, stableRand, 1.0);

  assert(
    openSoft909.openShimmerTailSec > openAccent909.openShimmerTailSec,
    '909: soft open hat shimmer tail is airier than accented open hat'
  );
  assert(
    openAccent909.openShimmerTailSec >= openSoft909.openShimmerTailSec * 0.35,
    '909: accented open hat shimmer tail is still meaningfully present (not collapsed)'
  );
}

// ─── 5. Fast closed patterns stay tight ───
{
  const fastClosedParams = { freq: 9300, decay: 0.025, open: 0.05, metal: 0.6 };
  const fastClosedAccent = resolveHihatVoiceSpec('aphex', fastClosedParams, stableRand, 1.0);

  assert(fastClosedAccent.openShimmerGain <= 0.01, 'aphex: fast closed accented hat keeps shimmer effectively silent');
  assert(fastClosedAccent.openBodyGain <= 0.01, 'aphex: fast closed accented hat keeps body effectively silent');
  assert(fastClosedAccent.noiseTailSec < 0.10, 'aphex: fast closed accented hat noise tail stays short');
}

console.log('Issue 003 hihat open/closed presence and accent response tilt checks passed.');
