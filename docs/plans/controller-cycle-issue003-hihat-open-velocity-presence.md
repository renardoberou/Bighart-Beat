# Bighart Beat Controller Cycle Plan

## Slice: Open/closed hihat presence + velocity response tilt

### Problem
Recent commits improved tail extension, shimmer boost, closed-needle accents, but open hats and closed hats still share a single decay/brightness regime that does not clearly tilt:
- Open hats: want longer decay ceiling, stronger accent-driven shimmer/body bloom, brighter air band
- Closed hats: want tighter transient and less air tail at high velocity so accents remain snappy

### Implementation Tasks
1. Adjust open/closed hihat decay/brightness ranges in `src/rhythm/hihat-voice.js`:
   - Open decay (`open >= 0.4`) should be allowed up to a slightly higher ceiling with accent boosting.
   - Closed decay (`open < 0.4`) should not ride that same top range.
   - Air brightness and shimmer/body gain should respond more to accent for open hats.
2. Add targeted tests in `tests/hihat-open-velocity-presence.issue003.test.js`.
3. Run focused JS test + full JS suite.
4. Syntax check touched files.
5. Commit + push + verify raw GitHub + GitHub Pages marker.

### Scope Constraints
- Small, playable slice.
- No refactor-only changes.
- Preserve existing behavior and recent improvements.

### Validation
- Focused new tests: red-green-refactor.
- Full JS suite does not regress.
- node -c on touched JS.
- Deploy marker verification against GitHub Pages.

### Intended Next Action
After landing, continue with another hihat/engine slice from the priority order or move to DIGI WRECK send/UX slice if hihat/playable evidence diminishes.
