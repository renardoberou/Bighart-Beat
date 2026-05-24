#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const State = require('../src/state/synth-notes.js');
const SynthVoice = require('../src/rhythm/synth-voice.js');

const rootHz = 100;
const ratio = 2;
const harmonicPitch = State.synthPitchForStep(rootHz, ratio);
assert.strictEqual(harmonicPitch, 200, 'fixture has a clear pre-engine harmonic pitch');

const expected909 = SynthVoice.resolveSynthVoiceSpec('909', { pitch: harmonicPitch, decay: 0.35, tone: 0.5, shape: 0.5 }).pitchHz;
const expectedReznor = SynthVoice.resolveSynthVoiceSpec('reznor', { pitch: harmonicPitch, decay: 0.35, tone: 0.5, shape: 0.5 }).pitchHz;
assert.strictEqual(expected909, 100, '909 resolver halves the audible synth pitch');
assert.strictEqual(expectedReznor, 148, 'Reznor resolver applies its industrial pitch multiplier');
assert.notStrictEqual(expected909, harmonicPitch, '909 audible pitch differs from the harmonic helper output');
assert.notStrictEqual(expectedReznor, harmonicPitch, 'Reznor audible pitch differs from the harmonic helper output');

const nineOhNineStatus = State.formatSynthNoteStatusLabel({ stepIndex: 0, ratio, rootHz, pitchHz: expected909 });
const reznorStatus = State.formatSynthNoteStatusLabel({ stepIndex: 0, ratio, rootHz, pitchHz: expectedReznor });
assert(nineOhNineStatus.includes('ROOT 100 Hz → 100 Hz'), 'status formatter can display the 909 engine-resolved Hz');
assert(reznorStatus.includes('ROOT 100 Hz → 148 Hz'), 'status formatter can display the Reznor engine-resolved Hz');

assert(
  /function\s+getStepSynthAudiblePitch\s*\(\s*step\s*\)\s*\{[\s\S]*SynthVoice\.resolveSynthVoiceSpec\(\s*S\.engine\s*,\s*\{\s*\.\.\.TRACKS\[6\]\.p\s*,\s*pitch:\s*getStepSynthPitch\(step\)\s*\}\s*\)\.pitchHz[\s\S]*\}/.test(main),
  'main exposes a selected-step audible pitch helper that uses the same engine resolver path/context as synthSynth audition/playback'
);

const statusMatch = main.match(/function\s+synthNoteStatusText\s*\(\s*step\s*\)\s*\{([\s\S]*?)\n\}/);
assert(statusMatch, 'synthNoteStatusText is discoverable');
const statusBody = statusMatch[1];
assert(/pitchHz:\s*getStepSynthAudiblePitch\(\s*boundedStep\s*\)/.test(statusBody), 'SYN NOTE EDIT status displays the engine-resolved audible synth pitch');
assert(!/pitchHz:\s*State\.synthPitchForStep\(\s*rootHz\s*,\s*ratio\s*\)/.test(statusBody), 'SYN NOTE EDIT status no longer displays only the pre-engine harmonic pitch');

assert(/function\s+previewSynth\s*\(\s*\)\s*\{[\s\S]*synthSynth\(t,\s*getTrackVoiceVelocity\(\s*6\s*\),\s*\{\s*\.\.\.tr\.p,\s*pitch:\s*getStepSynthPitch\(LAST_SYNTH_NOTE_STEP\)\s*\},\s*\{\s*audition:\s*true\s*\}\s*\)/.test(main), 'TEST SYN keeps using the selected-step harmonic pitch into the runtime synth resolver');
assert(/case\s+'synth':\s*\{\s*const\s+v\s*=\s*getTrackVoiceVelocity\(ti\);\s*synthSynth\(t,\s*v,\s*\{\s*\.\.\.tr\.p,\s*pitch:\s*getStepSynthPitch\(firingStep\)\s*\}\);\s*break;\s*\}/.test(main), 'sequenced SYN playback keeps its existing runtime synth resolver call path');

const synthPanelMatch = main.match(/syn\.innerHTML\s*=\s*`([\s\S]*?)`;\s*pn\.appendChild\(syn\)/);
assert(synthPanelMatch, 'SYN voice panel template is discoverable');
for (const hook of ['data-synth-test', 'data-synth-note-status', 'data-synth-note-edit', 'data-synth-prev-step', 'data-synth-next-step', 'data-synth-rnd-step', 'data-synth-root-step']) {
  assert(synthPanelMatch[1].includes(hook), `SYN NOTE EDIT hook remains intact: ${hook}`);
}

console.log('synth note engine-aware status checks passed');
