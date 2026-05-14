# MVP Playability Test Checklist — Bighart Beat

Purpose: practical acceptance gates for a Bernado-testable MVP candidate. Run these after automated checks and before sharing a build. A candidate is not MVP-pass until every Required gate below passes on desktop and at least one mobile browser.

## Automated preflight

From repo root:

```bash
for f in tests/*.test.js; do node "$f"; done
for f in src/state/*.js src/rhythm/*.js src/*.js tests/*.js; do node --check "$f"; done
```

Pass criteria:
- All test scripts exit 0.
- App, rhythm, state, and test JavaScript syntax checks pass.
- No unexpected working-tree source changes are present.

## Required MVP gates

### Gate 1 — launch/audio unlock
- Open `index.html` via a local server, not directly from a file URL when possible.
- Start screen shows `BIGHART BEAT` and `ENGAGE`.
- Tap/click `ENGAGE`; app shell appears.
- Press `PLAY`; browser audio starts after this user gesture.
- Press `STOP`, then `PLAY` again at least 5 times.

Pass criteria:
- Default beat is audible.
- Step display/playhead advances while playing and resets to `--` on stop.
- No doubled/flammed playback after repeated play/stop.
- Console remains free of errors.

### Gate 2 — sequencer playability
- Verify six rows are visible: KCK, SNR, HHT, CLP, INP, ETH.
- Toggle steps on/off across at least three tracks while stopped and while playing.
- Confirm toggled-on steps sound on the next loop.
- Clear only the selected pattern and confirm first.

Pass criteria:
- 6 × 16 grid remains usable.
- Step state updates visually and audibly.
- Clear affects only the selected bank.

### Gate 3 — BPM, tap tempo, and swing
- Use `+` and `−` to change BPM.
- Hold `+` and `−` to check repeat behavior.
- Tap `TAP` four times at an obvious tempo.
- Tap the `SWING` segmented toggle through `0%`, `25%`, `50%`, and `75%` while playing, then return to `0%`.
- Try bounds: BPM should not go below 40 or above 240; swing should stay on the four visible toggle choices.

Pass criteria:
- BPM display updates immediately.
- Playback tempo and delay time track the new BPM.
- Tap tempo settles to a plausible BPM without console errors.
- Swing visibly updates its percent readout and audibly delays off-beat 16ths without stopping transport.

### Gate 4 — pattern banks A–D
- In pattern A, make an obvious edit.
- Switch to B and make a different edit.
- Switch A → B → C → D → A.

Pass criteria:
- Each bank preserves independent pattern state.
- Active bank button accurately reflects the selected bank.
- Playback uses the currently selected bank.

### Gate 5 — mixer, voice editor, FX, master
- For each track: select the row, move at least one voice parameter, adjust volume, toggle M/D/R buttons.
- Toggle delay and reverb on/off; change delay division, feedback/tone/wet, reverb size/damp/gate/wet.
- Move master level and watch VU response while playing.

Pass criteria:
- Controls update labels/values immediately.
- Mute silences the track; volume changes are audible.
- Delay/reverb sends are audible when enabled and silent when disabled.
- No dangerous runaway feedback or clipping blast.

### Gate 6 — import/export/state persistence
- Export JSON after edits.
- Reload page and confirm autosaved state returns.
- Import the exported JSON.
- Try importing malformed JSON.

Pass criteria:
- Export downloads a JSON file.
- Valid import restores BPM, bank, patterns, mixer, FX, and master settings.
- Invalid import fails cleanly without mutating current state.

### Gate 7 — rhythm intelligence MVP
- Confirm a visible rhythm-intelligence panel/status exists.
- Confirm labels update after changing the current pattern: `SYNC`, `ANCHOR`, `TENSION`, `RECOVER`, `DRIVE`.
- Check fixture behavior: empty, four-on-floor, offbeat/syncopated, dense/all-steps, backbeat.

Pass criteria:
- Labels are deterministic for the same pattern.
- Analysis runs without audio dependency and does not affect playback timing.
- Empty pattern does not crash.

### Gate 8 — mobile Bernado smoke test
Test on a narrow phone viewport or actual phone.

- ENGAGE → PLAY works from touch.
- Transport, pattern buttons, and grid can be tapped without zooming.
- Toggle several steps accurately.
- Mute must be reachable by explicit `M` button; double-tap-only row-label mute is not sufficient.
- Scroll/use controls below sequencer without trapping the page.
- Import/export affordances are understandable or documented for the target browser.

Pass criteria:
- First-time user can make and hear a beat in under 2 minutes.
- No major control is hidden, untappable, or dependent on desktop-only gestures.
- No mobile console errors if remote debugging is available.

## Current known MVP caveats to check before Bernado test

- Rhythm intelligence UI/logic is now implemented and covered by automated fixtures, but still needs a real browser visual check.
- Swing timing is covered by automated fixtures and should be given an audible live-playback check at `25%`, `50%`, and the more drastic `75%` max.
- Reverb gate routing is covered by an automated runtime guard and still deserves an audible FX sanity check.
- Mobile mute usability must be verified: row-label double-click exists, but explicit mixer `M` buttons are the acceptable mobile path.
- Full MVP confidence still requires at least one actual mobile-browser pass.
