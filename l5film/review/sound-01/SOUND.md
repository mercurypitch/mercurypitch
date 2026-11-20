# Lesson 5: the sound, measured

`tools/sound-measure.py`, from `assets/audio/` (mixed by `tools/mix.py` from `cues.json`, 549.465 s) and the kit's numbers in `assets/audio/kit-sound.json` (`tools/sound-kit.mjs`). Every number here is read from a written file; none is the mixer's own claim. What a person has to listen to is listed in the hand-back, not here.

Beside this file: `tracks/` (each sound's pitch and level track), `starts-picture.csv` (the traces' heads, frame by frame), `audio.md` (the skill's `measure.py audio` on the review cut against `music-only.wav`: there every line and example counts as an effect, as in Lesson 4), `effects/audio.md` (the same measure on the effects alone, `music-only.wav` + `stems/fx.wav`, against `music-only.wav`) and `check.json` (the root's `check` with the full mix).

## 1. Pitch and level against the drawn contours (FACTS 80, 98)

Each sound is tracked in `assets/audio/stems/examples.wav`, the stem as delivered, every 10 ms from 0.03 s after it starts to 0.03 s before it ends. "Drawn" is the kit's own function, read in node (`tools/sound-kit.mjs`): `L.CONTOUR.<name>.c(t)` for the takes, the Push note and Tavi's hold; `L.CONTOUR.vib(t, 0)` round the note for the held notes the kit draws no line for. The level is the fundamental's, against `L.CONTOUR.<name>.db(t)`, between the voice's attack (0.09 s) and its release (the last 0.18 s), which the strip does not draw. "Mean" is the track's mean error: how far the note's centre sits from its pitch. The last column is the same track read from `full.wav`, between the attack and the release (the room tone is in it, 37 LU under the voice, and blurs the reading where the note is faint).

