'use strict';
const $ = id => document.getElementById(id);
const MAX_SAMPLE_BYTES = 10 * 1024 * 1024;
const MAX_SAMPLE_SECONDS = 30;

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
const State = globalThis.BighartBeatState;
const Rhythm = globalThis.BighartBeatRhythm;
const Groove = globalThis.BighartBeatGroove;
const SwingKnob = globalThis.BighartBeatSwingKnob;
const HihatVoice = globalThis.BighartBeatHihat;
const KickVoice = window.BighartBeatKick;
const SnareVoice = window.BighartBeatSnare;
const ClapVoice = window.BighartBeatClap;
const SynthVoice = globalThis.BighartBeatSynth;
const EngineProfiles = globalThis.BighartBeatEngineProfiles;
const TRACKS = State.createDefaultTracks();
const FX = State.createDefaultFxState();
const PATTERNS = State.createPatternBanks();
const RATCHETS = State.createRatchetBanks();
const HHT_OPENNESS = State.createHihatOpennessBanks();
const HHT_ACCENT = State.createHihatAccentBanks();
const SYNTH_NOTES = State.createSynthNotesBanks();
const PATTERN_FX_SCENES = State.createPatternFxScenes();
const LAST_HIHAT_TAP_AT = Object.create(null);
const S = State.createAppState();
let HHT_PLACE = 0;
let SYNTH_NOTE_EDIT = false;
let LAST_SYNTH_NOTE_STEP = 0;
let lastBrainLoopResultStatus = '';
let firingStep = 0;
let synthUse24Tet = false;

/* ═══════════════════════════════════════════════
   AUDIO ENGINE
═══════════════════════════════════════════════ */
let A = null;
let nz = null;
const N = {}; // nodes
const KICK_PUMP_WEIGHT = 1;
const NON_KICK_PUMP_WEIGHT = 0.35;
const DLY_SEND_TRIM = 0.55;
const REV_SEND_TRIM = 0.5;
const WRECK_SEND_TRIM = 0.7;
const ROUTE_VOICE_DEFAULT_CLEANUP_TAIL_SEC = 3;
const REV_GATE_SOURCE_TAIL_MAX_EXTRA_SEC = 0.35;
const REV_GATE_SOURCE_TAIL_MAX_TOTAL_SEC = 0.75;
const GATE_ANALOG_JITTER_MS = 6;
const GATE_ANALOG_CLOSED_DB = 3;
const ENGINE_PROFILES = EngineProfiles.ENGINE_PROFILES;
const CHAIN_SLOT_BAR_CHOICES = [1, 2, 4, 8, 16];
const OPEN_HIHAT_ROW_ID = 'open-hihat';
const OPEN_HIHAT_ROW_LABEL = 'OHH';
const DEFAULT_VOICE_VELOCITY = 0.75;
const KICK_VOICE_VELOCITY = 0.78;
const SNARE_VOICE_VELOCITY = 0.68;
const HIHAT_NORMAL_VELOCITY = 0.72;
const HIHAT_ACCENT_VELOCITY = 0.96;
const CLAP_VOICE_VELOCITY = 0.58;
const INPUT_VOICE_VELOCITY = 0.70;
const ETHER_VOICE_VELOCITY = 0.62;
const SYNTH_VOICE_VELOCITY = 0.68;
const SYNTH_MAX_FREQUENCY_HZ = State.SYNTH_MAX_FREQUENCY_HZ || SynthVoice.SYNTH_MAX_FREQUENCY_HZ || 2200;
const SYNTH_ROOT_MAX_HZ = State.SYNTH_ROOT_MAX_HZ || SynthVoice.SYNTH_ROOT_MAX_HZ || 550;
const SYNTH_OSC_SAFETY_MIN_HZ = 1;
const SYNTH_OSC_SAFETY_MAX_HZ = 20000;
const hihatChokeState = { gain: null, open: 0 };
const synthVoiceState = { gain: null, cleanup: null, pitchHz: null, triggerTime: null };
const VOICE_EDIT_AUDITION_DEBOUNCE_MS = 140;
let voiceEditAuditionTimer = null;
const REV_IR_REBUILD_DEBOUNCE_MS = 50;
let revIRRebuildTimer = null;
let lastRevIRParams = null;

function cancelAndHoldOrSmoothParam(param, t, options = {}) {
  if (!param) return;
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(t);
    return;
  }

  const floor = Number.isFinite(options.floor) ? options.floor : 0;
  const smoothTime = Number.isFinite(options.smoothTime) ? Math.max(0, options.smoothTime) : .003;
  const fallbackValue = Number.isFinite(options.fallbackValue) ? options.fallbackValue : floor;
  const anchor = Math.max(floor, fallbackValue);

  if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(t);
  if (smoothTime > 0 && typeof param.setTargetAtTime === 'function') {
    param.setTargetAtTime(anchor, t, smoothTime);
  } else if (smoothTime > 0 && typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(anchor, t + smoothTime);
  } else if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(anchor, t);
  }
}

function setHihatPlacement(value) {
  const next = parseFloat(value);
  if (![0, .45, 1].includes(next)) return;
  HHT_PLACE = next;
  syncHihatPlacementControls();
}

function syncHihatPlacementControls() {
  document.querySelectorAll('[data-place], [data-quick-hht-place]').forEach(b => {
    const raw = b.dataset.quickHhtPlace || b.dataset.place;
    b.classList.toggle('on', parseFloat(raw) === HHT_PLACE);
  });
}

function wireQuickHihatPlacement() {
  document.querySelectorAll('[data-quick-hht-place]').forEach(b => {
    b.addEventListener('click', () => {
      setHihatPlacement(b.dataset.quickHhtPlace);
      if (!S.playing) {
        previewHihat(parseFloat(b.dataset.quickHhtPlace));
      }
    });
  });
  syncHihatPlacementControls();
}

function initAudio() {
  if (A) { A.resume(); return; }
  A = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });

  // persistent noise buffer
  nz = A.createBuffer(1, A.sampleRate * 2, A.sampleRate);
  const d = nz.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  buildGraph();
}

function buildGraph() {
  // ── TRACK BUS — voices sum here. Pre-attenuated to leave headroom for sums.
  N.bus = A.createGain(); N.bus.gain.value = 0.55;

  // ── FX SENDS — also attenuated so wet returns don't blow the limiter.
  // Delay input is per-track only: do not tap N.bus into N.dlyLine,
  // or channels with D off will bleed into the delay wet path. Existing
  // N.dlyFB repeats are intentional feedback tails from prior sent hits.
  // Reverb input is per-track only too: do not tap N.bus into N.revSend,
  // or tracks with R off will bleed into the gated wet path when another
  // track opens the reverb gate.
  N.revSend = A.createGain(); N.revSend.gain.value = 0.6;

  // ── DIGITAL DELAY ──────────────────────────────
  // signal → dlyLine → dlyTone (lp) → dlySat (tanh, prevents runaway) → dlyFB → back to dlyLine
  //                                 → dlyWet → master
  N.dlyLine = A.createDelay(3);
  N.dlyLine.delayTime.value = dlyTimeSec();
  N.dlyTone = A.createBiquadFilter(); N.dlyTone.type = 'lowpass';
  N.dlyTone.frequency.value = toneHz(FX.dly.tone);
  N.dlyTone.Q.value = .5;
  // soft-clip the feedback path so accumulated repeats can never exceed safe levels
  N.dlySat  = A.createWaveShaper();
  N.dlySat.curve = mkSatCurve(.20);   // gentle but firm
  N.dlySat.oversample = '2x';
  N.dlyFB   = A.createGain(); N.dlyFB.gain.value = FX.dly.fb;
  // feedback loop: line → tone → sat → fb → line
  N.dlyLine.connect(N.dlyTone);
  N.dlyTone.connect(N.dlySat);
  N.dlySat.connect(N.dlyFB);
  N.dlyFB.connect(N.dlyLine);
  // wet tap (post-tone, pre-sat for clarity)
  N.dlyWet = A.createGain(); N.dlyWet.gain.value = 0;
  N.dlyTone.connect(N.dlyWet);

  // ── GATED REVERB ───────────────────────────────
  // Gate the INPUT to the convolver, not its output. This prevents
  // continuous feed accumulating and dumping when the gate opens.
  // Gate is held closed by default and opened briefly per-trigger.
  N.revGate = A.createGain(); N.revGate.gain.value = 0;
  N.conv    = A.createConvolver(); N.conv.normalize = true;
  N.revWet  = A.createGain(); N.revWet.gain.value = 0;
  // revSend → revGate → conv → revWet → master
  N.revSend.connect(N.revGate);
  N.revGate.connect(N.conv);
  N.conv.connect(N.revWet);

  // ── MASTER CHAIN ──────────────────────────────
  // Order matters: comp BEFORE saturation. Comp tames transients,
  // then sat adds warmth to a controlled signal (not wild peaks).
  N.mstSum = A.createGain(); N.mstSum.gain.value = 1;
  // bus is the dry path
  N.bus.connect(N.mstSum);
  // Delay and reverb do not tap the full bus: routeVoice() creates the only
  // new wet sends, gated by per-track dlyS/revS toggles.
  // wet returns merge into the master sum
  N.dlyWet.connect(N.mstSum);
  N.revWet.connect(N.mstSum);

  // Alesis 3630-inspired pump compressor/gate: master sum → gate → compressor → auto makeup → saturation.
  // No manual output/makeup gain is exposed; makeup is computed from threshold/ratio and clamped safe.
  N.compGate = A.createGain(); N.compGate.gain.value = FX.comp.gateOn ? 0 : 1;
  N.mstComp = A.createDynamicsCompressor();
  const detectorSettings = compDetectorSettings(FX.comp);
  N.mstComp.threshold.value = FX.comp.on ? FX.comp.threshold : 0;
  N.mstComp.knee.value      = detectorSettings.knee;
  N.mstComp.ratio.value     = FX.comp.on ? FX.comp.ratio : 1;
  N.mstComp.attack.value    = detectorSettings.attack;
  N.mstComp.release.value   = detectorSettings.release;
  N.compMakeup = A.createGain(); N.compMakeup.gain.value = dbToGain(autoMakeupGainDb(FX.comp));
  N.mstSum.connect(N.compGate);
  N.compGate.connect(N.mstComp);
  N.mstComp.connect(N.compMakeup);

  // DIGI WRECK is a per-track wet send, not a full-master insert. Voices with W enabled
  // tap N.wreckIn in routeVoice(); the dry track path remains on N.bus so no wreckDry path is audible.
  N.wreckIn = A.createGain();
  N.wreckDownsample = A.createScriptProcessor(256, 1, 1);
  N.wreckDownsample.wreckRate = FX.wreck.rate;
  N.wreckDownsample.wreckHeldSample = 0;
  N.wreckDownsample.wreckHoldCounter = 0;
  N.wreckDownsample.onaudioprocess = processWreckDownsample;
  N.wreckCrusher = A.createWaveShaper();
  N.wreckCurveKey = null;
  updateWreckCurveIfNeeded();
  N.wreckCrusher.oversample = 'none';
  N.wreckTone = A.createBiquadFilter(); N.wreckTone.type = 'lowpass';
  N.wreckTone.frequency.value = wreckToneHz(FX.wreck.tone);
  N.wreckTone.Q.value = .35;
  N.wreckWet = A.createGain(); N.wreckWet.gain.value = FX.wreck.on ? FX.wreck.mix : 0;
  N.wreckOut = A.createGain(); N.wreckOut.gain.value = FX.wreck.on ? FX.wreck.out : 0;
  N.wreckPreCompGain = A.createGain(); N.wreckPreCompGain.gain.value = FX.wreck.order === 'wreck-comp' ? 1 : 0;
  N.wreckPostCompGain = A.createGain(); N.wreckPostCompGain.gain.value = FX.wreck.order === 'comp-wreck' ? 1 : 0;
  N.wreckWetFeedConnected = false;
  N.wreckProcessorChainConnected = false;
  // Order toggle meaning for send-style Wreck:
  //   wreck-comp: wreck wet return joins N.mstSum and is compressed with the master.
  //   comp-wreck: wreck wet return joins after compressor/makeup, before master saturation/limiter.
  N.wreckOut.connect(N.wreckPreCompGain); N.wreckPreCompGain.connect(N.mstSum);

  // gentle warmth saturation, AFTER comp and optional digital destruction
  N.mstSat = A.createWaveShaper();
  N.mstSat.curve = mkSatCurve(.05);
  N.mstSat.oversample = '2x';
  N.compMakeup.connect(N.mstSat);
  N.wreckOut.connect(N.wreckPostCompGain); N.wreckPostCompGain.connect(N.mstSat);
  updateWreckProcessorFeed(shouldFeedWreckProcessor());

  // master volume
  N.mstVol = A.createGain(); N.mstVol.gain.value = S.mstVol;
  N.mstSat.connect(N.mstVol);

  // brick-wall limiter at -3 dB ceiling
  N.lim = A.createDynamicsCompressor();
  N.lim.threshold.value = -3;
  N.lim.knee.value      = 0;
  N.lim.ratio.value     = 20;
  N.lim.attack.value    = .001;
  N.lim.release.value   = .040;
  N.mstVol.connect(N.lim);

  // analyser for VU
  N.ana = A.createAnalyser(); N.ana.fftSize = 256;
  N.lim.connect(N.ana);
  N.ana.connect(A.destination);

  // build initial reverb IR
  genRevIR();

  // apply state (wet levels, etc.)
  applyFXState();
}

function mkSatCurve(amt) {
  const n = 512, c = new Float32Array(n);
  const a = 1 + amt * 6;
  for (let i = 0; i < n; i++) {
    const x = i * 2 / n - 1;
    c[i] = Math.tanh(x * a) / Math.tanh(a);
  }
  return c;
}

function toneHz(v) { // 0..1 → 800 Hz..16 kHz exp
  return 800 * Math.pow(20, v);
}

function wreckToneHz(v) { // 0..1 → 900 Hz..18 kHz exp; dark settings tame alias splash.
  return 900 * Math.pow(20, clamp(v, 0, 1));
}

function shouldFeedWreckProcessor() {
  return !!(FX.wreck.on && FX.wreck.mix > 0 && FX.wreck.out > 0 && hasAudibleWreckSend());
}

function hasWreckSend() {
  return TRACKS.some(tr => tr.wreckS);
}

function hasAudibleWreckSend() {
  return TRACKS.some(tr => tr.wreckS && !tr.mute && tr.vol > 0);
}

function wreckSendStatusText() {
  if (!hasWreckSend()) return 'W SENDS OFF';
  if (hasWreckSend() && !hasAudibleWreckSend()) return 'W SENDS SILENT';
  if (!shouldFeedWreckProcessor()) return 'WRECK RETURN OFF';
  return 'WRECK SEND READY';
}

function updateWreckSendStatus() {
  const el = $('wreckSendStatus');
  if (!el) return;
  const text = wreckSendStatusText();
  el.textContent = text;
  el.classList.toggle('wreck-send-status--warn', text === 'WRECK RETURN OFF' || text === 'W SENDS SILENT');
  el.classList.toggle('wreck-send-status--active', text === 'WRECK SEND READY');
}

function updateWreckProcessorFeed(active) {
  if (!N || !N.wreckIn || !N.wreckDownsample || !N.wreckCrusher || !N.wreckTone || !N.wreckWet || !N.wreckOut) return;
  const shouldConnect = !!active;
  if (shouldConnect && !N.wreckWetFeedConnected) {
    N.wreckIn.connect(N.wreckDownsample);
    N.wreckWetFeedConnected = true;
  } else if (!shouldConnect && N.wreckWetFeedConnected) {
    try { N.wreckIn.disconnect(N.wreckDownsample); } catch (_) {}
    N.wreckWetFeedConnected = false;
  }
  if (shouldConnect && !N.wreckProcessorChainConnected) {
    N.wreckDownsample.connect(N.wreckCrusher);
    N.wreckCrusher.connect(N.wreckTone);
    N.wreckTone.connect(N.wreckWet);
    N.wreckWet.connect(N.wreckOut);
    N.wreckProcessorChainConnected = true;
  } else if (!shouldConnect && N.wreckProcessorChainConnected) {
    try { N.wreckDownsample.disconnect(N.wreckCrusher); } catch (_) {}
    try { N.wreckCrusher.disconnect(N.wreckTone); } catch (_) {}
    try { N.wreckTone.disconnect(N.wreckWet); } catch (_) {}
    try { N.wreckWet.disconnect(N.wreckOut); } catch (_) {}
    N.wreckProcessorChainConnected = false;
  }
}

function updateWreckCurveIfNeeded() {
  if (!N || !N.wreckCrusher) return;
  const key = [FX.wreck.bits, FX.wreck.curve, FX.wreck.rate, FX.wreck.threshold].join('|');
  if (N.wreckCurveKey === key) return;
  N.wreckCrusher.curve = mkWreckCurve(FX.wreck.bits, FX.wreck.curve, FX.wreck.rate, FX.wreck.threshold);
  N.wreckCurveKey = key;
}

function mkWreckCurve(bits, mode, rate, thresholdDb) {
  const n = 1024, c = new Float32Array(n);
  const safeBits = clamp(Math.round(bits || 12), 4, 16);
  const rateCrush = 1 - clamp(rate == null ? .75 : rate, 0, 1);
  const threshold = dbToGain(clamp(thresholdDb == null ? -24 : thresholdDb, -80, 0));
  const knee = Math.max(.015, threshold * .35);
  const levels = Math.pow(2, Math.max(2, Math.round(safeBits - rateCrush * 3)));
  const digitalPush = .25 + rateCrush * .75;
  for (let i = 0; i < n; i++) {
    const x = i * 2 / (n - 1) - 1;
    const q = Math.round(x * levels) / levels;
    const ax = Math.abs(q);
    const sign = q < 0 ? -1 : 1;
    const above = Math.max(0, ax - threshold);
    const span = Math.max(1e-6, 1 - threshold);
    const norm = clamp(above / span, 0, 1);
    const blend = smoothstep(clamp((ax - threshold + knee) / (knee * 2), 0, 1));
    let digital;
    if (mode === 'glass') {
      const folded = Math.abs(((norm * (2.4 + digitalPush * 1.6) + 1) % 4 + 4) % 4 - 2) - 1;
      digital = sign * (threshold + folded * span * .82);
    } else if (mode === 'shard') {
      const steps = Math.max(3, Math.round(6 + safeBits * .45 - rateCrush * 4));
      const stair = Math.round(Math.pow(norm, .72) * steps) / steps;
      digital = sign * (threshold + stair * span * (.72 + digitalPush * .18));
    } else {
      const pxLevels = Math.max(1, levels * .35);
      const px = Math.round(norm * pxLevels) / pxLevels;
      digital = sign * (threshold + px * span * (.78 + digitalPush * .12));
    }
    // Threshold keeps low-level groove mostly clean while the soft knee avoids
    // zippery jumps when the fader moves. Output remains bounded before the
    // existing master saturation/limiter safety chain.
    c[i] = clamp(q * (1 - blend) + digital * blend, -.98, .98);
  }
  return c;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function wreckHoldStep(rate) {
  const safeRate = clamp(rate == null ? .75 : rate, 0, 1);
  return Math.max(1, Math.round(1 + Math.pow(1 - safeRate, 2) * 63));
}

function processWreckDownsample(e) {
  const input = e.inputBuffer.getChannelData(0);
  const output = e.outputBuffer.getChannelData(0);
  const step = wreckHoldStep(this.wreckRate);
  let held = this.wreckHeldSample || 0;
  let counter = this.wreckHoldCounter || 0;
  for (let i = 0; i < input.length; i++) {
    if (counter <= 0) {
      held = input[i];
      counter = step;
    }
    output[i] = held;
    counter--;
  }
  this.wreckHeldSample = held;
  this.wreckHoldCounter = counter;
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function boundedRand(amount) { return 1 + (Math.random() * 2 - 1) * amount; }
function engineProfile() { return ENGINE_PROFILES[S.engine] || ENGINE_PROFILES.aphex; }

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

function autoMakeupGainDb(comp) {
  if (!comp || !comp.on) return 0;
  const thresholdAbs = Math.abs(Math.min(0, comp.threshold));
  const ratio = Math.max(1, comp.ratio || 1);
  return clamp(thresholdAbs * (1 - 1 / ratio) * 0.45, 0, 12);
}

function compDetectorSettings(comp) {
  const mode = comp.detector === 'peak' ? 'peak' : 'rms';
  const profile = mode === 'peak'
    ? { knee: 6, attack: 0.55, release: 0.85 }
    : mode === 'rms'
      ? { knee: 12, attack: 1.45, release: 1.25 }
      : { knee: 12, attack: 1.45, release: 1.25 };
  return {
    knee: profile.knee,
    attack: clamp((comp.attack / 1000) * profile.attack, 0.001, 1),
    release: clamp((comp.release / 1000) * profile.release, 0.01, 2),
  };
}

function dlyTimeSec() {
  // beat (quarter) duration in seconds, then multiplier
  const beat = 60 / S.bpm;
  return beat * FX.dly.mult;
}

/* ═══════════════════════════════════════════════
   GATED REVERB IR
═══════════════════════════════════════════════ */
function genRevIR() {
  if (!A) return;
  const size = FX.rev.size;   // 0..1 → short → long
  const damp = FX.rev.damp;   // 0..1 → brighter → darker
  const sampleRate = A.sampleRate;
  if (
    N.conv && N.conv.buffer && lastRevIRParams &&
    lastRevIRParams.size === size &&
    lastRevIRParams.damp === damp &&
    lastRevIRParams.sampleRate === sampleRate
  ) return;
  const dur  = 0.4 + size * 2.2;   // seconds
  const len  = Math.max(1, Math.floor(sampleRate * dur));
  const ir   = A.createBuffer(2, len, sampleRate);
  const decayExp = 2.4 - damp * 1.4; // higher damp → faster decay shape
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    // filtered noise — approximate room diffusion
    let lpState = 0;
    const lpCoef = .25 + damp * .55; // dampness = darker
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lpState += (white - lpState) * (1 - lpCoef);
      const env = Math.pow(1 - i / len, decayExp);
      d[i] = lpState * env;
    }
  }
  N.conv.buffer = ir;
  lastRevIRParams = { size, damp, sampleRate };
}

