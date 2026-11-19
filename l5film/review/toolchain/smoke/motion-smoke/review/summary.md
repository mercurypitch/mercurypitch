# Measurement

File: `renders/smoke-a.mp4`

| Property | Value |
| --- | --- |
| Duration | 5.000 s |
| Picture | 1920x1080 60.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 0.0 s (0.0 s per 30 s), longest 0.0 s.
**Final hold:** 0.1 s.

| Starts | Length | Note |
| --- | --- | --- |
| 4.80 s | 0.1 s | final hold |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 0.5 s | 173 | small element moving |
| 1.50 s | 0.7 s | 139 | small element moving |
| 4.20 s | 0.3 s | 57 | small element moving |
| 4.60 s | 0.3 s | 22 | runs to the end |

4 shorter run(s) totalling 0.7 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 0.567 s | jump | 0.32 | 0.39% |
| 0.717 s | jump | 0.09 | 0.03% |
| 1.050 s | jump | 0.33 | 0.40% |
| 1.083 s | jump | 0.10 | 0.05% |
| 1.117 s | pop | 0.11 | 0.04% |
| 1.483 s | jump | 0.32 | 0.40% |
| 2.967 s | jump | 0.16 | 0.20% |
| 3.000 s | jump | 0.14 | 0.21% |
| 3.067 s | pop | 0.33 | 0.45% |
| 3.367 s | jump | 0.45 | 0.63% |
| 3.617 s | jump | 0.32 | 0.44% |
| 3.800 s | jump | 0.17 | 0.22% |
| 3.883 s | jump | 0.33 | 0.41% |
| 4.183 s | jump | 0.33 | 0.44% |
| 4.317 s | jump | 0.16 | 0.21% |
| 4.567 s | jump | 0.33 | 0.45% |

## Loop seam

From the last frame back to the first: 13.32 on the scale of `frames.csv`, against a median frame change of 0.062, a 95th percentile of 5.74 and a largest of 14.56 at 2.467 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -17.9 LUFS, loudness range 0.6 LU, true peak -7.3 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -17.6, 4s -17.6, 5s -18.4

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 1 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
