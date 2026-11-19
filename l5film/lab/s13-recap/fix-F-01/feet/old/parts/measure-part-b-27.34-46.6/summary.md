# Measurement

File: `lab/s13-recap/parts/part-b-27.34-46.6.mp4`

| Property | Value |
| --- | --- |
| Duration | 19.267 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 1.1 s (1.7 s per 30 s), longest 0.3 s.
**Final hold:** 0.2 s.

| Starts | Length | Note |
| --- | --- | --- |
| 0.00 s | 0.1 s |  |
| 3.20 s | 0.3 s |  |
| 4.20 s | 0.1 s |  |
| 5.80 s | 0.1 s |  |
| 8.40 s | 0.1 s |  |
| 12.50 s | 0.3 s |  |
| 14.40 s | 0.1 s |  |
| 19.00 s | 0.2 s | final hold |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 0.4 s | 160 | small element moving |
| 1.80 s | 0.4 s | 194 | small element moving |
| 2.90 s | 3.9 s | 162 | small element moving |
| 7.00 s | 4.7 s | 166 | small element moving |
| 11.90 s | 1.1 s | 161 | small element moving |
| 13.10 s | 1.5 s | 166 | small element moving |
| 14.80 s | 1.1 s | 160 | small element moving |
| 16.00 s | 3.2 s | 174 | small element moving, runs to the end |

0 shorter run(s) totalling 0.0 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 19.233 s | jump | 0.11 | 0.17% |

## Loop seam

From the last frame back to the first: 13.10 on the scale of `frames.csv`, against a median frame change of 0.037, a 95th percentile of 0.69 and a largest of 1.90 at 1.767 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -19.7 LUFS, loudness range 3.5 LU, true peak -3.1 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -24.7, 4s -20.2, 5s -19.4, 6s -19.6, 7s -20.6, 8s -20.4, 9s -20.3, 10s -21.5, 11s -21.0, 12s -21.6, 13s -22.2, 14s -22.5, 15s -20.9, 16s -19.2, 17s -19.5, 18s -19.6, 19s -20.8

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 4 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`, `sheet-04.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
