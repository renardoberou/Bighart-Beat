'use strict';
const $ = id => document.getElementById(id);
const MAX_SAMPLE_BYTES = 10 * 1024 * 1024;

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
const State = globalThis.BighartBeatState;
const Rhythm = globalThis.BighartBeatRhythm;
const TRACKS = State.createDefaultTracks();
const FX = State.createDefaultFxState();
const PATTERNS = State.createPatternBanks();
const S = State.createAppState();

/* ═══════════════════════════════════════════════
   AUDIO ENGINE
═══════════════════════════════════════════════ */
let A = null;
let nz = null;
const N = {}; // nodes
const KICK_PUMP_WEIGHT = 1;
const NON_KICK_PUMP_WEIGHT = 0.35;
const GATE_ANALOG_JITTER_MS = 6;
const GATE_ANALOG_CLOSED_DB = 3;

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
  N.dlySend = A.createGain(); N.dlySend.gain.value = 0.7;
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
  // delay/reverb sends tap from bus
  N.bus.connect(N.dlySend); N.dlySend.connect(N.dlyLine);
  N.bus.connect(N.revSend);
  // wet returns merge into the master sum
  N.dlyWet.connect(N.mstSum);
  N.revWet.connect(N.mstSum);

  // Alesis 3630-inspired pump compressor/gate: master sum → gate → compressor → auto makeup → saturation.
  // No manual output/makeup gain is exposed; makeup is computed from threshold/ratio and clamped safe.
  N.compGate = A.createGain(); N.compGate.gain.value = FX.comp.gateOn ? 0 : 1;
  N.mstComp = A.createDynamicsCompressor();
  N.mstComp.threshold.value = FX.comp.on ? FX.comp.threshold : 0;
  N.mstComp.knee.value      = FX.comp.detector === 'peak' ? 6 : 12;
  N.mstComp.ratio.value     = FX.comp.on ? FX.comp.ratio : 1;
  N.mstComp.attack.value    = FX.comp.attack / 1000;
  N.mstComp.release.value   = FX.comp.release / 1000;
  N.compMakeup = A.createGain(); N.compMakeup.gain.value = dbToGain(autoMakeupGainDb(FX.comp));
  N.mstSum.connect(N.compGate);
  N.compGate.connect(N.mstComp);
  N.mstComp.connect(N.compMakeup);

  // gentle warmth saturation, AFTER comp
  N.mstSat = A.createWaveShaper();
  N.mstSat.curve = mkSatCurve(.05);
  N.mstSat.oversample = '2x';
  N.compMakeup.connect(N.mstSat);

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

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

function autoMakeupGainDb(comp) {
  if (!comp || !comp.on) return 0;
  const thresholdAbs = Math.abs(Math.min(0, comp.threshold));
  const ratio = Math.max(1, comp.ratio || 1);
  return clamp(thresholdAbs * (1 - 1 / ratio) * 0.45, 0, 12);
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
  const dur  = 0.4 + size * 2.2;   // seconds
  const len  = Math.max(1, Math.floor(A.sampleRate * dur));
  const ir   = A.createBuffer(2, len, A.sampleRate);
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
}

/* ═══════════════════════════════════════════════
   VOICE SYNTHESIS — made to sound superb
═══════════════════════════════════════════════ */
function routeVoice(t, ti) {
  // create a per-hit gain so we can split to bus, delaySend, revSend at track-level
  const tr = TRACKS[ti];
  const out = A.createGain();
  out.gain.value = tr.vol;
  out.connect(N.bus);
  if (tr.dlyS) {
    const ds = A.createGain(); ds.gain.value = 1;
    out.connect(ds); ds.connect(N.dlyLine);
  }
  if (tr.revS) {
    const rs = A.createGain(); rs.gain.value = 1;
    out.connect(rs); rs.connect(N.revGate);
    triggerGate(t);
  }
  return out;
}

