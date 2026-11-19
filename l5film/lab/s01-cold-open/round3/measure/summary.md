# Measurement

File: `lab/s01-cold-open/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 38.833 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 0.9 s (0.7 s per 30 s), longest 0.3 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.1 s |  |
| 0.50 s | 0.1 s |  |
| 4.90 s | 0.1 s |  |
| 10.40 s | 0.1 s |  |
| 13.30 s | 0.1 s |  |
| 30.30 s | 0.1 s |  |
| 34.10 s | 0.3 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 0.9 s | 131 | small element moving |
| 1.30 s | 2.6 s | 152 | small element moving |
| 4.60 s | 0.6 s | 144 | small element moving |
| 5.80 s | 2.1 s | 175 | small element moving |
| 8.40 s | 0.8 s | 135 | small element moving |
| 9.90 s | 2.5 s | 231 | small element moving |
| 13.00 s | 1.6 s | 174 | small element moving |
| 15.00 s | 1.3 s | 229 | small element moving |
| 17.10 s | 3.9 s | 175 | small element moving |
| 21.60 s | 2.3 s | 224 | small element moving |
| 25.00 s | 0.4 s | 166 | small element moving |
| 26.40 s | 0.7 s | 135 | small element moving |
| 27.20 s | 1.2 s | 209 | small element moving |
| 28.70 s | 1.9 s | 169 | small element moving |
| 33.80 s | 0.8 s | 124 | small element moving |
| 34.80 s | 1.5 s | 173 | small element moving |
| 36.50 s | 0.9 s | 170 | small element moving |

12 shorter run(s) totalling 1.9 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 6.267 s | jump | 0.14 | 0.20% |
| 10.800 s | jump | 0.12 | 0.21% |
| 13.933 s | jump | 0.13 | 0.20% |
| 17.800 s | jump | 0.05 | 0.05% |
| 17.867 s | jump | 0.08 | 0.03% |
| 19.733 s | jump | 0.11 | 0.20% |
| 24.267 s | jump | 0.15 | 0.26% |
| 27.867 s | jump | 0.09 | 0.10% |
| 28.100 s | pop | 0.14 | 0.10% |
| 29.267 s | jump | 0.07 | 0.06% |
| 33.033 s | jump | 0.50 | 0.64% |
| 36.733 s | pop | 0.11 | 0.08% |

## Loop seam

From the last frame back to the first: 87.80 on the scale of `frames.csv`, against a median frame change of 0.079, a 95th percentile of 0.79 and a largest of 13.54 at 38.300 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -19.9 LUFS, loudness range 4.5 LU, true peak -3.3 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -172.3, 4s -172.3, 5s -172.3, 6s -23.6, 7s -21.8, 8s -19.9, 9s -20.9, 10s -19.8, 11s -20.1, 12s -19.6, 13s -20.3, 14s -20.5, 15s -20.1, 16s -20.1, 17s -20.1, 18s -21.4, 19s -22.9, 20s -25.4, 21s -30.7, 22s nan, 23s nan, 24s nan, 25s nan, 26s -24.1, 27s -22.8, 28s -20.1, 29s -20.7, 30s -20.5, 31s -21.4, 32s -20.7, 33s -20.5, 34s -20.4, 35s -20.4, 36s -19.9, 37s -20.3, 38s -21.7

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 8 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
