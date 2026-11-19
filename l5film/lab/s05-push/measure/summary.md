# Measurement

File: `lab/s05-push/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 36.233 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 1.1 s (0.9 s per 30 s), longest 0.2 s.
**Final hold:** 0.1 s.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.1 s |  |
| 7.10 s | 0.1 s |  |
| 9.70 s | 0.2 s |  |
| 11.50 s | 0.1 s |  |
| 12.80 s | 0.1 s |  |
| 16.10 s | 0.1 s |  |
| 16.70 s | 0.1 s |  |
| 18.50 s | 0.1 s |  |
| 31.10 s | 0.2 s |  |
| 36.10 s | 0.1 s | final hold |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 2.90 s | 2.2 s | 166 | small element moving |
| 5.30 s | 2.9 s | 171 | small element moving |
| 8.40 s | 4.6 s | 167 | small element moving |
| 13.10 s | 1.9 s | 164 | small element moving |
| 15.20 s | 5.5 s | 166 | small element moving |
| 21.30 s | 0.4 s | 204 | small element moving |
| 22.30 s | 1.5 s | 202 | small element moving |
| 25.00 s | 2.5 s | 201 | small element moving |
| 28.60 s | 0.6 s | 175 | small element moving |
| 29.40 s | 0.5 s | 195 | small element moving |
| 30.00 s | 2.4 s | 157 | small element moving |
| 33.20 s | 2.2 s | 184 | small element moving |

9 shorter run(s) totalling 1.3 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 7.833 s | pop | 0.06 | 0.05% |
| 10.000 s | jump | 0.03 | 0.04% |
| 12.367 s | pop | 0.08 | 0.06% |
| 14.900 s | jump | 0.11 | 0.08% |
| 20.167 s | jump | 0.09 | 0.13% |
| 31.367 s | jump | 0.03 | 0.04% |
| 35.033 s | pop | 0.07 | 0.05% |

## Loop seam

From the last frame back to the first: 3.64 on the scale of `frames.csv`, against a median frame change of 0.046, a 95th percentile of 0.51 and a largest of 3.10 at 2.167 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -20.0 LUFS, loudness range 4.7 LU, true peak -2.8 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -24.9, 4s -21.9, 5s -20.4, 6s -19.6, 7s -19.7, 8s -19.5, 9s -21.0, 10s -22.0, 11s -19.7, 12s -19.4, 13s -19.5, 14s -21.5, 15s -22.5, 16s -19.4, 17s -20.2, 18s -19.1, 19s -21.2, 20s -20.9, 21s -24.0, 22s -27.1, 23s -160.9, 24s -160.9, 25s -160.9, 26s -160.9, 27s -24.4, 28s -21.1, 29s -19.2, 30s -19.5, 31s -20.9, 32s -22.3, 33s -21.9, 34s -20.8, 35s -20.2, 36s -21.3

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 8 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`, `sheet-07.jpg`, `sheet-08.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
