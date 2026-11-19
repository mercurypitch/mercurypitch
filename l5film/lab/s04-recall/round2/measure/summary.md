# Measurement

File: `lab/s04-recall/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 13.667 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 0.5 s (1.1 s per 30 s), longest 0.1 s.
**Final hold:** 0.1 s.

| Starts | Length | Note |
| --- | --- | --- |
| 3.30 s | 0.1 s |  |
| 4.60 s | 0.1 s |  |
| 8.40 s | 0.1 s |  |
| 8.60 s | 0.1 s |  |
| 9.80 s | 0.1 s |  |
| 13.50 s | 0.1 s | final hold |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.00 s | 0.4 s | 104 | small element moving |
| 1.60 s | 0.9 s | 112 | small element moving |
| 2.70 s | 3.7 s | 173 | small element moving |
| 6.70 s | 0.9 s | 162 | small element moving |
| 8.40 s | 1.7 s | 173 | small element moving |
| 10.60 s | 0.6 s | 162 | small element moving |
| 11.30 s | 0.3 s | 174 | small element moving |

2 shorter run(s) totalling 0.4 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

| Time | Kind | Mean change | Pixels changed |
| --- | --- | --- | --- |
| 6.033 s | pop | 0.06 | 0.05% |
| 9.600 s | pop | 0.09 | 0.12% |

## Loop seam

From the last frame back to the first: 3.41 on the scale of `frames.csv`, against a median frame change of 0.057, a 95th percentile of 2.92 and a largest of 5.23 at 1.000 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam rejoins like an ordinary frame. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -19.9 LUFS, loudness range 7.7 LU, true peak -3.6 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -19.3, 4s -20.8, 5s -21.6, 6s -25.0, 7s -29.7, 8s -24.3, 9s -21.9, 10s -21.1, 11s -20.9, 12s -20.5, 13s -20.0

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 3 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
