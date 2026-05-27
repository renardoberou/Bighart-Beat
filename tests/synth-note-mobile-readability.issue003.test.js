#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles/main.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
const synthNotesJs = fs.readFileSync(path.join(root, 'src/state/synth-notes.js'), 'utf8');

// ── CSS mobile synth note readability checks ──

// 1. Mobile CSS increases synth note label font-size
assert(
  /\.row\[data-id="synth"\]\s\.sc\.syn-note::before[\s\S]*?font-size:\s*9px/.test(css),
  'mobile CSS should increase synth note ::before font-size to at least 9px'
);

// 2. Mobile CSS increases ratchet badge font-size on synth rows
assert(
  /\.row\[data-id="synth"\]\s\.sc\.r[23]::after[\s\S]*?font-size:\s*9px/.test(css),
  'mobile CSS should increase synth ratchet badge font-size to at least 9px'
);

// 3. Mobile CSS has ratchet-lbl coexistence rules
assert(
  /\.syn-note\.ratchet-lbl::before/.test(css),
  'CSS should have .syn-note.ratchet-lbl::before rule for position swapping'
);
assert(
  /\.ratchet-lbl\.r[23]::after/.test(css),
  'CSS should have .ratchet-lbl.r2/r3::after rule for position swapping'
);

// 4. Mobile CSS has stronger selected step highlight
assert(
  /\.row\[data-id="synth"\]\s\.sc\.syn-note-selected[\s\S]*?outline-width:\s*3px/.test(css),
  'mobile CSS should have thicker outline for selected synth note step'
);

// 5. Mobile CSS increases hat-help font size
assert(
  /@media[\s\S]*\.hat-help[\s\S]*?font-size:\s*10px/.test(css),
  'mobile CSS should increase .hat-help font-size to at least 10px'
);

// ── JS setSynthNoteMarker ratchet-lbl logic checks ──

// 6. setSynthNoteMarker removes ratchet-lbl class
assert(
  /classList\.remove\([^)]*ratchet-lbl/.test(js),
  'setSynthNoteMarker should remove ratchet-lbl class on refresh'
);

// 7. setSynthNoteMarker adds ratchet-lbl when ratchet > 1
assert(
  /currentRatchet\s*>\s*1[\s\S]*?ratchet-lbl/.test(js),
  'setSynthNoteMarker should add ratchet-lbl when ratchet > 1'
);

// 8. setSynthNoteMarker checks getRatchetCount
assert(
  /getRatchetCount\(RATCHETS/.test(js),
  'setSynthNoteMarker should check getRatchetCount for ratchet coexistence'
);

// ── Synth notes state label format checks ──

// 9. formatSynthNoteMarkerLabel returns interval labels
assert(
  /formatSynthNoteMarkerLabel/.test(synthNotesJs),
  'synth-notes.js should export formatSynthNoteMarkerLabel'
);

// 10. SYNTH_HARMONIC_INTERVAL_LABELS has expected entries
assert(
  /'oct↓'/.test(synthNotesJs) && /'root'/.test(synthNotesJs) && /'5th'/.test(synthNotesJs),
  'synth-notes.js should have oct↓, root, and 5th interval labels'
);

console.log('Synth note mobile readability checks passed.');
