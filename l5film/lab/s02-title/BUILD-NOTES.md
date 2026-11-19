# s02-title: build notes (group A)

`compositions/s02-title.html`, 3.6 s on the scratch clock (film 38.81 to 42.41). STORYBOARD row 2; HANDOFFS
§ Carried (the title), § The cuts S1 to S2 and S2 to S3.

Lesson 4's `s02-title` ported onto this kit with this film's line: `L.field` (S1's field), `L.TITLE` (the staff's
displacement, the zoom, the chimes, the bead's flight), `L.staff`, `L.note`, `L.clef`, `L.sharp`, `L.bead`. Lesson 4's
note colours kept (A3 blue, A4 orange, the rest chrome); its kicker rules, chrome title gradient, sheen and the
"Find Your **Pitch**" spectrum kept.

## Fix round (critic A-01): the chart fades up 0.2 s earlier (DECISIONS 176)

- The chart (band, strip, "A3", "level") fades up from `title` + LIFT - 0.2 over TT.FLY (1.0 s, sine.inOut), in s02
  and s03 alike (`FADE_UP`), so the bead never flies over an empty frame. Probe: the band's group at 0.11 at 2.73,
  0.47 at 3.00, 0.89 at 3.30 and 1.0 on the last frame, which s03's first frame matches (1.0); the bead's flight
  still clears "A3"'s ink by 12 px or more on every sampled frame. Probe: 50 lines, all pass.
- Clip (with its scratch voice): `clip.mp4`; stills `clip-still-*.png` (0, 1.5, 2.73, 3.0, 3.3, 3.4, 3.5, 3.59); the
  last 0.9 s frame by frame (every other frame): `end-sheet.png`.
- measure.py (`measure/summary.md`): no holds; one low-motion run (0.4 s at 2.10); jumps at 1.37, 1.87, 1.97 (the
  living staff and the bobbing notes, as before). Round 2's clip and measure: `round2/`.

## Rows and anchors (scene time; `title` is 0)

| What | Anchor | Scratch time |
| --- | --- | --- |
| field shrinks into the bead (radius power2.out, centre power3.out, rim crisp over 0.1 s) | 0 (the cut) | 0 to 0.46 |
| five chimes' notes hop in, ripples | `L.TITLE.CHIME(k)` = title + 0.05 + 0.09 k | 0.05 to 0.41 |
| title, then "LESSON 05" | `at('title', 'start', 0.26)`, + 0.1 | 0.26, 0.36 |
| "Find Your Pitch" | `at('title', 'start', 0.76)` | 0.76 |
| type and notes exit up | `at('title', 'start', 2.42)` | 2.42 |
| bead lifts off; staff fades (0.6 s); chart fades up at F-promise-a | `L.cue('title', 'start', L.TITLE.LIFT)` (film time) | 2.72 |
| bead in flight to A3 (sine.out, 1.0 s), amber over its last 0.3 s | `L.TITLE.flight(T)` (film time) | 2.72 to 3.72 (lands in s03) |

The chart (band, "A3", the strip's hairline, "level"; Merc's line not drawn) is drawn in the world at
F-promise-a by its own rig (`from: 'F-promise-a'`); the staff, notes and type are in a separate layer zoomed 4 %
about the centre (`L.TITLE.zoom`), as Lesson 4's s02 did, so the chart never rides the title's zoom. The chart's
fade-up is one film-time curve (`L.prog(T, LIFT_F, 1.0, 'sine.inOut')`) that s03 continues.

## Proof

- Stills: `still-0.00.png` ... `still-3.59.png`, sheet `sheet.png` (0.25, 0.6, 1.0, 1.6, 2.6, 2.85, 3.0, 3.3, 3.59).
- Clip: `clip.mp4` (30 fps draft, with the scratch voice and sting); `measure/summary.md`.
- measure.py: holds 0.0 s; one low-motion run 0.4 s (2.10, the type at rest while the notes bob and the staff lives);
  three "jumps" (1.37, 1.87, 1.97 s, 0.2 to 0.7 % of pixels): frame diffs put them on the living staff and the
  bobbing notes across the frame (continuous motion, no element appearing).
- `check lab/s02-title/proj --at=1.5,2.2`: layout 0 issues, contrast 13/13.
- Probe (`probe.json`, `node lab/s01-cold-open/probe.mjs s02-title`): first frame's field (960, 540), r 1500, opaque,
  as S1's last; the bead's flight sampled every 0.055 s against "A3"'s real ink (Outfit 600 48 at F-promise-a).

## Handoffs

- **S1 to S2**: S1's last clip frame against S2's first: mean abs difference 0.30 of 255, no pixel over 24, luma
  114.8 both (the field breathes and its grain steps; nothing else).
- **S2 to S3** (HANDOFFS provisional, confirmed): s02's last frame bead (487.78, 395.77) r 17.76, s03's first
  (487.72, 395.81) r 17.72, the same `L.TITLE.flight` from film time; clip frames across the cut differ by 0.34
  of 255 (0.03 % of pixels over 24). The flight clears "A3" by 24.6 px at its closest (s03 0.02 s, the bead r 16)
  and lands at (480.0, 400.0). It clears the top staff line 0.055 s after it lifts (the staff still at 97 %): it
  lifts off its rest on the middle line, so it crosses the upper two lines in its first two frames.

## Open

- The bead keeps Lesson 4's chrome until its last 0.3 s, then turns amber as it shrinks (the kit's `flight`).
