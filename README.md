# Bighart Beat

Bighart Beat is a browser-native drum machine and rhythm-intelligence instrument connected to Bernado's rhythm-cognition / neuroscience research.

Core translation:

> Groove = structured surprise that recovers into the meter.

## Current phase

MVP-priority playable candidate (web), plus an early native Android shell (Phase A).

Implemented baseline (web):

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

## Android app (native shell)

`android/` contains a Kotlin WebView shell that packages the same live web
source into a standalone Android app (`com.resonantsystems.bighartbeat`).
Design decisions are recorded in `docs/ADR-002-android-shell.md`.

Key points:

- The APK never drifts from the web app: a Gradle `Sync` task copies
  `index.html`, `src/`, and `styles/` into the app's assets at build time.
- `src/android-bridge.js` is the only change to the web app itself (one
  `<script>` tag in `index.html`). It's feature-detected and fully inert in
  browsers, GitHub Pages, and the test runner.
- Background audio is transport-driven: while the beat is playing, a
  foreground `mediaPlayback` service keeps the JS scheduler alive with the
  screen off; stopping the transport releases it.
- Built entirely in GitHub Actions — no local Android toolchain is used or
  required.

**Build status:** `android-build` workflow is green; the debug APK builds
successfully on every push touching `android/**`, `src/**`, `styles/**`, or
`index.html` (download from that workflow run's artifacts, GitHub login
required).

**Test status:** CI build passes. The on-device smoke checklist in
`docs/ADR-002-android-shell.md` (Phase A) has not yet been marked complete —
run through it after installing the debug APK and check off each item as it
passes.

**Release status:**

- First signed Android release is live: [`app-v1.0.0`](https://github.com/renardoberou/Bighart-Beat/releases/tag/app-v1.0.0) with signed APK, AAB, and SHA-256 checksums.
- Signed APK installed and basic on-device smoke confirmed working on 2026-07-09.

**Not yet done:**

- Extended on-device smoke checklist beyond basic install/use: persistence,
  screen-off playback, notification STOP, phone-call focus loss, and
  back-button exit.
- Gumroad attachment / Play internal-test distribution from the signed APK/AAB.
- Phase C native deepening: offline font vendoring, haptics, WebView audio
  latency evaluation.

No keystore, signing passwords, `.env` files, or built APK/AAB binaries are
ever committed to this repository — release artifacts are produced and
distributed exclusively through GitHub Actions (workflow artifacts and
GitHub Releases).

## How to run locally (web)

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

Expected current result: all 142 tests pass and syntax checks pass. This is
the same gate `pages.yml` runs before every deploy, and it also validates
`src/android-bridge.js`'s registration in the cache-busting manifest.

## Bernado test script

See:

- `docs/mvp-test-checklist.md` (web)
- `docs/ADR-002-android-shell.md` Phase A checklist (Android on-device smoke)

Minimum smoke path (web):

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