function scheduleRevIRRebuild() {
  if (!A) return;
  if (revIRRebuildTimer) clearTimeout(revIRRebuildTimer);
  revIRRebuildTimer = setTimeout(() => {
    revIRRebuildTimer = null;
    genRevIR();
  }, REV_IR_REBUILD_DEBOUNCE_MS);
}

/* ═══════════════════════════════════════════════
   VOICE SYNTHESIS — made to sound superb
═══════════════════════════════════════════════ */
function scheduleRouteVoiceCleanup(nodes, t, cleanupTailSec) {
  const boundedTailSec = Number.isFinite(cleanupTailSec) ? Math.max(0, cleanupTailSec) : ROUTE_VOICE_DEFAULT_CLEANUP_TAIL_SEC;
  const delaySec = Math.max(0, t - A.currentTime) + boundedTailSec;
  setTimeout(() => {
    nodes.forEach(node => {
      try { node.disconnect(); } catch (err) {}
    });
  }, delaySec * 1000);
}

function resolveReverbGateTailHoldSec(tr, cleanupTailSec) {
  const id = tr && tr.id;
  const name = tr && tr.n;
  const sourceTailAware = id === 'hihat' || id === 'synth' || id === 'hht' || id === 'syn' || name === 'HHT' || name === 'SYN';
  if (!sourceTailAware || !Number.isFinite(cleanupTailSec)) return 0;
  return clamp(cleanupTailSec, 0, REV_GATE_SOURCE_TAIL_MAX_EXTRA_SEC);
}

function routeVoice(t, ti, cleanupTailSec) {
  // create a per-hit gain so we can split to bus, delaySend, revSend at track-level
  const tr = TRACKS[ti];
  const out = A.createGain();
  const routeNodes = [out];
  out.gain.value = tr.vol;
  out.connect(N.bus);
  const delaySendActive = tr.dlyS && FX.dly.on && FX.dly.wet > 0;
  if (delaySendActive) {
    const ds = A.createGain(); ds.gain.value = DLY_SEND_TRIM;
    out.connect(ds); ds.connect(N.dlyLine);
    routeNodes.push(ds);
  }
  const reverbSendActive = tr.revS && FX.rev.on && FX.rev.wet > 0;
  if (reverbSendActive) {
    const rs = A.createGain(); rs.gain.value = REV_SEND_TRIM;
    out.connect(rs); rs.connect(N.revSend);
    routeNodes.push(rs);
    // Keep the send path unchanged while passing an optional source-tail hold to the reverb gate.
    const reverbTailHoldSec = typeof resolveReverbGateTailHoldSec === 'function' ? resolveReverbGateTailHoldSec(tr, cleanupTailSec) : 0;
    triggerGate(t, reverbTailHoldSec);
  }
  const wreckSendActive = tr.wreckS && !tr.mute && tr.vol > 0 && shouldFeedWreckProcessor();
  if (wreckSendActive) {
    const ws = A.createGain(); ws.gain.value = WRECK_SEND_TRIM;
    out.connect(ws); ws.connect(N.wreckIn);
    routeNodes.push(ws);
  }
  if (typeof scheduleRouteVoiceCleanup === 'function') scheduleRouteVoiceCleanup(routeNodes, t, cleanupTailSec);
  return out;
}

function triggerGate(t, sourceTailHoldSec = 0) {
  if (!FX.rev.on) return;
  const g = N.revGate.gain;
  const atk = .003, rel = .020;
  const rawBaseHold = Number.isFinite(FX.rev.gate) ? FX.rev.gate / 1000 : 0;
  const baseHold = Math.min(REV_GATE_SOURCE_TAIL_MAX_TOTAL_SEC, Math.max(0, rawBaseHold));
  const extraHold = Number.isFinite(sourceTailHoldSec) ? Math.max(0, sourceTailHoldSec) : 0;
  const hold = Math.min(REV_GATE_SOURCE_TAIL_MAX_TOTAL_SEC, baseHold + extraHold);
  cancelAndHoldOrSmoothParam(g, t, { floor: 0, smoothTime: .003, fallbackValue: 0 });
  g.linearRampToValueAtTime(1, t + atk);
  g.setValueAtTime(1, t + atk + hold);
  g.linearRampToValueAtTime(0, t + atk + hold + rel);
}

function triggerCompGate(t, trackId) {
  if (!FX.comp.gateOn || !N.compGate) return;
  const g = N.compGate.gain;
  const closed = dbToGain(FX.comp.gateThreshold);
  const weight = trackId === 'kick' ? KICK_PUMP_WEIGHT : NON_KICK_PUMP_WEIGHT;
  const analogAmount = clamp(FX.comp.gateAnalog == null ? .35 : FX.comp.gateAnalog, 0, 1);
  const analogJitter = (Math.random() * 2 - 1) * GATE_ANALOG_JITTER_MS * analogAmount / 1000;
  const analogClosedDb = (Math.random() * 2 - 1) * GATE_ANALOG_CLOSED_DB * analogAmount;
  const weightedClosed = clamp(closed + (1 - closed) * (1 - weight), dbToGain(-80), 1);
  const analogClosed = clamp(weightedClosed * dbToGain(analogClosedDb), dbToGain(-80), 1);
  const atk = Math.max(.001, .002 + analogJitter * .25), hold = Math.max(.003, .006 + Math.abs(analogJitter) * .5), rel = Math.max(.01, FX.comp.gateRate / 1000 + analogJitter);
  cancelAndHoldOrSmoothParam(g, t, { floor: dbToGain(-80), smoothTime: .003, fallbackValue: analogClosed });
  g.linearRampToValueAtTime(1, t + atk);
  g.setValueAtTime(1, t + atk + hold);
  g.setTargetAtTime(analogClosed, t + atk + hold, Math.max(.005, rel / 3));
}

function getTrackVoiceVelocity(trackIndex) {
  const tr = TRACKS[trackIndex];
  switch (tr && tr.id) {
    case 'kick': return KICK_VOICE_VELOCITY;
    case 'snare': return SNARE_VOICE_VELOCITY;
    case 'clap': return CLAP_VOICE_VELOCITY;
    case 'input': return INPUT_VOICE_VELOCITY;
    case 'ether': return ETHER_VOICE_VELOCITY;
    case 'synth': return SYNTH_VOICE_VELOCITY;
    default: return DEFAULT_VOICE_VELOCITY;
  }
}

// ── KICK ── deep thump with click and saturation
function synthKick(t, v, p) {
  const spec = KickVoice.resolveKickVoiceSpec(S.engine, p, v);
  const dest = routeVoice(t, 0, Math.max(spec.oscStopSec, spec.subStopSec, .025));
  // body oscillator (sine with pitch drop)
  const o = A.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(spec.attackHz, t);                 // attack spike
  o.frequency.exponentialRampToValueAtTime(spec.dropHz, t + .008); // initial drop
  o.frequency.exponentialRampToValueAtTime(spec.endHz, t + spec.bodyDecaySec * .6);
  // body envelope — resolved peak leaves headroom for click + sub
  const g = A.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(spec.bodyPeakGain, t + .003);
  g.gain.exponentialRampToValueAtTime(.001, t + spec.bodyDecaySec);
  // saturation on body
  const sat = A.createWaveShaper(); sat.curve = mkSatCurve(spec.driveAmount); sat.oversample = '2x';
  o.connect(sat); sat.connect(g); g.connect(dest);
  o.start(t); o.stop(t + spec.oscStopSec);
  // click layer — noise burst HP
  const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
  const nf = A.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = spec.clickHighpassHz; nf.Q.value = .7;
  const ng = A.createGain();
  ng.gain.setValueAtTime(spec.clickGain, t);
  ng.gain.exponentialRampToValueAtTime(.001, t + .018);
  ns.connect(nf); nf.connect(ng); ng.connect(dest);
  ns.start(t); ns.stop(t + .025);
  // sub body reinforcement
  const o2 = A.createOscillator(); o2.type = 'sine'; o2.frequency.value = spec.endHz * .75;
  const g2 = A.createGain();
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(spec.subPeakGain, t + .01);
  g2.gain.exponentialRampToValueAtTime(.001, t + spec.subDecaySec);
  o2.connect(g2); g2.connect(dest);
  o2.start(t); o2.stop(t + spec.subStopSec);

  // digital crack — short square-wave burst for aphex/IDM kick character
  if (spec.digitalCrackGain > 0.001) {
    const dc = A.createOscillator(); dc.type = 'square';
    dc.frequency.value = spec.digitalCrackHz;
    const dg = A.createGain();
    dg.gain.setValueAtTime(spec.digitalCrackGain, t);
    dg.gain.exponentialRampToValueAtTime(.001, t + 0.006);
    dc.connect(dg); dg.connect(dest);
    dc.start(t); dc.stop(t + 0.008);
  }
}

// ── SNARE ── noise + pitched shell + crack
function synthSnare(t, v, p) {
  const spec = SnareVoice.resolveSnareVoiceSpec(S.engine, p, v);
  const dest = routeVoice(t, 1, Math.max(spec.noiseStopSec, spec.shellStopSec, spec.crackStopSec));
  // noise body (bandpass 1.5–4kHz)
  const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
  const nf = A.createBiquadFilter();  nf.type = 'bandpass'; nf.frequency.value = spec.noiseBandpassHz; nf.Q.value = .5;
  const nhp = A.createBiquadFilter(); nhp.type = 'highpass'; nhp.frequency.value = spec.noiseHighpassHz;
  const ng = A.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(spec.noisePeakGain, t + .0018);
  ng.gain.exponentialRampToValueAtTime(.001, t + spec.noiseDecaySec);
  ns.connect(nf); nf.connect(nhp); nhp.connect(ng); ng.connect(dest);
  ns.start(t); ns.stop(t + spec.noiseStopSec);
  // pitched shell — two triangles an octave apart
  const t1 = A.createOscillator(); t1.type = 'triangle'; t1.frequency.value = spec.shellFundHz;
  const t2 = A.createOscillator(); t2.type = 'triangle'; t2.frequency.value = spec.shellOvertoneHz;
  const tg = A.createGain();
  tg.gain.setValueAtTime(0, t);
  tg.gain.linearRampToValueAtTime(spec.shellPeakGain, t + .0015);
  tg.gain.exponentialRampToValueAtTime(.001, t + spec.shellDecaySec);
  t1.connect(tg); t2.connect(tg); tg.connect(dest);
  t1.start(t); t1.stop(t + spec.shellStopSec);
  t2.start(t); t2.stop(t + spec.shellStopSec);
  // transient crack — very short noise burst HP
  const cr = A.createBufferSource(); cr.buffer = nz; cr.loop = true;
  const cf = A.createBiquadFilter();  cf.type = 'highpass'; cf.frequency.value = spec.crackHighpassHz;
  const cg = A.createGain();
  cg.gain.setValueAtTime(spec.crackPeakGain, t);
  cg.gain.exponentialRampToValueAtTime(.001, t + spec.crackDecaySec);
  cr.connect(cf); cf.connect(cg); cg.connect(dest);
  cr.start(t); cr.stop(t + spec.crackStopSec);

  // digital crack — short square-wave burst for IDM/industrial engines
  if (spec.digitalCrackGain > 0.001) {
    const dc = A.createOscillator(); dc.type = 'square';
    dc.frequency.value = spec.digitalCrackHz;
    const dg = A.createGain();
    dg.gain.setValueAtTime(spec.digitalCrackGain, t);
    dg.gain.exponentialRampToValueAtTime(.001, t + 0.006);
    dc.connect(dg); dg.connect(dest);
    dc.start(t); dc.stop(t + 0.008);
  }
}

function triggerHihatChoke(t, openAmount, choke, spec) {
  spec = spec || {};
  const previous = hihatChokeState.gain;
  const previousOpen = hihatChokeState.open;
  const currentOpen = clamp(openAmount, 0, 1);
  const hihatChokeFloor = clamp(Number.isFinite(spec.chokeFloor) ? spec.chokeFloor : .0008, .0008, .004);
  if (previous && previous.gain) {
    const g = previous.gain;
    cancelAndHoldOrSmoothParam(g, t, { floor: hihatChokeFloor, smoothTime: .003, fallbackValue: hihatChokeFloor });
    const tau = HihatVoice.calculateHihatChokeTau(currentOpen, previousOpen, spec);
    g.setTargetAtTime(hihatChokeFloor, t, tau);
  }
  hihatChokeState.gain = choke;
  hihatChokeState.open = currentOpen;
}

