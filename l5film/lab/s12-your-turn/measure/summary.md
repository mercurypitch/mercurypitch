# Measurement

File: `lab/s12-your-turn/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 76.800 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 4.2 s (1.6 s per 30 s), longest 0.2 s.
**Final hold:** 0.3 s.

| Starts | Length | Note |
| --- | --- | --- |
| 1.00 s | 0.1 s |  |
| 1.70 s | 0.1 s |  |
| 5.10 s | 0.1 s |  |
| 5.30 s | 0.1 s |  |
| 7.60 s | 0.1 s |  |
| 7.80 s | 0.1 s |  |
| 8.60 s | 0.1 s |  |
| 9.90 s | 0.1 s |  |
| 12.20 s | 0.1 s |  |
| 13.30 s | 0.1 s |  |
| 13.50 s | 0.1 s |  |
| 13.70 s | 0.2 s |  |
| 14.80 s | 0.2 s |  |
| 18.30 s | 0.1 s |  |
| 18.50 s | 0.1 s |  |
| 19.40 s | 0.1 s |  |
| 37.90 s | 0.2 s |  |
| 38.60 s | 0.1 s |  |
| 41.50 s | 0.1 s |  |
| 43.30 s | 0.1 s |  |
| 45.30 s | 0.1 s |  |
| 47.60 s | 0.1 s |  |
| 49.70 s | 0.2 s |  |
| 51.80 s | 0.1 s |  |
| 53.40 s | 0.1 s |  |
| 53.60 s | 0.2 s |  |
| 53.90 s | 0.1 s |  |
| 54.60 s | 0.1 s |  |
| 55.80 s | 0.1 s |  |
| 62.60 s | 0.1 s |  |
| 63.10 s | 0.1 s |  |
| 65.60 s | 0.1 s |  |
| 66.10 s | 0.1 s |  |
| 69.60 s | 0.2 s |  |
| 74.20 s | 0.1 s |  |
| 75.20 s | 0.1 s |  |
| 76.40 s | 0.3 s | final hold |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 3.0 s | 173 | small element moving |
| 3.20 s | 12.1 s | 171 | small element moving |
| 15.50 s | 2.0 s | 174 | small element moving |
| 17.80 s | 2.0 s | 121 | small element moving |
| 20.10 s | 0.3 s | 58 | small element moving |
| 22.20 s | 1.3 s | 75 | small element moving |
| 25.30 s | 0.4 s | 99 | small element moving |
| 25.90 s | 0.8 s | 125 | small element moving |
| 26.90 s | 0.8 s | 126 | small element moving |
| 27.90 s | 0.8 s | 164 | small element moving |
| 28.90 s | 0.8 s | 164 | small element moving |
| 29.80 s | 1.0 s | 241 | small element moving |
| 30.90 s | 0.8 s | 163 | small element moving |
| 31.90 s | 0.8 s | 129 | small element moving |
| 32.80 s | 0.9 s | 239 | small element moving |
| 33.90 s | 0.8 s | 128 | small element moving |
| 34.90 s | 0.8 s | 127 | small element moving |
| 36.90 s | 2.7 s | 197 | small element moving |
| 39.80 s | 4.0 s | 166 | small element moving |
| 43.90 s | 4.0 s | 170 | small element moving |
| 48.10 s | 3.9 s | 156 | small element moving |
| 52.30 s | 2.7 s | 121 | small element moving |
| 55.10 s | 2.9 s | 165 | small element moving |
| 58.80 s | 17.0 s | 184 | small element moving |
| 76.30 s | 0.4 s | 20 | runs to the end |

5 shorter run(s) totalling 0.7 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 15.067 s | pop | 0.07 | 0.07% |
| 39.267 s | pop | 0.08 | 0.06% |
| 42.467 s | pop | 0.06 | 0.05% |
| 54.867 s | jump | 0.03 | 0.03% |
| 58.700 s | jump | 0.45 | 1.24% |
| 58.767 s | jump | 0.47 | 1.29% |
| 69.900 s | jump | 0.04 | 0.04% |
| 73.133 s | pop | 0.08 | 0.05% |

## Loop seam

From the last frame back to the first: 7.92 on the scale of `frames.csv`, against a median frame change of 0.035, a 95th percentile of 0.25 and a largest of 2.70 at 20.900 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -19.8 LUFS, loudness range 6.6 LU, true peak -1.3 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -19.3, 4s -21.0, 5s -19.7, 6s -20.2, 7s -20.1, 8s -22.1, 9s -19.6, 10s -19.9, 11s -19.5, 12s -21.9, 13s -19.7, 14s -20.0, 15s -20.6, 16s -20.9, 17s -20.8, 18s -18.5, 19s -19.9, 20s -19.6, 21s -22.3, 22s -23.9, 23s -28.3, 24s -27.9, 25s -25.5, 26s -25.5, 27s -29.3, 28s -156.8, 29s -156.8, 30s -156.8, 31s -156.8, 32s -156.8, 33s -156.8, 34s -156.8, 35s -156.8, 36s -156.8, 37s -25.3, 38s -22.9, 39s -20.0, 40s -20.2, 41s -20.1, 42s -23.2, 43s -26.4, 44s -29.5, 45s -23.5, 46s -20.7, 47s -20.5, 48s -20.4, 49s -21.4, 50s -21.4, 51s -20.1, 52s -20.6, 53s -19.5, 54s -20.3, 55s -19.8, 56s -20.3, 57s -20.7, 58s -20.9, 59s -19.2, 60s -20.0, 61s -17.8, 62s -19.0, 63s -18.6, 64s -21.8, 65s -20.3, 66s -20.8, 67s -20.5, 68s -22.3, 69s -21.4, 70s -21.8, 71s -20.8, 72s -21.3, 73s -19.6, 74s -20.5, 75s -19.7, 76s -20.9

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 16 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`, `sheet-09.jpg`, `sheet-10.jpg`, `sheet-11.jpg`, `sheet-12.jpg`, `sheet-13.jpg`, `sheet-14.jpg`, `sheet-15.jpg`, `sheet-16.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