| Sound | Cue | Note | Points | Pitch error: mean | max | RMS | Level error: max | RMS | Read at | In full.wav: RMS, max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `easy` | 0.600 | A3 220.00 Hz | 395 | +0.00 c | 0.84 c | 0.09 c | 0.02 dB | 0.00 dB | 0.03 to 3.97 s | 0.98 c, 2.72 c |
| `pushed` | 21.210 | A3 220.00 Hz | 395 | +0.00 c | 0.84 c | 0.09 c | 0.02 dB | 0.00 dB | 0.03 to 3.97 s | 0.86 c, 3.13 c |
| `push` | 86.760 | A3 220.00 Hz | 555 | +0.00 c | 0.71 c | 0.06 c | 0.02 dB | 0.00 dB | 0.03 to 5.57 s | 0.73 c, 2.67 c |
| `demo` | 294.815 | A4 440.00 Hz | 995 | +0.00 c | 0.38 c | 0.02 c | 0.00 dB | 0.00 dB | 0.03 to 9.97 s | 1.08 c, 3.67 c |
| `gauge` | 124.980 | A3 220.00 Hz | 995 | +0.00 c | 0.64 c | 0.04 c | 0.02 dB | 0.00 dB | 0.03 to 9.97 s | 1.05 c, 3.69 c |
| `listen (Merc)` | 407.140 | A3 220.00 Hz | 195 | +0.00 c | 0.69 c | 0.09 c | 0.02 dB | 0.00 dB | 0.03 to 1.97 s | 1.03 c, 2.70 c |
| `listen (Tavi)` | 407.140 | A4 440.00 Hz | 195 | +0.00 c | 0.14 c | 0.03 c | 0.01 dB | 0.00 dB | 0.03 to 1.97 s | 0.66 c, 2.42 c |
| `twinkle 1` | 529.135 | C4 261.63 Hz | 45 | +0.02 c | 0.75 c | 0.25 c | 0.01 dB | 0.00 dB | 0.03 to 0.47 s | 1.08 c, 2.23 c |
| `twinkle 2` | 529.635 | C4 261.63 Hz | 45 | +0.02 c | 1.11 c | 0.26 c | 0.01 dB | 0.00 dB | 0.03 to 0.47 s | 1.26 c, 2.46 c |
| `twinkle 3` | 530.135 | G4 392.00 Hz | 45 | +0.01 c | 0.41 c | 0.09 c | 0.01 dB | 0.00 dB | 0.03 to 0.47 s | 1.16 c, 2.62 c |
| `twinkle 4` | 530.635 | G4 392.00 Hz | 45 | +0.01 c | 0.70 c | 0.12 c | 0.01 dB | 0.00 dB | 0.03 to 0.47 s | 1.06 c, 2.63 c |
| `twinkle 5` | 531.135 | A4 440.00 Hz | 45 | +0.03 c | 0.48 c | 0.10 c | 0.01 dB | 0.00 dB | 0.03 to 0.47 s | 0.89 c, 2.25 c |
| `twinkle 6` | 531.635 | A4 440.00 Hz | 45 | +0.04 c | 1.46 c | 0.23 c | 0.01 dB | 0.00 dB | 0.03 to 0.47 s | 0.91 c, 2.14 c |
| `twinkle 7` | 532.135 | G4 392.00 Hz | 95 | +0.00 c | 0.21 c | 0.05 c | 0.01 dB | 0.00 dB | 0.03 to 0.97 s | 1.11 c, 2.43 c |
| `start-air` | 243.900 | A3 220.00 Hz | 103 | +0.00 c | 0.46 c | 0.06 c | 0.01 dB | 0.00 dB | 0.55 to 1.57 s | 1.00 c, 2.44 c |
| `start-catch` | 252.930 | A3 220.00 Hz | 136 | -0.01 c | 2.56 c | 0.27 c | 0.03 dB | 0.00 dB | 0.21 to 1.57 s | 1.14 c, 4.45 c |
| `start-together` | 259.660 | A3 220.00 Hz | 147 | +0.00 c | 0.72 c | 0.08 c | 0.01 dB | 0.00 dB | 0.11 to 1.57 s | 1.03 c, 2.42 c |
| `starts: air` | 266.230 | A3 220.00 Hz | 103 | +0.00 c | 0.46 c | 0.06 c | 0.01 dB | 0.00 dB | 0.55 to 1.57 s | 0.95 c, 2.99 c |
| `starts: catch` | 268.030 | A3 220.00 Hz | 136 | -0.01 c | 2.56 c | 0.27 c | 0.03 dB | 0.00 dB | 0.21 to 1.57 s | 0.95 c, 3.62 c |
| `starts: together` | 269.830 | A3 220.00 Hz | 147 | +0.00 c | 0.72 c | 0.08 c | 0.01 dB | 0.00 dB | 0.11 to 1.57 s | 1.12 c, 2.68 c |

What the tracks read at the moments FACTS 80 names (measured, then drawn in brackets):

- `easy`: -37.1 c at 0.03 s (-37.6; the line starts at -40), -20.0 c at 0.25 s (-20.0), -0.1 c at 0.50 s (+0.0); the wave's first peak +9.1 c (+9.2), its largest from 0.85 s 14.1 c (14.0); the level stays within 0.02 dB of even.
- `pushed`: as `easy` to 1.0 s (-37.1 c at 0.03 s); its centre, the mean over two whole waves, is +34.8 c round 2.75 s (+34.8: it leaves the band, 35) and +55.6 c over the last two waves (+55.6; 60 at 4.0 s); the level is +3.00 dB at 2.5 s (+3.00) and +5.59 dB at 3.8 s (+5.60), where the release starts; the line draws +6 dB at 4.0 s, inside the voice's release.
- `push`: centre -0.2 c at 50 (-0.2), +59.9 c held at 100 (+59.9; 2.1 to 3.6 s), +0.1 c back at 50 (+0.1); level +0.00 dB at 50, +6.00 dB at 100 (+6.00), +0.00 dB back at 50; a step is 1.2 c and 0.12 dB by the kit.
- `demo` (Tavi, A4): 0.03 s -58.4 (-58.4), 0.18 s -38.0 (-38.0), 0.34 s -52.0 (-52.0), 0.50 s -22.0 (-22.0), 0.66 s -38.0 (-38.0), 0.80 s -10.0 (-10.0), 0.90 s +0.0 (+0.0); from 1.25 s the wave swings -14.0 to +14.0 c (-14.0 to +14.0), centre -0.00 c.
- `gauge`: the note unchanged, its centre +0.00 c from its pitch; its own wave swings -14.0 to +14.0 c.
- `listen (Merc)`: the note unchanged, its centre +0.00 c from its pitch; its own wave swings -14.0 to +14.0 c.
- `listen (Tavi)`: the note unchanged, its centre +0.00 c from its pitch; its own wave swings -14.0 to +14.0 c.
- `twinkle`: each note's centre from its pitch: C4 261.63 Hz +0.02 c, C4 261.63 Hz +0.02 c, G4 392.00 Hz +0.01 c, G4 392.00 Hz +0.01 c, A4 440.00 Hz +0.03 c, A4 440.00 Hz +0.04 c, G4 392.00 Hz +0.00 c; onsets 0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0 s (`L.TEASE.onset`), the last note 1.0 s.