function triggerGate(t) {
  if (!FX.rev.on) return;
  const g = N.revGate.gain;
  const atk = .003, hold = FX.rev.gate / 1000, rel = .020;
  // Use cancelAndHoldAtTime where supported (Chrome/Safari) — gracefully clears
  // future events while preserving the current ramp position.
  if (g.cancelAndHoldAtTime) {
    g.cancelAndHoldAtTime(t);
  } else {
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
  }
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
  if (g.cancelAndHoldAtTime) {
    g.cancelAndHoldAtTime(t);
  } else {
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
  }
  g.linearRampToValueAtTime(1, t + atk);
  g.setValueAtTime(1, t + atk + hold);
  g.setTargetAtTime(analogClosed, t + atk + hold, Math.max(.005, rel / 3));
}

// ── KICK ── deep thump with click and saturation
function synthKick(t, v, p) {
  const dest = routeVoice(t, 0);
  // body oscillator (sine with pitch drop)
  const o = A.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(p.pitch * 1.8, t);                  // attack spike
  o.frequency.exponentialRampToValueAtTime(p.pitch, t + .008);    // initial drop
  o.frequency.exponentialRampToValueAtTime(p.end, t + p.decay * .6);
  // body envelope — peak at 0.85 leaves headroom for click + sub
  const g = A.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v * .85, t + .003);
  g.gain.exponentialRampToValueAtTime(.001, t + p.decay);
  // saturation on body
  const sat = A.createWaveShaper(); sat.curve = mkSatCurve(p.drive); sat.oversample = '2x';
  o.connect(sat); sat.connect(g); g.connect(dest);
  o.start(t); o.stop(t + p.decay + .08);
  // click layer — noise burst HP
  const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
  const nf = A.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 1800; nf.Q.value = .7;
  const ng = A.createGain();
  ng.gain.setValueAtTime(v * p.click * .42, t);
  ng.gain.exponentialRampToValueAtTime(.001, t + .018);
  ns.connect(nf); nf.connect(ng); ng.connect(dest);
  ns.start(t); ns.stop(t + .025);
  // sub body reinforcement
  const o2 = A.createOscillator(); o2.type = 'sine'; o2.frequency.value = p.end * .75;
  const g2 = A.createGain();
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(v * .28, t + .01);
  g2.gain.exponentialRampToValueAtTime(.001, t + p.decay * 1.1);
  o2.connect(g2); g2.connect(dest);
  o2.start(t); o2.stop(t + p.decay * 1.2 + .05);
}

// ── SNARE ── noise + pitched shell + crack
function synthSnare(t, v, p) {
  const dest = routeVoice(t, 1);
  // noise body (bandpass 1.5–4kHz)
  const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
  const nf = A.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2200; nf.Q.value = .5;
  const nhp = A.createBiquadFilter(); nhp.type = 'highpass'; nhp.frequency.value = 800;
  const ng = A.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(v * .58, t + .0018);
  ng.gain.exponentialRampToValueAtTime(.001, t + p.decay);
  ns.connect(nf); nf.connect(nhp); nhp.connect(ng); ng.connect(dest);
  ns.start(t); ns.stop(t + p.decay + .04);
  // pitched shell — two triangles an octave apart
  const t1 = A.createOscillator(); t1.type = 'triangle'; t1.frequency.value = p.tone;
  const t2 = A.createOscillator(); t2.type = 'triangle'; t2.frequency.value = p.tone * 1.5;
  const tg = A.createGain();
  tg.gain.setValueAtTime(0, t);
  tg.gain.linearRampToValueAtTime(v * p.body * .68, t + .0015);
  tg.gain.exponentialRampToValueAtTime(.001, t + p.decay * .45);
  t1.connect(tg); t2.connect(tg); tg.connect(dest);
  t1.start(t); t1.stop(t + p.decay * .6);
  t2.start(t); t2.stop(t + p.decay * .6);
  // transient crack — very short noise burst HP
  const cr = A.createBufferSource(); cr.buffer = nz; cr.loop = true;
  const cf = A.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 4500;
  const cg = A.createGain();
  cg.gain.setValueAtTime(v * p.snap * .55, t);
  cg.gain.exponentialRampToValueAtTime(.001, t + .012);
  cr.connect(cf); cf.connect(cg); cg.connect(dest);
  cr.start(t); cr.stop(t + .02);
}

