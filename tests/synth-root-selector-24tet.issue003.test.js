#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const mainJs = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(
  /function\s+setSynthRootFromNote\s*\(\s*noteIndex,\s*octave,\s*use24Tet\s*=\s*false\s*\)/.test(mainJs),
  'setSynthRootFromNote accepts an optional 24-TET mode flag'
);
assert(/syn-note-selector__row--tet-stack/.test(mainJs), 'main.js defines the stacked 24-TET selector layout');
assert(/syn-note-selector__row--tet-band--quarter/.test(mainJs), 'main.js defines a dedicated quarter-tone selector band');
assert(/syn-note-selector__row--tet-stack/.test(css) && /syn-note-selector__row--tet-band/.test(css), 'CSS exposes 24-TET selector layout hooks');
assert(
  /overflow-x:\s*auto/.test(css) && /touch-action:\s*pan-x/.test(css) && /min-width:\s*3\.5rem/.test(css),
  '24-TET selector bands stay tappable on mobile'
);

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start >= 0, `runtime exposes ${name}`);
  let depth = 0;
  let end = -1;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert(end >= 0, `runtime function ${name} has a balanced body`);
  return source.slice(start, end);
}

function createClassList(target) {
  const classes = new Set();
  const sync = () => {
    target._className = Array.from(classes).join(' ');
  };
  return {
    add(...names) {
      names.filter(Boolean).forEach(name => classes.add(name));
      sync();
    },
    remove(...names) {
      names.filter(Boolean).forEach(name => classes.delete(name));
      sync();
    },
    toggle(name, force) {
      const shouldAdd = force === undefined ? !classes.has(name) : !!force;
      if (shouldAdd) classes.add(name);
      else classes.delete(name);
      sync();
      return classes.has(name);
    },
    contains(name) {
      return classes.has(name);
    },
  };
}

function createMockElement(tagName) {
  const el = {
    tagName: tagName.toUpperCase(),
    children: [],
    parentNode: null,
    textContent: '',
    title: '',
    dataset: {},
    _listeners: {},
    _innerHTML: '',
    _className: '',
  };
  Object.defineProperty(el, 'className', {
    get() {
      return el._className;
    },
    set(value) {
      el._className = String(value || '');
    },
  });
  Object.defineProperty(el, 'innerHTML', {
    get() {
      return el._innerHTML;
    },
    set(value) {
      el._innerHTML = String(value || '');
      el.children = [];
    },
  });
  el.classList = createClassList(el);
  el.appendChild = function appendChild(child) {
    child.parentNode = el;
    el.children.push(child);
    return child;
  };
  el.append = function append(...nodes) {
    nodes.forEach(node => el.appendChild(node));
  };
  el.addEventListener = function addEventListener(type, handler) {
    el._listeners[type] = handler;
  };
  el.click = function click() {
    if (el._listeners.click) el._listeners.click();
  };
  el.querySelectorAll = function querySelectorAll(selector) {
    const matches = [];
    const walk = node => {
      if (!node) return;
      if (selector === '.syn-note-selector__btn' && String(node.className).includes('syn-note-selector__btn')) matches.push(node);
      if (selector === '.syn-note-selector__btn--octave' && String(node.className).includes('syn-note-selector__btn--octave')) matches.push(node);
      (node.children || []).forEach(walk);
    };
    walk(el);
    return matches;
  };
  el.querySelector = function querySelector(selector) {
    return el.querySelectorAll(selector)[0] || null;
  };
  return el;
}

function createMockDocument() {
  return {
    createElement: createMockElement,
  };
}

function createSyncRow(count, kind) {
  const buttons = Array.from({ length: count }, (_, idx) => {
    const btn = {
      className: kind === 'octave'
        ? 'syn-note-selector__btn syn-note-selector__btn--octave'
        : 'syn-note-selector__btn',
      dataset: {},
      textContent: '',
      title: '',
      _listeners: {},
      _className: '',
    };
    Object.defineProperty(btn, 'className', {
      get() {
        return btn._className;
      },
      set(value) {
        btn._className = String(value || '');
      },
    });
    btn.classList = createClassList(btn);
    if (kind === 'note') btn.dataset.noteIndex = String(idx);
    btn.addEventListener = function addEventListener(type, handler) {
      btn._listeners[type] = handler;
    };
    btn.click = function click() {
      if (btn._listeners.click) btn._listeners.click();
    };
    return btn;
  });
  return {
    buttons,
    querySelectorAll(selector) {
      if (selector === '.syn-note-selector__btn') return buttons;
      if (selector === '.syn-note-selector__btn--octave') return buttons;
      return [];
    },
  };
}

