#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(/const\s+SynthVoice\s*=\s*(?:globalThis|window)\.BighartBeatSynth/.test(main), 'main.js imports BighartBeatSynth helper');
assert(/const\s+synthVoiceState\s*=\s*\{\s*gain:\s*null\s*\}/.test(main), 'runtime keeps shared mono synth state');
assert(/function\s+triggerSynthChoke\s*\(\s*t,\s*voiceGain,\s*spec\s*\)\s*\{[\s\S]*const\s+previous\s*=\s*synthVoiceState\.gain[\s\S]*previous\.gain[\s\S]*setTargetAtTime\(\.0008,\s*t,\s*spec\.chokeTau\)/.test(main), 'synth retrigger chokes/release-ramps previous mono voice');
assert(/synthVoiceState\.gain\s*=\s*voiceGain/.test(main), 'synth choke stores current voice for next retrigger');
assert(/function\s+synthSynth\s*\(\s*t,\s*v,\s*p\s*\)\s*\{[\s\S]*routeVoice\(t,\s*6\)[\s\S]*SynthVoice\.resolveSynthVoiceSpec\(S\.engine,\s*p\)[\s\S]*triggerSynthChoke\(t,\s*voiceGain,\s*spec\)/.test(main), 'synthSynth uses routeVoice, selected engine resolver, and mono choke');
assert(/createOscillator\(\)[\s\S]*\.type\s*=\s*spec\.oscType[\s\S]*frequency\.setValueAtTime\(spec\.pitchHz,\s*t\)/.test(main), 'synthSynth creates oscillator from resolver pitch/type');
assert(/createBiquadFilter\(\)[\s\S]*\.type\s*=\s*spec\.filterType[\s\S]*frequency\.setValueAtTime\(spec\.filterRestHz,\s*t\)[\s\S]*frequency\.exponentialRampToValueAtTime\(Math\.max\(80,\s*spec\.filterTriggerHz\),\s*t\s*\+\s*spec\.filterAttackSec\)/.test(main), 'synthSynth shapes tone through resolver trigger filter envelope');
assert(/const\s+SYNTH_NOTES\s*=\s*State\.createSynthNotesBanks\(\)/.test(main), 'runtime initializes per-pattern synth note banks');
assert(/function\s+getStepSynthPitch\s*\(\s*step\s*\)[\s\S]*State\.synthPitchForStep\(TRACKS\[6\]\.p\.pitch,\s*getStepSynthRatio\(step\)\)/.test(main), 'runtime derives synth playback pitch from root pitch and per-step ratio');
assert(/case\s+'synth':\s*synthSynth\(t,\s*v,\s*\{\s*\.\.\.tr\.p,\s*pitch:\s*getStepSynthPitch\(firingStep\)\s*\}\);\s*break;/.test(main), 'fire() dispatches synth track with per-step harmonic pitch');
assert(/function\s+previewSynth\s*\(\s*\)\s*\{[\s\S]*initAudio\(\)[\s\S]*triggerCompGate\(t,\s*tr\.id\)[\s\S]*synthSynth\(t,\s*tr\.vol,\s*tr\.p\)/.test(main), 'TEST SYN audition uses same runtime synth path');
assert(/tr\.n\s*===\s*'SYN'\s*\?\s*'SYNTH'/.test(main), 'voice editor names SYN as SYNTH');
assert(/tr\.id\s*===\s*'synth'[\s\S]*SYNTH ENGINE:\s*\$\{S\.engine\.toUpperCase\(\)\}[\s\S]*TEST SYN[\s\S]*mkRow\('PITCH'[\s\S]*mkRow\('DECAY'[\s\S]*mkRow\('TONE'[\s\S]*mkRow\('SHAPE'/.test(main), 'voice editor exposes SYN engine info, TEST SYN, pitch, decay, tone, and shape controls');
assert(/data-synth-test/.test(main), 'TEST SYN button has a stable data hook');
assert(/data-synth-note-edit/.test(main), 'SYN voice editor exposes a stable note-edit hook');
assert(/data-synth-rnd-harm/.test(main), 'SYN voice editor exposes a stable harmonic-randomize hook');
assert(/State\.cycleSynthNoteRatio\(SYNTH_NOTES\[S\.patt\],\s*i\)/.test(main), 'note edit cycles the selected synth step harmonic ratio');
assert(/State\.randomHarmonicSynthNotes\(SYNTH_NOTES\[S\.patt\],\s*PATTERNS\[S\.patt\]\.synth\)/.test(main), 'random harmonic action edits selected-pattern synth note ratios');
assert(/tr\.id\s*===\s*'synth'\s*\?\s*'syn'/.test(main), 'mixer maps synth to its own color key');
assert(/--t-syn\s*:/.test(css), 'CSS defines synth track color token');
assert(/\.row\[data-id="synth"\]\s+\.rlbl\s*\{\s*color:\s*var\(--t-syn\)/.test(css), 'SYN row label uses synth color token');
assert(/\.row\[data-id="synth"\]\s+\.rlbl\s+\.dot\s*\{\s*background:\s*var\(--t-syn\)/.test(css), 'SYN row dot uses synth color token');
assert(/\.row\[data-id="synth"\]\s+\.sc\.on\s*\{\s*background:\s*var\(--t-syn\)/.test(css), 'SYN active cells use synth color token');

console.log('Issue 010 synth runtime/UI static checks passed.');