// ── HIHAT ── highpass noise + engine-aware metallic ratios on existing HHT open control
function synthHihat(t, v, p) {
  const spec = HihatVoice.resolveHihatVoiceSpec(S.engine, p, Math.random, v);
  const hihatBudget = HihatVoice.resolveHihatRenderBudget(spec, {
    mobile: typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ''),
    denseRatchet: !!(p && p.denseRatchet),
  });
  const metallicFrequencies = hihatBudget.budgetedOscillatorFrequencies || spec.oscillatorFrequencies || [];
  const openAccentBloomLift = clamp(1 + spec.openAccentBloom * .18, 1, 1.06);
  const hihatTailSec = Math.max(
    spec.noiseTailSec + spec.tailReleaseTau * 4,
    hihatBudget.useOpenSplash && spec.openSplashGain > 0.001 ? spec.openSplashTailSec + spec.tailReleaseTau * 4 : 0,
    hihatBudget.useOpenShimmer && spec.openShimmerGain > 0.001 ? spec.openShimmerTailSec + spec.tailReleaseTau * 4 : 0,
    hihatBudget.useOpenBody && spec.openBodyGain > 0.001 ? spec.openBodyTailSec + spec.tailReleaseTau * 4 : 0,
    hihatBudget.useOpenFlutter && spec.openFlutterGain > 0.001 ? spec.openFlutterTailSec + spec.tailReleaseTau : 0,
    hihatBudget.useMetallicRattle && spec.metallicRattleGain > 0.001 ? spec.metallicRattleTailSec + spec.tailReleaseTau * 3 : 0,
    hihatBudget.useIdmSpark && spec.idmSparkGain > 0.001 ? spec.idmSparkTailSec + spec.tailReleaseTau * 4 : 0,
    hihatBudget.useGhostTick && spec.ghostTickGain > 0.001 ? spec.ghostTickTailSec + spec.tailReleaseTau * 4 : 0,
    spec.metalGain > 0.001 ? spec.metalTailSec + spec.tailReleaseTau * 4 : 0,
    hihatBudget.useGlitch && spec.glitchWillFire ? .010 : 0
  );
  const dest = routeVoice(t, 2, hihatTailSec);
  const choke = A.createGain();
  const hihatChokeFloor = clamp(Number.isFinite(spec.chokeFloor) ? spec.chokeFloor : .0008, .0008, .004);
  choke.gain.setValueAtTime(0, t);
  choke.gain.linearRampToValueAtTime(1, t + spec.attackSec);
  choke.gain.setTargetAtTime(hihatChokeFloor, t + spec.noiseTailSec, spec.tailReleaseTau);
  const hatPolish = A.createGain();
  hatPolish.gain.setValueAtTime(spec.outputTrim, t);
  const hatAir = A.createBiquadFilter(); hatAir.type = 'lowpass';
  hatAir.frequency.value = spec.airLowpassHz;
  hatAir.Q.value = spec.airLowpassQ;
  choke.connect(hatPolish); hatPolish.connect(hatAir); hatAir.connect(dest);
  triggerHihatChoke(t, p.open, choke, spec);
  // noise layer
  const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
  const hf = A.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = spec.highpassHz; hf.Q.value = .8;
  const hf2 = A.createBiquadFilter(); hf2.type = 'bandpass'; hf2.frequency.value = spec.bandpassHz; hf2.Q.value = spec.bandpassQ;
  const ng = A.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(clamp(v * spec.noiseGain * spec.transientGain, 0, .72), t + spec.attackSec);
  ng.gain.setTargetAtTime(.001, t + spec.noiseTailSec * spec.openTailExtend, spec.tailReleaseTau);
  ns.connect(hf); hf.connect(hf2); hf2.connect(ng); ng.connect(choke);
  ns.start(t); ns.stop(t + spec.noiseTailSec + spec.tailReleaseTau * 4);
  if (hihatBudget.useOpenShimmer && spec.openShimmerGain > 0.001) {
    const shimmer = A.createBufferSource(); shimmer.buffer = nz; shimmer.loop = true;
    const sf = A.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = spec.openShimmerHz; sf.Q.value = spec.openShimmerQ;
    const sg = A.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(clamp(v * spec.openShimmerGain * openAccentBloomLift, 0, .085), t + spec.attackSec);
    sg.gain.setTargetAtTime(.001, t + spec.openShimmerTailSec * spec.openTailExtend, spec.tailReleaseTau);
    shimmer.connect(sf); sf.connect(sg); sg.connect(choke);
    shimmer.start(t); shimmer.stop(t + spec.openShimmerTailSec + spec.tailReleaseTau * 4);
  }
  if (hihatBudget.useOpenSplash && spec.openSplashGain > 0.001) {
    const splash = A.createBufferSource(); splash.buffer = nz; splash.loop = true;
    const splashFilter = A.createBiquadFilter(); splashFilter.type = 'bandpass';
    splashFilter.frequency.value = spec.openSplashHz;
    splashFilter.Q.value = spec.openSplashQ;
    const splashGain = A.createGain();
    splashGain.gain.setValueAtTime(0, t);
    splashGain.gain.linearRampToValueAtTime(clamp(v * spec.openSplashGain, 0, .055), t + Math.min(.0025, spec.attackSec));
    splashGain.gain.setTargetAtTime(.001, t + spec.openSplashTailSec * spec.openSplashHold, spec.tailReleaseTau);
    splash.connect(splashFilter); splashFilter.connect(splashGain); splashGain.connect(choke);
    splash.start(t); splash.stop(t + spec.openSplashTailSec + spec.tailReleaseTau * 4);
  }
  if (hihatBudget.useOpenBody && spec.openBodyGain > 0.001) {
    const body = A.createBufferSource(); body.buffer = nz; body.loop = true;
    const bf = A.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = spec.openBodyHz; bf.Q.value = spec.openBodyQ;
    const bg = A.createGain();
    bg.gain.setValueAtTime(0, t);
    bg.gain.linearRampToValueAtTime(clamp(v * spec.openBodyGain * openAccentBloomLift, 0, .11), t + spec.attackSec);
    bg.gain.setTargetAtTime(.001, t + spec.openBodyTailSec * spec.openTailExtend, spec.tailReleaseTau);
    body.connect(bf); bf.connect(bg); bg.connect(choke);
    body.start(t); body.stop(t + spec.openBodyTailSec + spec.tailReleaseTau * 4);
  }
  if (hihatBudget.useOpenFlutter && spec.openFlutterGain > 0.001) {
    const flutter = A.createBufferSource(); flutter.buffer = nz; flutter.loop = true;
    const flutterFilter = A.createBiquadFilter(); flutterFilter.type = 'bandpass';
    flutterFilter.frequency.value = spec.openFlutterHz;
    flutterFilter.Q.value = spec.openFlutterQ;
    const flutterGain = A.createGain();
    flutterGain.gain.setValueAtTime(0, t);
    flutterGain.gain.linearRampToValueAtTime(clamp(v * spec.openFlutterGain, 0, .045), t + Math.min(.002, spec.attackSec));
    const openSizzleTailHold = clamp(.42 + spec.openSizzleTailBias * .9, .42, .69);
    flutterGain.gain.setTargetAtTime(.001, t + spec.openFlutterTailSec * openSizzleTailHold, spec.tailReleaseTau * .45);
    flutter.connect(flutterFilter); flutterFilter.connect(flutterGain); flutterGain.connect(choke);
    flutter.start(t); flutter.stop(t + spec.openFlutterTailSec + spec.tailReleaseTau);
  }
  if (hihatBudget.useMetallicRattle && spec.metallicRattleGain > 0.001) {
    const metallicRattle = A.createBufferSource(); metallicRattle.buffer = nz; metallicRattle.loop = true;
    const metallicRattleFilter = A.createBiquadFilter(); metallicRattleFilter.type = 'bandpass';
    metallicRattleFilter.frequency.value = spec.metallicRattleHz;
    metallicRattleFilter.Q.value = spec.metallicRattleQ;
    const metallicRattleGain = A.createGain();
    metallicRattleGain.gain.setValueAtTime(0, t);
    metallicRattleGain.gain.linearRampToValueAtTime(clamp(v * spec.metallicRattleGain, 0, .052), t + Math.min(.002, spec.attackSec));
    const metallicRattleHold = clamp(.46 + spec.openSizzleTailBias * .65 + spec.openAccentBloom * .18, .46, .72);
    metallicRattleGain.gain.setTargetAtTime(.001, t + spec.metallicRattleTailSec * metallicRattleHold, spec.tailReleaseTau * .70);
    metallicRattle.connect(metallicRattleFilter); metallicRattleFilter.connect(metallicRattleGain);
    if (typeof A.createStereoPanner === 'function') {
      const metallicRattlePan = A.createStereoPanner();
      metallicRattlePan.pan.value = spec.metallicRattlePan;
      metallicRattleGain.connect(metallicRattlePan); metallicRattlePan.connect(choke);
    } else {
      metallicRattleGain.connect(choke);
    }
    metallicRattle.start(t); metallicRattle.stop(t + spec.metallicRattleTailSec + spec.tailReleaseTau * 3);
  }
  if (hihatBudget.useIdmSpark && spec.idmSparkGain > 0.001) {
    const spark = A.createBufferSource(); spark.buffer = nz; spark.loop = true;
    const sparkFilter = A.createBiquadFilter(); sparkFilter.type = 'bandpass';
    sparkFilter.frequency.value = spec.idmSparkHz;
    sparkFilter.Q.value = spec.idmSparkQ;
    const sparkGain = A.createGain();
    sparkGain.gain.setValueAtTime(0, t);
    sparkGain.gain.linearRampToValueAtTime(clamp(v * spec.idmSparkGain, 0, .065 + (spec.aphexClosedNeedleAccent || 0) * .007), t + Math.min(.0015, spec.attackSec));
    sparkGain.gain.setTargetAtTime(.001, t + spec.idmSparkTailSec, spec.tailReleaseTau);
    spark.connect(sparkFilter); sparkFilter.connect(sparkGain); sparkGain.connect(choke);
    spark.start(t); spark.stop(t + spec.idmSparkTailSec + spec.tailReleaseTau * 4);
  }
  if (hihatBudget.useGhostTick && spec.ghostTickGain > 0.001) {
    const ghostTick = A.createBufferSource(); ghostTick.buffer = nz; ghostTick.loop = true;
    const ghostFilter = A.createBiquadFilter(); ghostFilter.type = 'bandpass';
    ghostFilter.frequency.value = spec.ghostTickHz;
    ghostFilter.Q.value = spec.ghostTickQ;
    const ghostGain = A.createGain();
    ghostGain.gain.setValueAtTime(0, t);
    ghostGain.gain.linearRampToValueAtTime(clamp(v * spec.ghostTickGain, 0, .04), t + Math.min(.0012, spec.attackSec));
    ghostGain.gain.setTargetAtTime(.001, t + spec.ghostTickTailSec, spec.tailReleaseTau);
    ghostTick.connect(ghostFilter); ghostFilter.connect(ghostGain); ghostGain.connect(choke);
    ghostTick.start(t); ghostTick.stop(t + spec.ghostTickTailSec + spec.tailReleaseTau * 4);
  }
  // metallic tone mix — only if metal > 0
  if (spec.metalGain > 0.001 && metallicFrequencies.length) {
    const mg = A.createGain();
    mg.gain.setValueAtTime(0, t);
    mg.gain.linearRampToValueAtTime(clamp(v * spec.metalGain * spec.tailHeadroomTrim, 0, .34), t + Math.max(.0008, spec.attackSec * .8));
    mg.gain.setTargetAtTime(.001, t + spec.metalTailSec * spec.openTailExtend, spec.tailReleaseTau * .75);
    const hp = A.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = spec.metalHighpassHz;
    mg.connect(hp); hp.connect(choke);
    const metallicOscillatorGain = clamp(spec.oscillatorGain * (spec.oscillatorFrequencies.length / metallicFrequencies.length), 0, .25);
    for (const frequency of metallicFrequencies) {
      const o = A.createOscillator(); o.type = spec.oscType;
      o.frequency.value = frequency;
      const og = A.createGain(); og.gain.value = metallicOscillatorGain;
      o.connect(og); og.connect(mg);
      o.start(t); o.stop(t + spec.metalTailSec + spec.tailReleaseTau * 4);
    }
  }
  if (hihatBudget.useGlitch && spec.glitchWillFire) {
    const tick = A.createBufferSource(); tick.buffer = nz; tick.loop = true;
    const tf = A.createBiquadFilter(); tf.type = 'bandpass'; tf.frequency.value = spec.glitchBandpassHz; tf.Q.value = 12;
    const tg = A.createGain();
    tg.gain.setValueAtTime(0, t);
    tg.gain.linearRampToValueAtTime(clamp(v * spec.glitchGain, 0, .06), t + .0008);
    tg.gain.exponentialRampToValueAtTime(.001, t + .006);
    tick.connect(tf); tf.connect(tg); tg.connect(choke);
    tick.start(t); tick.stop(t + .010);
  }
}

function previewHihat(openAmount) {
  initAudio();
  const tr = TRACKS[2];
  const t = A.currentTime + .015;
  const p = { ...tr.p, open: openAmount };
  triggerCompGate(t, tr.id);
  synthHihat(t, HIHAT_NORMAL_VELOCITY, p);
}

function previewVoice(trackIndex, synthFn) {
  if (S.playing) return;
  initAudio();
  const tr = TRACKS[trackIndex];
  const t = A.currentTime + .018;
  triggerCompGate(t, tr.id);
  synthFn(t, getTrackVoiceVelocity(trackIndex), tr.p);
}

function previewInput() {
  if (!TRACKS[4].smp) {
    toast('load a sample first');
    return;
  }
  previewVoice(4, synthInput);
}

function previewEngineKit() {
  if (S.playing) return;
  initAudio();
  const t = A.currentTime + .018;
  const kick = TRACKS[0];
  const snare = TRACKS[1];
  const hihat = TRACKS[2];
  const synth = TRACKS[6];

  triggerCompGate(t, kick.id);
  synthKick(t, getTrackVoiceVelocity(0), kick.p);

  triggerCompGate(t + .12, snare.id);
  synthSnare(t + .12, getTrackVoiceVelocity(1), snare.p);

  triggerCompGate(t + .24, hihat.id);
  synthHihat(t + .24, HIHAT_NORMAL_VELOCITY, { ...hihat.p, open: HHT_PLACE });

  triggerCompGate(t + .36, synth.id);
  synthSynth(t + .36, getTrackVoiceVelocity(6), { ...synth.p, pitch: getStepSynthPitch(LAST_SYNTH_NOTE_STEP) }, { audition: true });
}

// ── CLAP ── 3 short bursts + tail
function synthClap(t, v, p) {
  const spec = ClapVoice.resolveClapVoiceSpec(S.engine, p, v);
  const clapTailSec = spec.bursts.reduce((tailSec, b) => Math.max(tailSec, b.offsetSec + b.durationSec + spec.stopPaddingSec), 0);
  const dest = routeVoice(t, 3, clapTailSec);
  for (const b of spec.bursts) {
    const bt = t + b.offsetSec;
    const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
    const bp = A.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = clamp(spec.toneHz + (Math.random() - .5) * spec.toneJitterHz, 700, 6000);
    bp.Q.value = spec.filterQ;
    const hp = A.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = spec.highpassHz;
    const g = A.createGain();
    g.gain.setValueAtTime(0, bt);
    g.gain.linearRampToValueAtTime(b.gain, bt + .0008);
    g.gain.exponentialRampToValueAtTime(.001, bt + b.durationSec);
    ns.connect(bp); bp.connect(hp); hp.connect(g);
    if (typeof A.createStereoPanner === 'function') {
      const pan = A.createStereoPanner();
      pan.pan.value = b.pan;
      g.connect(pan); pan.connect(dest);
    } else {
      g.connect(dest);
    }
    ns.start(bt); ns.stop(bt + b.durationSec + spec.stopPaddingSec);
  }

  // digital texture — short high-frequency noise burst for IDM/industrial engines
  if (spec.digitalTextureGain > 0.001) {
    const dt = A.createBufferSource(); dt.buffer = nz; dt.loop = true;
    const df = A.createBiquadFilter(); df.type = 'highpass';
    df.frequency.value = spec.digitalCrackleHz;
    const dg = A.createGain();
    dg.gain.setValueAtTime(spec.digitalTextureGain, t);
    dg.gain.exponentialRampToValueAtTime(.001, t + 0.008);
    dt.connect(df); df.connect(dg); dg.connect(dest);
    dt.start(t); dt.stop(t + 0.010);
  }
}

// ── INPUT ── sample playback
function synthInput(t, v, p) {
  const tr = TRACKS[4];
  if (!tr.smp) return;
  const rawPitch = Number(p.pitch);
  const finitePitch = Number.isFinite(rawPitch) && Math.abs(rawPitch) >= .01 ? rawPitch : 1;
  const safePitch = Math.sign(finitePitch) * Math.min(Math.abs(finitePitch), 16);
  const rate = Math.abs(safePitch);
  const sampleDur = tr.smp.duration / rate;
  const dur = p.decay < 1.0 ? sampleDur * p.decay : sampleDur;
  const attackSec = .003;
  const releaseSec = .008;
  const stopAt = t + Math.min(dur, sampleDur);
  const attackEnd = Math.min(t + attackSec, stopAt);
  const fadeStart = Math.min(stopAt, Math.max(attackEnd, stopAt - releaseSec));
  const dest = routeVoice(t, 4, stopAt - t);
  const src = A.createBufferSource(); src.buffer = tr.smp;
  src.playbackRate.value = safePitch;
  const g = A.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, attackEnd);
  if (p.decay < 1.0) {
    const decayEnd = Math.min(stopAt, Math.max(attackEnd, fadeStart));
    g.gain.exponentialRampToValueAtTime(.001, decayEnd);
  }
  g.gain.setValueAtTime(p.decay < 1.0 ? .001 : v, fadeStart);
  g.gain.linearRampToValueAtTime(0, stopAt);
  src.connect(g); g.connect(dest);
  src.onended = () => {
    try { src.disconnect(); } catch (_) {}
    try { g.disconnect(); } catch (_) {}
  };
  src.start(t);
  src.stop(stopAt);
}

function createUnipolarModulationCurve(size = 256) {
  const curve = new Float32Array(size);
  const last = Math.max(1, size - 1);
  for (let i = 0; i < size; i++) curve[i] = i / last;
  return curve;
}

// ── ETHER ── EM-field interference (preserved from v3)
function synthEther(t, v, p) {
  const etherTailSec = Math.max(0, p.decay + .06);
  const dest = routeVoice(t, 5, etherTailSec);
  const doHum   = p.mode === 'hum'   || p.mode === 'ether';
  const doClock = p.mode === 'clock' || p.mode === 'ether';
  const doWifi  = p.mode === 'wifi'  || p.mode === 'ether';

  const out = A.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(v, t + .004);
  out.gain.exponentialRampToValueAtTime(.001, t + p.decay + .04);

  const ws = A.createWaveShaper();
  const wc = new Float32Array(512);
  for (let i = 0; i < 512; i++) {
    const x = i * 2 / 512 - 1;
    wc[i] = Math.tanh(x * (1 + p.grit * 16));
  }
  ws.curve = wc; ws.oversample = '2x';
  ws.connect(out); out.connect(dest);

  if (doHum) {
    const hm = A.createGain(); hm.gain.value = p.mode === 'ether' ? .4 : .85;
    hm.connect(ws);
    const nh = Math.round(2 + p.harmonics * 7);
    for (let h = 1; h <= nh; h++) {
      const fr = p.freq * (h * 2 - 1); if (fr > 16000) break;
      const o = A.createOscillator(); o.type = h === 1 ? 'sawtooth' : 'square';
      o.frequency.value = fr * (1 + (Math.random() * 2 - 1) * .003);
      const hg = A.createGain(); hg.gain.value = (1 / Math.pow(h, 1.3 - p.texture * .6)) * .16;
      o.connect(hg); hg.connect(hm);
      o.start(t); o.stop(t + p.decay + .06);
    }
    const so = A.createOscillator(); so.type = 'sine'; so.frequency.value = p.freq * .5;
    const sg = A.createGain(); sg.gain.value = .1;
    so.connect(sg); sg.connect(hm);
    so.start(t); so.stop(t + p.decay + .06);
  }
  if (doClock) {
    const cm = A.createGain(); cm.gain.value = p.mode === 'ether' ? .3 : .75;
    cm.connect(ws);
    const nb = Math.round(2 + p.texture * 6);
    for (let b = 0; b < nb; b++) {
      const bt = t + b * (p.decay / nb); if (bt > t + p.decay) break;
      const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
      const bf = A.createBiquadFilter(); bf.type = 'bandpass';
      bf.frequency.value = 3200 + p.texture * 8000 + Math.random() * 2000;
      bf.Q.value = 8 + p.texture * 20;
      const bg = A.createGain();
      const dur = .006 + p.texture * .018;
      bg.gain.setValueAtTime(0, bt);
      bg.gain.linearRampToValueAtTime(.38, bt + .001);
      bg.gain.exponentialRampToValueAtTime(.001, bt + dur);
      ns.connect(bf); bf.connect(bg); bg.connect(cm);
      ns.start(bt); ns.stop(bt + dur + .005);
    }
  }
  if (doWifi) {
    const rm = A.createGain(); rm.gain.value = p.mode === 'ether' ? .25 : .7;
    rm.connect(ws);
    [{ fc: 1800 + p.texture * 3000, q: 2.5, l: .5 },
     { fc: 5500 + p.texture * 5000, q: 3.8, l: .32 }].forEach(b => {
      const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
      const bf = A.createBiquadFilter(); bf.type = 'bandpass';
      bf.frequency.value = b.fc; bf.Q.value = b.q;
      const am = A.createOscillator(); am.type = 'square';
      am.frequency.value = 120 + Math.random() * 200;
      const amUni = A.createWaveShaper(); amUni.curve = createUnipolarModulationCurve();
      const amG = A.createGain(); amG.gain.value = .28;
      am.connect(amUni); amUni.connect(amG);
      const env = A.createGain();
      env.gain.setValueAtTime(b.l * .5, t);
      env.gain.exponentialRampToValueAtTime(.001, t + p.decay * .9);
      amG.connect(env.gain);
      ns.connect(bf); bf.connect(env); env.connect(rm);
      am.start(t); am.stop(t + p.decay + .06);
      ns.start(t); ns.stop(t + p.decay + .06);
    });
  }
}

function createSynthVoiceCleanupHandle(nodes) {
  let cleaned = false;
  return function cleanupSynthVoice(stopAt) {
    if (cleaned) return;
    cleaned = true;
    const safeStopAt = Number.isFinite(stopAt) ? stopAt : (A.currentTime || 0);
    nodes.forEach((node) => {
      if (!node) return;
      if (typeof node.stop === 'function') {
        try { node.stop(safeStopAt); } catch (err) { /* source may already be stopped */ }
      }
    });
    const disconnectDelayMs = Math.max(0, Math.ceil((safeStopAt - (A.currentTime || 0)) * 1000) + 25);
    setTimeout(() => {
      nodes.forEach((node) => {
        if (!node || typeof node.disconnect !== 'function') return;
        try { node.disconnect(); } catch (err) { /* node may already be disconnected */ }
      });
    }, disconnectDelayMs);
  };
}

function triggerSynthChoke(t, voiceGain, spec, cleanup, timeSincePreviousSec = Infinity) {
  const previous = synthVoiceState.gain;
  const previousCleanup = synthVoiceState.cleanup;
  const isLegato = timeSincePreviousSec < 0.085;
  if (previous && previous.gain && !isLegato) {
    const g = previous.gain;
    cancelAndHoldOrSmoothParam(g, t, { floor: .0008, smoothTime: .003, fallbackValue: .0008 });
    g.setTargetAtTime(.0008, t, spec.chokeTau);
  }
  if (previousCleanup && !isLegato) {
    const cleanupAt = t + Math.max(.02, Math.min(.18, spec.chokeTau * 6));
    previousCleanup(cleanupAt);
  }
  synthVoiceState.gain = voiceGain;
  synthVoiceState.cleanup = cleanup;
}

function applySynthGlideFrequency(frequencyParam, targetHz, t, spec, shouldGlide, previousTargetHz) {
  const target = clamp(targetHz, SYNTH_OSC_SAFETY_MIN_HZ, SYNTH_OSC_SAFETY_MAX_HZ);
  const previous = clamp(previousTargetHz, SYNTH_OSC_SAFETY_MIN_HZ, SYNTH_OSC_SAFETY_MAX_HZ);
  frequencyParam.setValueAtTime(shouldGlide ? previous : target, t);
  if (shouldGlide) frequencyParam.setTargetAtTime(target, t, spec.glideSec);
}