// ── HIHAT ── highpass noise + metallic square ratios
function synthHihat(t, v, p) {
  const dest = routeVoice(t, 2);
  const dec = p.open > .5 ? Math.max(p.decay, .22 + p.open * .25) : p.decay;
  // noise layer
  const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
  const hf = A.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = p.freq; hf.Q.value = .8;
  const hf2 = A.createBiquadFilter(); hf2.type = 'bandpass'; hf2.frequency.value = 10500; hf2.Q.value = .7;
  const ng = A.createGain();
  ng.gain.setValueAtTime(0, t);
  ng.gain.linearRampToValueAtTime(v * .42, t + .0012);
  ng.gain.exponentialRampToValueAtTime(.001, t + dec);
  ns.connect(hf); hf.connect(hf2); hf2.connect(ng); ng.connect(dest);
  ns.start(t); ns.stop(t + dec + .04);
  // metallic tone mix (808-style square ratios) — only if metal > 0
  if (p.metal > 0.01) {
    const ratios = [2.00, 2.74, 3.00, 4.17, 4.36, 6.42];
    const mg = A.createGain();
    mg.gain.setValueAtTime(0, t);
    mg.gain.linearRampToValueAtTime(v * p.metal * .18, t + .001);
    mg.gain.exponentialRampToValueAtTime(.001, t + dec * .8);
    const hp = A.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = p.freq * .9;
    mg.connect(hp); hp.connect(dest);
    for (const r of ratios) {
      const o = A.createOscillator(); o.type = 'square';
      o.frequency.value = 205 * r;
      const og = A.createGain(); og.gain.value = 1 / ratios.length * .6;
      o.connect(og); og.connect(mg);
      o.start(t); o.stop(t + dec + .02);
    }
  }
}

// ── CLAP ── 3 short bursts + tail
function synthClap(t, v, p) {
  const dest = routeVoice(t, 3);
  const s = p.spread / 1000; // ms → s
  const bursts = [
    { o: 0.000, g: .48, d: .014 },
    { o: s,        g: .42, d: .014 },
    { o: s * 2,    g: .38, d: .014 },
    { o: s * 3.1,  g: .82, d: p.decay }, // the main tail
  ];
  for (const b of bursts) {
    const bt = t + b.o;
    const ns = A.createBufferSource(); ns.buffer = nz; ns.loop = true;
    const bp = A.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = p.tone + (Math.random() - .5) * 280;
    bp.Q.value = 1.3;
    const hp = A.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    const g = A.createGain();
    g.gain.setValueAtTime(0, bt);
    g.gain.linearRampToValueAtTime(v * b.g * .55, bt + .0008);
    g.gain.exponentialRampToValueAtTime(.001, bt + b.d);
    ns.connect(bp); bp.connect(hp); hp.connect(g); g.connect(dest);
    ns.start(bt); ns.stop(bt + b.d + .02);
  }
}

// ── INPUT ── sample playback
function synthInput(t, v, p) {
  const tr = TRACKS[4];
  if (!tr.smp) return;
  const dest = routeVoice(t, 4);
  const src = A.createBufferSource(); src.buffer = tr.smp;
  src.playbackRate.value = p.pitch;
  const g = A.createGain();
  g.gain.setValueAtTime(v, t);
  if (p.decay < 1.0) {
    const dur = tr.smp.duration * p.decay;
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
  }
  src.connect(g); g.connect(dest);
  src.start(t);
}

