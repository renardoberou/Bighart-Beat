# Bighart Beat

Bighart Beat is a browser-native drum machine and rhythm-intelligence instrument connected to Bernado's rhythm-cognition / neuroscience research.

Core translation:

> Groove = structured surprise that recovers into the meter.

## Current phase

MVP-priority playable candidate.

Implemented baseline:

- v4 studio app shell extracted into a repo-backed static browser app.
- 6-track × 16-step drum machine: KCK, SNR, HHT, CLP, INP, ETH.
- Transport: ENGAGE, PLAY, STOP, BPM, tap tempo, step display.
- Pattern banks A-D with independent state.
- Voice editor, mixer, delay, gated reverb, master/VU controls.
- Local autosave plus JSON export/import with validation.
- Static deterministic Rhythm Intelligence MVP readout:
  - SYNC
  - ANCHOR
  - TENSION
  - RECOVER
  - DRIVE

## How to run locally

From the repo root:

```bash
python3 -m http.server 8765
```

Then open:

```text
http://127.0.0.1:8765/index.html
```

On mobile, use a browser pointed at the static server address if available. Tap **ENGAGE** first, then **PLAY**. Browser audio requires a user gesture.

Directly opening `index.html` may work in some browsers, but the local server path is preferred for testing.

## Automated checks

From the repo root:

```bash
for f in tests/*.test.js; do node "$f"; done
for f in src/state/*.js src/rhythm/*.js src/*.js tests/*.js; do node --check "$f"; done
```

Expected current result: all tests pass and syntax checks pass.

## Bernado test script

See:

- `docs/mvp-test-checklist.md`

Minimum smoke path:

1. Open the app.
2. Tap **ENGAGE**.
3. Press **PLAY** and confirm the default beat is audible.
4. Toggle steps on KCK/SNR/HHT.
5. Switch A-D and confirm pattern state is preserved.
6. Change BPM and tap tempo.
7. Move mixer/voice/FX/master controls.
8. Export JSON, reload, and import it back.
9. Confirm Rhythm Intelligence labels update when the pattern changes.

## Canonical sources

- Base implementation: `/storage/emulated/0/Download/bighart-beat-v4-studio-2.html`
- Reference/inspiration only: `/storage/emulated/0/Download/bighart-beat-v3-2.html`

## Swarm roles

Role definitions live in `.hermes/agents/`.

The project is currently under an autonomous MVP-first controller cadence. Changes should remain small, verified, and scoped to playability/MVP gates before broader refactors.