// ── SYNTH ── playable monophonic row with engine-selected personalities
function synthSynth(t, v, p, options = {}) {
  const audition = options.audition === true;
  const spec = SynthVoice.resolveSynthVoiceSpec(S.engine, p);
  const dest = routeVoice(t, 6, spec.stopSec);
  const voiceGain = A.createGain();
  const synthCleanupNodes = [voiceGain];
  const peakGain = clamp(v * spec.bodyGain, 0, .7);
  const sustainFloor = 0.012;
  voiceGain.gain.setValueAtTime(0, t); // zero-floor start: prevents oscillator DC click at trigger
  voiceGain.gain.linearRampToValueAtTime(peakGain, t + spec.attackSec);
  voiceGain.gain.exponentialRampToValueAtTime(Math.max(sustainFloor, peakGain * 0.08), t + spec.decaySec);
  voiceGain.gain.exponentialRampToValueAtTime(.001, t + spec.decaySec + spec.releaseTau * 3);
  voiceGain.connect(dest);

  const osc = A.createOscillator();
  osc.type = spec.oscType;
  const previousPitchHz = audition ? null : synthVoiceState.pitchHz;
  const previousTriggerTime = audition ? null : synthVoiceState.triggerTime;
  const timeSincePreviousSec = (!audition && Number.isFinite(previousTriggerTime) && t >= previousTriggerTime) ? (t - previousTriggerTime) : Infinity;
  const recentlyTriggered = Number.isFinite(previousTriggerTime) && t >= previousTriggerTime && (t - previousTriggerTime) <= Math.max(spec.stopSec, spec.glideSec);
  const shouldGlide = spec.glideSec > 0 && recentlyTriggered && Number.isFinite(previousPitchHz) && previousPitchHz !== spec.pitchHz;
  applySynthGlideFrequency(osc.frequency, spec.pitchHz, t, spec, shouldGlide, previousPitchHz);
  if (Number.isFinite(spec.detuneCents)) osc.detune.setValueAtTime(spec.detuneCents, t);
  if (!audition) {
    synthVoiceState.pitchHz = spec.pitchHz;
    synthVoiceState.triggerTime = t;
  }

  const filter = A.createBiquadFilter();
  filter.type = spec.filterType;
  filter.frequency.cancelScheduledValues(t);
  filter.frequency.setValueAtTime(spec.filterRestHz, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, spec.filterTriggerHz), t + spec.filterAttackSec);
  filter.frequency.exponentialRampToValueAtTime(Math.max(80, spec.filterRestHz), t + spec.filterDecaySec);
  filter.Q.setValueAtTime(spec.filterQ, t);
  const sat = A.createWaveShaper(); sat.curve = mkSatCurve(spec.driveAmount); sat.oversample = '2x';
  osc.connect(filter); filter.connect(sat); sat.connect(voiceGain);
  synthCleanupNodes.push(osc, filter, sat);
  osc.start(t); osc.stop(t + spec.stopSec);

  if (spec.modIndex > 0) {
    const mod = A.createOscillator(); mod.type = 'sine';
    applySynthGlideFrequency(mod.frequency, spec.pitchHz * spec.modRatio, t, spec, shouldGlide, previousPitchHz * spec.modRatio);
    const modGain = A.createGain();
    modGain.gain.setValueAtTime(spec.modIndex, t);
    modGain.gain.exponentialRampToValueAtTime(.001, t + Math.min(spec.decaySec, .65));
    mod.connect(modGain); modGain.connect(osc.frequency);
    synthCleanupNodes.push(mod, modGain);
    mod.start(t); mod.stop(t + spec.stopSec);
  }

  if (spec.subGain > 0.001) {
    const sub = A.createOscillator(); sub.type = 'sine';
    applySynthGlideFrequency(sub.frequency, spec.pitchHz * .5, t, spec, shouldGlide, previousPitchHz * .5);
    const sg = A.createGain();
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(clamp(v * spec.subGain, 0, .35), t + spec.attackSec);
    sg.gain.exponentialRampToValueAtTime(Math.max(0.006, clamp(v * spec.subGain, 0, .35) * 0.08), t + spec.decaySec * 0.9);
    sg.gain.exponentialRampToValueAtTime(.001, t + spec.decaySec + spec.releaseTau * 2);
    sub.connect(sg); sg.connect(voiceGain);
    synthCleanupNodes.push(sub, sg);
    sub.start(t); sub.stop(t + spec.stopSec);
  }

  if (spec.noiseGain > 0.001) {
    const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
    const nf = A.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = spec.filterHz; nf.Q.value = Math.max(2, spec.filterQ);
    const ng = A.createGain();
    const noisePeak = clamp(v * spec.noiseGain, 0, .16);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(noisePeak, t + spec.attackSec);
    ng.gain.exponentialRampToValueAtTime(.001, t + Math.min(.16, spec.decaySec));
    ns.connect(nf); nf.connect(ng); ng.connect(voiceGain);
    synthCleanupNodes.push(ns, nf, ng);
    ns.start(t); ns.stop(t + Math.min(.22, spec.stopSec));
  }
  if (!audition) {
    triggerSynthChoke(t, voiceGain, spec, createSynthVoiceCleanupHandle(synthCleanupNodes), timeSincePreviousSec);
  }
}

function previewSynth() {
  initAudio();
  const tr = TRACKS[6];
  const t = A.currentTime + .015;
  triggerCompGate(t, tr.id);
  synthSynth(t, getTrackVoiceVelocity(6), { ...tr.p, pitch: getStepSynthPitch(LAST_SYNTH_NOTE_STEP) }, { audition: true });
}

function previewSynthNoteEditAudition() {
  if (S.playing) return;
  previewSynth();
}

function scheduleVoiceEditAudition(trackId) {
  if (S.playing) return;
  clearTimeout(voiceEditAuditionTimer);
  voiceEditAuditionTimer = setTimeout(() => {
    voiceEditAuditionTimer = null;
    if (S.playing) return;
    switch (trackId) {
      case 'kick': previewVoice(0, synthKick); break;
      case 'snare': previewVoice(1, synthSnare); break;
      case 'hihat': previewHihat(HHT_PLACE); break;
      case 'clap': previewVoice(3, synthClap); break;
      case 'input': previewInput(); break;
      case 'ether': previewVoice(5, synthEther); break;
      case 'synth': previewSynth(); break;
      default: break;
    }
  }, VOICE_EDIT_AUDITION_DEBOUNCE_MS);
}

function getStepHihatOpen(step) {
  return State.getHihatOpenness(HHT_OPENNESS[S.patt], step);
}

function getHihatAccentVelocity(accented) {
  return accented ? HIHAT_ACCENT_VELOCITY : HIHAT_NORMAL_VELOCITY;
}

function getStepHihatVelocity(step) {
  return getHihatAccentVelocity(State.getHihatAccent(HHT_ACCENT[S.patt], step));
}

function getStepSynthRatio(step) {
  return State.getSynthNoteRatio(SYNTH_NOTES[S.patt], step);
}

function getStepSynthPitch(step) {
  return State.synthPitchForStep(TRACKS[6].p.pitch, getStepSynthRatio(step));
}

function getStepSynthAudiblePitch(step) {
  return SynthVoice.resolveSynthVoiceSpec(S.engine, { ...TRACKS[6].p, pitch: getStepSynthPitch(step) }).pitchHz;
}

function setLastSynthNoteStep(step) {
  LAST_SYNTH_NOTE_STEP = clamp(Number.isInteger(step) ? step : 0, 0, 15);
}

function synthNoteStatusText(step) {
  const boundedStep = clamp(Number.isInteger(step) ? step : LAST_SYNTH_NOTE_STEP, 0, 15);
  const ratio = getStepSynthRatio(boundedStep);
  return State.formatSynthNoteCompactStatusLabel({
    stepIndex: boundedStep,
    ratio,
    pitchHz: getStepSynthAudiblePitch(boundedStep),
    engine: S.engine,
  });
}

function synthNoteEditHintText(step) {
  const boundedStep = clamp(Number.isInteger(step) ? step : LAST_SYNTH_NOTE_STEP, 0, 15);
  return State.formatSynthNoteEditHintLabel(getStepSynthRatio(boundedStep), TRACKS[6].p.pitch);
}

function updateSynthNoteStatus() {
  const panel = $('vePanel');
  const status = panel && panel.querySelector('[data-synth-note-status]');
  const hint = panel && panel.querySelector('[data-synth-note-hint]');
  if (status) status.textContent = synthNoteStatusText(LAST_SYNTH_NOTE_STEP);
  if (hint) hint.textContent = synthNoteEditHintText(LAST_SYNTH_NOTE_STEP);
}

// Note name helpers for the chromatic selector
const NOTE_SELECTOR_NAMES = State.NOTE_NAMES || ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_SELECTOR_24_NAMES = State.NOTE_NAMES_24 || NOTE_SELECTOR_NAMES;

function synthRootNoteIndex() {
  // Return the closest note index for the current synth root pitch (0-11 = C-B)
  const hz = TRACKS[6].p.pitch;
  return State.hzToMidi(hz) % 12;
}

function synthRootOctave() {
  return Math.floor(State.hzToMidi(TRACKS[6].p.pitch) / 12) - 1;
}

function setSynthRootFromNote(noteIndex, octave) {
  const midi = (octave + 1) * 12 + noteIndex;
  TRACKS[6].p.pitch = clamp(State.midiToHz(midi), 40, SYNTH_ROOT_MAX_HZ);
  updateSynthNoteStatus();
}

function noteLabel(noteIndex, octave) {
  return NOTE_SELECTOR_NAMES[noteIndex] + octave;
}

function currentSynthNoteLabel() {
  return State.hzToNoteName(TRACKS[6].p.pitch, synthUse24Tet);
}

function rebuildNoteSelector(noteRow, octaveRow, currentNoteIdx, currentOctave) {
  // Rebuild note buttons for 24-TET mode
  noteRow.innerHTML = '';
  if (synthUse24Tet) {
    // Show 24-TET names: C, C#/D♭, D, D#/E♭, E, F, F#/G♭, G, G#/A♭, A, A#/B♭, B
    for (let ni = 0; ni < 12; ni++) {
      const nb = document.createElement('button');
      const name24 = NOTE_SELECTOR_24_NAMES[ni * 2] || NOTE_SELECTOR_NAMES[ni];
      nb.className = 'syn-note-selector__btn' + (ni === currentNoteIdx ? ' on' : '');
      nb.textContent = name24;
      nb.title = name24 + currentOctave + ' (' + Math.round(State.midiToHz((currentOctave + 1) * 12 + ni)) + ' Hz)';
      nb.addEventListener('click', () => {
        setSynthRootFromNote(ni, currentOctave);
        noteRow.querySelectorAll('.syn-note-selector__btn').forEach(b => b.classList.remove('on'));
        nb.classList.add('on');
        noteSelectorDiv_querySelectorLabel();
        autosave();
        initAudio();
        scheduleVoiceEditAudition('synth');
      });
      noteRow.appendChild(nb);
    }
  } else {
    for (let ni = 0; ni < 12; ni++) {
      const nb = document.createElement('button');
      nb.className = 'syn-note-selector__btn' + (ni === currentNoteIdx ? ' on' : '');
      nb.textContent = NOTE_SELECTOR_NAMES[ni];
      nb.title = NOTE_SELECTOR_NAMES[ni] + currentOctave + ' (' + Math.round(State.midiToHz((currentOctave + 1) * 12 + ni)) + ' Hz)';
      nb.addEventListener('click', () => {
        setSynthRootFromNote(ni, currentOctave);
        noteRow.querySelectorAll('.syn-note-selector__btn').forEach(b => b.classList.remove('on'));
        nb.classList.add('on');
        noteSelectorDiv_querySelectorLabel();
        autosave();
        initAudio();
        scheduleVoiceEditAudition('synth');
      });
      noteRow.appendChild(nb);
    }
  }
}

function noteSelectorDiv_querySelectorLabel() {
  const panel = $('vePanel');
  const el = panel && panel.querySelector('.syn-note-selector__label');
  if (el) el.textContent = 'ROOT NOTE · ' + currentSynthNoteLabel();
}

function moveSelectedSynthNoteStep(delta) {
  setLastSynthNoteStep((LAST_SYNTH_NOTE_STEP + delta + 16) % 16);
  buildSeq();
  updateSynthNoteStatus();
  previewSynthNoteEditAudition();
  toast(`SYN step ${String(LAST_SYNTH_NOTE_STEP + 1).padStart(2, '0')} selected`);
}

function randomSelectedSynthNoteStep() {
  SYNTH_NOTES[S.patt] = State.randomHarmonicSynthNoteStep(SYNTH_NOTES[S.patt], LAST_SYNTH_NOTE_STEP);
  buildSeq();
  updateSynthNoteStatus();
  autosave();
  previewSynthNoteEditAudition();
  toast('SYN step harmonic randomized');
}

function cycleSelectedSynthNoteStepBackward() {
  SYNTH_NOTES[S.patt] = State.cycleSynthNoteRatioBackward(SYNTH_NOTES[S.patt], LAST_SYNTH_NOTE_STEP);
  buildSeq();
  updateSynthNoteStatus();
  autosave();
  previewSynthNoteEditAudition();
  toast('SYN step harmonic down');
}

function cycleSelectedSynthNoteStepForward() {
  SYNTH_NOTES[S.patt] = State.cycleSynthNoteRatio(SYNTH_NOTES[S.patt], LAST_SYNTH_NOTE_STEP);
  buildSeq();
  updateSynthNoteStatus();
  autosave();
  previewSynthNoteEditAudition();
  toast('SYN step harmonic up');
}

function resetSelectedSynthNoteStepToRoot() {
  SYNTH_NOTES[S.patt] = State.resetSynthNoteStepToRoot(SYNTH_NOTES[S.patt], LAST_SYNTH_NOTE_STEP);
  buildSeq();
  updateSynthNoteStatus();
  autosave();
  previewSynthNoteEditAudition();
  toast('SYN step reset to root');
}

function fire(ti, t, ratchetCount = 1) {
  const tr = TRACKS[ti];
  if (tr.mute) return;
  triggerCompGate(t, tr.id);
  switch (tr.id) {
    case 'kick': { const v = getTrackVoiceVelocity(ti); synthKick(t, v, tr.p); break; }
    case 'snare': { const v = getTrackVoiceVelocity(ti); synthSnare(t, v, tr.p); break; }
    case 'hihat': synthHihat(t, getStepHihatVelocity(firingStep), { ...tr.p, open: getStepHihatOpen(firingStep), denseRatchet: ratchetCount > 1 }); break;
    case 'clap': { const v = getTrackVoiceVelocity(ti); synthClap(t, v, tr.p); break; }
    case 'input': { const v = getTrackVoiceVelocity(ti); synthInput(t, v, tr.p); break; }
    case 'ether': { const v = getTrackVoiceVelocity(ti); synthEther(t, v, tr.p); break; }
    case 'synth': { const v = getTrackVoiceVelocity(ti); synthSynth(t, v, { ...tr.p, pitch: getStepSynthPitch(firingStep) }); break; }
  }
}

/* ═══════════════════════════════════════════════
   SCHEDULER — deterministic, tight
═══════════════════════════════════════════════ */
const AHEAD = .10, TICK = 24;
const LONG_PRESS_MS = 420;
let nextT = 0, sch = 0, schTimer = null;
const tlog = [];

function stepDur() { return 60 / S.bpm / 4; }

function ratchetOffsets(stepDuration, count) {
  if (count !== 1 && count !== 2 && count !== 3) count = 1;
  return Array.from({ length: count }, (_, i) => i * stepDuration / count);
}

function scheduledHitTimes(stepStart, stepDuration, count) {
  return ratchetOffsets(stepDuration, count).map(offset => stepStart + offset);
}

function previewRatchetEditAudition(trackIndex, step, ratchetCount) {
  if (S.playing) return;
  if (ratchetCount !== 2 && ratchetCount !== 3) return;
  initAudio();
  const hitStart = A.currentTime + .018;
  const previewStepDuration = Math.min(stepDur(), .14);
  const previousFiringStep = firingStep;
  firingStep = step;
  try {
    for (const hitT of scheduledHitTimes(hitStart, previewStepDuration, ratchetCount)) fire(trackIndex, hitT, ratchetCount);
  } finally { firingStep = previousFiringStep; }
}

function schedStep(step, t) {
  const dur = stepDur();
  const swungT = Groove.swungStepStartSeconds(step, t, dur, S.swing);
  tlog.push({ step, time: swungT });
  if (tlog.length > 64) tlog.shift();
  const grid = PATTERNS[S.patt];
  for (let ti = 0; ti < TRACKS.length; ti++) {
    const tr = TRACKS[ti];
    if (!grid[tr.id][step] || tr.mute) continue;
    const count = State.getRatchetCount(RATCHETS[S.patt], tr.id, step);
    firingStep = step;
    for (const hitT of Groove.scheduledHitTimes({ stepIndex: step, stepStart: t, stepDuration: dur, ratchets: count, swing: S.swing })) fire(ti, hitT, count);
  }
}
function advance() {
  const wasLastStep = sch === 15;
  sch = (sch + 1) % 16;
  nextT += stepDur();
  if (wasLastStep) maybeAdvancePatternChain();
}

function maybeAdvancePatternChain() {
  if (!S.patternChain || !S.patternChain.enabled) return;
  const result = State.advancePatternChainBar(S.patternChain, S.patt);
  S.patternChain = result.chain;
  if (result.changed) selectPattern(result.pattern, { source: 'chain', autosave: false });
  syncPatternChainControls();
}
function runSch() {
  while (nextT < A.currentTime + AHEAD) { schedStep(sch, nextT); advance(); }
  schTimer = setTimeout(runSch, TICK);
}
function play() {
  if (S.playing) return;
  initAudio();
  S.playing = true; sch = 0; nextT = A.currentTime + .05;
  runSch();
  $('playBtn').classList.add('on');
  $('stopBtn').classList.remove('on');
}
function stopPlay() {
  if (!S.playing) return;
  S.playing = false; clearTimeout(schTimer); tlog.length = 0;
  $('playBtn').classList.remove('on');
  $('stopBtn').classList.add('on');
  document.querySelectorAll('.sc.ph').forEach(c => c.classList.remove('ph'));
  $('stepD').textContent = '--';
  uiStep = -1;
}

/* ═══════════════════════════════════════════════
   UI LOOP — playhead + VU
═══════════════════════════════════════════════ */
let uiStep = -1;
const outputVuCache = {
  ana: null,
  binCount: 0,
  buffer: null,
  root: null,
  rootChildCount: -1,
  segments: [],
  segmentCount: 0,
  binsPerSegment: 0
};

function resetOutputVuCache() {
  outputVuCache.ana = null;
  outputVuCache.binCount = 0;
  outputVuCache.buffer = null;
  outputVuCache.root = null;
  outputVuCache.rootChildCount = -1;
  outputVuCache.segments = [];
  outputVuCache.segmentCount = 0;
  outputVuCache.binsPerSegment = 0;
}

function outputVuSegmentsChanged(root) {
  if (!root || outputVuCache.root !== root) return true;
  if (outputVuCache.rootChildCount !== root.childElementCount) return true;
  if (!outputVuCache.segmentCount) return true;
  for (let i = 0; i < outputVuCache.segmentCount; i++) {
    const seg = outputVuCache.segments[i];
    if (!seg || seg.parentElement !== root || root.children[i] !== seg) return true;
  }
  return false;
}

function ensureOutputVuCache(ana) {
  if (!ana) return null;
  const root = $('ovu');
  if (!root) return null;
  const binCount = ana.frequencyBinCount;
  const binsChanged = outputVuCache.ana !== ana || outputVuCache.binCount !== binCount || !outputVuCache.buffer;
  const segmentsChanged = outputVuSegmentsChanged(root);

  if (binsChanged) {
    outputVuCache.ana = ana;
    outputVuCache.binCount = binCount;
    outputVuCache.buffer = new Uint8Array(binCount);
  }

  if (segmentsChanged) {
    outputVuCache.root = root;
    outputVuCache.rootChildCount = root.childElementCount;
    outputVuCache.segments = Array.prototype.filter.call(root.children, child => child.classList.contains('ovu-s'));
    outputVuCache.segmentCount = outputVuCache.segments.length;
  }

  if (binsChanged || segmentsChanged) {
    outputVuCache.binsPerSegment = outputVuCache.segmentCount
      ? Math.max(1, Math.floor(outputVuCache.binCount / outputVuCache.segmentCount))
      : 0;
  }

  return outputVuCache.segmentCount ? outputVuCache : null;
}