## 2. The ticks against `listen` (FACTS 97, LAB-CHECKS 16)

| In | Tick | Tick peak | `listen` peak | Tick under | Tick true peak | `listen` true peak | Under |
| --- | --- | --- | --- | --- | --- | --- | --- |
| full.wav | `tick-in` 411.280 s | -23.9 dBFS | -10.8 dBFS | 13.2 dB | -23.8 dBTP | -10.8 dBTP | 13.0 dB |
| full.wav | `tick-out` 421.380 s | -23.8 dBFS | -10.8 dBFS | 13.1 dB | -23.7 dBTP | -10.8 dBTP | 12.9 dB |
| review cut (AAC, decoded) | `tick-in` 411.280 s | -23.9 dBFS | -10.7 dBFS | 13.2 dB | -23.8 dBTP | -10.7 dBTP | 13.1 dB |
| review cut (AAC, decoded) | `tick-out` 421.380 s | -23.8 dBFS | -10.7 dBFS | 13.1 dB | -23.7 dBTP | -10.7 dBTP | 12.9 dB |

The tick alone (`stems/fx.wav`, `tick-in`): within 20 dB of its peak for 25 ms and gone (60 dB down) 30 ms after it starts; its first sample over -90 dBFS is 0.1 ms after its cue; half its energy lies between 2870 and 3455 Hz, 90 % between 2405 and 4010 Hz (centre 3170 Hz); 0.27 % of it lies under 1.9 kHz, where the A3 voice's eight partials are (220 to 1,760 Hz). No pitch: over 30 ms its largest autocorrelation at any lag from 1 to 12.5 ms (a pitch from 1 kHz down to 80 Hz) is 0.20, against 0.85 for 30 ms of `listen`. `tick-out` is the same samples at the same level.

The review cut's sound was decoded and lined up with `full.wav` on the title chime (0 samples apart).

## 3. The starts' onsets against FACTS 80 (and 75, 96)