// ── ETHER ── EM-field interference (preserved from v3)
function synthEther(t, v, p) {
  const dest = routeVoice(t, 5);
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
      const amG = A.createGain(); amG.gain.value = .28;
      am.connect(amG);
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

function fire(ti, t) {
  const tr = TRACKS[ti];
  if (tr.mute) return;
  triggerCompGate(t, tr.id);
  const v = tr.vol;
  switch (tr.id) {
    case 'kick':  synthKick(t, v, tr.p); break;
    case 'snare': synthSnare(t, v, tr.p); break;
    case 'hihat': synthHihat(t, v, tr.p); break;
    case 'clap':  synthClap(t, v, tr.p); break;
    case 'input': synthInput(t, v, tr.p); break;
    case 'ether': synthEther(t, v, tr.p); break;
  }
}

/* ═══════════════════════════════════════════════
   SCHEDULER — deterministic, tight
═══════════════════════════════════════════════ */
const AHEAD = .10, TICK = 24;
let nextT = 0, sch = 0, schTimer = null;
const tlog = [];

function stepDur() { return 60 / S.bpm / 4; }

function schedStep(step, t) {
  tlog.push({ step, time: t });
  if (tlog.length > 64) tlog.shift();
  const grid = PATTERNS[S.patt];
  for (let ti = 0; ti < TRACKS.length; ti++) {
    const tr = TRACKS[ti];
    if (!grid[tr.id][step] || tr.mute) continue;
    fire(ti, t);
  }
}
function advance() { sch = (sch + 1) % 16; nextT += stepDur(); }
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
    const d = new Uint8Array(N.ana.frequencyBinCount);
    N.ana.getByteFrequencyData(d);
    const segs = document.querySelectorAll('.ovu-s');
    const bpg = Math.floor(d.length / segs.length);
    segs.forEach((seg, i) => {
      let s = 0;
      for (let j = i * bpg; j < (i + 1) * bpg; j++) s += d[j];
      const v = s / bpg / 255;
      seg.style.background = v > .72 ? 'var(--redLt)' : v > .42 ? 'var(--amberLt)' : 'var(--greenLt)';
      seg.style.opacity = .1 + v * .9;
    });
  }
}

/* ═══════════════════════════════════════════════
   SEQUENCER BUILD
═══════════════════════════════════════════════ */
function buildSeq() {
  const seq = $('seq');
  seq.innerHTML = '';
  for (const tr of TRACKS) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.id = tr.id;

    const lbl = document.createElement('div');
    lbl.className = 'rlbl' + (tr.mute ? ' mute' : '');
    lbl.dataset.ti = TRACKS.indexOf(tr);
    lbl.innerHTML = `<div class="dot"></div><span>${tr.n}</span><div class="mi">${tr.mute ? 'MUTE' : 'ON'}</div>`;
    lbl.addEventListener('click', () => {
      S.sel = TRACKS.indexOf(tr);
      buildSeq();
      buildMix();
      buildVE();
    });
    lbl.addEventListener('dblclick', e => {
      e.preventDefault();
      tr.mute = !tr.mute;
      buildSeq(); buildMix();
    });
    if (TRACKS.indexOf(tr) === S.sel) lbl.classList.add('sel');
    row.appendChild(lbl);

    for (let i = 0; i < 16; i++) {
      const c = document.createElement('div');
      c.className = 'sc';
      c.dataset.s = i;
      c.dataset.ti = TRACKS.indexOf(tr);
      if (i % 4 === 0)  c.classList.add('db');
      if (i % 8 === 0)  c.classList.add('db4');
      const grid = PATTERNS[S.patt];
      if (grid[tr.id][i]) c.classList.add('on');
      c.addEventListener('click', () => {
        PATTERNS[S.patt] = State.toggleStep(PATTERNS[S.patt], tr.id, i);
        if (PATTERNS[S.patt][tr.id][i]) c.classList.add('on');
        else c.classList.remove('on');
        renderRhythmIntelligence();
        autosave();
      });
      row.appendChild(c);
    }
    seq.appendChild(row);
  }
}

