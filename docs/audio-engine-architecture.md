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

## Routing regression guards
- Delay input is per-track only; when delay is off or wet is zero, fresh hits do not enter the delay line except for intentional existing feedback tails.
- Reverb input is per-track only; fresh hits route through `revSend -> revGate -> conv`, and when reverb is off or wet is zero no new hits enter the reverb send.
