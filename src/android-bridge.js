'use strict';

/* ═══════════════════════════════════════════════
   ANDROID NATIVE SHELL BRIDGE — Bighart Beat (ADR-002)

   Loaded last in index.html. Feature-detected: when window.AndroidHost
   (injected by MainActivity.kt) is absent — every browser, GitHub Pages,
   the test runner — this file is completely inert.

   Contract with com.resonantsystems.bighartbeat.MainActivity:
     JS → native : AndroidHost.onAudioStarted()        claim audio focus
                   AndroidHost.setBackgroundAudio(b)   foreground service on/off
     native → JS : BighartAndroid.suspend()            audio focus lost (transient)
                   BighartAndroid.resume()             audio focus regained
                   BighartAndroid.stopFromNotification()  STOP action / permanent loss

   Engine globals consumed — all top-level bindings from src/main.js
   (classic scripts share one global lexical environment):
     A          AudioContext | null
     S          app state object (S.playing is the transport flag)
     initAudio  lazy AudioContext creation — every call site is by-name
     stopPlay   transport stop

   WHY S.playing IS INTERCEPTED INSTEAD OF WRAPPING play()/stopPlay():
   main.js binds the transport buttons BY REFERENCE —
       $('playBtn').addEventListener('click', play);
       $('stopBtn').addEventListener('click', stopPlay);
   — so reassigning the global functions after the fact would miss the
   primary path while catching the keyboard path, splitting behavior.
   The state flag is the single authoritative signal every code path
   mutates (transport buttons, spacebar, pattern chain, future macros),
   so an accessor on S.playing observes all of them at once.

   BACKGROUND AUDIO MODEL (divergence from ping-thing's explicit toggle):
   transport-driven. While the beat runs, leaving the app or turning the
   screen off keeps it playing (mediaPlayback foreground service holds the
   process foreground-privileged so the JS scheduler is not frozen).
   Stopping the transport — from the UI, the notification's STOP action,
   or a permanent audio-focus loss — releases the service. A drum machine
   that is playing should keep playing; one that is stopped should cost
   nothing. No new UI, no new user decision.
═══════════════════════════════════════════════ */
(function () {
  if (!window.AndroidHost) return;

  var audioAnnounced = false;

  /* ── native → JS control surface ─────────────────────────────────── */
  window.BighartAndroid = {
    suspend: function () {
      try { if (A) A.suspend(); } catch (e) {}
    },
    resume: function () {
      try { if (A) A.resume(); } catch (e) {}
    },
    stopFromNotification: function () {
      try { if (S.playing) stopPlay(); } catch (e) {}
      window.BighartAndroid.suspend();
    }
  };

  /* ── audio start → native audio focus ────────────────────────────── */
  /* initAudio is safe to wrap by reassignment: grep confirms all ten
     call sites in main.js invoke it by name, never by stored reference. */
  var _initAudio = initAudio;
  initAudio = function () {
    _initAudio();
    if (!audioAnnounced && A) {
      audioAnnounced = true;
      try { AndroidHost.onAudioStarted(); } catch (e) {}
    }
  };

  /* ── transport-driven background audio ───────────────────────────── */
  var playingValue = !!S.playing;
  Object.defineProperty(S, 'playing', {
    configurable: true,
    enumerable: true,
    get: function () { return playingValue; },
    set: function (v) {
      v = !!v;
      var changed = v !== playingValue;
      playingValue = v;
      if (changed) {
        try { AndroidHost.setBackgroundAudio(v); } catch (e) {}
      }
    }
  });
})();
