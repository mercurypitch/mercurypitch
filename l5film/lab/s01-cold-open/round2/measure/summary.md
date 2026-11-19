# Measurement

File: `lab/s01-cold-open/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 38.833 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | none |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 0.7 s (0.5 s per 30 s), longest 0.1 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.1 s |  |
| 0.50 s | 0.1 s |  |
| 4.90 s | 0.1 s |  |
| 10.40 s | 0.1 s |  |
| 30.30 s | 0.1 s |  |
| 34.20 s | 0.1 s |  |
| 35.90 s | 0.1 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 0.9 s | 131 | small element moving |
| 1.30 s | 2.6 s | 152 | small element moving |
| 4.60 s | 0.6 s | 144 | small element moving |
| 5.80 s | 2.1 s | 175 | small element moving |
| 8.00 s | 0.3 s | 139 | small element moving |
| 8.40 s | 1.0 s | 139 | small element moving |
| 10.00 s | 2.7 s | 231 | small element moving |
| 12.80 s | 1.8 s | 173 | small element moving |
| 15.00 s | 1.6 s | 229 | small element moving |
| 17.10 s | 1.6 s | 128 | small element moving |
| 18.90 s | 1.0 s | 173 | small element moving |
| 20.00 s | 1.0 s | 141 | small element moving |
| 21.30 s | 1.3 s | 138 | small element moving |
| 23.10 s | 0.8 s | 147 | small element moving |
| 24.10 s | 0.5 s | 149 | small element moving |
| 25.00 s | 0.4 s | 166 | small element moving |
| 26.40 s | 0.7 s | 133 | small element moving |
| 27.20 s | 3.3 s | 209 | small element moving |
| 33.50 s | 2.8 s | 172 | small element moving |
| 36.50 s | 1.2 s | 198 | small element moving |

7 shorter run(s) totalling 1.1 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 6.267 s | jump | 0.14 | 0.20% |
| 10.800 s | jump | 0.12 | 0.21% |
| 13.933 s | jump | 0.12 | 0.20% |
| 16.600 s | jump | 0.13 | 0.20% |
| 17.800 s | jump | 0.05 | 0.05% |
| 19.733 s | jump | 0.11 | 0.20% |
| 22.900 s | pop | 0.27 | 0.25% |
| 24.267 s | jump | 0.16 | 0.26% |
| 27.867 s | jump | 0.09 | 0.10% |
| 28.100 s | pop | 0.14 | 0.10% |
| 29.267 s | jump | 0.07 | 0.05% |
| 33.033 s | jump | 0.44 | 0.61% |
| 36.733 s | pop | 0.11 | 0.08% |
| 38.467 s | pop | 28.80 | 41.62% |

## Loop seam

From the last frame back to the first: 87.79 on the scale of `frames.csv`, against a median frame change of 0.068, a 95th percentile of 0.66 and a largest of 28.80 at 38.467 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

No audio stream.

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 8 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