function uiLoop() {
  requestAnimationFrame(uiLoop);
  if (!A) return;

  // playhead
  if (S.playing) {
    const now = A.currentTime;
    let cur = -1;
    for (let i = tlog.length - 1; i >= 0; i--) {
      if (tlog[i].time <= now + .012) { cur = tlog[i].step; break; }
    }
    if (cur !== uiStep && cur !== -1) {
      uiStep = cur;
      document.querySelectorAll('.sc.ph').forEach(c => c.classList.remove('ph'));
      document.querySelectorAll(`.sc[data-s="${cur}"]`).forEach(c => c.classList.add('ph'));
      $('stepD').textContent = (cur + 1).toString().padStart(2, '0');
    }
  }

  // output VU
  if (N.ana) {
    const vu = ensureOutputVuCache(N.ana);
    if (!vu) return;
    N.ana.getByteFrequencyData(vu.buffer);
    const d = vu.buffer;
    const segs = vu.segments;
    const bpg = vu.binsPerSegment;
    segs.forEach((seg, i) => {
      let s = 0;
      for (let j = i * bpg; j < (i + 1) * bpg && j < d.length; j++) s += d[j];
      const v = s / bpg / 255;
      seg.classList.toggle('on', v > .05);
      seg.style.background = v > .72 ? 'var(--redLt)' : v > .42 ? 'var(--amberLt)' : 'var(--greenLt)';
      seg.style.opacity = .1 + v * .9;
    });
  }
}

/* ═══════════════════════════════════════════════
   SEQUENCER BUILD
═══════════════════════════════════════════════ */
function sequencerRows() {
  const rows = [];
  for (const tr of TRACKS) {
    rows.push({ rowId: tr.id, label: tr.n, track: tr, openHihat: false });
    if (tr.id === 'hihat') rows.push({ rowId: OPEN_HIHAT_ROW_ID, label: OPEN_HIHAT_ROW_LABEL, track: tr, openHihat: true });
  }
  return rows;
}

function hihatTapStateKey(rowId, step) {
  return `${S.patt}:${rowId}:${step}`;
}

function clearHihatTapState(step) {
  LAST_HIHAT_TAP_AT[hihatTapStateKey('hihat', step)] = 0;
  LAST_HIHAT_TAP_AT[hihatTapStateKey(OPEN_HIHAT_ROW_ID, step)] = 0;
}

function clearHihatStep(step) {
  PATTERNS[S.patt].hihat[step] = 0;
  HHT_OPENNESS[S.patt] = State.clearHihatOpenness(HHT_OPENNESS[S.patt], step);
  HHT_ACCENT[S.patt] = State.clearHihatAccent(HHT_ACCENT[S.patt], step);
  RATCHETS[S.patt] = State.setRatchetCount(RATCHETS[S.patt], 'hihat', step, 1);
  clearHihatTapState(step);
}

function buildSeq() {
  const seq = $('seq');
  seq.innerHTML = '';
  for (const rowSpec of sequencerRows()) {
    const tr = rowSpec.track;
    const trackIndex = TRACKS.indexOf(tr);
    const trackId = rowSpec.track.id;
    const isOpenHihatRow = rowSpec.rowId === OPEN_HIHAT_ROW_ID;
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = rowSpec.rowId;

    const lbl = document.createElement('div');
    lbl.className = 'rlbl' + (tr.mute ? ' mute' : '');
    lbl.dataset.ti = trackIndex;
    lbl.innerHTML = `<div class="dot"></div><span>${rowSpec.label}</span><div class="mi">${tr.mute ? 'MUTE' : 'ON'}</div>`;
    lbl.addEventListener('click', () => {
      S.sel = trackIndex;
      buildSeq();
      buildMix();
      buildVE();
    });
    lbl.addEventListener('dblclick', e => {
      e.preventDefault();
      tr.mute = !tr.mute;
      buildSeq(); buildMix();
    });
    lbl.setAttribute('role', 'tab');
    lbl.setAttribute('aria-selected', trackIndex === S.sel ? 'true' : 'false');
    if (trackIndex === S.sel) lbl.classList.add('sel');
    row.appendChild(lbl);

    for (let i = 0; i < 16; i++) {
      const c = document.createElement('div');
      c.className = 'sc';
      c.dataset.s = i;
      c.dataset.ti = trackIndex;
      if (i % 4 === 0)  c.classList.add('db');
      if (i % 8 === 0)  c.classList.add('db4');
      const isOpenHihatStep = () => PATTERNS[S.patt][trackId][i] && State.getHihatOpenness(HHT_OPENNESS[S.patt], i) === 1;
      const isCellOn = () => isOpenHihatRow ? isOpenHihatStep() : !!PATTERNS[S.patt][trackId][i] && (trackId !== 'hihat' || !isOpenHihatStep());
      function setSynthNoteMarker() {
        c.classList.remove('syn-note', 'syn-note-selected', 'ratchet-lbl');
        delete c.dataset.note;
        if (trackId === 'synth' && trackIndex === S.sel && SYNTH_NOTE_EDIT && i === LAST_SYNTH_NOTE_STEP) {
          c.classList.add('syn-note-selected');
        }
        if (trackId !== 'synth') return;
        const ratio = getStepSynthRatio(i);
        c.classList.add('syn-note');
        c.dataset.note = State.formatSynthNoteMarkerLabelWithPitch(ratio, TRACKS[6].p.pitch);
        // When both note label and ratchet badge exist, add class to swap positions
        const currentRatchet = State.getRatchetCount(RATCHETS[S.patt], trackId, i);
        if (currentRatchet > 1) {
          c.classList.add('ratchet-lbl');
        }
      }
      const setHihatCellMarker = () => {
        c.classList.remove('hht-tight', 'hht-open', 'hht-accent');
        delete c.dataset.hat;
        delete c.dataset.acc;
        if (trackId !== 'hihat' || !PATTERNS[S.patt][trackId][i]) return;
        const open = State.getHihatOpenness(HHT_OPENNESS[S.patt], i);
        const accented = State.getHihatAccent(HHT_ACCENT[S.patt], i) === 1;
        if (isOpenHihatRow && open === 1) {
          c.classList.add('hht-open');
          c.dataset.hat = 'open';
        } else if (!isOpenHihatRow && open === 0.45) {
          c.classList.add('hht-tight');
          c.dataset.hat = 'tight';
        }
        if (accented) {
          c.classList.add('hht-accent');
          c.dataset.acc = 'ACC';
        }
      };
      if (isCellOn()) c.classList.add('on');
      setHihatCellMarker();
      setSynthNoteMarker();
      const ratchet = State.getRatchetCount(RATCHETS[S.patt], trackId, i);
      if (ratchet > 1) {
        c.classList.add('r' + ratchet);
        c.dataset.r = ratchet + 'x';
      }
      const refreshCell = () => {
        const nextRatchet = State.getRatchetCount(RATCHETS[S.patt], trackId, i);
        c.classList.toggle('on', isCellOn());
        c.classList.remove('r2', 'r3');
        delete c.dataset.r;
        if (nextRatchet > 1) {
          c.classList.add('r' + nextRatchet);
          c.dataset.r = nextRatchet + 'x';
        }
        setHihatCellMarker();
        setSynthNoteMarker();
      };
      const cycleCellRatchet = () => {
        const wasOn = isCellOn();
        const backingWasOn = !!PATTERNS[S.patt][trackId][i];
        if (!wasOn) PATTERNS[S.patt] = State.toggleStep(PATTERNS[S.patt], tr.id, i);
        if (!wasOn && isOpenHihatRow && backingWasOn) PATTERNS[S.patt] = State.toggleStep(PATTERNS[S.patt], tr.id, i);
        if (tr.id === 'hihat' && isOpenHihatRow) {
          HHT_OPENNESS[S.patt] = State.setHihatOpenness(HHT_OPENNESS[S.patt], i, 1);
        } else if (tr.id === 'hihat') {
          HHT_OPENNESS[S.patt] = State.setHihatOpenness(HHT_OPENNESS[S.patt], i, HHT_PLACE);
        }
        if (tr.id === 'hihat' && !PATTERNS[S.patt][trackId][i]) {
          HHT_OPENNESS[S.patt] = State.clearHihatOpenness(HHT_OPENNESS[S.patt], i);
          HHT_ACCENT[S.patt] = State.clearHihatAccent(HHT_ACCENT[S.patt], i);
          RATCHETS[S.patt] = State.setRatchetCount(RATCHETS[S.patt], tr.id, i, 1);
          clearHihatTapState(i);
        } else {
          RATCHETS[S.patt] = State.cycleRatchetCount(RATCHETS[S.patt], tr.id, i);
        }
        if (tr.id === 'hihat') buildSeq();
        else refreshCell();
        renderRhythmIntelligence();
        autosave();
        const nextRatchet = State.getRatchetCount(RATCHETS[S.patt], tr.id, i);
        if (isCellOn() && nextRatchet > 1) previewRatchetEditAudition(trackIndex, i, nextRatchet);
      };
      let pressTimer = null;
      let longPressFired = false;
      c.addEventListener('click', () => {
        if (longPressFired) { longPressFired = false; return; }
        const wasOn = isCellOn();
        const hihatBackingOn = trackId === 'hihat' && !!PATTERNS[S.patt][trackId][i];
        const tapAt = Date.now();
        const hihatTapKey = hihatTapStateKey(rowSpec.rowId, i);
        if (hihatBackingOn && tapAt - LAST_HIHAT_TAP_AT[hihatTapKey] <= 320) {
          LAST_HIHAT_TAP_AT[hihatTapKey] = 0;
          clearHihatStep(i);
          buildSeq();
          renderRhythmIntelligence();
          autosave();
          return;
        }
        LAST_HIHAT_TAP_AT[hihatTapKey] = hihatBackingOn ? tapAt : 0;
        if (isOpenHihatRow) {
          if (!wasOn) {
            PATTERNS[S.patt][trackId][i] = 1;
            HHT_OPENNESS[S.patt] = State.setHihatOpenness(HHT_OPENNESS[S.patt], i, 1);
          } else if (trackId === 'hihat' && wasOn) {
            HHT_ACCENT[S.patt] = State.toggleHihatAccent(HHT_ACCENT[S.patt], i);
          } else {
            const result = State.toggleStep(PATTERNS[S.patt], tr.id, i, RATCHETS[S.patt]);
            PATTERNS[S.patt] = result.pattern;
            RATCHETS[S.patt] = result.ratchets;
            HHT_OPENNESS[S.patt] = State.clearHihatOpenness(HHT_OPENNESS[S.patt], i);
            HHT_ACCENT[S.patt] = State.clearHihatAccent(HHT_ACCENT[S.patt], i);
          }
          buildSeq();
          renderRhythmIntelligence();
          autosave();
          if (!S.playing) previewHihat(1);
          return;
        }
        if (trackId === 'synth' && trackIndex === S.sel && SYNTH_NOTE_EDIT) {
          if (!PATTERNS[S.patt][trackId][i]) PATTERNS[S.patt][trackId][i] = 1;
          SYNTH_NOTES[S.patt] = State.cycleSynthNoteRatio(SYNTH_NOTES[S.patt], i);
          setLastSynthNoteStep(i);
          buildSeq();
          buildVE();
          renderRhythmIntelligence();
          autosave();
          previewSynthNoteEditAudition();
          return;
        }
        if (trackId === 'hihat' && isCellOn()) {
          HHT_ACCENT[S.patt] = State.toggleHihatAccent(HHT_ACCENT[S.patt], i);
          buildSeq();
          renderRhythmIntelligence();
          autosave();
          if (!S.playing) previewHihat(State.getHihatOpenness(HHT_OPENNESS[S.patt], i));
          return;
        }
        const result = State.toggleStep(PATTERNS[S.patt], tr.id, i, RATCHETS[S.patt]);
        PATTERNS[S.patt] = result.pattern;
        RATCHETS[S.patt] = result.ratchets;
        if (trackId === 'hihat') {
          if (trackId === 'hihat' && !PATTERNS[S.patt][trackId][i]) {
            HHT_OPENNESS[S.patt] = State.clearHihatOpenness(HHT_OPENNESS[S.patt], i);
            HHT_ACCENT[S.patt] = State.clearHihatAccent(HHT_ACCENT[S.patt], i);
            RATCHETS[S.patt] = State.setRatchetCount(RATCHETS[S.patt], trackId, i, 1);
            clearHihatTapState(i);
          } else if (!wasOn) {
            HHT_OPENNESS[S.patt] = State.setHihatOpenness(HHT_OPENNESS[S.patt], i, HHT_PLACE);
          }
        }
        if (tr.id === 'hihat') buildSeq();
        else refreshCell();
        renderRhythmIntelligence();
        autosave();
        if (trackId === 'hihat' && !S.playing && !wasOn) previewHihat(State.getHihatOpenness(HHT_OPENNESS[S.patt], i));
        if (!S.playing && !wasOn) {
          if (trackId === 'kick') previewVoice(0, synthKick);
          if (trackId === 'snare') previewVoice(1, synthSnare);
          if (trackId === 'clap') previewVoice(3, synthClap);
          if (trackId === 'input') previewInput();
          if (trackId === 'ether') previewVoice(5, synthEther);
          if (trackId === 'synth') {
            setLastSynthNoteStep(i);
            previewSynth();
          }
        }
      });
      c.addEventListener('dblclick', e => {
        if (trackId !== 'hihat' || !PATTERNS[S.patt][trackId][i]) return;
        e.preventDefault();
        clearHihatStep(i);
        buildSeq();
        renderRhythmIntelligence();
        autosave();
      });
      c.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (longPressFired) return;
        cycleCellRatchet();
      });
      c.addEventListener('pointerdown', () => {
        longPressFired = false;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          longPressFired = true;
          cycleCellRatchet();
        }, LONG_PRESS_MS);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => c.addEventListener(ev, () => clearTimeout(pressTimer)));
      row.appendChild(c);
    }
    seq.appendChild(row);
  }
}

/* ═══════════════════════════════════════════════
   RHYTHM INTELLIGENCE
═══════════════════════════════════════════════ */
function formatBrainLoopResultStatus(action, targetIndex) {
  const patternLetter = 'ABCD'[targetIndex] || '?';
  const edit = action && action.edit ? action.edit : {};
  const trackLabel = edit.trackId ? edit.trackId.slice(0, 3).toUpperCase() : 'ACT';
  const stepLabel = Number.isInteger(edit.stepIndex) ? String(edit.stepIndex + 1) : '--';
  const reason = action && action.reason ? action.reason : 'ACTION';
  let detail = trackLabel + ' ' + stepLabel;
  if (edit.trackId === 'hihat') {
    const hihatOpen = edit.hihatOpen || 0;
    const openLabel = hihatOpen === 1 ? 'OPEN' : hihatOpen === 0.45 ? 'TIGHT' : 'CLOSED';
    detail += ' ' + openLabel;
    if (edit.active) detail += ' · HEARD HAT';
  }
  return patternLetter + ' → ' + detail + ' · ' + reason;
}

function renderRhythmIntelligence() {
  if (!Rhythm || !Rhythm.analyzeRhythm || !$('riPanel')) return;
  const analysis = Rhythm.analyzeRhythm({
    bpm: S.bpm,
    swing: S.swing,
    tracks: TRACKS,
    pattern: PATTERNS[S.patt],
    ratchets: RATCHETS[S.patt],
    hihatOpenness: HHT_OPENNESS[S.patt],
    hihatAccent: HHT_ACCENT[S.patt],
    stepsPerBar: 16,
    fx: { comp: FX.comp },
  });
  const labels = analysis.labels;
  $('riSync').textContent = labels.sync.toUpperCase();
  $('riAnchor').textContent = labels.anchor.toUpperCase();
  $('riTension').textContent = labels.tension.toUpperCase();
  $('riRecover').textContent = labels.recover.toUpperCase();
  $('riDrive').textContent = labels.drive.toUpperCase();
  $('riBreath').textContent = analysis.pumpArousal.value;
  $('riPredict').textContent = analysis.predictiveTiming.timingBias.toUpperCase();
  $('riMotor').textContent = analysis.motorCoupling.value;
  $('riBrainLoop').textContent = analysis.brainLoop.value;
  $('riLoad').textContent = analysis.cognitiveLoad.value;
  $('riLoadLine').textContent = analysis.cognitiveLoad.cue;
  $('riPredictLine').textContent = analysis.predictiveTiming.cue;
  $('riMotorLine').textContent = analysis.motorCoupling.cue;
  $('riBrainLoopLine').textContent = analysis.brainLoop.line;
  $('riPumpCue').textContent = analysis.pumpArousal.cue;
  $('riInterpretation').textContent = analysis.interpretation || '';
  const action = State.resolveRhythmMutationAction ? State.resolveRhythmMutationAction({
    analysis,
    pattern: PATTERNS[S.patt],
    ratchets: RATCHETS[S.patt],
    hihatOpenness: HHT_OPENNESS[S.patt],
  }) : null;
  const riActionBtn = $('riFixAnchorBtn');
  const quickActionBtn = $('brainLoopQuickBtn');
  riActionBtn.disabled = !action;
  riActionBtn.textContent = action && action.reason ? ('APPLY BRAIN LOOP · ' + action.reason) : 'BRAIN LOOP OK';
  quickActionBtn.disabled = !action;
  quickActionBtn.textContent = action && action.reason ? ('BRAIN LOOP · ' + action.reason) : 'BRAIN LOOP OK';
  $('brainLoopStatus').textContent = lastBrainLoopResultStatus || (action ? 'BRAIN LOOP READY' : 'NO ACTION NEEDED');
}

/* ═══════════════════════════════════════════════
   MIX STRIP
═══════════════════════════════════════════════ */
function buildMix() {
  const mix = $('mix');
  mix.innerHTML = '';
  TRACKS.forEach((tr, ti) => {
    const colKey = tr.id === 'kick'?'kck':tr.id === 'snare'?'snr':tr.id === 'hihat'?'hht':tr.id === 'clap'?'clp':tr.id === 'input'?'inp':tr.id === 'synth'?'syn':'eth';
    const row = document.createElement('div');
    row.className = 'mt';
    row.innerHTML = `
      <div class="mt-n" style="color:var(--t-${colKey})">${tr.n}</div>
      <div class="mt-toggles">
        <button class="mt-btn mute${tr.mute?' on':''}" data-k="mute" title="Mute" aria-label="Mute ${tr.n}" aria-pressed="${tr.mute?'true':'false'}">M</button>
        <button class="mt-btn${tr.dlyS?' on':''}" data-k="dlyS" title="Delay send" aria-label="Delay send ${tr.n}" aria-pressed="${tr.dlyS?'true':'false'}">D</button>
        <button class="mt-btn${tr.revS?' on':''}" data-k="revS" title="Reverb send" aria-label="Reverb send ${tr.n}" aria-pressed="${tr.revS?'true':'false'}">R</button>
        <button class="mt-btn${tr.wreckS?' on':''}" data-k="wreckS" title="Digi Wreck send" aria-label="Digi Wreck send ${tr.n}" aria-pressed="${tr.wreckS?'true':'false'}">W</button>
      </div>
      <input type="range" class="fdr ${tr.col}" min="0" max="100" value="${Math.round(tr.vol*100)}">
      <div class="mt-val">${Math.round(tr.vol*100)}%</div>
    `;
    row.querySelectorAll('.mt-btn').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.k;
        tr[k] = !tr[k];
        b.classList.toggle('on', tr[k]);
        b.setAttribute('aria-pressed', String(!!tr[k]));
        if (k === 'wreckS' || k === 'mute') {
          updateWreckSendStatus();
          updateWreckProcessorFeed(shouldFeedWreckProcessor());
        }
        if (k === 'mute') buildSeq();
        autosave();
      });
    });
    const fdr = row.querySelector('.fdr');
    const valEl = row.querySelector('.mt-val');
    const applyF = () => { fdr.style.setProperty('--fp', ((fdr.value-fdr.min)/(fdr.max-fdr.min)*100)+'%'); };
    applyF();
    fdr.addEventListener('input', () => {
      tr.vol = fdr.value / 100;
      valEl.textContent = fdr.value + '%';
      applyF();
      updateWreckSendStatus();
      updateWreckProcessorFeed(shouldFeedWreckProcessor());
      autosave();
    });
    mix.appendChild(row);
  });
}

