#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'src', 'main.js'), 'utf8');

const helperMatch = main.match(/function\s+previewRatchetEditAudition\s*\(\s*trackIndex\s*,\s*step\s*,\s*ratchetCount\s*\)\s*\{([\s\S]*?)\n\}/);
assert(helperMatch, 'src/main.js defines previewRatchetEditAudition(trackIndex, step, ratchetCount) helper');
const helper = helperMatch[1];

assert(/if\s*\(\s*S\.playing\s*\)\s*return\s*;/.test(helper), 'ratchet edit audition returns immediately while transport is playing');
assert(/if\s*\(\s*ratchetCount\s*<\s*2\s*\)\s*return\s*;/.test(helper) || /if\s*\(\s*ratchetCount\s*!==\s*2\s*&&\s*ratchetCount\s*!==\s*3\s*\)\s*return\s*;/.test(helper), 'ratchet edit audition keeps 1x/off cases silent and targets audible 2x/3x edits');
assert(/initAudio\s*\(\s*\)\s*;/.test(helper), 'ratchet edit audition initializes audio before scheduling stopped preview hits');
assert(/A\.currentTime\s*\+\s*\.0?(?:1[0-9]|2[0-5])/.test(helper), 'ratchet edit audition starts from A.currentTime plus a small mobile-safe offset');
assert(/stepDur\s*\(\s*\)/.test(helper) && /Math\.min\s*\(/.test(helper), 'ratchet edit audition uses a shortened stepDur-derived preview window');
assert(/(?:ratchetOffsets\s*\(|scheduledHitTimes\s*\(|Groove\.scheduledHitTimes\s*\()/.test(helper), 'ratchet edit audition schedules hits through existing ratchet timing helpers');
assert(/const\s+previousFiringStep\s*=\s*firingStep\s*;/.test(helper), 'ratchet edit audition captures existing firingStep before previewing');
assert(/firingStep\s*=\s*step\s*;/.test(helper), 'ratchet edit audition sets firingStep so hihat openness/accent and synth pitch use the edited step');
assert(/finally\s*\{\s*firingStep\s*=\s*previousFiringStep\s*;\s*\}/.test(helper), 'ratchet edit audition restores firingStep after scheduling preview hits');
assert(/fire\s*\(\s*trackIndex\s*,\s*hitT\s*,\s*ratchetCount\s*\)/.test(helper), 'ratchet edit audition reuses fire(trackIndex, hitT, ratchetCount) for current voice context');
assert(!/\bplay\s*\(\s*\)/.test(helper) && !/\brunSch\s*\(\s*\)/.test(helper) && !/S\.playing\s*=/.test(helper), 'ratchet edit audition does not start transport/scheduler or mutate S.playing');

const cycleStart = main.indexOf('const cycleCellRatchet = () => {');
assert(cycleStart >= 0, 'sequencer cell ratchet cycling helper exists');
const cycleEnd = main.indexOf('let pressTimer = null;', cycleStart);
assert(cycleEnd > cycleStart, 'sequencer cell ratchet cycling helper can be inspected');
const cycle = main.slice(cycleStart, cycleEnd);

assert(/State\.cycleRatchetCount\s*\(\s*RATCHETS\[S\.patt\]\s*,\s*tr\.id\s*,\s*i\s*\)/.test(cycle), 'cycleCellRatchet cycles the stored ratchet count');
assert(/renderRhythmIntelligence\s*\(\s*\)\s*;[\s\S]*autosave\s*\(\s*\)\s*;[\s\S]*previewRatchetEditAudition\s*\(\s*trackIndex\s*,\s*i\s*,\s*(?:nextRatchet|State\.getRatchetCount\s*\([^)]*\))\s*\)/.test(cycle), 'cycleCellRatchet invokes ratchet edit audition after state/render/autosave and after the ratchet count updates');
assert(/if\s*\(\s*isCellOn\s*\(\s*\)\s*&&\s*(?:nextRatchet|State\.getRatchetCount\s*\([^)]*\))\s*>\s*1\s*\)\s*previewRatchetEditAudition/.test(cycle), 'cycleCellRatchet only auditions when the edited cell remains on with an audible 2x/3x ratchet count');
assert(!/cycleCellRatchet[\s\S]*?\bplay\s*\(\s*\)/.test(cycle) && !/cycleCellRatchet[\s\S]*?\brunSch\s*\(\s*\)/.test(cycle), 'cycleCellRatchet does not start transport or scheduler for auditions');

const contextMenu = main.slice(main.indexOf("c.addEventListener('contextmenu'"), main.indexOf("c.addEventListener('pointerdown'"));
assert(/cycleCellRatchet\s*\(\s*\)\s*;/.test(contextMenu), 'contextmenu continues to use cycleCellRatchet');
const pointerBlock = main.slice(main.indexOf("c.addEventListener('pointerdown'"), main.indexOf("\['pointerup'", main.indexOf("c.addEventListener('pointerdown'")));
assert(/cycleCellRatchet\s*\(\s*\)\s*;/.test(pointerBlock), 'long-press continues to use cycleCellRatchet');

console.log('Issue 003 ratchet edit audition static checks passed.');
