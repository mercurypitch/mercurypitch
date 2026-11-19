# Measurement

File: `lab/s09-onset/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 57.100 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 5.7 s (3.0 s per 30 s), longest 0.4 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.1 s |  |
| 4.30 s | 0.2 s |  |
| 6.80 s | 0.3 s |  |
| 8.20 s | 0.1 s |  |
| 8.50 s | 0.1 s |  |
| 9.10 s | 0.1 s |  |
| 9.40 s | 0.1 s |  |
| 12.10 s | 0.1 s |  |
| 12.80 s | 0.1 s |  |
| 13.00 s | 0.1 s |  |
| 14.60 s | 0.1 s |  |
| 15.50 s | 0.1 s |  |
| 18.40 s | 0.1 s |  |
| 20.20 s | 0.1 s |  |
| 21.10 s | 0.1 s |  |
| 22.00 s | 0.2 s |  |
| 22.60 s | 0.1 s |  |
| 22.90 s | 0.1 s |  |
| 23.30 s | 0.1 s |  |
| 23.70 s | 0.1 s |  |
| 27.50 s | 0.2 s |  |
| 27.90 s | 0.1 s |  |
| 30.50 s | 0.1 s |  |
| 31.10 s | 0.1 s |  |
| 34.70 s | 0.1 s |  |
| 35.40 s | 0.1 s |  |
| 43.50 s | 0.1 s |  |
| 44.90 s | 0.2 s |  |
| 45.60 s | 0.3 s |  |
| 46.10 s | 0.1 s |  |
| 46.50 s | 0.1 s |  |
| 47.20 s | 0.4 s |  |
| 49.20 s | 0.1 s |  |
| 50.00 s | 0.4 s |  |
| 51.10 s | 0.1 s |  |
| 52.10 s | 0.1 s |  |
| 52.30 s | 0.2 s |  |
| 54.00 s | 0.2 s |  |
| 54.80 s | 0.2 s |  |
| 56.00 s | 0.1 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 1.60 s | 0.3 s | 95 | small element moving |
| 3.20 s | 0.7 s | 81 | small element moving |
| 4.10 s | 1.5 s | 161 | small element moving |
| 5.70 s | 0.9 s | 99 | small element moving |
| 6.70 s | 3.8 s | 154 | small element moving |
| 11.00 s | 4.9 s | 163 | small element moving |
| 18.00 s | 1.9 s | 91 | small element moving |
| 20.10 s | 4.7 s | 157 | small element moving |
| 27.10 s | 1.4 s | 94 | small element moving |
| 28.80 s | 2.6 s | 155 | small element moving |
| 34.40 s | 3.3 s | 168 | small element moving |
| 38.10 s | 1.5 s | 133 | small element moving |
| 40.00 s | 1.4 s | 155 | small element moving |
| 41.70 s | 1.5 s | 150 | small element moving |
| 43.40 s | 4.6 s | 154 | small element moving |
| 48.60 s | 8.4 s | 157 | small element moving, runs to the end |

15 shorter run(s) totalling 1.7 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 1.467 s | jump | 0.42 | 0.64% |
| 14.867 s | pop | 0.04 | 0.03% |
| 33.100 s | jump | 0.53 | 0.37% |
| 47.767 s | pop | 0.04 | 0.03% |
| 53.267 s | pop | 0.06 | 0.05% |
| 55.767 s | pop | 0.07 | 0.03% |

## Loop seam

From the last frame back to the first: 9.72 on the scale of `frames.csv`, against a median frame change of 0.031, a 95th percentile of 0.57 and a largest of 2.87 at 34.133 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -20.0 LUFS, loudness range 6.0 LU, true peak -2.7 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -25.2, 4s -22.2, 5s -20.6, 6s -20.3, 7s -21.1, 8s -19.8, 9s -20.4, 10s -20.4, 11s -22.1, 12s -20.8, 13s -19.8, 14s -20.0, 15s -20.4, 16s -22.5, 17s -24.4, 18s -26.2, 19s -21.9, 20s -20.1, 21s -19.8, 22s -19.8, 23s -20.7, 24s -20.8, 25s -23.8, 26s -25.6, 27s -26.6, 28s -22.9, 29s -20.2, 30s -20.0, 31s -20.3, 32s -23.2, 33s -26.7, 34s -24.8, 35s -24.1, 36s -20.1, 37s -20.5, 38s -20.4, 39s -24.9, 40s -31.0, 41s nan, 42s nan, 43s nan, 44s -26.2, 45s -20.5, 46s -20.0, 47s -19.5, 48s -21.9, 49s -21.6, 50s -22.3, 51s -19.6, 52s -19.4, 53s -19.2, 54s -21.4, 55s -21.5, 56s -21.7, 57s -22.6

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 12 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`, `sheet-09.jpg`, `sheet-10.jpg`, `sheet-11.jpg`, `sheet-12.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
