# Bighart Beat — MASTER PLAN

Mission: 001 — Repo Foundation and Master Plan

Status: planning gate complete; implementation remains gated until user approval.

## 1. Canonical decision

- Base implementation: `/storage/emulated/0/Download/bighart-beat-v4-studio-2.html`
- Reference/inspiration: `/storage/emulated/0/Download/bighart-beat-v3-2.html`

Decision: use the v4 studio shell as the implementation baseline. Mine v3.2 only for inspiration: chaos controls, MIDI/live-input concepts, richer FX ideas, and performance macro vocabulary.

## 2. Product vision

Bighart Beat is a browser-native drum machine that teaches rhythm through use: make beat → hear beat → see rhythm analysis → adjust beat → understand rhythm better.

It should feel like a playable instrument first and a rhythm-cognition sandbox second.

Core product translation:

> Groove = structured surprise that recovers into the meter.

## 3. MVP scope

The MVP is acceptable when a first-time user can:

- Tap ENGAGE and unlock audio.
- Press play and hear a default beat.
- Program a 6-track × 16-step pattern.
- Change BPM and use tap tempo.
- Switch pattern banks A–D without losing patterns.
- Adjust voice parameters, mute/volume, delay/reverb sends, and master level.
- Export/import JSON state.
- See a static rhythm-intelligence panel that updates deterministically from the current pattern.

### MVP rhythm-intelligence readout

Use simple labels, not academic jargon:

- `SYNC`: straight / groove / tense / broken
- `ANCHOR`: locked / bending / wobbly / lost
- `TENSION`: low / med / high / red
- `RECOVER`: recovers / wobbles / unstable
- `DRIVE`: flat / moving / locked / peak

Initial visible output example:

```text
SYNC: GROOVE
ANCHOR: LOCKED
TENSION: MED
RECOVER: RECOVERS
DRIVE: PEAK
```

## 4. Non-goals for MVP

Do not build yet:

- Generative beat creation.
- AI variation.
- Markov/probabilistic mutation.
- Full v3 chaos system.
- User accounts/cloud sync.
- MIDI input/output.
- Live mic capture.
- DAW plugin/export audio.
- Deep wiki browser inside app.
- Scientific citation UI.
- Medical/neuroscience claims.

## 5. Swarm roles

Role definitions live in `.hermes/agents/`:

- Orchestrator / Conductor: coordinates task graph, gates, final synthesis.
- Product Agent: roadmap, MVP, non-goals, feature priority.
- UI/UX Agent: layout, performance controls, visual language.
- Audio Engine Agent: Web Audio, scheduler, voices, FX, rhythm metrics feasibility.
- Code Agent: implementation after specs are approved.
- QA / Critic Agent: acceptance tests, risks, breakage detection.
- Research Bridge Agent: neuroscience/wiki → playable metrics.
- Architect / Refactor Agent: HTML snapshot audit and modularization plan.

## 6. UI/UX direction

Keep v4’s three-zone app shell:

1. Transport/system rail
   - Play/stop, BPM, tap, step display, pattern bank, compact rhythm status chip.
2. Sequencer
   - Always-visible 6 × 16 grid.
   - Track rows: KCK, SNR, HHT, CLP, INP, ETH.
3. Control deck
   - Voice, Mix, Rhythm, FX, Master sections.

Important UI decisions:

- Keep warm dark Bighart Bay / Resonant Systems visual identity.
- Avoid double-click as the only mute gesture on mobile; use long-press or explicit mute buttons.
- Add compact `RHYTHM INTELLIGENCE` panel inspired by v3’s Chaos tab, but non-destructive for MVP.
- Make analysis visible without hiding the sequencer.
- Do not overload step cells; intelligence overlays should be optional.

## 7. Audio architecture

Recommended runtime layers:

- UI Layer: emits transport, pattern, voice, FX, storage actions.
- Sequencer Layer: owns BPM, play state, current step, lookahead scheduling.
- Audio Engine Layer: owns AudioContext, graph, voices, samples, FX, master.
- Voice Layer: stateless trigger functions for kick/snare/hihat/clap/input/ether.
- Rhythm Intelligence Layer: pure functions over pattern grid; no AudioContext dependency.

Scheduler baseline from v4:

- `lookaheadSec = 0.10`
- `tickMs = 20–25`
- `stepDurSec = 60 / bpm / 4`
- 16-step loop, 4/4 sixteenths

Audio graph target:

```text
voices -> dry bus -> master sum -> compressor -> saturation -> master gain -> limiter -> analyser -> destination
       -> delay send -> delay line/filter/feedback/wet -> master sum
       -> reverb send -> gate -> convolver/wet -> master sum
```

Routing guard now implemented and covered:

- Per-hit reverb sends route through `revSend -> revGate -> conv`, not directly to `conv`.
- Fresh delay/reverb injection is blocked when the global effect is off or wet is zero; existing delay feedback tails remain intentional.

## 8. Rhythm-intelligence heuristic MVP

Keep deterministic, cheap, explainable.

### Inputs

```js
{
  bpm,
  swing,
  tracks,
  pattern,
  stepsPerBar: 16
}
```

### Outputs

```js
{
  syncopation,
  meterConfidence,
  surpriseTension,
  recoverability,
  movementDrive,
  labels,
  stepMetrics
}
```

### Default meter salience

```text
[1.00, 0.15, 0.45, 0.15,
 0.75, 0.15, 0.45, 0.15,
 0.90, 0.15, 0.45, 0.15,
 0.75, 0.15, 0.45, 0.15]
```

### Track weights

