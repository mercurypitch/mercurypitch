# Measurement

File: `lab/s06-diaphragm/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 68.800 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 4.6 s (2.0 s per 30 s), longest 0.5 s.
**Final hold:** 0.1 s.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.1 s |  |
| 4.40 s | 0.1 s |  |
| 4.60 s | 0.3 s |  |
| 10.60 s | 0.1 s |  |
| 14.80 s | 0.1 s |  |
| 17.20 s | 0.1 s |  |
| 18.00 s | 0.1 s |  |
| 18.20 s | 0.2 s |  |
| 19.60 s | 0.1 s |  |
| 34.20 s | 0.3 s |  |
| 34.60 s | 0.2 s |  |
| 38.30 s | 0.1 s |  |
| 38.60 s | 0.1 s |  |
| 39.00 s | 0.1 s |  |
| 40.90 s | 0.1 s |  |
| 42.20 s | 0.4 s |  |
| 48.00 s | 0.2 s |  |
| 49.80 s | 0.1 s |  |
| 52.10 s | 0.1 s |  |
| 52.60 s | 0.1 s |  |
| 53.00 s | 0.5 s |  |
| 54.00 s | 0.1 s |  |
| 54.20 s | 0.1 s |  |
| 54.40 s | 0.1 s |  |
| 55.80 s | 0.1 s |  |
| 58.20 s | 0.1 s |  |
| 58.40 s | 0.3 s |  |
| 65.60 s | 0.1 s |  |
| 65.80 s | 0.1 s |  |
| 67.80 s | 0.1 s |  |
| 68.60 s | 0.1 s | final hold |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 3.00 s | 1.9 s | 108 | small element moving |
| 6.00 s | 0.6 s | 134 | small element moving |
| 6.70 s | 4.7 s | 162 | small element moving |
| 11.80 s | 1.2 s | 96 | small element moving |
| 13.70 s | 6.7 s | 154 | small element moving |
| 20.50 s | 0.3 s | 84 | small element moving |
| 20.90 s | 1.4 s | 127 | small element moving |
| 32.70 s | 0.6 s | 164 | small element moving |
| 33.40 s | 0.4 s | 78 | small element moving |
| 33.90 s | 2.3 s | 145 | small element moving |
| 36.90 s | 0.3 s | 98 | small element moving |
| 37.60 s | 2.1 s | 151 | small element moving |
| 39.90 s | 4.6 s | 159 | small element moving |
| 46.70 s | 1.6 s | 133 | small element moving |
| 49.60 s | 0.7 s | 110 | small element moving |
| 50.40 s | 5.9 s | 160 | small element moving |
| 57.20 s | 3.3 s | 159 | small element moving |
| 60.70 s | 1.0 s | 185 | small element moving |
| 62.30 s | 0.6 s | 93 | small element moving |
| 63.10 s | 0.3 s | 63 | small element moving |
| 63.80 s | 2.2 s | 143 | small element moving |
| 66.20 s | 2.5 s | 119 | small element moving, runs to the end |

13 shorter run(s) totalling 2.1 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 38.033 s | pop | 0.05 | 0.05% |
| 51.833 s | pop | 0.04 | 0.03% |
| 55.400 s | pop | 0.05 | 0.04% |
| 58.833 s | pop | 0.05 | 0.04% |

## Loop seam

From the last frame back to the first: 8.92 on the scale of `frames.csv`, against a median frame change of 0.062, a 95th percentile of 0.41 and a largest of 3.47 at 2.167 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -19.8 LUFS, loudness range 2.6 LU, true peak -1.5 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -24.2, 4s -21.8, 5s -20.9, 6s -20.6, 7s -21.0, 8s -19.5, 9s -19.5, 10s -19.2, 11s -20.4, 12s -21.2, 13s -22.2, 14s -20.7, 15s -20.5, 16s -20.0, 17s -20.0, 18s -20.0, 19s -20.1, 20s -22.1, 21s -25.4, 22s -30.7, 23s nan, 24s nan, 25s nan, 26s nan, 27s nan, 28s nan, 29s nan, 30s nan, 31s nan, 32s nan, 33s -22.9, 34s -21.0, 35s -19.8, 36s -21.1, 37s -19.6, 38s -19.1, 39s -19.5, 40s -19.8, 41s -20.7, 42s -20.7, 43s -22.1, 44s -20.6, 45s -20.2, 46s -21.1, 47s -20.7, 48s -20.8, 49s -19.5, 50s -20.8, 51s -19.7, 52s -19.9, 53s -19.9, 54s -20.4, 55s -21.3, 56s -21.1, 57s -20.3, 58s -19.8, 59s -20.5, 60s -20.8, 61s -20.7, 62s -20.6, 63s -19.2, 64s -19.2, 65s -18.6, 66s -20.7, 67s -20.5, 68s -21.0

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 14 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`, `sheet-09.jpg`, `sheet-10.jpg`, `sheet-11.jpg`, `sheet-12.jpg`, `sheet-13.jpg`, `sheet-14.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
