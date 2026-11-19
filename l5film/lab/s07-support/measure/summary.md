# Measurement

File: `lab/s07-support/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 36.400 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 3.5 s (2.9 s per 30 s), longest 0.5 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 1.50 s | 0.1 s |  |
| 4.60 s | 0.1 s |  |
| 6.60 s | 0.3 s |  |
| 8.60 s | 0.1 s |  |
| 9.30 s | 0.1 s |  |
| 12.20 s | 0.2 s |  |
| 13.00 s | 0.1 s |  |
| 14.30 s | 0.1 s |  |
| 15.40 s | 0.3 s |  |
| 16.90 s | 0.2 s |  |
| 18.00 s | 0.1 s |  |
| 19.50 s | 0.1 s |  |
| 21.10 s | 0.2 s |  |
| 21.60 s | 0.1 s |  |
| 21.80 s | 0.4 s |  |
| 22.50 s | 0.2 s |  |
| 24.40 s | 0.5 s |  |
| 25.10 s | 0.1 s |  |
| 28.70 s | 0.1 s |  |
| 31.90 s | 0.1 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 1.40 s | 1.3 s | 152 | small element moving |
| 2.80 s | 1.3 s | 154 | small element moving |
| 4.20 s | 3.1 s | 162 | small element moving |
| 8.40 s | 0.4 s | 59 | small element moving |
| 9.20 s | 0.3 s | 153 | small element moving |
| 9.60 s | 1.5 s | 155 | small element moving |
| 11.60 s | 5.5 s | 156 | small element moving |
| 17.20 s | 1.0 s | 81 | small element moving |
| 18.70 s | 0.5 s | 152 | small element moving |
| 19.30 s | 0.4 s | 67 | small element moving |
| 19.90 s | 1.5 s | 149 | small element moving |
| 21.60 s | 2.0 s | 157 | small element moving |
| 23.70 s | 2.4 s | 151 | small element moving |
| 26.70 s | 0.7 s | 155 | small element moving |
| 27.70 s | 8.3 s | 157 | small element moving |

3 shorter run(s) totalling 0.3 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 13.567 s | pop | 0.04 | 0.03% |
| 34.167 s | pop | 0.05 | 0.04% |

## Loop seam

From the last frame back to the first: 6.44 on the scale of `frames.csv`, against a median frame change of 0.028, a 95th percentile of 1.01 and a largest of 3.76 at 9.033 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -19.9 LUFS, loudness range 2.4 LU, true peak -2.4 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -19.8, 4s -20.5, 5s -20.7, 6s -20.6, 7s -21.3, 8s -19.6, 9s -20.8, 10s -20.1, 11s -20.5, 12s -20.2, 13s -19.9, 14s -20.5, 15s -20.4, 16s -21.5, 17s -21.2, 18s -21.0, 19s -19.9, 20s -20.3, 21s -19.0, 22s -19.6, 23s -19.7, 24s -21.6, 25s -22.4, 26s -20.6, 27s -21.5, 28s -19.0, 29s -19.7, 30s -19.1, 31s -21.6, 32s -20.9, 33s -20.9, 34s -20.1, 35s -21.0, 36s -21.4

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 8 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
