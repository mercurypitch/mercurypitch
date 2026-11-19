# Measurement

File: `lab/s03-promise/clip.mp4`

| Property | Value |
| --- | --- |
| Duration | 10.500 s |
| Picture | 1920x1080 30.00 fps h264 |
| Audio | aac 48000 Hz 2 ch |

## Holds

A hold is a 0.1 s sample where the mean change is below 0.1 and no pixel changes by 16 or more. Target: at most about 1 s per 30 s in total and none longer than about 0.5 s; a hold that runs to the end (the final call to action) is reported separately and exempt.

**Inside the film:** 0.1 s (0.3 s per 30 s), longest 0.1 s.
**Final hold:** none.

| Starts | Length | Note |
| --- | --- | --- |
| 0.80 s | 0.1 s |  |

## Low motion

Runs where the mean change is below 0.35. Not an automatic fail: a critic looks at each one. A large "largest change" means something small is visibly moving (a thin line drawing, a small object), which the mean hides.

| Starts | Length | Largest change | Note |
| --- | --- | --- | --- |
| 0.30 s | 0.7 s | 109 | small element moving |
| 1.10 s | 0.4 s | 23 |  |
| 1.60 s | 2.2 s | 92 | small element moving |

3 shorter run(s) totalling 0.3 s are not listed; `motion.csv` has every sample.

## Single-frame events

From every frame at the film's own rate, by the share of pixels that change by more than 24 (at 960 px wide) against the changes either side. A jump changes once and stays: a large one is a cut, a small one is usually a whole-pixel snap in a slow move, and equal snaps come out as equal jumps. A pop differs from both of its neighbours: a flash, a missing element or a one-frame glitch. Look at each on a frame-exact sheet.

None found.

## Loop seam

From the last frame back to the first: 3.88 on the scale of `frames.csv`, against a median frame change of 0.220, a 95th percentile of 0.38 and a largest of 1.13 at 9.667 s. If the film plays on a loop (feeds, landing pages, README embeds), the seam reads as a jump. Compare `frame-last.png` with `frame-0.png`; ignore this for a film that never loops.

## Loudness

Integrated -21.5 LUFS, loudness range 1.5 LU, true peak -1.5 dBTP.

Targets: about -14 LUFS for punchy pieces, -16 to -19 LUFS for calm ones, true peak at most -1 dBTP. Momentary loudness needs a 400 ms window and short-term loudness a 3 s window, so the first samples read -120.7 by definition. Ignore the loudness range on clips shorter than about 10 s. Compare effects with the music using `measure.py audio`.

Short-term per second: 1s -120.7, 2s -120.7, 3s -20.9, 4s -21.8, 5s -22.2, 6s -21.5, 7s -22.4, 8s -22.1, 9s -22.7, 10s -21.9

## Look at these

- `frame-0.png`: must be a finished composition. `frame-last.png`: the end card.
- 3 contact sheet(s), one frame every 0.2 s, each stamped with its own time: `sheet-01.jpg`, `sheet-02.jpg`, `sheet-03.jpg`
- Every transition and every single-frame event: `measure.py dense`, at 20 fps and frame-exact (`--fps <film fps>`, `--window` covering the whole transition).
