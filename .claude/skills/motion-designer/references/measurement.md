# Measurement

Numbers turn taste arguments into fixable items. They never replace a critic
watching the frames: a video that passes every number can still be dull.

## Render

```bash
python3 scripts/measure.py render renders/<name>.mp4 --out review/<round>
python3 scripts/measure.py dense renders/<name>.mp4 --out review/<round> --at 2.4,7.0,11.35
python3 scripts/measure.py dense renders/<name>.mp4 --out review/<round> --at 2.4 --window 0.6 --fps 60
python3 scripts/measure.py audio renders/<name>.mp4 --music-only <music-only render> --out review/<round>
python3 scripts/measure.py color renders/<name>.mp4 --at 4.0 --box 1700,980,120,60
```

`render` writes `summary.md`, `motion.csv`, `frames.csv`, `events.csv`,
`loudness.csv`, `frame-0.png`, `frame-last.png` and contact sheets (one frame
every 0.2 s, 25 to a sheet). `dense` makes one sheet per time: by default one
second at 20 fps; with `--fps <film fps>` and a `--window` that covers the whole
transition, every frame, which is how a one-frame defect is seen. `audio`
measures each effect against the music-only render. `color` prints the mean
colour of a box, for brand-colour checks.

| Check                   | Target                                                                                                                                        | Source                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Holds                   | At most ~1 s per 30 s in total; none longer than ~0.5 s; the final hold is exempt                                                             | `summary.md` § Holds                                         |
| Low motion              | Every run listed is looked at by a critic; not an automatic fail                                                                              | `summary.md` § Low motion                                    |
| Single-frame events     | Every pop explained; jumps are cuts or acceptable snaps                                                                                       | `summary.md` § Single-frame events, then a frame-exact sheet |
| Frame one               | A finished composition                                                                                                                        | `frame-0.png`                                                |
| Loop seam               | For a film that loops: rejoins like an ordinary frame                                                                                         | `summary.md` § Loop seam, `frame-last.png`                   |
| Text contrast           | At least 4.5:1 on settled text                                                                                                                | `check` contrast audit; critic for text over footage         |
| Collisions, fly-through | None, including mid-transition                                                                                                                | `check` layout audit (text only); critic on the dense sheets |
| Brand colour            | Within about 3 per channel of the token                                                                                                       | `measure.py color` on a background box                       |
| Loudness                | About -14 LUFS punchy, -16 to -19 LUFS calm; true peak at most -1 dBTP                                                                        | `summary.md` § Loudness                                      |
| Effects against music   | +3 to +4 dB over the music in the effect's own band (a whoosh +2 to +3); 2-8 kHz lift at most ~4 dB; sample peak at most ~6 dB over the music | `audio.md` § Effects in their own band                       |
| Determinism             | Two renders give identical frames                                                                                                             | `ffmpeg -i <file> -map 0:v -f framemd5 -` on both, compare   |

The `check` layout audit only compares text with text: in the first smoke test
it missed the title flying across the logo mark, an image. Critics catch those.

## Contact sheets and their times

Every tile is a real frame of the film, picked with FFmpeg's `select`, and the
time printed on it is that frame's own time. The first version resampled with
the `fps` filter, which stamps the output time instead: on a frame-indexed test
clip every 20 fps tile was one frame later than its label, and every 0.2 s tile
five frames later. A verification critic reported it. Picking frames also needs `-fps_mode passthrough`, or FFmpeg
repeats whole sheets to fill a constant frame rate (34 sheets instead of 3 on
the same clip). `dense` picks every Nth frame, so a rate that does not divide
the film's (25 fps from 60) becomes the nearest one that does (30), and the file
name says which.

## Reading holds and low motion

Each sample, about 0.1 s apart, carries two numbers: the mean absolute luma
change and the largest change of any pixel, on a 0 to 255 scale at 320 px wide.
A hold needs both to be small (mean below 0.1, largest below 16), because the
mean alone misses small things moving. Measured on the MercuryPitch smoke test:
a static frame changes no pixel by more than 1 or 2; slowly drifting type
reaches 9 to 29; a thin pitch curve being drawn reads only 0.15 to 0.6 on the
mean but 87 to 174 on the largest change; a fly-through reads 8 to 17 on the
mean. A run is reported from the first frame that stops changing.

Low-motion runs (mean below 0.35) are listed with their largest change. The
kit's 0.35 threshold was set on bright, cream-coloured films, so on a dark stage
it also catches slow moves that are genuinely visible; "small element moving" in
the table says something is. The critic decides whether a run reads as dead.

A hold that runs to the end of the film is the final call to action, reported
separately and left out of the per-30-seconds figure. If a brand has an unusual
palette, calibrate once: render one second held still and one second of the
slowest move you would accept, and set `--low` between their readings.

## Single-frame events

`render` reads every frame at the film's own rate and counts, for each pair of
frames, the share of pixels (at 960 px wide) that change by more than 24
(`--changed`). A jump changes at least three times as many pixels as the
changes either side of it; a pop is two such changes in a row, a frame that
differs from both neighbours. Comparing with the immediate neighbours treats
equal events equally: a slow move that snaps whole pixels gives a run of equal
jumps. A large jump is a cut; a small one is usually such a snap; a pop is a
flash, a missing element or a one-frame glitch. `summary.md` lists the 20
strongest and `events.csv` all of them.

