# Measurement

File: `lab/s13-recap/parts/part-a-0-27.94.mp4`

| Property | Value |
| --- | --- |
| Duration | 27.967 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 1.5 s (1.6 s per 30 s), longest 0.2 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 3.50 s | 0.1 s |  |
| 6.10 s | 0.1 s |  |
| 7.60 s | 0.1 s |  |
| 11.50 s | 0.1 s |  |
| 11.70 s | 0.1 s |  |
| 12.10 s | 0.1 s |  |
| 15.90 s | 0.1 s |  |
| 16.10 s | 0.1 s |  |
| 17.20 s | 0.1 s |  |
| 18.70 s | 0.1 s |  |
| 20.20 s | 0.2 s |  |
| 24.30 s | 0.1 s |  |
| 24.60 s | 0.2 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 2.00 s | 4.6 s | 176 | small element moving |
| 6.80 s | 0.9 s | 120 | small element moving |
| 8.10 s | 0.3 s | 128 | small element moving |
| 9.00 s | 7.5 s | 171 | small element moving |
| 16.80 s | 2.1 s | 159 | small element moving |
| 20.10 s | 5.1 s | 174 | small element moving |
| 25.50 s | 0.4 s | 133 | small element moving |
| 26.10 s | 1.6 s | 158 | small element moving |

4 shorter run(s) totalling 0.5 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 5.233 s | pop | 0.11 | 0.11% |
| 8.900 s | jump | 0.23 | 0.05% |
| 14.967 s | pop | 0.09 | 0.09% |
| 15.067 s | jump | 0.14 | 0.11% |
| 16.733 s | jump | 0.37 | 0.22% |
| 17.733 s | pop | 0.08 | 0.06% |
| 23.367 s | pop | 0.06 | 0.05% |

## Loop seam

From the last frame back to the first: 6.20 on the scale of `frames.csv`, against a median frame change of 0.036, a 95th percentile of 0.52 and a largest of 2.05 at 0.733 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -20.0 LUFS, loudness range 9.2 LU, true peak -3.5 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -20.4, 4s -20.6, 5s -23.3, 6s -27.3, 7s -27.3, 8s -23.8, 9s -20.2, 10s -20.4, 11s -19.4, 12s -21.0, 13s -21.5, 14s -26.4, 15s -32.1, 16s -23.2, 17s -20.9, 18s -20.4, 19s -21.8, 20s -20.6, 21s -19.4, 22s -19.8, 23s -22.8, 24s -28.8, 25s -30.8, 26s -22.5, 27s -21.0

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 6 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`, `sheet-06.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
