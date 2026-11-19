# Measurement

File: `lab/s10-steady/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 61.100 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 2.3 s (1.1 s per 30 s), longest 0.2 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.1 s |  |
| 4.40 s | 0.1 s |  |
| 7.90 s | 0.1 s |  |
| 33.00 s | 0.1 s |  |
| 35.30 s | 0.1 s |  |
| 35.50 s | 0.1 s |  |
| 37.00 s | 0.1 s |  |
| 41.80 s | 0.1 s |  |
| 42.00 s | 0.1 s |  |
| 43.00 s | 0.2 s |  |
| 44.60 s | 0.1 s |  |
| 45.40 s | 0.2 s |  |
| 46.80 s | 0.1 s |  |
| 49.40 s | 0.1 s |  |
| 50.90 s | 0.1 s |  |
| 52.70 s | 0.1 s |  |
| 56.20 s | 0.1 s |  |
| 56.70 s | 0.1 s |  |
| 57.50 s | 0.1 s |  |
| 57.90 s | 0.2 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 1.50 s | 0.4 s | 144 | small element moving |
| 3.80 s | 1.6 s | 168 | small element moving |
| 5.50 s | 2.7 s | 171 | small element moving |
| 8.70 s | 0.7 s | 159 | small element moving |
| 9.50 s | 0.7 s | 181 | small element moving |
| 10.60 s | 13.1 s | 180 | small element moving |
| 25.10 s | 1.3 s | 158 | small element moving |
| 26.50 s | 4.1 s | 174 | small element moving |
| 32.70 s | 0.7 s | 71 | small element moving |
| 33.70 s | 4.5 s | 168 | small element moving |
| 38.40 s | 0.6 s | 181 | small element moving |
| 40.50 s | 1.6 s | 118 | small element moving |
| 42.30 s | 1.4 s | 171 | small element moving |
| 43.80 s | 7.5 s | 174 | small element moving |
| 52.60 s | 1.1 s | 129 | small element moving |
| 53.80 s | 0.5 s | 145 | small element moving |
| 54.40 s | 1.7 s | 167 | small element moving |
| 56.20 s | 2.1 s | 168 | small element moving |
| 58.40 s | 1.5 s | 207 | small element moving |
| 60.00 s | 0.6 s | 205 | small element moving |

1 shorter run(s) totalling 0.1 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 1.467 s | jump | 0.31 | 0.47% |
| 6.467 s | pop | 0.06 | 0.05% |
| 33.300 s | jump | 0.04 | 0.03% |
| 41.567 s | jump | 0.03 | 0.05% |
| 46.333 s | pop | 0.06 | 0.05% |

## Loop seam

From the last frame back to the first: 9.49 on the scale of `frames.csv`, against a median frame change of 0.045, a 95th percentile of 2.09 and a largest of 3.60 at 24.600 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -20.5 LUFS, loudness range 3.5 LU, true peak -1.6 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -24.5, 4s -21.7, 5s -21.0, 6s -21.3, 7s -21.9, 8s -20.6, 9s -21.2, 10s -22.7, 11s -27.5, 12s -46.4, 13s nan, 14s nan, 15s nan, 16s nan, 17s nan, 18s nan, 19s nan, 20s -29.0, 21s -23.7, 22s -21.5, 23s -20.8, 24s -20.8, 25s -20.0, 26s -20.3, 27s -20.9, 28s -23.0, 29s -22.1, 30s -21.5, 31s -21.2, 32s -21.6, 33s -22.2, 34s -19.9, 35s -19.8, 36s -19.4, 37s -21.8, 38s -22.0, 39s -23.1, 40s -20.7, 41s -20.4, 42s -20.0, 43s -21.7, 44s -21.6, 45s -21.2, 46s -20.6, 47s -21.1, 48s -21.4, 49s -20.6, 50s -20.8, 51s -21.1, 52s -20.5, 53s -19.6, 54s -19.0, 55s -21.1, 56s -20.7, 57s -21.3, 58s -21.1, 59s -22.6, 60s -22.6, 61s -23.2

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 13 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`, `sheet-09.jpg`, `sheet-10.jpg`, `sheet-11.jpg`, `sheet-12.jpg`, `sheet-13.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