/* ═══════════════════════════════════════════════
   RHYTHM INTELLIGENCE
═══════════════════════════════════════════════ */
function renderRhythmIntelligence() {
  if (!Rhythm || !Rhythm.analyzeRhythm || !$('riPanel')) return;
  const labels = Rhythm.analyzeRhythm({
    bpm: S.bpm,
    swing: 0,
    tracks: TRACKS,
    pattern: PATTERNS[S.patt],
    stepsPerBar: 16,
  }).labels;
  $('riSync').textContent = labels.sync.toUpperCase();
  $('riAnchor').textContent = labels.anchor.toUpperCase();
  $('riTension').textContent = labels.tension.toUpperCase();
  $('riRecover').textContent = labels.recover.toUpperCase();
  $('riDrive').textContent = labels.drive.toUpperCase();
}

/* ═══════════════════════════════════════════════
   MIX STRIP
═══════════════════════════════════════════════ */
function buildMix() {
  const mix = $('mix');
  mix.innerHTML = '';
  TRACKS.forEach((tr, ti) => {
    const colKey = tr.id === 'kick'?'kck':tr.id === 'snare'?'snr':tr.id === 'hihat'?'hht':tr.id === 'clap'?'clp':tr.id === 'input'?'inp':'eth';
    const row = document.createElement('div');
    row.className = 'mt';
    row.innerHTML = `
      <div class="mt-n" style="color:var(--t-${colKey})">${tr.n}</div>
      <div class="mt-toggles">
        <button class="mt-btn mute${tr.mute?' on':''}" data-k="mute" title="Mute">M</button>
        <button class="mt-btn${tr.dlyS?' on':''}" data-k="dlyS" title="Delay send">D</button>
        <button class="mt-btn${tr.revS?' on':''}" data-k="revS" title="Reverb send">R</button>
      </div>
      <input type="range" class="fdr ${tr.col}" min="0" max="100" value="${Math.round(tr.vol*100)}">
      <div class="mt-val">${Math.round(tr.vol*100)}%</div>
    `;
    row.querySelectorAll('.mt-btn').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.k;
        tr[k] = !tr[k];
        b.classList.toggle('on');
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
    });
    pn.appendChild(row);
  };

  const c = tr.col;
  if (tr.id === 'kick') {
    mkRow('PITCH', 60, 240, 1, tr.p.pitch, x=>`${x|0} Hz`, v=>tr.p.pitch=v, c);
    mkRow('BODY',  20, 80, 1, tr.p.end, x=>`${x|0} Hz`, v=>tr.p.end=v, c);
    mkRow('DECAY', 10, 120, 1, Math.round(tr.p.decay*100), x=>`${(x/100).toFixed(2)} s`, v=>tr.p.decay=v/100, c);
    mkRow('CLICK', 0, 100, 1, Math.round(tr.p.click*100), x=>`${x}%`, v=>tr.p.click=v/100, c);
    mkRow('DRIVE', 0, 100, 1, Math.round(tr.p.drive*100), x=>`${x}%`, v=>tr.p.drive=v/100, c);
  } else if (tr.id === 'snare') {
    mkRow('TONE',  80, 600, 1, tr.p.tone, x=>`${x|0} Hz`, v=>tr.p.tone=v, c);
    mkRow('BODY',  0, 100, 1, Math.round(tr.p.body*100), x=>`${x}%`, v=>tr.p.body=v/100, c);
    mkRow('SNAP',  0, 100, 1, Math.round(tr.p.snap*100), x=>`${x}%`, v=>tr.p.snap=v/100, c);
    mkRow('DECAY', 4, 50, 1, Math.round(tr.p.decay*100), x=>`${(x/100).toFixed(2)} s`, v=>tr.p.decay=v/100, c);
  } else if (tr.id === 'hihat') {
    mkRow('FREQ',  4000, 14000, 100, tr.p.freq, x=>`${(x/1000).toFixed(1)} kHz`, v=>tr.p.freq=v, c);
    mkRow('DECAY', 2, 40, 1, Math.round(tr.p.decay*1000), x=>`${x} ms`, v=>tr.p.decay=v/1000, c);
    mkRow('OPEN',  0, 100, 1, Math.round(tr.p.open*100), x=>`${x}%`, v=>tr.p.open=v/100, c);
    mkRow('METAL', 0, 100, 1, Math.round(tr.p.metal*100), x=>`${x}%`, v=>tr.p.metal=v/100, c);
  } else if (tr.id === 'clap') {
    mkRow('SPREAD',2, 30, 1, tr.p.spread, x=>`${x} ms`, v=>tr.p.spread=v, c);
    mkRow('DECAY', 4, 40, 1, Math.round(tr.p.decay*100), x=>`${(x/100).toFixed(2)} s`, v=>tr.p.decay=v/100, c);
    mkRow('TONE',  900, 3000, 10, tr.p.tone, x=>`${x|0} Hz`, v=>tr.p.tone=v, c);
  } else if (tr.id === 'input') {
    // sample picker + pitch/decay
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
      });
    });
    mkRow('FREQ',  20, 400, 1, tr.p.freq, x=>`${x|0} Hz`, v=>tr.p.freq=v, c);
    mkRow('HARM',  0, 100, 1, Math.round(tr.p.harmonics*100), x=>`${x}%`, v=>tr.p.harmonics=v/100, c);
    mkRow('TEXT',  0, 100, 1, Math.round(tr.p.texture*100), x=>`${x}%`, v=>tr.p.texture=v/100, c);
    mkRow('GRIT',  0, 100, 1, Math.round(tr.p.grit*100), x=>`${x}%`, v=>tr.p.grit=v/100, c);
    mkRow('DECAY', 5, 80, 1, Math.round(tr.p.decay*100), x=>`${(x/100).toFixed(2)} s`, v=>tr.p.decay=v/100, c);
  }
}

