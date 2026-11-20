# Measurement

File: `lab/passes-proto/s08-after/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 20.400 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 1.2 s (1.8 s per 30 s), longest 0.3 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.3 s |  |
| 3.70 s | 0.1 s |  |
| 5.50 s | 0.1 s |  |
| 5.70 s | 0.2 s |  |
| 8.90 s | 0.1 s |  |
| 14.00 s | 0.1 s |  |
| 16.70 s | 0.1 s |  |
| 19.90 s | 0.2 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 0.3 s | 9 | nothing visible moves |
| 1.50 s | 0.4 s | 43 |  |
| 2.90 s | 12.3 s | 181 | small element moving |
| 15.30 s | 3.0 s | 150 | small element moving |
| 18.40 s | 1.9 s | 155 | small element moving, runs to the end |

0 shorter run(s) totalling 0.0 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 11.300 s | pop | 0.06 | 0.04% |

## Loop seam

From the last frame back to the first: 4.07 on the scale of `frames.csv`, against a median frame change of 0.025, a 95th percentile of 0.44 and a largest of 2.73 at 2.167 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -16.0 LUFS, loudness range 2.7 LU, true peak -1.8 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -19.9, 4s -18.5, 5s -15.5, 6s -16.9, 7s -15.3, 8s -16.9, 9s -16.5, 10s -17.3, 11s -16.9, 12s -16.8, 13s -17.4, 14s -17.4, 15s -16.3, 16s -15.6, 17s -14.8, 18s -15.2, 19s -16.0, 20s -17.9

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 5 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`, `sheet-05.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
