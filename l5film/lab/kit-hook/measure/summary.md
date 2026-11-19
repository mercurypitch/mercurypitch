# Measurement

File: `clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 4.400 s |
| Picture | 1920x1080 60.00 fps h264 |
| Audio | none |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 0.4 s (2.7 s per 30 s), longest 0.2 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 2.90 s | 0.2 s |  |
| 3.40 s | 0.2 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 2.70 s | 0.5 s | 90 | small element moving |

2 shorter run(s) totalling 0.4 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 0.317 s | jump | 0.16 | 0.13% |
| 0.400 s | jump | 0.21 | 0.18% |
| 2.067 s | jump | 0.35 | 0.60% |
| 2.450 s | jump | 0.13 | 0.16% |
| 2.683 s | pop | 0.24 | 0.28% |
| 2.817 s | jump | 0.22 | 0.28% |

## Loop seam

From the last frame back to the first: 93.87 on the scale of `frames.csv`, against a median frame change of 0.199, a 95th percentile of 1.51 and a largest of 16.54 at 4.117 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

No audio stream.

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 1 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
