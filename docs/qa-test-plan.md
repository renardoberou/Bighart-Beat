# QA Test Plan — Bighart Beat

## Gates
- Gate A: Master plan exists and is accepted.
- Gate B: v4 behavior parity after app shell extraction.
- Gate C: deterministic rhythm-intelligence fixtures pass.

## Critical risks
- Scheduler drift.
- Mobile audio unlock regression.
- FX routing/gain staging changes.
- Import/export schema breakage.
- Untestable rhythm-intelligence scope.

## First parity checks
Start screen, ENGAGE, play/stop, BPM/tap, step toggling, pattern A–D, mixer, voice editor, FX, master VU, localStorage, import/export, sample load, mobile viewport, no console errors.

## Mission 005 risk-hardening checks
- Runtime helper wiring is covered by smoke/static checks: index loads state helper scripts before `src/main.js`; step toggle, selected-bank clear, autosave/export, and load/import use Mission 005 State helpers.
- Malformed localStorage/import payloads are validation-gated before mutation, so invalid JSON/schema/track/pattern/meta data must fail atomically with the existing runtime state unchanged.
