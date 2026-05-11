# Audio Engine Architecture — Bighart Beat

## Baseline
Use v4 as canonical. Preserve lookahead scheduler: 0.10 sec lookahead, ~24 ms tick, 16-step sixteenth grid.

## Layers
- UI actions
- Sequencer scheduler
- Audio engine graph
- Stateless voice triggers
- Pure rhythm-intelligence analysis

## Graph
voices -> dry bus -> master chain -> destination, with per-track delay/reverb sends.

## Known implementation issue
Review v4 reverb routing: per-hit reverb appears to bypass the intended gate by connecting directly to the convolver. Fix during audio extraction.
