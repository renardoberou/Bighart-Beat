# Changelog

Notable changes to Bighart Beat. Dates reflect when changes landed on `main`.

## Unreleased — Android shell, Phase A

**Added**

- `android/` — Kotlin single-Activity WebView shell packaging the live web
  app as a standalone Android app (`com.resonantsystems.bighartbeat`),
  built entirely via GitHub Actions (no local toolchain). See
  `docs/ADR-002-android-shell.md` for full rationale.
  - Gradle `Sync` task copies `index.html`, `src/`, `styles/` into app
    assets at build time, so the APK cannot drift from the web app.
  - `MainActivity.kt`: loads the app via `WebViewAssetLoader`
    (`https://appassets.androidplatform.net/assets/...`), crash-visibility
    screen with copyable trace, double-back-to-exit, audio-focus handling
    (loss stops the transport).
  - `PlaybackService.kt`: foreground `mediaPlayback` service with a
    notification STOP action, so playback can continue with the screen off.
  - App icon, theme, and manifest resources.
- `src/android-bridge.js` — the only change to the existing web app. One
  `<script>` tag added to `index.html`. Feature-detected on
  `window.AndroidHost`; inert in browsers, GitHub Pages, and the test
  runner.
  - Intercepts the `S.playing` state transition (via property accessor,
    not function wrapping, since transport buttons are bound by reference)
    to start/stop native background audio.
  - Wraps `initAudio` by reassignment to claim native audio focus on first
    audio.
- `.github/workflows/android-build.yml` — builds a debug APK on every push
  touching `android/**`, `src/**`, `styles/**`, or `index.html`; uploads it
  as the `bighart-beat-debug-apk` workflow artifact.
- `.github/workflows/android-release.yml` — builds a signed APK + AAB and
  publishes a GitHub Release on tags matching `app-v*`. Reads the signing
  keystore and passwords from repository secrets
  (`KEYSTORE_B64`, `KEYSTORE_PASS`, `KEY_ALIAS`, `KEY_PASS`); fails loudly
  if they're missing. No secrets are ever committed.
- `docs/ADR-002-android-shell.md` — architecture decision record for the
  Android shell, including the Phase A/B/C rollout checklist.

**Fixed**

- `tests/static-asset-cache-busting.issue003.test.js` — the repo's QA gate
  asserts the exact `<script>` manifest in `index.html`. Updated it to
  recognize `src/android-bridge.js` (token, pattern alternation, expected
  script list, and per-script token mapping) so the Pages deploy gate
  passes with the new bridge script present.

**Status**

- CI: `android-build` green (debug APK artifact builds successfully);
  `pages.yml` green (all 142 tests + syntax checks pass, including the
  cache-busting gate above).
- Not yet done: Phase A on-device smoke checklist, Phase B signed release
  (keystore/secrets/tag/Gumroad), Phase C native deepening (offline fonts,
  haptics, WebView audio latency evaluation). See
  `docs/ADR-002-android-shell.md` for the itemized checklist.

## Earlier

Web app history (337+ commits) predates this changelog: modular
state/audio/UI extraction, rhythm-intelligence engine, pattern banks,
voice/mixer/FX editors, performance macro, and the full test suite. See
`docs/MASTER_PLAN.md` for phase-by-phase history of the web app.
