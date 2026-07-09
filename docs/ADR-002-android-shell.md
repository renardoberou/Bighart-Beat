# ADR-002 — Native Android shell inside the main repo

**Status:** Accepted — implementation approved directly by B. (owner), 2026-06-11.
**Supersedes:** nothing. Extends MASTER_PLAN beyond the browser MVP toward the
project endgame: Bighart Beat as a standalone native Android app.
**Precedent:** `renardoberou/ping-thing-android` (ADR-001 there) — same shell
architecture, builds green in CI as of 2026-06-11, Phase 2 complete.

## Context

Bighart Beat reached browser maturity: 337 commits, MASTER_PLAN Phases 1–5
shipped (modular state/audio/UI extraction, rhythm intelligence, performance
macro v1), green Pages deploys, extensive tests. The endgame has always been
a standalone native Android app. The owner builds exclusively from an Android
phone via GitHub web + Actions; no local toolchain exists or will exist.

Unlike Ping Thing (a single 175 KB HTML file vendored into a separate repo),
Bighart Beat is a **live multi-file app actively developed by the Hermes
swarm** in this repo. A vendored snapshot would drift within days.

## Decision

1. **The Android shell lives in this repo** under `android/`, beside the web
   source it packages. No second repo, no vendoring.
2. **Assets are synced at build time** from the live web source (`index.html`,
   `src/`, `styles/`) by a Gradle `Sync` task. The APK is, by construction,
   exactly the instrument Pages deploys. Hermes agents keep working on the
   web source; every change is automatically the next app build.
3. **Kotlin single-Activity WebView shell** served through `WebViewAssetLoader`
   under `https://appassets.androidplatform.net/` — classic scripts,
   query-string cache busters, and localStorage all behave identically to
   Pages. Engine preservation is absolute: zero DSP rewrites.
4. **Background audio is transport-driven**, not toggle-driven (divergence
   from ping-thing). `src/android-bridge.js` intercepts `S.playing`
   transitions: beat running → mediaPlayback foreground service holds the JS
   scheduler alive with the screen off; beat stopped → service released.
   Rationale: a drum machine that is playing should keep playing; one that is
   stopped should cost nothing; no new UI, no new user decision.
5. **`S.playing` is intercepted via accessor, not by wrapping functions** —
   main.js binds the transport buttons by reference
   (`addEventListener('click', play)`), so global-function reassignment would
   miss the primary path. The state flag is the single signal every code path
   mutates. `initAudio` *is* wrapped by reassignment (all ten call sites are
   by-name) to claim native audio focus on first audio.
6. **The bridge is feature-detected** (`window.AndroidHost`) and completely
   inert in browsers, Pages, and the test runner. One `<script>` tag in
   index.html is the only change to existing files.
7. **CI is the only build environment.** `android-build.yml` produces a debug
   APK artifact on every push touching `android/**`, `src/**`, `styles/**`,
   or `index.html`. `android-release.yml` produces a signed APK + AAB GitHub
   Release on tags matching `app-v*` (namespaced so web-side tagging stays
   free). Toolchain pinned to the proven ping-thing combo: Gradle 8.9,
   AGP 8.6.1, Kotlin 2.0.20, compileSdk 35, minSdk 26.
8. **App identity `com.resonantsystems.bighartbeat`** is committed and
   immutable post-release.

## Accepted losses in v1

- Google Fonts (Syne + Share Tech Mono) load online; offline falls back to
  system stacks. Phase C item: vendor the woff2 files into `styles/fonts/`.
- No haptics yet. `AndroidHost.hapticTap(ms)` is already exposed for a later
  pad-feedback pass.
- Web MIDI remains out of scope (consistent with MASTER_PLAN non-goals).

## Phase checklist

### Phase A — Debug APK (this change)
- [ ] `android-build.yml` green; `bighart-beat-debug-apk` artifact downloads
      and installs.
- [ ] On-device smoke against MASTER_PLAN Gate B: ENGAGE → audio; play/stop
      repeatedly; step toggling; banks A–D; BPM/tap; mutes/volumes/sends;
      voice editor; FX; save/load + import/export (localStorage persists
      across app restarts); no crash screen.
- [ ] Android-specific: screen off while playing → beat continues;
      notification STOP stops transport; phone-call focus loss stops
      transport; back-button double-press exits.

### Phase B — Signed release
- [x] Keystore generated in Termux and stored only in repo secrets
      (`KEYSTORE_B64`, `KEYSTORE_PASS`, `KEY_ALIAS`, `KEY_PASS`) — follow
      ping-thing-android `docs/RELEASE.md`, which already retired the unsafe
      public-artifact path.
- [x] Tag `app-v1.0.0` → Release with `bighart-beat-v1.0.0.apk` + `.aab`.
- [x] Signed APK installed and basic on-device smoke confirmed working on
      2026-07-09.
- [ ] Gumroad: attach the APK to the existing Bighart Beat product.

### Phase C — Native deepening (only after A+B stable)
- [ ] Vendor fonts for full offline.
- [ ] Haptic taps on step/pad hits via `AndroidHost.hapticTap`.
- [ ] Evaluate measured WebView audio latency; Oboe escape hatch only if a
      real device shows it is needed (ping-thing ADR-001 threshold logic).

## Alternatives rejected

- **Separate `bighart-beat-android` repo (ping-thing pattern)** — correct for
  a frozen single file; wrong for a live multi-file app under active swarm
  development. Drift is certain; sync-at-build makes drift impossible.
- **Capacitor/Cordova/TWA/Flutter** — rejected for the same reasons as
  ping-thing ADR-001; TWA additionally couples a paid offline instrument to
  hosted HTTPS + Chrome.
