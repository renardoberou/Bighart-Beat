# Bighart Beat Swarm Pre-Approval Charter

Bernado has pre-approved subagents to pursue the Bighart Beat project goals below without asking for repeated permission, as long as they stay inside this charter.

## Global mission

Build Bighart Beat into a clean, repo-backed, browser-native drum machine and rhythm-intelligence instrument.

Canonical source:

- Base implementation: `/storage/emulated/0/Download/bighart-beat-v4-studio-2.html`
- Reference/inspiration: `/storage/emulated/0/Download/bighart-beat-v3-2.html`

Core product rule:

> Groove = structured surprise that recovers into the meter.

## Pre-approved goals

Subagents may work toward these goals without asking Bernado again:

1. Preserve and stabilize the v4 studio drum machine behavior.
2. Refactor the codebase into maintainable modules.
3. Add tests before changing behavior.
4. Improve browser/mobile reliability.
5. Improve Web Audio timing, scheduler clarity, and audio graph safety.
6. Implement deterministic rhythm-intelligence analysis.
7. Keep Bighart Beat connected to rhythm cognition / neuroscience concepts from the wiki.
8. Improve UI/UX while preserving the Bighart Bay / Resonant Systems identity.
9. Document architecture, product decisions, QA gates, and implementation plans.
10. Use focused subagents for Product, UI/UX, Audio Engine, Code, QA/Critic, Research Bridge, and Architect/Refactor work.

## Pre-approved implementation phases

The swarm may proceed through these phases when prior gates pass:

1. Browser parity/manual QA for the extracted app shell.
2. State extraction:
   - tracks
   - patterns
   - FX state
   - app state
   - persistence schema
3. Pure helper tests:
   - pattern creation
   - step toggling
   - pattern clearing
   - export/import validation
4. Audio extraction:
   - AudioContext lifecycle
   - scheduler
   - master graph
   - delay graph
   - reverb graph
   - sends
   - voices
5. UI extraction:
   - transport
   - sequencer
   - pattern bank
   - mixer
   - voice editor
   - FX panel
   - master panel
6. Static rhythm-intelligence MVP:
   - SYNC
   - ANCHOR
   - TENSION
   - RECOVER
   - DRIVE
7. Controlled variation and performance macro only after static analysis works and passes QA.

## Pre-approved file operations

Subagents may create, edit, and commit files inside:

- `/storage/emulated/0/Documents/bighart-beat`

Pre-approved paths include:

- `index.html`
- `src/**`
- `styles/**`
- `tests/**`
- `docs/**`
- `.hermes/**`
- `README.md`
- project config files needed for tests/build tooling, if introduced deliberately

Subagents may read but must not modify the canonical source snapshots in `/storage/emulated/0/Download/`.

## Pre-approved commands

Subagents may run local, non-destructive commands inside the repo, including:

- `node --check ...`
- `node tests/...`
- `python3 -m http.server ...`
- local browser/static smoke checks when available
- `git status`, `git diff`, `git log`
- `git add` and `git commit` for completed, verified work
- package-manager/test tooling commands if a future approved phase introduces `package.json`

## Git policy

Subagents may commit verified, scoped changes.

Commit messages should be clear and phase-specific, for example:

- `test: add pattern state fixtures`
- `refactor: extract pattern state helpers`
- `refactor: extract audio scheduler`
- `feat: add static rhythm intelligence analysis`
- `docs: update qa gate for state extraction`

Before committing, subagents should run relevant checks and include the result in their summary.

## Required gates

Subagents must respect these gates:

1. Test-first for new pure logic and bug fixes.
2. Preserve behavior during refactors unless the task explicitly authorizes a behavior change.
3. Run focused tests/checks before reporting success.
4. Review audio/timing changes with Audio Engine Agent or QA/Critic Agent.
5. Do not stack unrelated changes in one commit.
6. If a test fails for a real reason, fix or report it; do not hide it.

## Still requires explicit Bernado approval

Subagents must not do these without fresh explicit approval:

- Push to GitHub or create a remote repository.
- Publish/deploy publicly.
- Install heavy dependencies or large frameworks.
- Delete major project files or canonical snapshots.
- Replace the v4 behavior wholesale with v3 behavior.
- Add cloud services, analytics, accounts, telemetry, or tracking.
- Make medical/therapeutic/neuroscience claims.
- Access credentials, private APIs, or external paid services.
- Modify files outside `/storage/emulated/0/Documents/bighart-beat`, except reading canonical snapshots and local wiki notes for research context.

## Main-agent availability rule

The main Hermes agent should remain available to Bernado. Long or multi-role work should be delegated to subagents or scheduled as background/autonomous work when appropriate. Subagents should return concise summaries, changed files, checks run, commit hashes, risks, and next recommended action.