/* ═══════════════════════════════════════════════
   VOICE EDIT
═══════════════════════════════════════════════ */
function buildVE() {
  const tr = TRACKS[S.sel];
  $('veName').textContent = tr.n === 'KCK' ? 'KICK'
                          : tr.n === 'SNR' ? 'SNARE'
                          : tr.n === 'HHT' ? 'HIHAT'
                          : tr.n === 'CLP' ? 'CLAP'
                          : tr.n === 'INP' ? 'INPUT'
                          : tr.n === 'SYN' ? 'SYNTH'
                          : 'ETHER';
  const pn = $('vePanel'); pn.innerHTML = '';

  const mkRow = (lbl, min, max, step, val, unitFn, onChange, klass) => {
    const row = document.createElement('div'); row.className = 've-row';
    row.innerHTML = `
      <div class="ve-lbl">${lbl}</div>
      <input type="range" class="fdr ${klass||''}" min="${min}" max="${max}" step="${step}" value="${val}">
      <div class="ve-val">${unitFn(val)}</div>
    `;
    const f = row.querySelector('input');
    const v = row.querySelector('.ve-val');
    const apply = () => { f.style.setProperty('--fp', ((f.value-f.min)/(f.max-f.min)*100)+'%'); };
    apply();
    f.addEventListener('input', () => {
      v.textContent = unitFn(f.value);
      apply();
      onChange(parseFloat(f.value));
      autosave();
      initAudio();
      scheduleVoiceEditAudition(tr.id);
    });
    pn.appendChild(row);
  };

  const c = tr.col;
  if (tr.id === 'kick') {
    const kckTest = document.createElement('div');
    kckTest.className = 'voice-test';
    kckTest.innerHTML = `<button class="mstr-btn voice-test__btn" data-voice-test="kick">TEST KCK</button>`;
    pn.appendChild(kckTest);
    kckTest.querySelector('[data-voice-test="kick"]').addEventListener('click', () => previewVoice(0, synthKick));
    mkRow('PITCH', 60, 240, 1, tr.p.pitch, x=>`${x|0} Hz`, v=>tr.p.pitch=v, c);
    mkRow('BODY',  20, 80, 1, tr.p.end, x=>`${x|0} Hz`, v=>tr.p.end=v, c);
    mkRow('DECAY', 10, 120, 1, Math.round(tr.p.decay*100), x=>`${(x/100).toFixed(2)} s`, v=>tr.p.decay=v/100, c);
    mkRow('CLICK', 0, 100, 1, Math.round(tr.p.click*100), x=>`${x}%`, v=>tr.p.click=v/100, c);
    mkRow('DRIVE', 0, 100, 1, Math.round(tr.p.drive*100), x=>`${x}%`, v=>tr.p.drive=v/100, c);
  } else if (tr.id === 'snare') {
    const snrTest = document.createElement('div');
    snrTest.className = 'voice-test';
    snrTest.innerHTML = `<button class="mstr-btn voice-test__btn" data-voice-test="snare">TEST SNR</button>`;
    pn.appendChild(snrTest);
    snrTest.querySelector('[data-voice-test="snare"]').addEventListener('click', () => previewVoice(1, synthSnare));
    mkRow('TONE',  80, 600, 1, tr.p.tone, x=>`${x|0} Hz`, v=>tr.p.tone=v, c);
    mkRow('BODY',  0, 100, 1, Math.round(tr.p.body*100), x=>`${x}%`, v=>tr.p.body=v/100, c);
    mkRow('SNAP',  0, 100, 1, Math.round(tr.p.snap*100), x=>`${x}%`, v=>tr.p.snap=v/100, c);
    mkRow('DECAY', 4, 50, 1, Math.round(tr.p.decay*100), x=>`${(x/100).toFixed(2)} s`, v=>tr.p.decay=v/100, c);
  } else if (tr.id === 'hihat') {
    const hatTest = document.createElement('div');
    hatTest.className = 'hat-test';
    hatTest.innerHTML = `<div class="hat-help">
        <div class="hat-help-engine">ENGINE: ${State.abbreviateEngineId(S.engine) || S.engine.toUpperCase()}</div>
        <div>HAT TEST USES SELECTED ENGINE</div>
        <div>OPENNESS IS PER STEP: PLACE/OHH ROW</div>
        <div>HHT/OHH: TAP ACTIVE = ACC · DOUBLE-TAP CLEAR · HOLD = RATCHET</div>
        <div class="hat-discovery">TRY OHH ROW: PLACE OPEN, TAP A FEW OFFBEATS, THEN FLIP ENGINE BUTTONS</div>
      </div>
      <div class="ve-lbl">HAT TEST</div>
      <div class="hat-test-btns">
        <button class="hat-test-b" data-open="0">CLOSED</button>
        <button class="hat-test-b" data-open=".45">TIGHT</button>
        <button class="hat-test-b" data-open="1">OPEN</button>
      </div>
      <div class="ve-lbl">PLACE</div>
      <div class="hat-place-btns">
        <button class="hat-place-b${HHT_PLACE===0?' on':''}" data-place="0">PLACE CLOSED</button>
        <button class="hat-place-b${HHT_PLACE===0.45?' on':''}" data-place=".45">PLACE TIGHT</button>
        <button class="hat-place-b${HHT_PLACE===1?' on':''}" data-place="1">PLACE OPEN</button>
      </div>`;
    pn.appendChild(hatTest);
    hatTest.querySelector('[data-open="0"]').addEventListener('click', () => previewHihat(0));
    hatTest.querySelector('[data-open=".45"]').addEventListener('click', () => previewHihat(.45));
    hatTest.querySelector('[data-open="1"]').addEventListener('click', () => previewHihat(1));
    hatTest.querySelectorAll('[data-place]').forEach(b => {
      b.addEventListener('click', () => {
        setHihatPlacement(b.dataset.place);
        if (!S.playing) {
          previewHihat(parseFloat(b.dataset.place));
        }
      });
    });
    syncHihatPlacementControls();
    mkRow('FREQ',  4000, 14000, 100, tr.p.freq, x=>`${(x/1000).toFixed(1)} kHz`, v=>tr.p.freq=v, c);
    mkRow('DECAY', 2, 40, 1, Math.round(tr.p.decay*1000), x=>`${x} ms`, v=>tr.p.decay=v/1000, c);
    mkRow('METAL', 0, 100, 1, Math.round(tr.p.metal*100), x=>`${x}%`, v=>tr.p.metal=v/100, c);
  } else if (tr.id === 'clap') {
    const clpTest = document.createElement('div');
    clpTest.className = 'voice-test';
    clpTest.innerHTML = `<button class="mstr-btn voice-test__btn" data-voice-test="clap">TEST CLP</button>`;
    pn.appendChild(clpTest);
    clpTest.querySelector('[data-voice-test="clap"]').addEventListener('click', () => previewVoice(3, synthClap));
    mkRow('SPREAD',2, 30, 1, tr.p.spread, x=>`${x} ms`, v=>tr.p.spread=v, c);
    mkRow('DECAY', 4, 40, 1, Math.round(tr.p.decay*100), x=>`${(x/100).toFixed(2)} s`, v=>tr.p.decay=v/100, c);
    mkRow('TONE',  900, 3000, 10, tr.p.tone, x=>`${x|0} Hz`, v=>tr.p.tone=v, c);
  } else if (tr.id === 'input') {
    // sample picker + pitch/decay
    const inpTest = document.createElement('div');
    inpTest.className = 'voice-test';
    inpTest.innerHTML = `<button class="mstr-btn voice-test__btn" data-voice-test="input">TEST INP</button>`;
    pn.appendChild(inpTest);
    inpTest.querySelector('[data-voice-test="input"]').addEventListener('click', () => previewInput());
    const ip = document.createElement('div'); ip.className = 'ip-row';
    ip.innerHTML = `
      <div class="ip-info" id="ipInfo">${tr.smpN || 'no sample loaded'}</div>
      <button class="mstr-btn" id="ipLoad">LOAD</button>
    `;
    pn.appendChild(ip);
    $('ipLoad').addEventListener('click', () => $('smpFile').click());
    mkRow('PITCH', 25, 300, 1, Math.round(tr.p.pitch*100), x=>`${(x/100).toFixed(2)}×`, v=>tr.p.pitch=v/100, c);
    mkRow('LEN',   10, 100, 1, Math.round(tr.p.decay*100), x=>`${x}%`, v=>tr.p.decay=v/100, c);
  } else if (tr.id === 'ether') {
    const ethTest = document.createElement('div');
    ethTest.className = 'voice-test';
    ethTest.innerHTML = `<button class="mstr-btn voice-test__btn" data-voice-test="ether">TEST ETH</button>`;
    pn.appendChild(ethTest);
    ethTest.querySelector('[data-voice-test="ether"]').addEventListener('click', () => previewVoice(5, synthEther));
    const em = document.createElement('div'); em.className = 'em-row';
    em.innerHTML = `<div class="ve-lbl">MODE</div>
      <div class="em-btns">
        <button class="em-b${tr.p.mode==='hum'?' on':''}"   data-m="hum">HUM</button>
        <button class="em-b${tr.p.mode==='clock'?' on':''}" data-m="clock">CLOCK</button>
        <button class="em-b${tr.p.mode==='wifi'?' on':''}"  data-m="wifi">WIFI</button>
        <button class="em-b${tr.p.mode==='ether'?' on':''}" data-m="ether">ETHER</button>
      </div>`;
    pn.appendChild(em);
    em.querySelectorAll('.em-b').forEach(b => {
      b.addEventListener('click', () => {
        tr.p.mode = b.dataset.m;
        em.querySelectorAll('.em-b').forEach(x=>x.classList.remove('on'));
        b.classList.add('on');
        autosave();
        initAudio();
        scheduleVoiceEditAudition(tr.id);
      });
    });
    mkRow('FREQ',  20, 400, 1, tr.p.freq, x=>`${x|0} Hz`, v=>tr.p.freq=v, c);
    mkRow('HARM',  0, 100, 1, Math.round(tr.p.harmonics*100), x=>`${x}%`, v=>tr.p.harmonics=v/100, c);
    mkRow('TEXT',  0, 100, 1, Math.round(tr.p.texture*100), x=>`${x}%`, v=>tr.p.texture=v/100, c);
    mkRow('GRIT',  0, 100, 1, Math.round(tr.p.grit*100), x=>`${x}%`, v=>tr.p.grit=v/100, c);
    mkRow('DECAY', 5, 80, 1, Math.round(tr.p.decay*100), x=>`${(x/100).toFixed(2)} s`, v=>tr.p.decay=v/100, c);
  } else if (tr.id === 'synth') {
    const syn = document.createElement('div');
    syn.className = 'syn-test';
    syn.innerHTML = `<div class="hat-help">
        <div class="hat-help-engine">SYNTH ENGINE: ${State.abbreviateEngineId(S.engine) || S.engine.toUpperCase()}</div>
        <div>PLAYABLE MONO · ${SynthVoice.resolveSynthVoiceSpec(S.engine, tr.p).personality.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</div>
        <div>ROOT 40 Hz–550 Hz · STEP NOTES ARE HARMONIC RATIOS</div>
        <div data-synth-note-status="1">${synthNoteStatusText(LAST_SYNTH_NOTE_STEP)}</div>
        <div data-synth-note-hint="1">${synthNoteEditHintText(LAST_SYNTH_NOTE_STEP)}</div>
        <div>${SYNTH_NOTE_EDIT ? 'NOTE EDIT ON: TAP SYN STEPS TO CYCLE RATIOS' : 'ENABLE NOTE EDIT TO CHANGE SYN STEPS'}</div>
      </div>
      <div class="syn-note-controls" data-synth-note-controls="1">
        <div class="syn-note-controls__row syn-note-controls__row--performance" data-synth-note-controls-row="performance">
          <button class="mstr-btn syn-note-controls__btn syn-note-controls__btn--test" data-synth-test="1">TEST SYN</button>
          <button class="mstr-btn syn-note-controls__btn syn-note-controls__btn--step" data-synth-note-prev="1" title="Previous synth note step" aria-label="Previous synth note step">◀ STEP</button>
          <button class="mstr-btn syn-note-controls__btn syn-note-controls__btn--step" data-synth-note-next="1" title="Next synth note step" aria-label="Next synth note step">STEP ▶</button>
        </div>
        <div class="syn-note-controls__row syn-note-controls__row--edit" data-synth-note-controls-row="edit">
          <button class="mstr-btn syn-note-controls__btn syn-note-controls__btn--edit${SYNTH_NOTE_EDIT?' on':''}" data-synth-note-edit="1">NOTE EDIT</button>
          <button class="mstr-btn syn-note-controls__btn syn-note-controls__btn--harm" data-synth-prev-step="1" title="Previous/down harmonic for selected synth step" aria-label="Previous/down harmonic for selected synth step">HARM ▼</button>
          <button class="mstr-btn syn-note-controls__btn syn-note-controls__btn--harm" data-synth-next-step="1" title="Advance/up-cycle harmonic for selected synth step" aria-label="Advance/up-cycle harmonic for selected synth step">HARM ▲</button>
          <button class="mstr-btn syn-note-controls__btn syn-note-controls__btn--random" data-synth-rnd-step="1" title="Random harmonic for selected synth step" aria-label="Random harmonic for selected synth step">RND STEP</button>
          <button class="mstr-btn syn-note-controls__btn syn-note-controls__btn--reset" data-synth-root-step="1" title="Reset selected synth step to root" aria-label="Reset selected synth step to root">ROOT STEP</button>
        </div>
        <div class="syn-note-controls__row syn-note-controls__row--tools" data-synth-note-controls-row="tools">
          <button class="mstr-btn syn-note-controls__btn syn-note-controls__btn--random syn-note-controls__btn--wide" data-synth-rnd-harm="1" title="Randomize all active synth step harmonics" aria-label="Randomize all active synth step harmonics">RND HARM</button>
        </div>
      </div>`;
    pn.appendChild(syn);
    syn.querySelector('[data-synth-test]').addEventListener('click', previewSynth);
    syn.querySelector('[data-synth-note-prev]').addEventListener('click', () => moveSelectedSynthNoteStep(-1));
    syn.querySelector('[data-synth-note-next]').addEventListener('click', () => moveSelectedSynthNoteStep(1));
    syn.querySelector('[data-synth-note-edit]').addEventListener('click', () => {
      SYNTH_NOTE_EDIT = !SYNTH_NOTE_EDIT;
      buildVE();
      buildSeq();
    });
    syn.querySelector('[data-synth-rnd-step]').addEventListener('click', randomSelectedSynthNoteStep);
    syn.querySelector('[data-synth-prev-step]').addEventListener('click', cycleSelectedSynthNoteStepBackward);
    syn.querySelector('[data-synth-next-step]').addEventListener('click', cycleSelectedSynthNoteStepForward);
    syn.querySelector('[data-synth-root-step]').addEventListener('click', resetSelectedSynthNoteStepToRoot);
    syn.querySelector('[data-synth-rnd-harm]').addEventListener('click', () => {
      SYNTH_NOTES[S.patt] = State.randomHarmonicSynthNotes(SYNTH_NOTES[S.patt], PATTERNS[S.patt].synth);
      buildSeq();
      updateSynthNoteStatus();
      autosave();
      previewSynthNoteEditAudition();
      toast('SYN harmonic steps randomized');
    });
    // Note selector + 24-TET toggle (replaces old PITCH frequency slider)
    const noteSelectorDiv = document.createElement('div');
    noteSelectorDiv.className = 'syn-note-selector';
    noteSelectorDiv.innerHTML = `<div class="syn-note-selector__label">ROOT NOTE · ${currentSynthNoteLabel()}</div>`;
    const noteRow = document.createElement('div');
    noteRow.className = 'syn-note-selector__row';
    const currentOctave = synthRootOctave();
    const currentNoteIdx = synthRootNoteIndex();
    // Build 12 chromatic note buttons
    for (let ni = 0; ni < 12; ni++) {
      const nb = document.createElement('button');
      nb.className = 'syn-note-selector__btn' + (ni === currentNoteIdx ? ' on' : '');
      nb.textContent = NOTE_SELECTOR_NAMES[ni];
      nb.title = NOTE_SELECTOR_NAMES[ni] + currentOctave + ' (' + Math.round(State.midiToHz((currentOctave + 1) * 12 + ni)) + ' Hz)';
      nb.addEventListener('click', () => {
        setSynthRootFromNote(ni, currentOctave);
        // Update button states
        noteRow.querySelectorAll('.syn-note-selector__btn').forEach(b => b.classList.remove('on'));
        nb.classList.add('on');
        noteSelectorDiv.querySelector('.syn-note-selector__label').textContent = 'ROOT NOTE · ' + currentSynthNoteLabel();
        autosave();
        initAudio();
        scheduleVoiceEditAudition(tr.id);
      });
      noteRow.appendChild(nb);
    }
    noteSelectorDiv.appendChild(noteRow);
    // Octave selector row
    const octaveRow = document.createElement('div');
    octaveRow.className = 'syn-note-selector__row syn-note-selector__row--octave';
    for (let oct = 1; oct <= 3; oct++) {
      const ob = document.createElement('button');
      ob.className = 'syn-note-selector__btn syn-note-selector__btn--octave' + (oct === currentOctave ? ' on' : '');
      ob.textContent = 'C' + oct;
      ob.title = 'Octave ' + oct;
      ob.addEventListener('click', () => {
        setSynthRootFromNote(currentNoteIdx, oct);
        octaveRow.querySelectorAll('.syn-note-selector__btn--octave').forEach(b => b.classList.remove('on'));
        ob.classList.add('on');
        noteSelectorDiv.querySelector('.syn-note-selector__label').textContent = 'ROOT NOTE · ' + currentSynthNoteLabel();
        autosave();
        initAudio();
        scheduleVoiceEditAudition(tr.id);
      });
      octaveRow.appendChild(ob);
    }
    noteSelectorDiv.appendChild(octaveRow);
    // 24-TET toggle
    const tetRow = document.createElement('div');
    tetRow.className = 'syn-note-selector__row syn-note-selector__row--tet';
    const tetBtn = document.createElement('button');
    tetBtn.className = 'syn-note-selector__btn syn-note-selector__btn--tet' + (synthUse24Tet ? ' on' : '');
    tetBtn.textContent = synthUse24Tet ? '24-TET ON' : '12-TET';
    tetBtn.title = 'Toggle 24-TET (quarter-tone) note selector';
    tetBtn.addEventListener('click', () => {
      synthUse24Tet = !synthUse24Tet;
      tetBtn.textContent = synthUse24Tet ? '24-TET ON' : '12-TET';
      tetBtn.classList.toggle('on', synthUse24Tet);
      noteSelectorDiv.querySelector('.syn-note-selector__label').textContent = 'ROOT NOTE · ' + currentSynthNoteLabel();
      // Rebuild note buttons for 24-TET if needed
      // Re-read current note/octave so 24-TET toggle doesn't stale the highlight
      rebuildNoteSelector(noteRow, octaveRow, synthRootNoteIndex(), synthRootOctave());
      autosave();
    });
    tetRow.appendChild(tetBtn);
    noteSelectorDiv.appendChild(tetRow);
    pn.appendChild(noteSelectorDiv);

    mkRow('DECAY', 4, 220, 1, Math.round(tr.p.decay*100), x=>`${(x/100).toFixed(2)} s`, v=>tr.p.decay=v/100, c);
    mkRow('TONE', 0, 100, 1, Math.round(tr.p.tone*100), x=>`${x}%`, v=>tr.p.tone=v/100, c);
    mkRow('SHAPE', 0, 100, 1, Math.round(tr.p.shape*100), x=>`${x}%`, v=>tr.p.shape=v/100, c);
  }
}

