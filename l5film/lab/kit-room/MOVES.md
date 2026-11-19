# The camera clip, move by move

`lab/kit-room/clip.mp4` (41.5 s, 30 fps; `lab/kit-src/room.html`), measured by the skill's `measure.py render` (`measure/`: motion.csv, frames.csv, sheets). Mean, least and largest luma change against the sample 0.1 s before (0 to 255). At rest only the dust moves (its largest change is a mote crossing a pixel). Three moves are shortened for the lab, marked SHORT. Re-measured after critic-kit-01 (the push on `L.steady`, the matched cuts crossfading).

| Window (lab s) | Move | Mean | Least | Largest |
| - | - | - | - | - |
| 0.05 to 0.4 | rest at F-cold (dust only) | 0.067 | 0.007 | 106 |
| 0.5 to 3.3 | drift to F-cold end (SHORT 3 s) | 0.105 | 0.012 | 22 |
| 3.9 to 6.7 | pull to F-hook | 1.196 | 0.129 | 125 |
| 7.25 to 7.75 | through the head bead | 4.715 | 0.546 | 165 |
| 8.6 to 12.5 | truck to F-promise-b (SHORT 4 s) | 0.894 | 0.107 | 120 |
| 13.0 to 14.3 | crane down and push to F-strip | 4.721 | 0.265 | 162 |
| 14.8 to 16.2 | crane up and pull to F0 | 4.564 | 0.198 | 161 |
| 16.2 to 16.6 | rest at F0 | 0.229 | 0.005 | 109 |
| 16.8 to 26.6 | push to F-gauge (10 s, 5 %, L.steady) | 0.098 | 0.021 | 21 |
| 26.7 to 27.0 | rest at F-gauge | 0.065 | 0.006 | 109 |
| 27.5 to 28.9 | push to F-hold | 3.291 | 0.121 | 158 |
| 29.4 to 30.8 | push to CU-scoop | 3.772 | 0.131 | 177 |
| 31.3 to 33.2 | truck to CU-wave | 3.493 | 0.408 | 176 |
| 33.7 to 35.1 | pull to F-hold | 3.592 | 0.075 | 180 |
| 35.95 to 37.0 | push to F-turn | 2.870 | 0.249 | 170 |
| 37.9 to 40.7 | push to F-end (SHORT 3 s) | 0.170 | 0.035 | 95 |

The push to F-gauge (16.65 to 26.65, `L.steady(10)`: 0.3 s smoothstep ramps, linear between): every 0.5 s window of it averages 0.061 or more (rest: 0.005 to 0.008 at F0 and F-gauge), so no stretch of it is still; it reaches speed by 16.95 (0.046, 0.084 at 17.0) and leaves it at 26.6 (0.036, rest from 26.8). The probe checks the same on the rig: every 0.5 s window moves the frame at least 1 px (lab/kit-probe/RESULTS.md, room).

The matched cuts (frames.csv, frame by frame, `L.roomCut` over 0.3 s). This lab carries no object across a cut, so its world (the S1 chart on the mid layer) jumps to F0 on the cut frame: 27.07 (2.73), 35.53 (9.90), 37.43 (8.51). The room does not: on that frame it still shows the framing it leaves, then crossfades to rest at 0.04 to 0.17, 0.05 to 0.24 and 0.03 to 0.19 a frame over the next 0.3 s, with no second spike. In the film the carried object holds its pixels on the cut frame, so nothing jumps at all: `lab/kit-cuts/` (two cuts with the gauge and the hold frame carried; the probe measures 0 px of movement, and frames.csv there reads 0.17 and 0.05 on the cut frames, against 0.002 before them). The plain cut at 8.15 (F-bead to F-promise-a, through the bead) stays one frame: 8.17 (8.02), then 0.03.
