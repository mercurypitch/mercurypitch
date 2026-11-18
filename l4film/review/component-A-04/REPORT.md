# Component A-04: s01 to s04 (verification)

**Group: KEEP.** All four scenes are KEEP: s01-cold-open, s02-title, s03-promise and s04-recall. Every item from A-03 is fixed except the empty lower third, which comes from the board's framing. Nothing new broke. What remains is optional or for the director to decide.

All times are film times. Your message made no claims about fixes, so there was nothing to set aside. I diffed every frame of these clips against A-03's render in `scratchpad/l4entr/a3`. Only four windows changed:
- s01 33.22–33.27: discs slightly brighter for 3 frames, which you cannot see.
- s02 34.20–34.58.
- s03 42.25–42.97 and 45.20–46.20.
- s04 68.06–69.20.

The rest is unchanged, and the decoded audio is bit-identical in all four clips.

## Previous items
1. **s04 "measure" beat: FIXED.** The fills go from luma 33 to 100 one stair at a time, 68.10 to 68.85 ("measure" is spoken at 68.04). All eight stay lit until 69.0 and are back to 33 by 69.25. The last frame matches A-03's handoff frame, and the beat reads plainly on the 384 px tiles.
2. **s02 snap: FIXED.** Mean luma every 0.05 s is now 116, 92, 56, 34, 25 (it was 116, 35). Lesson 2 measures 122, 93, 61, 38.
3. **s03 parallax: FIXED.**
   - At 45.8 the near discs measure 37–53 against a ground of 16. At the same frame in A-03's render they were 31–45.
   - Between 45.5 and 46.0 the discs travel about 130 px while the stairs travel 70 px.
   - The brightening covers about 45.2–46.2, the fast part of the move.
4. **s03 stair-1 stutter: FIXED.** Stair 1 rises to 101 over 42.18–42.43 and stays lit until the naming wave reaches it at 43.15, then fades with the wave. It never dips.
5. **s04 empty lower third: STILL PRESENT.** It is unchanged; see problem 1.
6. **HANDOFFS leftovers: FIXED.** § Camera moves now says "pass-through", and § Inside A has no "(provisional)" marks left. The board now describes the tile pulses as "one after another, counted", which matches the render.

## Shots as read
- **s01:** wide shot, eye level, static camera with its drift. A pass-through into the house's glow runs 32.95–33.88, then the field holds 0.3 s.
- **s02:** full-frame type, centre symmetry. The field collapses into the bead over 34.18–34.45, then the staff dissolves into the staircase on D.
- **s03:** wide shot, static. The riser run, then the slide to C; stair 1 lights and holds into the naming wave. Then a pull-out and pan to F0, with visible parallax.
- **s04:** wide shot at F0, static. In order: the tiles, q0, the brackets, the stand-up, the numerals, Tavi, the "?", the risers, and the new stair-by-stair wave on "measure".
- **Against the board:** no differences.

## Problems, ranked
1. **s04 60.4–69.35, y 740–1080 and x 1200–1680.** The staircase fills about 50% of the frame's width and 36% of its height for 9 s. From 68.5 to 69.35 it is the only thing on screen.
   - Option, as in A-03: bring the strip in on "measure". That moves the A-to-B handoff, so it is for the director and builder B to decide.
   - Not blocking: Lesson 2's keyboard frames are about as sparse.
2. **s04 68.10–69.25, a repeat of s03 42.9–43.8.** The measuring wave copies the naming wave: the same fill (luma 100 against 101), the same 0.1 s spacing and the same direction. It reads, but two different actions get one picture.
   - Optional fix: on "measure", sweep the riser bars in turn (4 to 8 px, ink, 0.1 s apart) instead of the fills, so the beat points at the steps rather than the stairs.
3. **s02 34.20–34.43, centre.** The collapse now lasts 15 frames, so you can see its shape: it shrinks as a soft glow, falling from luma 109 to 35 over about 200 px. Lesson 2's is a hard-edged disc, dropping from 66 to 19 within about 24 px. The glow's halo also washes over note 3 and the ♯ (34.35–34.43).
   - Fix: bring the field's blur to 0 by about 34.28, so a crisp disc closes onto the staff.

## Measured
- **Holds**, none longer than 0.1 s:
  - s01: 0.2 s in total.
  - s02: none.
  - s03: 0.1 s, plus a 0.2 s final hold.
  - s04: 0.4 s, plus a 0.1 s final hold.
- **Low motion:** in s04, 62.55–67.75 is carried by Tavi talking, the "?" (64.25) and the risers brightening (66.25).
- **Word timing**, against the scratch cues in `cues.json`:

  | Word | Spoken | On screen |
  | --- | --- | --- |
  | "Seven letters" | 54.81 | white tiles from 54.85 |
  | "steps?" | 64.19 | "?" at 64.25 |
  | "bigger" | 66.22 | risers at 66.25 |
  | "measure" | 68.04 | wave from 68.10 |

- **Contrast:** the ink names on the lit fill, rgb(93,101,113), measure about 4.9:1.
- **Loudness:**

  | Scene | Integrated | True peak |
  | --- | --- | --- |
  | s01 | −16.0 LUFS | −1.8 dBTP |
  | s02 | −22.1 LUFS | −10.7 dBTP |
  | s03 | −16.4 LUFS | −2.0 dBTP |
  | s04 | −15.5 LUFS | −1.5 dBTP |

- **Facts:** no on-screen text was added or changed.

## Not judged
- **The mix by ear.** It is bit-identical to A-03's.
- **Timing against the final voice.** I checked the scratch cues only, not the voiced takes.
- **Viewing on a real phone.**

## Files
- This harness does not let me write report files, so I did not write `/home/user/mercurypitch/output/motion/lesson-04/review/component-A-04/REPORT.md`. Please save this text there.
- I did not read the builder's notes kept in the scratchpad (`A-fix*-msg.txt`, `A-round*-report.txt`).
- My working dumps were in `/dev/shm/critA04`, and I deleted them along with my helper scripts.