/* ═══════════════════════════════════════════════
   FX STATE APPLY
═══════════════════════════════════════════════ */
function applyFXState() {
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
  N.mstComp.threshold.setTargetAtTime(FX.comp.on ? FX.comp.threshold : 0, A.currentTime, .02);
  N.mstComp.ratio.setTargetAtTime(FX.comp.on ? FX.comp.ratio : 1, A.currentTime, .02);
  N.mstComp.attack.setTargetAtTime(FX.comp.attack / 1000, A.currentTime, .02);
  N.mstComp.release.setTargetAtTime(FX.comp.release / 1000, A.currentTime, .02);
  N.mstComp.knee.setTargetAtTime(FX.comp.detector === 'peak' ? 6 : 12, A.currentTime, .02);
  N.compMakeup.gain.setTargetAtTime(dbToGain(autoMakeupGainDb(FX.comp)), A.currentTime, .02);
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
      const data = State.serializeProject({ appState: S, tracks: TRACKS, fx: FX, patterns: PATTERNS });
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
  $('patt').querySelectorAll('.patt-b').forEach(b => b.classList.toggle('on', parseInt(b.dataset.p) === S.patt));
}

function syncFxControls() {
  $('togDly').classList.toggle('on', FX.dly.on);
  $('togRev').classList.toggle('on', FX.rev.on);
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
  $('togComp').classList.toggle('on', FX.comp.on);
  $('togCompGate').classList.toggle('on', FX.comp.gateOn);
  $('compDetector').querySelectorAll('.div-b').forEach(b =>
    b.classList.toggle('on', b.dataset.det === FX.comp.detector)
  );
  setFdr('compThresh', FX.comp.threshold, v => v + ' dB');
  setFdr('compRatio', FX.comp.ratio, v => v + ':1');
  setFdr('compAttack', FX.comp.attack, v => v + ' ms');
  setFdr('compRelease', FX.comp.release, v => v + ' ms');
  setFdr('compGateThresh', FX.comp.gateThreshold, v => v + ' dB');
  setFdr('compGateRate', FX.comp.gateRate, v => v + ' ms');
}

function syncMasterControls() {
  $('bpmD').textContent = S.bpm;
  setFdr('mstVol', Math.round(S.mstVol * 100), v => v + '%');
}