Measured in `stems/examples.wav`, in seconds from each start's own beginning (its cue, or its row in `starts`: 0, 1.8, 3.6 s by s09's own `ROW_T`). The puff and the click are read above 4 kHz, where the A3 voice has nothing (a 1 ms sliding peak, against that burst's own top); the tone is read on its fundamental (165 to 293 Hz), whose envelope cannot turn faster than about 8 ms, so the catch's 10 ms rise reads a little slower than it is. The kit draws: air, the tone's level rising from 0.25 to 0.5 s (a smoothstep); a catch, the mark at 0.15 s and the wave at full from there; together, the level rising over the first 0.06 s (`L.TRACE.level`).

| Start | At (film) | First sound at | Burst from (10 %) | Burst to (10 %) | Tone at 10 % | 50 % | 90 % | FACTS 80 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `start-air` | 243.900 | 0.0003 s | 0.0297 s | 0.3950 s | 0.299 s | 0.375 s | 0.451 s | noise 0 to 0.35 s; tone rising from 0.25 s over 0.25 s (10 % 0.299, 50 % 0.375, 90 % 0.451 on the drawn level) |
| `start-catch` | 252.930 | 0.1500 s | 0.1500 s | 0.1542 s | 0.154 s | 0.158 s | 0.162 s | silence to 0.15 s; a 3 ms click; tone at full within 10 ms (by 0.163 s) |
| `start-together` | 259.660 | 0.0003 s | none (under -111 dBFS) | none | 0.012 s | 0.030 s | 0.048 s | tone rising over 60 ms (10 % 0.012, 50 % 0.030, 90 % 0.048 on the drawn level); no noise, no click |
| `starts: air` | 266.230 | 0.0003 s | 0.0297 s | 0.3950 s | 0.299 s | 0.375 s | 0.451 s | noise 0 to 0.35 s; tone rising from 0.25 s over 0.25 s (10 % 0.299, 50 % 0.375, 90 % 0.451 on the drawn level) |
| `starts: catch` | 268.030 | 0.1500 s | 0.1500 s | 0.1542 s | 0.154 s | 0.158 s | 0.162 s | silence to 0.15 s; a 3 ms click; tone at full within 10 ms (by 0.163 s) |
| `starts: together` | 269.830 | 0.0003 s | none (under -111 dBFS) | none | 0.012 s | 0.030 s | 0.048 s | tone rising over 60 ms (10 % 0.012, 50 % 0.030, 90 % 0.048 on the drawn level); no noise, no click |

"First sound at" is the first sample over -90 dBFS: before it the stem is silent. The puff is the page's burst on the page's envelope (an exponential rise over 40 ms, held to 0.35 s, a 20 ms decay), so its 10 % points sit about 0.03 s inside its 0 and just past its 0.35 s. The tone ends inside each start: its release closes at 1.6 s, so the 0.2 s between the rows of `starts` is silent.

Between the rows of `starts` the stem is digital silence both times (the room tone is in its own stem).

## 4. No voice over a sound (BRIEF § Audio)

On the cue sheet, and in the stems: for every example, sung note and the hold, the nearest line each side, and the voice stem's largest sample inside the sound (the room tone is in its own stem, so silence there is digital).

| Sound | From, to | Line before ends | Gap | Line after starts | Gap | Voice stem inside | Examples stem 0.1 s each side |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `easy` | 0.600 to 4.600 | none |  | `o1` 5.100 | 0.50 s | silent | silent, silent |
| `pushed` | 21.210 to 25.210 | `b1` 18.560 | 2.65 s | `b3` 25.410 | 0.20 s | silent | silent, silent |
| `push` | 86.760 to 92.360 | `b8` 86.360 | 0.40 s | `o5` 92.660 | 0.30 s | silent | silent, silent |
| `gauge` | 124.980 to 134.980 | `b12` 122.280 | 2.70 s | `b13` 135.180 | 0.20 s | silent | silent, silent |
| `start-air` | 243.900 to 245.500 | `b25` 243.550 | 0.35 s | `b26` 245.800 | 0.30 s | silent | silent, silent |
| `start-catch` | 252.930 to 254.530 | `b26` 252.580 | 0.35 s | `b27` 254.830 | 0.30 s | silent | silent, silent |
| `start-together` | 259.660 to 261.260 | `b27` 259.310 | 0.35 s | `b27a` 261.610 | 0.35 s | silent | silent, silent |
| `starts` | 266.230 to 271.430 | `b27a` 265.880 | 0.35 s | `b28` 271.930 | 0.50 s | silent | silent, silent |
| `demo` | 294.815 to 304.815 | `b29` 294.415 | 0.40 s | `o12` 305.115 | 0.30 s | silent | silent, silent |
| `listen` | 407.140 to 409.140 | `b41` 406.540 | 0.60 s | `b42` 409.240 | 0.10 s | silent | silent, silent |
| `tick-in` | 411.280 to 411.380 | `b42` 410.180 | 1.10 s | `b43` 422.180 | 10.80 s | silent | silent, silent |
| `hold` | 411.380 to 421.380 | `b42` 410.180 | 1.20 s | `b43` 422.180 | 0.80 s | silent | silent, silent |
| `tick-out` | 421.380 to 421.480 | `b42` 410.180 | 11.20 s | `b43` 422.180 | 0.70 s | silent | silent, silent |
| `twinkle` | 529.135 to 533.135 | `b59` 528.785 | 0.35 s | `b60` 533.335 | 0.20 s | silent | silent, silent |

**No line overlaps a sound or the hold on the cue sheet.**

Every take is as long as its cue (no take runs past its line's end).
No example, effect, pad or chime sounds under any line: under the lines, only the room tone.

## 5. The bed and the silences (FACTS 81, DECISIONS 215)

From `stems/bed.wav` as delivered. A window is the gap between two lines, sounds or stings that holds an act mark or a dressed pause, less 0.35 s after a line and 0.25 s before one (0.6 and 0.5 round a sound), the pad swelling across each edge over 0.35 s.

| Holds | After, before | Pad sounds | At full level | RMS at full | Peak |
| --- | --- | --- | --- | --- | --- |
| `predict` | `b1`, `pushed` | 18.74 to 20.88 s | 19.09 to 20.54 s | -31.9 dBFS | -19.6 dBFS |
| `hook` | `o2`, `title` | 37.79 to 38.98 s | 38.13 to 38.63 s | -28.4 dBFS | -19.6 dBFS |
| `q0` | `o3`, `b6` | 57.86 to 60.25 s | 58.20 to 59.91 s | -32.4 dBFS | -19.6 dBFS |
| `act1` | `b6`, `o4` | 66.14 to 68.79 s | 66.49 to 68.44 s | -32.8 dBFS | -19.6 dBFS |
| `act2` | `b9`, `o6` | 102.35 to 104.99 s | 102.69 to 104.64 s | -32.8 dBFS | -19.6 dBFS |
| `predict2` | `b12`, `gauge` | 122.46 to 124.65 s | 122.81 to 124.31 s | -32.0 dBFS | -19.6 dBFS |
| `act3` | `b20`, `o9` | 207.51 to 210.16 s | 207.86 to 209.81 s | -32.8 dBFS | -19.6 dBFS |
| `act4` | `b22`, `o10` | 227.90 to 230.54 s | 228.25 to 230.19 s | -32.8 dBFS | -19.6 dBFS |
| `act5` | `b28`, `o11` | 284.97 to 287.61 s | 285.31 to 287.26 s | -32.8 dBFS | -19.6 dBFS |
| `sing` | `b33`, `b34` | 346.05 to 348.69 s | 346.39 to 348.35 s | -32.8 dBFS | -19.6 dBFS |
| `feel` | `b43`, `b44` | 426.98 to 429.23 s | 427.33 to 428.88 s | -32.1 dBFS | -19.6 dBFS |
| `recap` | `b46a`, `b47` | 461.50 to 462.74 s | 461.85 to 462.39 s | -28.5 dBFS | -19.6 dBFS |
| `q1` | `b48`, `b49` | 466.55 to 468.74 s | 466.89 to 468.39 s | -32.0 dBFS | -19.6 dBFS |
| `q3` | `b51`, `b52` | 475.17 to 477.36 s | 475.51 to 477.01 s | -32.0 dBFS | -19.6 dBFS |
| `q4` | `o14a`, `b54` | 484.68 to 487.18 s | 485.03 to 486.83 s | -32.5 dBFS | -19.6 dBFS |
| `break` | `b54`, `b55` | 489.89 to 491.83 s | 490.24 to 491.49 s | -31.5 dBFS | -19.6 dBFS |
| `next`, `card` | `b58`, `b59` | 525.02 to 527.67 s | 525.37 to 527.32 s | -32.8 dBFS | -19.6 dBFS |

Under the lines the bed's largest sample is digital silence; under the sounds, digital silence; under the chimes, -40.0 dBFS (`title`: the pad's last 0.18 s under the title's first note). In `heard` digital silence, `breathe` digital silence, `hold` digital silence, `tick-in` digital silence, `tick-out` digital silence.

The room tone: `hold`'s ten seconds read -55.5 dBFS RMS in `full.wav` (peak -42.3 dBFS), and nothing else sounds there.
Over the whole film the quietest 50 ms of `full.wav` (from 0.1 s to 0.5 s before the end) reads -57.0 dBFS RMS: it never falls to digital silence.

## 6. The landings, the whooshes and the chimes

Merc's landings come from s13's rule, read by `tools/sound-kit.mjs`: `HOP1 = at('break', 'start', 0.6)`, `HOP2 = at('break', 'start', 1.25)`, each move `at: HOPn + L.HOP.crouch` (0.12 s) for `L.HOP.air` (0.41 s): take-off 490.43 and 491.08, landing 490.84 and 491.49 s.

| Landing | Onset in `stems/fx.wav` | Peak | Pad peak in `break` | Against the pad | Gone (40 dB down) after |
| --- | --- | --- | --- | --- | --- |
| 490.840 s | 490.8403 s (+0.3 ms) | -22.6 dBFS | -19.6 dBFS | -3.0 dB | 271 ms |
| 491.490 s | 491.4903 s (+0.3 ms) | -22.6 dBFS | -19.6 dBFS | -3.0 dB | 271 ms |

For scale, the narration: a line's loudest 50 ms reads -13.4 to -8.4 dBFS RMS (median -10.4), and -26.9 to -13.3 (median -15.9) in 2 to 8 kHz, over the film's 71 lines (`stems/voice.wav`).

| Whoosh | From, to | Peak at | Cut (mark - 0.15) | Next line | Sample peak | Loudest 50 ms | Under the narration's | In 2-8 kHz, under the narration's | Under 150 Hz | Over 6 kHz | Rise (10 to 90 %) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `act1` | 66.215 to 66.915 s | 66.61 s | 66.515 s | 68.865 s | -15.5 dBFS | -25.1 dBFS | 14.7 dB | 24.1 dB | 0.00 % | 0.00 % | 236 ms |
| `act2` | 102.420 to 103.120 s | 102.82 s | 102.720 s | 105.070 s | -16.1 dBFS | -25.4 dBFS | 14.9 dB | 23.8 dB | 0.00 % | 0.00 % | 215 ms |
| `act3` | 207.585 to 208.285 s | 207.94 s | 207.885 s | 210.235 s | -15.5 dBFS | -25.3 dBFS | 14.8 dB | 23.8 dB | 0.00 % | 0.00 % | 246 ms |
| `act4` | 227.970 to 228.670 s | 228.33 s | 228.270 s | 230.620 s | -16.2 dBFS | -25.5 dBFS | 15.0 dB | 24.5 dB | 0.00 % | 0.00 % | 240 ms |
| `act5` | 285.040 to 285.740 s | 285.45 s | 285.340 s | 287.690 s | -15.6 dBFS | -26.0 dBFS | 15.5 dB | 24.4 dB | 0.00 % | 0.00 % | 223 ms |
| `sing` | 346.120 to 346.820 s | 346.43 s | 346.420 s | 348.770 s | -14.7 dBFS | -25.3 dBFS | 14.8 dB | 23.8 dB | 0.00 % | 0.00 % | 214 ms |
| `recap` | 462.070 to 462.770 s | 462.39 s | 462.370 s | 462.820 s | -15.1 dBFS | -25.3 dBFS | 14.8 dB | 23.5 dB | 0.00 % | 0.00 % | 213 ms |
| `next` | 527.045 to 527.745 s | 527.45 s | 527.395 s | 527.745 s | -15.0 dBFS | -25.8 dBFS | 15.4 dB | 23.7 dB | 0.00 % | 0.00 % | 221 ms |

The same reading, loudest 50 ms, for the rest: a tick -36.4 dBFS (26.0 dB under); a landing -29.6 dBFS (19.2 dB under); the pad at a swell's top -27.1 dBFS (16.6 dB under); the title chime -19.4 dBFS (8.9 dB under); `listen` -16.6 dBFS (6.2 dB under); `gauge` -21.0 dBFS (10.6 dB under); `demo` -21.8 dBFS (11.3 dB under); `pushed` (its last second) -15.3 dBFS (4.9 dB under).

| Chime | First note | Notes | Stagger | Peak in full.wav | Rings to (60 dB down) |
| --- | --- | --- | --- | --- | --- |
| `title` | 38.860 s | A3 E4 A4 C#5 E5 | 0.09 s | -10.9 dBFS | 41.83 s |
| `end` | 543.365 s | A3 E4 A4 C#5 A5 | 0.12 s | -12.7 dBFS | 548.18 s |

## 7. The stems and the mix

Each file as delivered (48 kHz, 24 bit, the same on both channels), by FFmpeg's `ebur128` (EBU R128, gated; true peak 4 times oversampled). The mixer balances each stem on a one-channel reading, 3.0 LU under these (Lesson 4's targets: voice -18, examples -21, stings -26, whooshes -30, bed -34, room tone -55), then sets one gain for everything.

| File | Integrated | Against the voice | Range | True peak | Sample peak | Balance (one channel): measured, target, gain |
| --- | --- | --- | --- | --- | --- | --- |
| `stems/voice.wav` | -15.7 LUFS | +0.0 LU | 5.4 LU | -1.5 dBTP | -2.2 dBFS | -23.8 LUFS, -18.0, +5.8 dB |
| `stems/examples.wav` | -18.2 LUFS | -2.5 LU | 11.7 LU | -9.9 dBTP | -9.9 dBFS | -15.2 LUFS, -21.0, -5.8 dB |
| `stems/stings.wav` | -23.2 LUFS | -7.5 LU | 17.7 LU | -10.9 dBTP | -10.9 dBFS | -22.9 LUFS, -26.0, -3.1 dB |
| `stems/fx.wav` | -28.2 LUFS | -12.5 LU | 14.7 LU | -14.7 dBTP | -14.7 dBFS | -30.2 LUFS, -30.0, +0.2 dB |
| `stems/bed.wav` | -31.2 LUFS | -15.5 LU | 14.3 LU | -19.6 dBTP | -19.6 dBFS | -40.2 LUFS, -34.0, +6.2 dB |
| `stems/floor.wav` | -52.3 LUFS | -36.6 LU | 0.3 LU | -40.5 dBTP | -40.5 dBFS | 0.3 LUFS, -55.0, -55.3 dB |

| Mix | Integrated | Range | True peak |
| --- | --- | --- | --- |
| `assets/audio/full.wav` | -16.0 LUFS | 4.8 LU | -1.5 dBTP |
| `assets/audio/music-only.wav` | -30.1 LUFS | 19.5 LU | -10.9 dBTP |
| the review cut (AAC 256k) | -16.1 LUFS | 4.8 LU | -1.5 dBTP |

The six stems add up to `full.wav` within -132 dBFS, and bed + stings + floor to `music-only.wav` within -132 dBFS (24-bit rounding); both channels of `full.wav` are identical.

Before the last gain the mix read -15.8 LUFS, -1.3 dBTP; the gain is -0.20 dB (target -16.0 LUFS, true peak -1.2 dBTP or lower). The peak limiter (ceiling -2 dBFS before that gain, 5 ms look-ahead, 120 ms release) takes at most 6.7 dB, at 42.51 s, and is at work for 142 s of the film's 549 (its release included); section 8 says where.

## 8. The limiter

`full.wav`'s samples reach the limiter's ceiling (-2.2 dBFS after the last gain) in 397 of its 10989 50 ms windows (19.9 s).
By kind: line 397. The most in one cue: `b37` 15, `b46a` 15, `b28` 14, `b14` 13, `b18` 13, `b20` 13.
By the mixer's own count it holds the mix down by more than 1 dB for 22.0 s and by more than 3 dB for 3.8 s (its 120 ms release included); the most is 6.7 dB at 42.51 s. Only narration reaches it: of the other stems the highest sample is the examples stem's, -9.9 dBFS, 7.7 dB under the ceiling.

## 9. The starts against S9's drawn traces (DECISIONS 194)

The picture is `renders/film-draft-02.mp4` (30 frames a second; frame n shows the film at n / 30 s, the video stream starting at 0 like the sound). In each frame the trace's head is the rightmost bright stroke in the strip (the wave is drawn up to the head, flat until its tone starts; a finished trace behind it is a 30 % ghost and is not counted). The trace draws at x = 700 + 562.5 t (`L.TRACE`), so the head's place is the picture's own time for that start, and the frame's time less the start's cue (or its row in `starts`) is the sound's.

**The picture's clock against the sound's**, over each start's first 0.5 s:

| Start | Cue (film) | Frames read | Picture - sound, mean | Worst | In pixels of the head (mean) |
| --- | --- | --- | --- | --- | --- |
| `start-air` | 243.900 s | 15 | -3.5 ms | -4.9 ms | -2.0 px |
| `start-catch` | 252.930 s | 14 | -3.0 ms | -5.1 ms | -1.7 px |
| `start-together` | 259.660 s | 15 | -2.6 ms | -3.6 ms | -1.4 px |
| `starts: air` | 266.230 s | 14 | -3.4 ms | -5.1 ms | -1.9 px |
| `starts: catch` | 268.030 s | 14 | -3.1 ms | -5.1 ms | -1.7 px |
| `starts: together` | 269.830 s | 14 | -2.3 ms | -3.3 ms | -1.3 px |

One pixel of the head is 1.8 ms. The head reads 1 to 3 px short of its drawn place in every frame (the stroke's tip is anti-aliased and the encoder softens it; a tip counts from luma 150), which is the whole of the mean above: the trace is drawn on the sound's clock.

**Each onset, in the sound and in the picture.** The picture can show an onset only in the first frame at or after it, so it follows the sound by up to one frame (33.3 ms here; 16.7 ms in the 60-frame final) and never leads it. Where a cue falls 3 ms before a frame, that frame holds a line under 2 px long, which cannot be read, and the next frame is counted (36.7 ms). "Passed x" allows the 3 px the head reads short.

| Start | Onset | Sound (film) | During frame | Picture: first frame showing it | Picture after sound |
| --- | --- | --- | --- | --- | --- |
| `start-air` | the puff begins (0 s) | 243.900 s | 7317 (243.900 to 243.933 s) | 7318 (243.933 s): the first dots and the line, more than 2 px long | +33.3 ms |
| `start-air` | the tone at 10 % (0.299 s on the drawn level; 0.299 s measured) | 244.199 s | 7325 (244.167 to 244.200 s) | 7326 (244.200 s): its head has passed x 868, where the wave is drawn at 10 % | +0.6 ms |
| `start-catch` | the trace begins (0 s: silence, a flat line) | 252.930 s | 7587 (252.900 to 252.933 s) | 7589 (252.967 s): the line, more than 2 px long | +36.7 ms |
| `start-catch` | the click (0.15 s; 0.1500 s measured) | 253.080 s | 7592 (253.067 to 253.100 s) | 7593 (253.100 s): the mark stands, 220 px tall | +20.0 ms |
| `start-together` | the tone begins (0 s) | 259.660 s | 7789 (259.633 to 259.667 s) | 7790 (259.667 s): the wave from the gold tick, more than 2 px long | +6.7 ms |
| `start-together` | the tone at 10 % (0.012 s on the drawn level; 0.012 s measured) | 259.672 s | 7790 (259.667 to 259.700 s) | 7791 (259.700 s): its head has passed x 707, where the wave is drawn at 10 % | +28.2 ms |
| `starts: air` | the puff begins (0 s) | 266.230 s | 7986 (266.200 to 266.233 s) | 7988 (266.267 s): the first dots and the line, more than 2 px long | +36.7 ms |
| `starts: air` | the tone at 10 % (0.299 s on the drawn level; 0.299 s measured) | 266.529 s | 7995 (266.500 to 266.533 s) | 7996 (266.533 s): its head has passed x 868, where the wave is drawn at 10 % | +3.9 ms |
| `starts: catch` | the trace begins (0 s: silence, a flat line) | 268.030 s | 8040 (268.000 to 268.033 s) | 8042 (268.067 s): the line, more than 2 px long | +36.7 ms |
| `starts: catch` | the click (0.15 s; 0.1500 s measured) | 268.180 s | 8045 (268.167 to 268.200 s) | 8046 (268.200 s): the mark stands, 140 px tall | +20.0 ms |
| `starts: together` | the tone begins (0 s) | 269.830 s | 8094 (269.800 to 269.833 s) | 8096 (269.867 s): the wave from the gold tick, more than 2 px long | +36.7 ms |
| `starts: together` | the tone at 10 % (0.012 s on the drawn level; 0.012 s measured) | 269.842 s | 8095 (269.833 to 269.867 s) | 8096 (269.867 s): its head has passed x 707, where the wave is drawn at 10 % | +24.9 ms |

