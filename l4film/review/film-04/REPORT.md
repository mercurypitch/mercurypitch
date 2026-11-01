# Film round 4 (verification): film-04.mp4

**Verdict: SHIP.** Round 3 asked for three fixes, and all three are done: the floor box is gone, the Mercs at 5:42 now land 0.38 s apart, and the end card holds for 5.1 s. Everything left is cosmetic or a matter of taste, so the polish list below is optional.

Compared frame by frame with film-03, the picture changed only at 4:16.05–4:16.15, at 5:42.0–5:44 (plus the floor under the Mercs after that) and on the end card from 7:59.4. Everything else is pixel-identical. The mix differs only by encoding noise.

No opinions were passed to me. I left STORYBOARD.md and HANDOFFS.md unread so my reading of the shots stays independent. I am not allowed to write report files here, so please save this text to `review/film-04/REPORT.md`.

## Previous items
1. **Floor box, 5:44–6:42: FIXED.** The vertical edges at x≈130 and x≈1820 are gone. The lit floor now runs out to the frame edge and fades out on the inner side, behind each Merc.
2. **Mercs dropping from the top: PARTLY.**
   - At 5:42 the Mercs are now staggered: Tavi lands at 5:42.68 and Merc at 5:43.07. The frame-exact sheet is clean.
   - Drops from the top remain at 1:01.6, 2:27.6, 4:09.2, and both Mercs at 5:42.
3. **End card: FIXED.** It is complete from 7:59.6 and the film ends at 8:04.73. It keeps moving to the end (slow push, idles); there is no frozen final hold.
4. **Recall, 0:46.8–0:47.8: STILL PRESENT.** The frames are unchanged, including the 0.3 s hold.
5. **Pill roll at 4:16: STILL PRESENT.** The outgoing "do = C?" still rises above the pill's top border from 4:16.08 to 4:16.13. That is 4 frames, one fewer than before.
6. **Cosmetic items:**
   - 7:58.45: the moment with only the Mercs and a bead is unchanged and still acceptable.
   - 0:34.5: the title's blur-to-sharp is STILL PRESENT.
7. **Earlier FIXED items stay FIXED** (identical frames): empty frame before the tease, brackets, countdown ring, tangled outlines, tile stack, tone rise, tease to end card, small subject.
8. **Monotony: PARTLY, unchanged.** The uniform zoom-ins remain at 1:20.2, 2:03.6, 3:06.0, 4:05.0 and 4:31.4.

## Shots as read (changed spans only; the rest reads as in round 3)
- **4:15.9–4:16.2:** the pill grows, then its text rolls up.
- **5:41.6–5:43.4:** a static wide on the "4 Sing it" chapter card.
  - Tavi falls in from the top right (5:42.2–5:42.68), then Merc from the top left (5:42.6–5:43.07). Both squash and splash on landing.
  - The card fades at 5:43.4, and the staircase tips into the guide lanes at 5:44.
- **7:58.45–8:04.73:** the end card builds by 7:59.6, then holds over a slow push.

## Problems, ranked (all optional)
1. **Drops from the top edge, four times** (1:01.6, 2:27.6, 4:09.2, 5:42). Fix: turn 2:27.6 and 4:09.2 into floor-level side leaps, like the one at 3:18.3.
2. **Floor glow arrives before its Merc, bottom corners.**
   - On the right it fades on at 5:42.1–5:42.2, about 0.5 s before Tavi lands. On the left it fades on at 5:42.5–5:42.6, about 0.5 s before Merc lands.
   - Each time, a grey floor strip with a hard top edge at y≈840 appears in an empty corner.
   - Fix: tie the strip's opacity to the fall, so it reaches full on the landing frame.
3. **Pill at 4:16.08–4:16.13, top right.** Fix: clip the outgoing label to the pill's inner box.
4. **Recall at 0:46.8.** Fix: carry the staircase into the tiles instead of swapping it, and drop the 0.3 s hold.
5. **The 0:34.5 title blur, and the five uniform zoom-ins.**

## Numbers
- **Holds:** 11.9 s in total (0.7 s per 30 s); the longest is 0.5 s at 4:30.2; no final hold.
- **Single-frame events:** the same 20 as film-03; none are new at 5:42. The end card's small jumps (8:00.85–8:03.57) each change 0.2–0.4% of pixels.
- **Floor at the feet line:** 8–13 levels brighter than the background from the frame edge to each Merc, and 0 on the inner side. The strongest vertical edge is 1.1 levels; film-03's box edges measured 2.3–3.3.
- **Loudness:** −16.0 LUFS integrated, LRA 5.2 LU, true peak −1.5 dBTP.
- **Mix against film-03:** the difference sits 25–30 dB under the signal throughout, which is encoding noise.
- **Whooshes:** unchanged, at 69.1, 145.8, 229.0, 341.0 and 405.2 s.
- **End sting:** it decays to room tone (−55 dBFS) by 8:01.5, so the last 3.2 s are silent apart from room tone.
- **Claims:** no new text on screen.

## For a human
- **End:** listen to the 3 s of near-silence under the end card.
- **Voices:** the voices are still the scratch takes. Re-voicing them means a new render and a new critic round.
- **Phone speakers:** check the mix, the whooshes and the silence on the viewer's turn on phone speakers.
- **Floor strip:** look at it on an OLED phone after YouTube's encoding.
- **Captions:** they are not in the render.

## Files
Everything is in `/home/user/mercurypitch/output/motion/lesson-04/review/film-04/`:
- `measure/` (`summary.md`, `audio.md`, sheets)
- `dense/` (20 fps sheets)
- `exact/` (frame-exact sheets at 4:16.08, 5:42.45 and 5:43.0)

I deleted my scratch files; the films in `/dev/shm/l4film` are untouched. My cleanup removed loose `.png`/`.jpg` files from the top level of the scratchpad folder I share with you, not only my own. Your notes reference none there, but check you lost nothing.