```text
kick = 1.00
snare = 0.90
clap = 0.75
input/perc = 0.65
hihat = 0.35
ether/texture = 0.25
```

### Movement-drive proxy

Prefer an inverted-U around medium syncopation:

```text
movementDrive = meterConfidence × recoverability × structuredNoveltyCurve
```

Default target:

```text
target_syncopation = 0.38
target_width = 0.38
```

## 9. Proposed repo architecture

Start with plain modern browser JavaScript modules. Avoid React/Svelte/etc. for MVP unless later justified.

Recommended tree:

```text
bighart-beat/
  README.md
  docs/
    MASTER_PLAN.md
    MISSION_001.md
    product-roadmap.md
    ui-ux-spec.md
    audio-engine-architecture.md
    research-bridge.md
    refactor-plan.md
    qa-test-plan.md
  src/
    main.js
    app/
      launch.js
      actions.js
      selectors.js
    state/
      initialState.js
      tracks.js
      patterns.js
      fxState.js
      schema.js
      migrations.js
    audio/
      audioContext.js
      scheduler.js
      metering.js
      graph/
        masterGraph.js
        delayGraph.js
        reverbGraph.js
        sends.js
      voices/
        kick.js
        snare.js
        hihat.js
        clap.js
        input.js
        ether.js
    rhythm/
      rhythm-intelligence.js
    ui/
      transport.js
      sequencer.js
      patternBank.js
      mixer.js
      voiceEditor.js
      rhythmPanel.js
      fxPanel.js
      masterPanel.js
      toast.js
      faders.js
    storage/
      localStorage.js
      exportImport.js
  styles/
    tokens.css
    base.css
    layout.css
    transport.css
    sequencer.css
    controls.css
  tests/
    patterns.test.js
    rhythm-intelligence.test.js
    scheduler.test.js
```

## 10. Implementation sequence

### Phase 0 — Behavior baseline

- Treat v4 as canonical behavior.
- Define parity checklist before code extraction.
- No v3 feature copying yet.

### Phase 1 — Minimal repo app shell

- Add `index.html`.
- Add `src/main.js`.
- Add CSS files.
- Move v4 markup/CSS/script with minimal behavior changes.
- Preserve IDs, classes, constants, and behavior.

### Phase 2 — State extraction

- Extract tracks, patterns, FX, app state.
- Add pure helpers and tests:
  - createPatternBanks
  - toggleStep
  - clearPattern
  - export/import validation

### Phase 3 — Audio extraction

- Extract AudioContext lifecycle.
- Extract master, delay, reverb graphs.
- Extract voices.
- Extract scheduler.
- Fix reverb send/gate routing.

### Phase 4 — UI extraction

- Extract faders, transport, sequencer, mixer, voice editor, FX, master panels.
- Preserve mobile layout.

### Phase 5 — Static rhythm intelligence

- Add pure `rhythm-intelligence.js`.
- Add fixtures and tests.
- Add Rhythm Intelligence panel.

### Phase 6 — Later feature wave

Only after MVP stability:

- Controlled variation.
- Performance macro: stable → groove tension → breakdown → recovery.
- MIDI/live input.
- Extended FX.
- Wiki link-outs/glossary.

## 11. QA gates

Implementation may start only after this master plan is accepted.

### Gate A — Repo/masterplan

- `docs/MASTER_PLAN.md` exists.
- v4 base and v3 reference are documented.
- MVP scope and non-goals are explicit.
- Behavior parity checklist exists.
- Audio/timing criteria exist.
- Mobile criteria exist.
- Rhythm-intelligence criteria exist.

### Gate B — First implementation parity

- Start screen appears.
- ENGAGE opens app.
- Audio starts after user gesture.
- Play/stop works repeatedly.
- No duplicate scheduler loop after repeated play/stop.
- Default pattern matches v4.
- Step toggling works.
- Pattern A–D switching preserves independent state.
- BPM clamp/tap tempo works.
- Track mute/volume/send controls work.
- Voice editor works for all tracks.
- Delay/reverb/master controls work.
- Save/load and import/export work.
- Mobile narrow viewport remains usable.
- No console errors during standard flows.

### Gate C — Rhythm intelligence MVP

Fixture expectations:

- Empty pattern: low drive, low meter confidence, no crash.
- Four-on-floor: high meter confidence, low/medium syncopation, high recoverability.
- Offbeat pattern: higher syncopation/tension.
- Dense all-steps pattern: high tension, lower recoverability.
- Backbeat pattern: recognizable 4/4 support.

Performance target:

- Analysis under 50 ms on mobile-class device.
- No audio-thread/scheduler dependency.

## 12. Risk register

Critical:

- Scheduler drift/regression during refactor.
- Mobile audio unlock failure.
- Global mutable state bugs.
- Untestable rhythm-intelligence scope.

Important:

- FX routing/gain staging changes.
- Import/export schema breakage.
- Dense mobile UI / small touch targets.
- Performance degradation from re-rendering.

Mitigations:

- Preserve v4 behavior first.
- Extract one subsystem at a time.
- Add pure tests for patterns/rhythm/scheduler helpers.
- Keep audio creation behind user gesture.
- Version exported/imported JSON.
- Add manual mobile checklist.

## 13. Next approved action

Recommended next action, if approved:

> Code Agent creates the behavior-preserving app shell from v4, while Audio Engine Agent reviews only the scheduler/audio graph extraction plan. No new features yet.

First implementation task:

```text
Create index.html + src/main.js + styles/* from v4 studio source, preserving behavior exactly.
```

Acceptance: pass Gate B parity checklist before extracting deeper modules or adding rhythm intelligence.
