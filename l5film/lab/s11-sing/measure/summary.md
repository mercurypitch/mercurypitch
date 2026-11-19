# Measurement

File: `lab/s11-sing/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 39.200 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 2.7 s (2.1 s per 30 s), longest 0.4 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 1.50 s | 0.1 s |  |
| 3.40 s | 0.2 s |  |
| 8.10 s | 0.1 s |  |
| 8.50 s | 0.1 s |  |
| 11.10 s | 0.1 s |  |
| 15.20 s | 0.2 s |  |
| 16.80 s | 0.1 s |  |
| 18.60 s | 0.1 s |  |
| 19.40 s | 0.1 s |  |
| 21.50 s | 0.4 s |  |
| 23.70 s | 0.1 s |  |
| 27.90 s | 0.2 s |  |
| 30.50 s | 0.3 s |  |
| 32.70 s | 0.1 s |  |
| 35.10 s | 0.1 s |  |
| 36.60 s | 0.2 s |  |
| 38.00 s | 0.1 s |  |
| 38.90 s | 0.1 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.70 s | 1.2 s | 146 | small element moving |
| 2.70 s | 2.7 s | 160 | small element moving |
| 5.50 s | 2.1 s | 171 | small element moving |
| 7.90 s | 1.9 s | 159 | small element moving |
| 9.90 s | 3.0 s | 174 | small element moving |
| 13.00 s | 7.1 s | 179 | small element moving |
| 20.20 s | 16.6 s | 171 | small element moving |
| 36.90 s | 1.4 s | 161 | small element moving |
| 38.40 s | 0.7 s | 126 | small element moving, runs to the end |

2 shorter run(s) totalling 0.2 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 0.033 s | jump | 0.07 | 0.04% |
| 10.833 s | pop | 0.08 | 0.05% |
| 17.067 s | jump | 0.11 | 0.09% |
| 32.267 s | pop | 0.09 | 0.06% |

## Loop seam

From the last frame back to the first: 6.10 on the scale of `frames.csv`, against a median frame change of 0.033, a 95th percentile of 0.14 and a largest of 1.06 at 2.133 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -20.0 LUFS, loudness range 3.1 LU, true peak -1.2 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -24.1, 4s -21.5, 5s -20.0, 6s -20.6, 7s -20.4, 8s -20.7, 9s -20.6, 10s -20.2, 11s -19.9, 12s -20.1, 13s -21.0, 14s -20.1, 15s -20.3, 16s -20.0, 17s -21.8, 18s -20.2, 19s -20.0, 20s -19.5, 21s -20.8, 22s -22.5, 23s -20.5, 24s -20.6, 25s -19.7, 26s -22.3, 27s -21.1, 28s -21.4, 29s -20.1, 30s -20.5, 31s -19.3, 32s -18.7, 33s -18.9, 34s -20.1, 35s -22.1, 36s -22.0, 37s -21.2, 38s -20.2, 39s -20.9

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 8 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