function activeIndexes(row) {
  return row.buttons
    .map((btn, idx) => (btn.classList.contains('on') ? idx : -1))
    .filter(idx => idx !== -1);
}

function closeTo(actual, expected, label) {
  assert(Math.abs(actual - expected) < 1e-9, `${label} (expected ${expected}, got ${actual})`);
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function loadHarness(initialHz, use24Tet) {
  let buildSeqCalls = 0;
  let statusCalls = 0;
  const sandbox = {
    NOTE_SELECTOR_NAMES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
    NOTE_SELECTOR_24_NAMES: ['C', 'C♯½', 'C♯', 'D♭½', 'D', 'D♯½', 'D♯', 'E♭½', 'E', 'E♯½', 'F', 'F♯½', 'F♯', 'G♭½', 'G', 'G♯½', 'G♯', 'A♭½', 'A', 'A♯½', 'A♯', 'B♭½', 'B', 'B♯½'],
    TRACKS: Array.from({ length: 7 }, (_, idx) => idx === 6 ? { p: { pitch: initialHz } } : { p: {} }),
    State: {
      hzToMidi(hz) {
        if (!Number.isFinite(hz) || hz <= 0) return 0;
        return 12 * Math.log2(hz / 440) + 69;
      },
      midiToHz(midi) {
        if (!Number.isFinite(midi)) return 550;
        return 440 * Math.pow(2, (midi - 69) / 12);
      },
    },
    clamp(value, lo, hi) {
      return Math.max(lo, Math.min(hi, value));
    },
    SYNTH_ROOT_MAX_HZ: 550,
    synthUse24Tet: use24Tet,
    buildSeq() {
      buildSeqCalls += 1;
    },
    updateSynthNoteStatus() {
      statusCalls += 1;
    },
    autosave() {},
    initAudio() {},
    scheduleVoiceEditAudition() {},
    document: createMockDocument(),
    module: { exports: {} },
    exports: {},
  };
  const script = [
    extractFunction(mainJs, 'roundedSynthRootMidi'),
    extractFunction(mainJs, 'synthRootNoteIndex'),
    extractFunction(mainJs, 'synthRootOctave'),
    extractFunction(mainJs, 'normalizeSynthRootNoteIndex'),
    extractFunction(mainJs, 'synthRootSelectorState'),
    extractFunction(mainJs, 'noteLabel'),
    extractFunction(mainJs, 'setSynthRootFromNote'),
    extractFunction(mainJs, 'syncSynthRootSelectorState'),
    extractFunction(mainJs, 'rebuildNoteSelector'),
    'module.exports = { roundedSynthRootMidi, synthRootNoteIndex, synthRootOctave, normalizeSynthRootNoteIndex, synthRootSelectorState, noteLabel, setSynthRootFromNote, syncSynthRootSelectorState, rebuildNoteSelector };',
  ].join('\n\n');
  vm.runInNewContext(script, sandbox);
  return {
    ...sandbox.module.exports,
    TRACKS: sandbox.TRACKS,
    State: sandbox.State,
    getBuildSeqCalls: () => buildSeqCalls,
    getStatusCalls: () => statusCalls,
    document: sandbox.document,
  };
}

const tet = loadHarness(midiToHz(59.5), true);
const tetLayoutNoteRow = tet.document.createElement('div');
const tetLayoutOctaveRow = tet.document.createElement('div');
tet.rebuildNoteSelector(tetLayoutNoteRow, tetLayoutOctaveRow);
assert(tetLayoutNoteRow.classList.contains('syn-note-selector__row--tet-stack'), '24-TET rebuild uses the stacked layout container');
assert.strictEqual(tetLayoutNoteRow.children.length, 2, '24-TET rebuild creates two selector bands');
assert(tetLayoutNoteRow.children[0].className.includes('syn-note-selector__row--tet-band--semitone'), 'first 24-TET band is the semitone row');
assert(tetLayoutNoteRow.children[1].className.includes('syn-note-selector__row--tet-band--quarter'), 'second 24-TET band is the quarter-tone row');
assert.strictEqual(tetLayoutNoteRow.children[0].children.length, 12, 'semitone band keeps 12 buttons');
assert.strictEqual(tetLayoutNoteRow.children[1].children.length, 12, 'quarter-tone band keeps 12 buttons');
const tetLayoutActiveButtons = [];
tetLayoutNoteRow.children.forEach(band => band.children.forEach(btn => {
  if (String(btn.className).split(/\s+/).includes('on')) tetLayoutActiveButtons.push(btn);
}));
assert.strictEqual(tetLayoutActiveButtons.length, 1, '24-TET layout has exactly one active note button');
assert.strictEqual(tetLayoutActiveButtons[0].dataset.noteIndex, '23', '59.5 Hz maps to the B♯½ pitch class in the quarter-tone row');
assert.strictEqual(tetLayoutActiveButtons[0].textContent, 'B♯½3', '24-TET layout preserves the lower octave for quarter-flats below C4');
assert.strictEqual(tet.synthRootSelectorState().use24Tet, true, 'selector state reports 24-TET mode when enabled');
assert.strictEqual(tet.synthRootSelectorState().currentNoteIdx, 23, 'selector state rounds 59.5 Hz to the expected quarter-tone index');
assert.strictEqual(tet.synthRootSelectorState().currentOctave, 3, 'selector state keeps quarter-flats below C4 in octave 3');

tet.setSynthRootFromNote(1, 4, true);
closeTo(tet.TRACKS[6].p.pitch, tet.State.midiToHz(60.5), '24-TET setter preserves the exact C♯½4 pitch');
tet.setSynthRootFromNote(23, 3, true);
closeTo(tet.TRACKS[6].p.pitch, tet.State.midiToHz(59.5), '24-TET setter preserves the exact B♯½3 pitch');
assert.strictEqual(tet.getBuildSeqCalls(), 2, 'quarter-tone root changes still rebuild the synth sequence');
assert.strictEqual(tet.getStatusCalls(), 2, 'quarter-tone root changes still refresh the synth status');

const tetNoteRow = createSyncRow(24, 'note');
const tetOctaveRow = createSyncRow(5, 'octave');
tet.setSynthRootFromNote(1, 4, true);
let tetSync = tet.syncSynthRootSelectorState(tetNoteRow, tetOctaveRow, () => {});
assert.strictEqual(tetSync.currentNoteIdx, 1, 'sync state reports C♯½ as note index 1');
assert.strictEqual(tetSync.currentOctave, 4, 'sync state reports C♯½4 in octave 4');
assert.deepStrictEqual(activeIndexes(tetNoteRow), [1], 'sync state highlights the quarter-tone button');
assert.deepStrictEqual(activeIndexes(tetOctaveRow), [3], 'sync state highlights the matching octave button');

tet.setSynthRootFromNote(23, 3, true);
tetSync = tet.syncSynthRootSelectorState(tetNoteRow, tetOctaveRow, () => {});
assert.strictEqual(tetSync.currentNoteIdx, 23, 'sync state reports B♯½ as note index 23');
assert.strictEqual(tetSync.currentOctave, 3, 'sync state reports B♯½3 in octave 3');
assert.deepStrictEqual(activeIndexes(tetNoteRow), [23], 'sync state highlights the quarter-flat root button');
assert.deepStrictEqual(activeIndexes(tetOctaveRow), [2], 'sync state keeps the lower octave active for quarter-flats below C4');

const twelve = loadHarness(130, false);
assert.strictEqual(twelve.synthRootSelectorState().use24Tet, false, 'selector state reports 12-TET mode when disabled');
assert.strictEqual(twelve.synthRootSelectorState().currentNoteIdx, 0, '12-TET selector state keeps C as note index 0 at 130 Hz');
assert.strictEqual(twelve.synthRootSelectorState().currentOctave, 3, '12-TET selector state keeps 130 Hz in octave 3');
twelve.setSynthRootFromNote(1, 4);
closeTo(twelve.TRACKS[6].p.pitch, twelve.State.midiToHz(61), '12-TET setter still maps semitone roots exactly');
const twelveNoteRow = createSyncRow(12, 'note');
const twelveOctaveRow = createSyncRow(5, 'octave');
const twelveSync = twelve.syncSynthRootSelectorState(twelveNoteRow, twelveOctaveRow, () => {});
assert.strictEqual(twelveSync.currentNoteIdx, 1, '12-TET sync reports C♯ as note index 1 after retuning');
assert.strictEqual(twelveSync.currentOctave, 4, '12-TET sync reports the retuned octave correctly');
assert.deepStrictEqual(activeIndexes(twelveNoteRow), [1], '12-TET sync highlights the semitone note button');
assert.deepStrictEqual(activeIndexes(twelveOctaveRow), [3], '12-TET sync highlights the matching octave button');

const twelveFallback = loadHarness(midiToHz(59.5), false);
const twelveFallbackNoteRow = twelveFallback.document.createElement('div');
const twelveFallbackOctaveRow = twelveFallback.document.createElement('div');
twelveFallback.rebuildNoteSelector(twelveFallbackNoteRow, twelveFallbackOctaveRow);
assert.strictEqual(twelveFallbackNoteRow.children[0].textContent, 'C4', '12-TET rebuild falls back to rounded semitone state when explicit indices are omitted');

console.log('Issue 003 24-TET synth root selector checks passed.');