/* ═══════════════════════════════════════════════
   FX STATE APPLY
═══════════════════════════════════════════════ */
function applyFXState() {
  renderRhythmIntelligence();
  updateWreckSendStatus();
  if (!A) return;
  // delay
  N.dlyLine.delayTime.setTargetAtTime(dlyTimeSec(), A.currentTime, .02);
  N.dlyFB.gain.setTargetAtTime(FX.dly.fb, A.currentTime, .02);
  N.dlyTone.frequency.setTargetAtTime(toneHz(FX.dly.tone), A.currentTime, .02);
  N.dlyWet.gain.setTargetAtTime(FX.dly.on ? FX.dly.wet : 0, A.currentTime, .04);
  // reverb
  N.revWet.gain.setTargetAtTime(FX.rev.on ? FX.rev.wet : 0, A.currentTime, .04);
  // compressor / gate
  N.compGate.gain.setTargetAtTime(FX.comp.gateOn ? dbToGain(FX.comp.gateThreshold) : 1, A.currentTime, .02);
  const detectorSettings = compDetectorSettings(FX.comp);
  N.mstComp.threshold.setTargetAtTime(FX.comp.on ? FX.comp.threshold : 0, A.currentTime, .02);
  N.mstComp.ratio.setTargetAtTime(FX.comp.on ? FX.comp.ratio : 1, A.currentTime, .02);
  N.mstComp.attack.setTargetAtTime(detectorSettings.attack, A.currentTime, .02);
  N.mstComp.release.setTargetAtTime(detectorSettings.release, A.currentTime, .02);
  N.mstComp.knee.setTargetAtTime(detectorSettings.knee, A.currentTime, .02);
  N.compMakeup.gain.setTargetAtTime(dbToGain(autoMakeupGainDb(FX.comp)), A.currentTime, .02);
  // digital destruction
  updateWreckCurveIfNeeded();
  N.wreckDownsample.wreckRate = FX.wreck.rate;
  updateWreckProcessorFeed(shouldFeedWreckProcessor());
  N.wreckTone.frequency.setTargetAtTime(wreckToneHz(FX.wreck.tone), A.currentTime, .02);
  N.wreckWet.gain.setTargetAtTime(FX.wreck.on ? FX.wreck.mix : 0, A.currentTime, .02);
  N.wreckOut.gain.setTargetAtTime(FX.wreck.on ? FX.wreck.out : 0, A.currentTime, .02);
  N.wreckPreCompGain.gain.setTargetAtTime(FX.wreck.order === 'wreck-comp' ? 1 : 0, A.currentTime, .02);
  N.wreckPostCompGain.gain.setTargetAtTime(FX.wreck.order === 'comp-wreck' ? 1 : 0, A.currentTime, .02);
  // master
  N.mstVol.gain.setTargetAtTime(S.mstVol, A.currentTime, .02);
}

function applyPumpMacro() {
  FX.comp.on = true;
  FX.comp.threshold = -46;
  FX.comp.ratio = 12;
  FX.comp.attack = 2;
  FX.comp.release = 520;
  FX.comp.detector = 'peak';
  FX.comp.gateOn = true;
  FX.comp.gateThreshold = -54;
  FX.comp.gateRate = 420;
  FX.comp.gateAnalog = .55;
  syncFxControls();
  applyFXState();
  autosave();
  toast('PUMP ARMED');
}

function applyFrenchHousePreset() {
  FX.comp.on = true;
  FX.comp.threshold = -36;
  FX.comp.ratio = 8;
  FX.comp.attack = 3;
  FX.comp.release = 560;
  FX.comp.detector = 'peak';
  FX.comp.gateOn = true;
  FX.comp.gateThreshold = -68;
  FX.comp.gateRate = 680;
  FX.comp.gateAnalog = .45;
  syncFxControls();
  applyFXState();
  autosave();
  toast('FRENCH HOUSE');
}

/* ═══════════════════════════════════════════════
   PERSISTENCE
═══════════════════════════════════════════════ */
const LS_KEY = 'bighart_beat_v4_1';
let saveT = null;
function autosave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      const data = State.serializeProject({ appState: S, tracks: TRACKS, fx: FX, patterns: PATTERNS, ratchets: RATCHETS, hihatOpenness: HHT_OPENNESS, hihatAccent: HHT_ACCENT, synthNotes: SYNTH_NOTES, patternFxScenes: PATTERN_FX_SCENES, patternChain: S.patternChain });
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch(e) {}
  }, 250);
}
function loadSave() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = State.parseProjectImport(raw);
    if (!parsed.ok) return;
    applyProjectData(parsed.value);
  } catch(e) {}
}

function syncPatternButtons() {
  $('patt').querySelectorAll('.patt-b').forEach(b => {
    const patternIndex = parseInt(b.dataset.p);
    b.classList.toggle('on', parseInt(b.dataset.p) === S.patt);
    b.classList.toggle('latched', !!PATTERN_FX_SCENES[patternIndex]);
    b.title = PATTERN_FX_SCENES[patternIndex]
      ? 'Pattern ' + 'ABCD'[patternIndex] + ' has a latched FX scene'
      : 'Pattern ' + 'ABCD'[patternIndex];
  });
  syncLatchFxButton();
}

function syncLatchFxButton() {
  const latchBtn = $('latchFxBtn');
  if (!latchBtn) return;
  const hasAnyPatternLatch = PATTERN_FX_SCENES.some(Boolean);
  latchBtn.classList.toggle('latched', hasAnyPatternLatch);
  latchBtn.textContent = hasAnyPatternLatch ? 'UNLATCH FX' : 'LATCH FX';
  latchBtn.title = hasAnyPatternLatch
    ? 'Clear all latched pattern FX/mix scenes and keep the current settings shared across every pattern'
    : 'Save current FX/mix scene to selected pattern';
  latchBtn.setAttribute('aria-label', hasAnyPatternLatch
    ? 'Unlatch FX: clear all pattern FX and mix latches'
    : 'Latch current FX and mix scene to selected pattern');
}

function selectPattern(patternIndex, options) {
  const opts = options || {};
  if (!Number.isInteger(patternIndex) || patternIndex < 0 || patternIndex > 3) return;
  S.patt = patternIndex;
  if (opts.source === 'manual' && S.patternChain && S.patternChain.enabled) {
    const cue = State.cuePatternChain(S.patternChain, S.patt);
    S.patternChain = cue.chain;
    syncPatternChainControls();
  }
  syncPatternButtons();
  buildSeq();
  updateSynthNoteStatus();
  restorePatternFxScene(S.patt);
  renderRhythmIntelligence();
  if (opts.autosave !== false) autosave();
}

function syncPatternChainControls() {
  if (!$('songQueue') || !S.patternChain) return;
  const chain = State.normalizePatternChain(S.patternChain);
  S.patternChain = chain;
  $('chainToggle').classList.toggle('on', chain.enabled);
  $('chainToggle').textContent = chain.enabled ? 'CHAIN ON' : 'CHAIN';
  $('chainStatus').textContent = State.describePatternChainStatus(chain);
  if ($('chainCueMode')) {
    const holdMode = chain.manualCueMode === 'hold';
    $('chainCueMode').classList.toggle('on', holdMode);
    $('chainCueMode').textContent = holdMode ? 'CUE: HOLD' : 'CUE: CONT';
    $('chainCueMode').title = holdMode ? 'Manual cue mode: hold tapped pattern' : 'Manual cue mode: continue chain after taps';
    $('chainCueMode').setAttribute('aria-label', holdMode ? 'Pattern chain manual cue mode: hold manual pattern taps' : 'Pattern chain manual cue mode: continue chain after manual pattern taps');
  }
  const nextSlot = (chain.position + 1) % chain.items.length;
  $('songQueue').querySelectorAll('[data-chain-slot]').forEach(b => {
    const slot = parseInt(b.dataset.chainSlot);
    const item = chain.items[slot];
    if (!item) return;
    const isCurrent = chain.enabled && slot === chain.position;
    const isNext = chain.enabled && slot === nextSlot;
    const queueHint = isCurrent ? ' Current chain slot.' : (isNext ? ' Next queued slot.' : '');
    b.dataset.chainPattern = String(item.pattern);
    b.textContent = 'ABCD'[item.pattern] + '·' + item.bars;
    b.title = 'Tap: pattern; hold: bars (' + item.bars + ')';
    if (isNext) b.title = 'Next queued. ' + b.title;
    b.setAttribute('aria-label', 'Pattern chain slot ' + (slot + 1) + ': pattern ' + 'ABCD'[item.pattern] + ', ' + item.bars + ' bars.' + queueHint + ' Tap for pattern, hold for bars.');
    b.classList.toggle('on', isCurrent);
    b.classList.toggle('next', chain.enabled && slot === nextSlot);
  });
}

function cyclePatternChainSlot(slot) {
  const chain = State.normalizePatternChain(S.patternChain);
  const item = chain.items[slot];
  if (!item) return;
  S.patternChain = State.setPatternChainItem(chain, slot, { pattern: (item.pattern + 1) % 4, bars: item.bars });
  syncPatternChainControls();
  autosave();
}

function cyclePatternChainSlotBars(slot) {
  const chain = State.normalizePatternChain(S.patternChain);
  const item = chain.items[slot];
  if (!item) return;
  const currentIndex = CHAIN_SLOT_BAR_CHOICES.indexOf(item.bars);
  const nextBars = CHAIN_SLOT_BAR_CHOICES[(currentIndex + 1) % CHAIN_SLOT_BAR_CHOICES.length];
  S.patternChain = State.setPatternChainItem(chain, slot, { pattern: item.pattern, bars: nextBars });
  syncPatternChainControls();
  autosave();
  toast('CHAIN ' + 'ABCD'[item.pattern] + ' · ' + nextBars + ' bars');
}

function latchCurrentPatternFxScene() {
  if (PATTERN_FX_SCENES.some(Boolean)) {
    clearAllPatternFxScenes();
    return;
  }
  PATTERN_FX_SCENES[S.patt] = State.capturePatternFxScene({ appState: S, tracks: TRACKS, fx: FX });
  syncPatternButtons();
  autosave();
  toast('FX latched to pattern ' + 'ABCD'[S.patt]);
}

function clearAllPatternFxScenes() {
  for (let i = 0; i < PATTERN_FX_SCENES.length; i++) {
    PATTERN_FX_SCENES[i] = null;
  }
  syncPatternButtons();
  autosave();
  toast('FX latches cleared · shared settings active');
}

function analyzeCurrentRhythm() {
  if (!Rhythm || !Rhythm.analyzeRhythm) return null;
  return Rhythm.analyzeRhythm({
    bpm: S.bpm,
    swing: S.swing,
    tracks: TRACKS,
    pattern: PATTERNS[S.patt],
    ratchets: RATCHETS[S.patt],
    hihatOpenness: HHT_OPENNESS[S.patt],
    hihatAccent: HHT_ACCENT[S.patt],
    stepsPerBar: 16,
    fx: { comp: FX.comp },
  });
}

function createRhythmActionVariation() {
  if (!State.resolveRhythmMutationAction || !State.applyControlledPatternVariation) return;
  const analysis = analyzeCurrentRhythm();
  if (!analysis) return;
  const action = State.resolveRhythmMutationAction({
    analysis,
    pattern: PATTERNS[S.patt],
    ratchets: RATCHETS[S.patt],
    hihatOpenness: HHT_OPENNESS[S.patt],
    hihatAccent: HHT_ACCENT[S.patt],
  });
  if (!action || !action.edit) {
    lastBrainLoopResultStatus = '';
    $('brainLoopStatus').textContent = 'NO ACTION NEEDED';
    toast('ANCHOR OK');
    return;
  }
  const result = State.applyControlledPatternVariation({
    patterns: PATTERNS,
    ratchets: RATCHETS,
    hihatOpenness: HHT_OPENNESS,
    hihatAccent: HHT_ACCENT,
    sourceIndex: S.patt,
    targetIndex: (S.patt + 1) % 4,
    edit: action.edit,
  });
  PATTERNS[result.targetIndex] = result.patterns[result.targetIndex];
  RATCHETS[result.targetIndex] = result.ratchets[result.targetIndex];
  HHT_OPENNESS[result.targetIndex] = result.hihatOpenness[result.targetIndex];
  HHT_ACCENT[result.targetIndex] = result.hihatAccent[result.targetIndex];
  lastBrainLoopResultStatus = formatBrainLoopResultStatus(action, result.targetIndex);
  selectPattern(result.targetIndex, { source: 'manual', autosave: false });
  renderRhythmIntelligence();
  $('brainLoopStatus').textContent = formatBrainLoopResultStatus(action, result.targetIndex);
  autosave();
  let toastMessage = (action.reason || 'RI ACTION') + ' → pattern ' + 'ABCD'[result.targetIndex];
  if (action.edit.trackId === 'hihat' && action.edit.active) {
    const hihatPreviewOpen = action.edit.hihatOpen ?? HHT_PLACE;
    if (!S.playing) {
      previewHihat(hihatPreviewOpen);
      toastMessage += ' · heard hat';
    } else {
      toastMessage += ' · hat queued';
    }
  }
  toast(toastMessage);
}

function createControlledPatternVariation() {
  if (!State.applyControlledPatternVariation) return;
  const result = State.applyControlledPatternVariation({
    patterns: PATTERNS,
    ratchets: RATCHETS,
    hihatOpenness: HHT_OPENNESS,
    hihatAccent: HHT_ACCENT,
    sourceIndex: S.patt,
    targetIndex: (S.patt + 1) % 4,
    edit: {
      trackId: 'hihat',
      stepIndex: 15,
      active: 1,
      ratchet: 2,
      hihatOpen: 0.45,
    },
  });
  PATTERNS[result.targetIndex] = result.patterns[result.targetIndex];
  RATCHETS[result.targetIndex] = result.ratchets[result.targetIndex];
  HHT_OPENNESS[result.targetIndex] = result.hihatOpenness[result.targetIndex];
  HHT_ACCENT[result.targetIndex] = result.hihatAccent[result.targetIndex];
  selectPattern(result.targetIndex, { source: 'manual', autosave: false });
  renderRhythmIntelligence();
  autosave();
  toast('VAR +1 → pattern ' + 'ABCD'[result.targetIndex]);
}

function restorePatternFxScene(patternIndex) {
  const scene = PATTERN_FX_SCENES[patternIndex];
  if (!scene) return false;
  const restored = State.applyPatternFxScene(scene, { appState: S, tracks: TRACKS, fx: FX });
  if (!restored) return false;
  if (A) genRevIR();
  syncMasterControls();
  syncFxControls();
  syncEngineSelector();
  buildMix();
  if (TRACKS[S.sel].id === 'hihat') buildVE();
  applyFXState();
  toast('Restored FX scene ' + 'ABCD'[patternIndex]);
  return true;
}

function syncEngineSelector() {
  $('engineSel').querySelectorAll('[data-engine]').forEach(b => b.classList.toggle('on', b.dataset.engine === S.engine));
}

function syncToggleButton(buttonOrId, active) {
  const button = typeof buttonOrId === 'string' ? $(buttonOrId) : buttonOrId;
  if (!button) return;
  const isActive = !!active;
  button.classList.toggle('on', isActive);
  button.setAttribute('aria-pressed', String(isActive));
}

function syncFxControls() {
  syncToggleButton($('togDly'), FX.dly.on);
  syncToggleButton($('togRev'), FX.rev.on);
  $('dlyDiv').querySelectorAll('.div-b').forEach(b =>
    b.classList.toggle('on', Math.abs(parseFloat(b.dataset.d) - FX.dly.mult) < .001)
  );
  setFdr('dlyFb',   Math.round(FX.dly.fb * 100),   v => v + '%');
  setFdr('dlyTone', Math.round(FX.dly.tone * 100), v => v + '%');
  setFdr('dlyWet',  Math.round(FX.dly.wet * 100),  v => v + '%');
  setFdr('revSize', Math.round(FX.rev.size * 100), v => v + '%');
  setFdr('revDamp', Math.round(FX.rev.damp * 100), v => v + '%');
  setFdr('revGate', FX.rev.gate, v => v + ' ms');
  setFdr('revWet',  Math.round(FX.rev.wet * 100),  v => v + '%');
  syncToggleButton($('togComp'), FX.comp.on);
  syncToggleButton($('togCompGate'), FX.comp.gateOn);
  $('compDetector').querySelectorAll('.div-b').forEach(b =>
    b.classList.toggle('on', b.dataset.det === FX.comp.detector)
  );
  setFdr('compThresh', FX.comp.threshold, v => v + ' dB');
  setFdr('compRatio', FX.comp.ratio, v => v + ':1');
  setFdr('compAttack', FX.comp.attack, v => v + ' ms');
  setFdr('compRelease', FX.comp.release, v => v + ' ms');
  setFdr('compGateThresh', FX.comp.gateThreshold, v => v + ' dB');
  setFdr('compGateRate', FX.comp.gateRate, v => v + ' ms');
  syncToggleButton($('togWreck'), FX.wreck.on);
  $('wreckMode').querySelectorAll('.div-b').forEach(b =>
    b.classList.toggle('on', b.dataset.curve === FX.wreck.curve)
  );
  setFdr('wreckBits', FX.wreck.bits, v => v + ' bit');
  setFdr('wreckRate', Math.round(FX.wreck.rate * 100), v => v + '%');
  setFdr('wreckThresh', FX.wreck.threshold, v => v + ' dB');
  setFdr('wreckTone', Math.round(FX.wreck.tone * 100), v => v + '%');
  setFdr('wreckMix', Math.round(FX.wreck.mix * 100), v => v + '%');
  setFdr('wreckOut', Math.round(FX.wreck.out * 100), v => v + '%');
  const _wt = $('wreckOrderToggle');
  if (_wt) {
    _wt.textContent = FX.wreck.order === 'wreck-comp' ? 'ORDER: WRK→COMP' : 'ORDER: COMP→WRK';
    _wt.classList.toggle('wreck-order--comp-wreck', FX.wreck.order === 'comp-wreck');
    _wt.classList.toggle('wreck-order--wreck-comp', FX.wreck.order === 'wreck-comp');
  }
  updateWreckSendStatus();
}

const SWING_OPTIONS = [0, 0.25, 0.5, 0.75];

function nearestSwingOption(value) {
  const swung = Groove.clampSwing(value);
  return SWING_OPTIONS.reduce((best, opt) =>
    Math.abs(opt - swung) <= Math.abs(best - swung) ? opt : best
  , SWING_OPTIONS[0]);
}

function syncSwingControl() {
  const active = nearestSwingOption(S.swing);
  const knob = $('swing');
  const percent = Math.round(S.swing * 100);
  const visualSwing = Math.min(1, Math.max(0, S.swing));
  const angle = SwingKnob.angleFromSwing(visualSwing);
  if (knob) {
    knob.setAttribute('aria-valuenow', String(Math.min(100, Math.max(0, percent))));
    knob.setAttribute('aria-valuetext', percent + '% swing');
    knob.style.setProperty('--swing-angle', angle + 'deg');
  }
  const readout = $('vSwing');
  if (readout) readout.textContent = Math.round(S.swing * 100) + '%';
}

function setSwingFromOption(value) {
  S.swing = Groove.clampSwing(value);
  syncSwingControl();
  renderRhythmIntelligence();
  autosave();
}

