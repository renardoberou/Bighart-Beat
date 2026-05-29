#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles', 'main.css'), 'utf8');

assert(/const\s+SynthVoice\s*=\s*(?:globalThis|window)\.BighartBeatSynth/.test(main), 'main.js imports BighartBeatSynth helper');
assert(/const\s+synthVoiceState\s*=\s*\{\s*gain:\s*null,\s*cleanup:\s*null,\s*pitchHz:\s*null,\s*triggerTime:\s*null\s*\}/.test(main), 'runtime keeps shared mono synth cleanup plus previous pitch/time for glide');
assert(/function\s+triggerSynthChoke\s*\([^)]*\)\s*\{[\s\S]*const\s+previous\s*=\s*synthVoiceState\.gain[\s\S]*previous\.gain[\s\S]*setTargetAtTime\(\.0008,\s*t,\s*spec\.chokeTau\)[\s\S]*previousCleanup\(\s*cleanupAt\s*\)/.test(main), 'synth retrigger chokes/release-ramps and cleanup-retires previous mono voice');
assert(/synthVoiceState\.gain\s*=\s*voiceGain/.test(main), 'synth choke stores current voice for next retrigger');
assert(/synthSynth\s*\(\s*t,\s*v,\s*p,\s*options\s*=\s*\{\s*\}\s*\)\s*\{[\s\S]*SynthVoice\.resolveSynthVoiceSpec\(S\.engine,\s*p\)[\s\S]*routeVoice\(t,\s*6,\s*spec\.stopSec\)[\s\S]*if\s*\(\s*!audition\s*\)\s*\{\s*triggerSynthChoke\(t,\s*voiceGain,\s*spec,\s*createSynthVoiceCleanupHandle\(synthCleanupNodes\)[^)]*\);\s*\}/.test(main), 'synthSynth uses selected engine resolver, routeVoice with the synth tail, and mono choke/cleanup for non-audition playback');
assert(/const\s+previousPitchHz\s*=\s*audition\s*\?\s*null\s*:\s*synthVoiceState\.pitchHz[\s\S]*const\s+shouldGlide\s*=\s*spec\.glideSec\s*>\s*0[\s\S]*previousPitchHz\s*!==\s*spec\.pitchHz/.test(main), 'synthSynth glides only from a distinct previous mono pitch');
assert(/function\s+applySynthGlideFrequency\s*\(\s*frequencyParam,\s*targetHz,\s*t,\s*spec,\s*shouldGlide,\s*previousTargetHz\s*\)\s*\{[\s\S]*const\s+target\s*=\s*clamp\(targetHz,\s*SYNTH_OSC_SAFETY_MIN_HZ,\s*SYNTH_OSC_SAFETY_MAX_HZ\)[\s\S]*const\s+previous\s*=\s*clamp\(previousTargetHz,\s*SYNTH_OSC_SAFETY_MIN_HZ,\s*SYNTH_OSC_SAFETY_MAX_HZ\)[\s\S]*frequencyParam\.setValueAtTime\(shouldGlide\s*\?\s*previous\s*:\s*target,\s*t\)[\s\S]*if\s*\(shouldGlide\)\s*frequencyParam\.setTargetAtTime\(target,\s*t,\s*spec\.glideSec\)/.test(main), 'shared synth glide helper uses broad oscillator safety clamps and schedules glide target');
assert(/applySynthGlideFrequency\(osc\.frequency,\s*spec\.pitchHz,\s*t,\s*spec,\s*shouldGlide,\s*previousPitchHz\)/.test(main), 'synthSynth applies shared glide automation to carrier oscillator frequency');
assert(/applySynthGlideFrequency\(mod\.frequency,\s*spec\.pitchHz\s*\*\s*spec\.modRatio,\s*t,\s*spec,\s*shouldGlide,\s*previousPitchHz\s*\*\s*spec\.modRatio\)/.test(main), 'synthSynth applies shared glide automation to FM/modulator oscillator frequency');
assert(/applySynthGlideFrequency\(sub\.frequency,\s*spec\.pitchHz\s*\*\s*\.5,\s*t,\s*spec,\s*shouldGlide,\s*previousPitchHz\s*\*\s*\.5\)/.test(main), 'synthSynth applies shared glide automation to sub oscillator frequency');
assert(!/spec\.pitchHz\s*\*\s*\.995/.test(main), 'synthSynth does not use fake same-pitch sag glide');
assert(/if\s*\(\s*!audition\s*\)\s*\{\s*synthVoiceState\.pitchHz\s*=\s*spec\.pitchHz;\s*synthVoiceState\.triggerTime\s*=\s*t;\s*\}/.test(main), 'synthSynth stores current pitch and trigger time for next playback glide');
assert(/createBiquadFilter\(\)[\s\S]*\.type\s*=\s*spec\.filterType[\s\S]*frequency\.setValueAtTime\(spec\.filterRestHz,\s*t\)[\s\S]*frequency\.exponentialRampToValueAtTime\(Math\.max\(80,\s*spec\.filterTriggerHz\),\s*t\s*\+\s*spec\.filterAttackSec\)/.test(main), 'synthSynth shapes tone through resolver trigger filter envelope');
assert(/const\s+SYNTH_NOTES\s*=\s*State\.createSynthNotesBanks\(\)/.test(main), 'runtime initializes per-pattern synth note banks');
assert(/function\s+getStepSynthPitch\s*\(\s*step\s*\)[\s\S]*State\.synthPitchForStep\(TRACKS\[6\]\.p\.pitch,\s*getStepSynthRatio\(step\)\)/.test(main), 'runtime derives synth playback pitch from root pitch and per-step ratio');
assert(/case\s+'synth':\s*\{\s*const\s+v\s*=\s*getTrackVoiceVelocity\(ti\);\s*synthSynth\(t,\s*v,\s*\{\s*\.\.\.tr\.p,\s*pitch:\s*getStepSynthPitch\(firingStep\)\s*\}\);\s*break;\s*\}/.test(main), 'fire() dispatches synth track with stable excitation and per-step harmonic pitch');
assert(/function\s+previewSynth\s*\(\s*\)\s*\{[\s\S]*initAudio\(\)[\s\S]*triggerCompGate\(t,\s*tr\.id\)[\s\S]*synthSynth\(t,\s*getTrackVoiceVelocity\(\s*6\s*\),\s*\{\s*\.\.\.tr\.p,\s*pitch:\s*getStepSynthPitch\(LAST_SYNTH_NOTE_STEP\)\s*\},\s*\{\s*audition:\s*true\s*\}\s*\)/.test(main), 'TEST SYN audition uses selected/last-edited harmonic step pitch, stable excitation, compressor gate, and isolates mono state');
assert(/tr\.n\s*===\s*'SYN'\s*\?\s*'SYNTH'/.test(main), 'voice editor names SYN as SYNTH');
assert(/tr\.id\s*===\s*'synth'[\s\S]*SYNTH ENGINE:[\s\S]*TEST SYN[\s\S]*syn-note-selector[\s\S]*mkRow\('DECAY'[\s\S]*mkRow\('TONE'[\s\S]*mkRow\('SHAPE'/.test(main), 'voice editor exposes SYN engine info, TEST SYN, chromatic note selector, decay, tone, and shape controls');
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