Validated on 2026-10-02:

- A synthetic clip with hard cuts at 2.000 s and 4.000 s and a box moving one
  pixel at a time between them: both cuts found, nothing else.
- The smoke test's slow drift (3.37-4.57 s) snaps whole pixels seven times. The
  first version, which compared the mean change with eight times the median of
  the surrounding half second, flagged one of the seven; a critic had found the
  others by hand. This version flags all seven, plus three events at
  2.97-3.07 s, and nothing in still stretches or the fly-through.
  At a threshold of 16 the drift itself crosses it, and four of the seven snaps
  fall under the three-times test.

## Loop seam

`render` compares the last frame with the first on the scale of `frames.csv`
and sets the result beside the film's median, 95th percentile and largest
frame change. A film that plays on a loop (social feeds, landing pages, README
embeds) should rejoin like any other frame. On the smoke test the seam measured
13.3 against a largest change of 14.6, the zoom-through: the loop jumps, as a
critic had measured by hand. Ignore it for a film that never loops.

## Reading loudness

Momentary loudness needs a 400 ms window and short-term loudness a 3 s window,
so the first samples of `loudness.csv` read -120.7 by definition. Integrated
loudness, the loudness range and true peak (in dBTP) come from FFmpeg's
`ebur128` summary. Ignore the loudness range on clips shorter than about 10 s.

## Effects against music

`measure.py audio` compares the mix with the music-only render, which differs
only by the effects. In 25 ms steps it measures both in nine octave bands and
marks every 50 ms where the mix carries at least 1.5 dB more than the music in
some octave; stretches less than 100 ms apart are one effect. The effect's band
is where the middle 60 per cent of its energy over the music lies (the kit takes
the 20th to 80th percentile of the effect's spectrum). Inside that band it
reports what the kit's mixer checks:

- **In-band peak:** the loudest 50 ms of the mix over the loudest 50 ms of the
  music, the music floored at -50 dBFS. Target about +3 to +4 dB; whooshes +2 to
  +3 dB ("a soft air pass").
- **Body:** the loudest 150 ms of the mix over the music in the same 150 ms. The
  kit added it after a 50 ms peak over-reported a 0.15 s thock by 8 dB.
- **2-8 kHz:** the 50 ms peak lift in the ear-sensitive band, at most about
  4 dB.
- **Sample peak:** the mix's sample peak over the music's local peak, floored at
  -20 dBFS; at most about 6 dB, 8 for a signature hit.

The numbers depend on the band: on the smoke test's whoosh (pink noise between
250 Hz and 4 kHz over a sine pad) the tool picks 328-2201 Hz and reads +3.3 dB,
while a critic who picked 0.5-4 kHz by ear read about +5 dB, and the same
measure in 0.5-4 kHz gives +3.9 dB. Read the band with the number. Both renders
are AAC, so a few tenths of a dB is codec noise. `audio.md` also keeps the 400 ms
momentary lift in full band and 2-8 kHz; that window smears a short effect and
reports it late (the whoosh at 2.4 s instead of 2.1 s), so judge levels by the
in-band table.

## Reference study

```bash
python3 scripts/reference_pass.py <reference.mp4> --out study/<name>
```

It reads every frame at 320 px: change from the previous frame, brightness,
edge strength, and FFmpeg's scene-change score. Cuts are frames scoring at
least 10 (`--cut`). Fast moments are the largest non-cut changes that stand out
from the film's own resting level (at least 2.0 and four times the median).
Validated on a synthetic clip with hard cuts at 2.000 s and 4.000 s: both found,
and the fly-through found at 4.70 s. Its sheets pick frames by time, so they
stay true on a variable frame rate download, and each tile carries its own time.

## Known problems in the kit's own scripts

Use `scripts/measure.py` instead of these; the kit's versions stay unmodified in
`kit/` for reference.

- `frozen-time.sh` reads values with `grep -o "YAVG=[0-9.]*"`. FFmpeg prints
  values below 1e-4 in scientific notation, so `5.20833e-05` is read as
  `5.20833` and a nearly frozen stretch where only a few pixels change counts as
  motion. It under-reports frozen time exactly when a render is almost still.
- `loudness.sh` splits on whitespace, but FFmpeg prints `S:-120.7` with no
  space when the value is six characters wide, so silent or not-yet-measured
  seconds come out blank, and it samples at x.1 s because of float drift.
- `contact-sheet.sh` writes one sheet only (`-frames:v 1`), without timestamps;
  anything past cols x rows frames is dropped.
- `quality-bar.md` and `gauntlet.md` point to these scripts; read them as
  pointing to `measure.py`.
- `solve-sfx-gains.py` returns its 0.005 floor when the music is sparse in the
  effect's band (seen against a sine pad). That means "no reliable answer", not
  "almost silent". `offline-mix.py` has per-event floors for this case but is
  hard-coded to one 40-second film; see the deviations in `SKILL.md`.
- `sfx-candidates.py` worked as documented.
