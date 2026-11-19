# Every camera move at normal exposure (integration item 5; DECISIONS 200)

L.BOKEH_LIFT 5 and L.STAVE_LIFT 4 (were 3 and 2.5); the bokeh's ramp by slide speed now 10 to 250 px a second of the near layer
against the diagram (was 10 to 160), the staves' unchanged (20 to 200 of the far layer's vertical slide). At rest the room is as
before (shown at 1 / LIFT = 0.2). Frames from `moves.mjs` on the live project (each scene alone with the kit and fonts; the passes
are not played, so the hosts may be missing); sheets `sheet-<sid>-<n>.png`: rows at 12 %, 50 % and 86 % of the move, each a pair
0.1 s apart. The bokeh shown at full is 5 times its rest alpha (was 3).

| Move | Scene s | Near slide, peak | Bokeh shown (rest 0.20) | Fastest lift change | Mean luma: before / middle / after |
| - | - | - | - | - | - |
| S1 pull out, F-cold end to F-hook (sine.inOut) | 30.64 to 33.64 | 155 px/s | 0.72 | 0.8 a second | 34.8 / 31.3 / 29.5 |
| S3 truck right 160 px, F-promise-a to -b (power1.inOut) | 0.72 to 10.17 | 20 px/s | 0.20 | 0.0 a second | 23.9 / 24.7 / 25.2 |
| S4 crane down with a push in, to F-strip (power2.inOut) | 0.30 to 1.70 | 709 px/s | 1.00 | 5.4 a second | 25.3 / 29.7 / 25.8 |
| S4 crane up, F-strip to F0 (power2.inOut) | 11.93 to 13.43 | 593 px/s | 1.00 | 4.6 a second | 29.9 / 29.1 / 27.2 |
| S6 slow push 5 % over 10 s, F0 to F-gauge (L.steady) | 22.26 to 32.26 | 4 px/s | 0.20 | 0.0 a second | 27.0 / 27.8 / 28.9 |
| S10 push in, F0 to F-hold (power2.inOut) | 2.42 to 3.92 | 363 px/s | 1.00 | 3.2 a second | 25.9 / 28.4 / 28.1 |
| S10 push in, F-hold to CU-scoop (power2.inOut) | 23.65 to 25.15 | 559 px/s | 1.00 | 4.1 a second | 28.9 / 31.3 / 31.1 |
| S10 truck right at 1.8x, CU-scoop to CU-wave (sine.inOut) | 30.64 to 32.64 | 226 px/s | 0.98 | 1.5 a second | 31.5 / 31.6 / 32.0 |
| S10 pull out, CU-wave to F-hold (power2.inOut) | 39.14 to 40.60 | 318 px/s | 1.00 | 3.3 a second | 34.4 / 31.0 / 28.8 |
| S12 push in, F0 to F-turn (power2.inOut) | 20.31 to 21.41 | 532 px/s | 1.00 | 5.7 a second | 29.4 / 29.6 / 30.2 |
| S15 slow push 3 %, F0 to F-end (sine.inOut) | 0.00 to 6.20 | 5 px/s | 0.20 | 0.0 a second | 25.4 / 29.4 / 29.3 |