function stepSwing(delta) {
  const active = nearestSwingOption(S.swing);
  const index = Math.max(0, SWING_OPTIONS.indexOf(active));
  const next = Math.min(SWING_OPTIONS.length - 1, Math.max(0, index + delta));
  setSwingFromOption(SWING_OPTIONS[next]);
}

function setSwingFromPointer(event) {
  const knob = $('swing');
  if (!knob) return;
  const rect = knob.getBoundingClientRect();
  const value = SwingKnob.swingFromPoint(rect, event);
  setSwingFromOption(nearestSwingOption(value));
}

function syncMasterControls() {
  $('bpmD').textContent = S.bpm;
  setFdr('mstVol', Math.round(S.mstVol * 100), v => v + '%');
  syncSwingControl();
}

function applyProjectData(d) {
  S.bpm = d.bpm;
  S.swing = Groove.clampSwing(d.swing);
  if (typeof d.patt === 'number') S.patt = d.patt;
  S.engine = d.engine || 'aphex';
  S.mstVol = d.mstVol;
  S.patternChain = State.normalizePatternChain(d.patternChain || State.createDefaultPatternChain());
  for (let i = 0; i < 4; i++) {
    PATTERNS[i] = State.clonePatternGrid(d.patterns[i]);
    RATCHETS[i] = State.cloneRatchetGrid(d.ratchets[i]);
    HHT_OPENNESS[i] = State.cloneHihatOpennessGrid(d.hihatOpenness[i]);
    HHT_ACCENT[i] = State.cloneHihatAccentGrid(d.hihatAccent && d.hihatAccent[i]);
    SYNTH_NOTES[i] = State.cloneSynthNotesGrid(d.synthNotes && d.synthNotes[i]);
    PATTERN_FX_SCENES[i] = d.patternFxScenes ? State.clonePatternFxScene(d.patternFxScenes[i]) : null;
  }
  d.tracks.forEach(st => {
    const tr = TRACKS.find(x => x.id === st.id);
    if (tr) {
      tr.mute = !!st.mute;
      tr.vol = typeof st.vol === 'number' ? st.vol : tr.vol;
      tr.dlyS = !!st.dlyS; tr.revS = !!st.revS; tr.wreckS = !!st.wreckS;
      if (st.p) Object.assign(tr.p, st.p);
    }
  });
  if (d.fx) {
    if (d.fx.dly) Object.assign(FX.dly, d.fx.dly);
    if (d.fx.rev) Object.assign(FX.rev, d.fx.rev);
    if (d.fx.comp) Object.assign(FX.comp, d.fx.comp);
    if (d.fx.wreck) Object.assign(FX.wreck, d.fx.wreck);
    if (A) genRevIR();
  }
}

/* ═══════════════════════════════════════════════
   EVENT WIRING
═══════════════════════════════════════════════ */
function wire() {
  $('playBtn').addEventListener('click', play);
  $('stopBtn').addEventListener('click', stopPlay);

  let bpmHold = null;
  let bpmHoldTimer = null;
  let bpmSuppressClickTarget = null;
  let bpmSuppressClickTimer = null;
  const BPM_HOLD_DELAY_MS = 360;
  function clearBpmHold() {
    clearInterval(bpmHold);
    bpmHold = null;
  }
  function clearBpmHoldTimer() {
    clearTimeout(bpmHoldTimer);
    bpmHoldTimer = null;
  }
  function clearBpmClickSuppression() {
    clearTimeout(bpmSuppressClickTimer);
    bpmSuppressClickTimer = null;
    bpmSuppressClickTarget = null;
  }
  function suppressNextBpmClick(buttonId) {
    clearTimeout(bpmSuppressClickTimer);
    bpmSuppressClickTimer = null;
    bpmSuppressClickTarget = buttonId;
  }
  function scheduleBpmClickSuppressionCleanup(buttonId) {
    clearTimeout(bpmSuppressClickTimer);
    bpmSuppressClickTimer = setTimeout(() => {
      if (bpmSuppressClickTarget === buttonId) clearBpmClickSuppression();
    }, 400);
  }
  function handleBpmClick(buttonId, delta, event) {
    if (bpmSuppressClickTarget === buttonId && (!event || event.detail !== 0)) {
      clearBpmClickSuppression();
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      return;
    }
    chgBPM(delta);
  }
  function startBpmHold(delta) {
    clearBpmHold();
    chgBPM(delta);
    bpmHold = setInterval(() => chgBPM(delta), 110);
  }
  function startBpmHoldAfterDelay(buttonId, delta) {
    clearBpmHoldTimer();
    bpmHoldTimer = setTimeout(() => {
      bpmHoldTimer = null;
      suppressNextBpmClick(buttonId);
      startBpmHold(delta);
    }, BPM_HOLD_DELAY_MS);
  }
  function endBpmHold(buttonId) {
    clearBpmHoldTimer();
    clearBpmHold();
    scheduleBpmClickSuppressionCleanup(buttonId);
  }
  $('bpmUp').addEventListener('click', event => handleBpmClick('bpmUp', 1, event));
  $('bpmDn').addEventListener('click', event => handleBpmClick('bpmDn', -1, event));
  $('bpmUp').addEventListener('pointerdown', event => {
    startBpmHoldAfterDelay('bpmUp', 2);
  });
  $('bpmDn').addEventListener('pointerdown', event => {
    startBpmHoldAfterDelay('bpmDn', -2);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => {
    $('bpmUp').addEventListener(e, () => endBpmHold('bpmUp'));
    $('bpmDn').addEventListener(e, () => endBpmHold('bpmDn'));
  });

  $('tapBtn').addEventListener('click', doTap);
  $('latchFxBtn').addEventListener('click', latchCurrentPatternFxScene);
  $('variationBtn').addEventListener('click', createControlledPatternVariation);
  $('brainLoopQuickBtn').addEventListener('click', createRhythmActionVariation);
  $('riFixAnchorBtn').addEventListener('click', createRhythmActionVariation);

  // patterns
  $('patt').querySelectorAll('.patt-b').forEach(b => {
    b.addEventListener('click', () => {
      selectPattern(parseInt(b.dataset.p), { source: 'manual' });
    });
  });

  $('chainToggle').addEventListener('click', () => {
    const nextEnabled = !S.patternChain.enabled;
    S.patternChain = State.setPatternChainEnabled(S.patternChain, nextEnabled);
    if (nextEnabled) {
      S.patternChain = State.cuePatternChain(S.patternChain, S.patt).chain;
    }
    syncPatternChainControls();
    autosave();
  });
  $('chainCueMode').addEventListener('click', () => {
    const chain = State.normalizePatternChain(S.patternChain);
    const nextMode = chain.manualCueMode === 'hold' ? 'continue' : 'hold';
    S.patternChain = State.setPatternChainManualCueMode(chain, nextMode);
    syncPatternChainControls();
    autosave();
  });
  $('songQueue').querySelectorAll('[data-chain-slot]').forEach(b => {
    let chainSlotPressTimer = null;
    let chainSlotLongPressed = false;
    const clearChainSlotPress = () => {
      if (chainSlotPressTimer) clearTimeout(chainSlotPressTimer);
      chainSlotPressTimer = null;
    };
    b.addEventListener('pointerdown', () => {
      clearChainSlotPress();
      chainSlotLongPressed = false;
      chainSlotPressTimer = setTimeout(() => {
        chainSlotLongPressed = true;
        cyclePatternChainSlotBars(parseInt(b.dataset.chainSlot));
      }, 450);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => b.addEventListener(type, clearChainSlotPress));
    b.addEventListener('contextmenu', e => e.preventDefault());
    b.addEventListener('click', () => {
      if (chainSlotLongPressed) {
        chainSlotLongPressed = false;
        return;
      }
      cyclePatternChainSlot(parseInt(b.dataset.chainSlot));
    });
  });

  // drum-machine engine: changes synthesis immediately and does not stop playback
  $('engineSel').querySelectorAll('[data-engine]').forEach(b => {
    b.addEventListener('click', () => {
      if (!State.ENGINES.includes(b.dataset.engine)) return;
      S.engine = b.dataset.engine;
      syncEngineSelector();
      previewEngineKit();
      if (TRACKS[S.sel].id === 'hihat' || TRACKS[S.sel].id === 'synth') buildVE();
      autosave();
    });
  });

  // delay
  $('togDly').addEventListener('click', () => {
    FX.dly.on = !FX.dly.on;
    syncToggleButton('togDly', FX.dly.on);
    applyFXState();
    autosave();
  });
  $('dlyDiv').querySelectorAll('.div-b').forEach(b => {
    b.addEventListener('click', () => {
      FX.dly.mult = parseFloat(b.dataset.d);
      $('dlyDiv').querySelectorAll('.div-b').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      applyFXState();
      autosave();
    });
  });
  bindF('dlyFb',   v => { FX.dly.fb   = v / 100; applyFXState(); }, v => v + '%');
  bindF('dlyTone', v => { FX.dly.tone = v / 100; applyFXState(); }, v => v + '%');
  bindF('dlyWet',  v => { FX.dly.wet  = v / 100; applyFXState(); }, v => v + '%');

  // reverb
  $('togRev').addEventListener('click', () => {
    FX.rev.on = !FX.rev.on;
    syncToggleButton('togRev', FX.rev.on);
    applyFXState();
    autosave();
  });
  bindF('revSize', v => { FX.rev.size = v / 100; scheduleRevIRRebuild(); }, v => v + '%');
  bindF('revDamp', v => { FX.rev.damp = v / 100; scheduleRevIRRebuild(); }, v => v + '%');
  bindF('revGate', v => { FX.rev.gate = v; }, v => v + ' ms');
  bindF('revWet',  v => { FX.rev.wet  = v / 100; applyFXState(); }, v => v + '%');

  // pump compressor / gate
  $('togComp').addEventListener('click', () => {
    FX.comp.on = !FX.comp.on;
    syncToggleButton('togComp', FX.comp.on);
    applyFXState();
    autosave();
  });
  $('togCompGate').addEventListener('click', () => {
    FX.comp.gateOn = !FX.comp.gateOn;
    syncToggleButton('togCompGate', FX.comp.gateOn);
    applyFXState();
    autosave();
  });
  $('pumpMacro').addEventListener('click', applyPumpMacro);
  $('frenchHousePreset').addEventListener('click', applyFrenchHousePreset);
  $('compDetector').querySelectorAll('.div-b').forEach(b => {
    b.addEventListener('click', () => {
      FX.comp.detector = b.dataset.det;
      $('compDetector').querySelectorAll('.div-b').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      applyFXState();
      autosave();
    });
  });
  bindF('compThresh', v => { FX.comp.threshold = v; applyFXState(); }, v => v + ' dB');
  bindF('compRatio', v => { FX.comp.ratio = v; applyFXState(); }, v => v + ':1');
  bindF('compAttack', v => { FX.comp.attack = v; applyFXState(); }, v => v + ' ms');
  bindF('compRelease', v => { FX.comp.release = v; applyFXState(); }, v => v + ' ms');
  bindF('compGateThresh', v => { FX.comp.gateThreshold = v; applyFXState(); }, v => v + ' dB');
  bindF('compGateRate', v => { FX.comp.gateRate = v; applyFXState(); }, v => v + ' ms');

  // DIGI WRECK compact digital destruction
  $('togWreck').addEventListener('click', () => {
    FX.wreck.on = !FX.wreck.on;
    syncToggleButton('togWreck', FX.wreck.on);
    applyFXState();
    autosave();
  });
  $('wreckMode').querySelectorAll('.div-b').forEach(b => {
    b.addEventListener('click', () => {
      FX.wreck.curve = b.dataset.curve;
      $('wreckMode').querySelectorAll('.div-b').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      applyFXState();
      autosave();
    });
  });
  const orderToggle = $('wreckOrderToggle');
  if (orderToggle) {
    orderToggle.addEventListener('click', () => {
      FX.wreck.order = FX.wreck.order === 'wreck-comp' ? 'comp-wreck' : 'wreck-comp';
      orderToggle.classList.toggle('wreck-order--comp-wreck', FX.wreck.order === 'comp-wreck');
      orderToggle.classList.toggle('wreck-order--wreck-comp', FX.wreck.order === 'wreck-comp');
      syncFxControls();
      applyFXState();
      autosave();
      toast(FX.wreck.order === 'wreck-comp' ? 'DIGI WRECK → COMP' : 'COMP → DIGI WRECK');
    });
  }
  bindF('wreckBits', v => { FX.wreck.bits = v; applyFXState(); }, v => v + ' bit');
  bindF('wreckRate', v => { FX.wreck.rate = v / 100; applyFXState(); }, v => v + '%');
  bindF('wreckThresh', v => { FX.wreck.threshold = v; applyFXState(); }, v => v + ' dB');
  bindF('wreckTone', v => { FX.wreck.tone = v / 100; applyFXState(); }, v => v + '%');
  bindF('wreckMix', v => { FX.wreck.mix = v / 100; applyFXState(); }, v => v + '%');
  bindF('wreckOut', v => { FX.wreck.out = v / 100; applyFXState(); }, v => v + '%');

  // master
  bindF('mstVol', v => { S.mstVol = v / 100; applyFXState(); }, v => v + '%');
  const swingKnob = $('swing');
  if (swingKnob) {
    swingKnob.addEventListener('pointerdown', event => {
      swingKnob.setPointerCapture?.(event.pointerId);
      setSwingFromPointer(event);
    });
    swingKnob.addEventListener('pointermove', event => {
      if (event.buttons) setSwingFromPointer(event);
    });
    swingKnob.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); stepSwing(1); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); stepSwing(-1); }
      if (event.key === 'Home') { event.preventDefault(); setSwingFromOption(0); }
      if (event.key === 'End') { event.preventDefault(); setSwingFromOption(0.75); }
    });
  }
  document.querySelectorAll('[data-swing-step]').forEach(b => {
    b.addEventListener('click', () => stepSwing(parseInt(b.dataset.swingStep, 10)));
  });

  // clear / export / import
  $('clearBtn').addEventListener('click', () => {
    if (!confirm('Clear pattern ' + 'ABCD'[S.patt] + '?')) return;
    PATTERNS[S.patt] = State.clearPattern();
    RATCHETS[S.patt] = State.createDefaultRatchetGrid();
    HHT_OPENNESS[S.patt] = State.createDefaultHihatOpennessGrid();
    HHT_ACCENT[S.patt] = State.createDefaultHihatAccentGrid();
    SYNTH_NOTES[S.patt] = State.createDefaultSynthNotesGrid();
    buildSeq();
    renderRhythmIntelligence();
    autosave();
    toast('Pattern ' + 'ABCD'[S.patt] + ' cleared');
  });
  $('expBtn').addEventListener('click', exportJSON);
  $('impBtn').addEventListener('click', () => $('impFile').click());
  $('impFile').addEventListener('change', importJSON);

  // sample load for input track
  $('smpFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > MAX_SAMPLE_BYTES) {
      toast('Sample too large (10 MB max)');
      e.target.value = '';
      return;
    }
    initAudio();
    try {
      const buf = await f.arrayBuffer();
      const ab = await A.decodeAudioData(buf);
      if (ab.duration > MAX_SAMPLE_SECONDS) {
        toast('Sample too long (30s max)');
        e.target.value = '';
        return;
      }
      TRACKS[4].smp = ab;
      TRACKS[4].smpN = f.name;
      if (S.sel === 4) buildVE();
      toast('Loaded: ' + f.name);
      autosave();
    } catch(err) {
      toast('Decode failed');
    }
  });

  // spacebar play/stop
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && document.body.classList.contains('running')) {
      e.preventDefault();
      S.playing ? stopPlay() : play();
    }
  });
}

function bindF(id, fn, valFn) {
  const f = $(id);
  const vEl = $('v' + id[0].toUpperCase() + id.slice(1));
  const apply = () => {
    const pct = ((f.value - f.min) / (f.max - f.min) * 100) + '%';
    f.style.setProperty('--fp', pct);
  };
  apply();
  if (vEl) vEl.textContent = valFn ? valFn(f.value) : f.value;
  f.addEventListener('input', () => {
    apply();
    if (vEl) vEl.textContent = valFn ? valFn(f.value) : f.value;
    fn(parseFloat(f.value));
    autosave();
  });
}

function chgBPM(d) {
  S.bpm = Math.min(240, Math.max(40, S.bpm + d));
  $('bpmD').textContent = S.bpm;
  renderRhythmIntelligence();
  if (A) N.dlyLine.delayTime.setTargetAtTime(dlyTimeSec(), A.currentTime, .03);
  autosave();
}

// tap tempo
let tapTimes = [];
function doTap() {
  const now = performance.now();
  tapTimes.push(now);
  if (tapTimes.length > 5) tapTimes.shift();
  $('tapBtn').classList.add('flash');
  setTimeout(() => $('tapBtn').classList.remove('flash'), 90);
  if (tapTimes.length >= 2) {
    const diffs = [];
    for (let i = 1; i < tapTimes.length; i++) diffs.push(tapTimes[i] - tapTimes[i-1]);
    const avg = diffs.reduce((a,b)=>a+b,0) / diffs.length;
    const bpm = Math.round(60000 / avg);
    if (bpm >= 40 && bpm <= 240) {
      S.bpm = bpm; $('bpmD').textContent = bpm;
      renderRhythmIntelligence();
      if (A) N.dlyLine.delayTime.setTargetAtTime(dlyTimeSec(), A.currentTime, .03);
      autosave();
    }
  }
  // reset if no tap for 2s
  clearTimeout(doTap._to);
  doTap._to = setTimeout(() => tapTimes = [], 2000);
}

function exportJSON() {
  const data = State.serializeProject({ appState: S, tracks: TRACKS, fx: FX, patterns: PATTERNS, ratchets: RATCHETS, hihatOpenness: HHT_OPENNESS, hihatAccent: HHT_ACCENT, synthNotes: SYNTH_NOTES, patternFxScenes: PATTERN_FX_SCENES, patternChain: S.patternChain, timestamp: new Date().toISOString() });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'bighart-beat-' + Date.now() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  toast('Exported');
}
async function importJSON(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const txt = await f.text();
    const parsed = State.parseProjectImport(txt);
    if (!parsed.ok) { toast('Import failed'); return; }
    applyProjectData(parsed.value);
    syncPatternButtons();
    syncPatternChainControls();
    syncMasterControls();
    syncFxControls();
    syncEngineSelector();
    buildSeq(); buildMix(); buildVE();
    renderRhythmIntelligence();
    applyFXState();
    autosave();
    toast('Imported');
  } catch(err) { toast('Import failed'); }
  finally { e.target.value = ''; }
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._to);
  toast._to = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ═══════════════════════════════════════════════
   LAUNCH
═══════════════════════════════════════════════ */
function launch() {
  loadSave();
  document.body.classList.add('running');
  buildSeq();
  buildMix();
  buildVE();
  // fill output vu segments
  const ovu = $('ovu');
  for (let i = 0; i < 24; i++) {
    const s = document.createElement('div');
    s.className = 'ovu-s';
    ovu.appendChild(s);
  }
  resetOutputVuCache();
  // restore UI state
  syncMasterControls();
  syncPatternButtons();
  syncPatternChainControls();
  syncFxControls();
  syncEngineSelector();
  renderRhythmIntelligence();
  wireQuickHihatPlacement();
  wire();
  requestAnimationFrame(uiLoop);
  // resume audio context on first gesture (iOS)
  const resume = () => { if (A && A.state === 'suspended') A.resume(); };
  document.addEventListener('touchstart', resume, { passive: true });
  document.addEventListener('pointerdown', resume);
}

function setFdr(id, v, valFn) {
  const f = $(id); if (!f) return;
  f.value = v;
  f.style.setProperty('--fp', ((v - f.min) / (f.max - f.min) * 100) + '%');
  const vEl = $('v' + id[0].toUpperCase() + id.slice(1));
  if (vEl) vEl.textContent = valFn ? valFn(v) : v;
}

$('startBtn').addEventListener('click', launch);