function applyProjectData(d) {
  S.bpm = d.bpm;
  if (typeof d.patt === 'number') S.patt = d.patt;
  S.mstVol = d.mstVol;
  for (let i = 0; i < 4; i++) PATTERNS[i] = State.clonePatternGrid(d.patterns[i]);
  d.tracks.forEach(st => {
    const tr = TRACKS.find(x => x.id === st.id);
    if (tr) {
      tr.mute = !!st.mute;
      tr.vol = typeof st.vol === 'number' ? st.vol : tr.vol;
      tr.dlyS = !!st.dlyS; tr.revS = !!st.revS;
      if (st.p) Object.assign(tr.p, st.p);
    }
  });
  if (d.fx) {
    if (d.fx.dly) Object.assign(FX.dly, d.fx.dly);
    if (d.fx.rev) Object.assign(FX.rev, d.fx.rev);
    if (d.fx.comp) Object.assign(FX.comp, d.fx.comp);
    if (A) genRevIR();
  }
}

/* ═══════════════════════════════════════════════
   EVENT WIRING
═══════════════════════════════════════════════ */
function wire() {
  $('playBtn').addEventListener('click', play);
  $('stopBtn').addEventListener('click', stopPlay);

  $('bpmUp').addEventListener('click', () => chgBPM(1));
  $('bpmDn').addEventListener('click', () => chgBPM(-1));
  let bpmHold = null;
  $('bpmUp').addEventListener('pointerdown', () => { bpmHold = setInterval(() => chgBPM(2), 110); });
  $('bpmDn').addEventListener('pointerdown', () => { bpmHold = setInterval(() => chgBPM(-2), 110); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => {
    $('bpmUp').addEventListener(e, () => clearInterval(bpmHold));
    $('bpmDn').addEventListener(e, () => clearInterval(bpmHold));
  });

  $('tapBtn').addEventListener('click', doTap);

  // patterns
  $('patt').querySelectorAll('.patt-b').forEach(b => {
    b.addEventListener('click', () => {
      S.patt = parseInt(b.dataset.p);
      syncPatternButtons();
      buildSeq();
      renderRhythmIntelligence();
      autosave();
    });
  });

  // delay
  $('togDly').addEventListener('click', () => {
    FX.dly.on = !FX.dly.on;
    $('togDly').classList.toggle('on', FX.dly.on);
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
    $('togRev').classList.toggle('on', FX.rev.on);
    applyFXState();
    autosave();
  });
  bindF('revSize', v => { FX.rev.size = v / 100; if (A) genRevIR(); }, v => v + '%');
  bindF('revDamp', v => { FX.rev.damp = v / 100; if (A) genRevIR(); }, v => v + '%');
  bindF('revGate', v => { FX.rev.gate = v; }, v => v + ' ms');
  bindF('revWet',  v => { FX.rev.wet  = v / 100; applyFXState(); }, v => v + '%');

  // pump compressor / gate
  $('togComp').addEventListener('click', () => {
    FX.comp.on = !FX.comp.on;
    $('togComp').classList.toggle('on', FX.comp.on);
    applyFXState();
    autosave();
  });
  $('togCompGate').addEventListener('click', () => {
    FX.comp.gateOn = !FX.comp.gateOn;
    $('togCompGate').classList.toggle('on', FX.comp.gateOn);
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

  // master
  bindF('mstVol', v => { S.mstVol = v / 100; applyFXState(); }, v => v + '%');

  // clear / export / import
  $('clearBtn').addEventListener('click', () => {
    if (!confirm('Clear pattern ' + 'ABCD'[S.patt] + '?')) return;
    PATTERNS[S.patt] = State.clearPattern();
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
  const data = State.serializeProject({ appState: S, tracks: TRACKS, fx: FX, patterns: PATTERNS, timestamp: new Date().toISOString() });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'bighart-beat-' + Date.now() + '.json';
  a.click(); URL.revokeObjectURL(url);
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
    syncMasterControls();
    syncFxControls();
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
  // restore UI state
  syncMasterControls();
  syncPatternButtons();
  syncFxControls();
  renderRhythmIntelligence();
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