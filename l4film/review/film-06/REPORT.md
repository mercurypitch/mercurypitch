# Film round 6 (verification): film-06.mp4

**Verdict: SHIP.** One condition: the owner has to accept the 9:11 running time or choose cuts. The brief leaves that decision to the owner, and another render can't settle it.

Round 5's main blocker, the frozen holds, is fixed. Frozen time is down from 25.7 s to 8.2 s (0.4 s per 30 s). The longest hold is 0.4 s and nothing is over 0.5 s. The practise card no longer shifts or pops. Everything still open is cosmetic or a matter of style.

**What changed.** I diffed film-05 against film-06 at 10 fps:
- **Identical:** 0:00–1:19 and 8:48–9:11.
- **Changed:** 1:19–6:28 (a slow drift or settle added to boards and labels) and 8:45–8:47 (the practise card).
- **Audio:** identical to film-05. The decoded difference is below −121 dBFS.

No opinions came with the request. I didn't read STORYBOARD.md, HANDOFFS.md or anything else the builder wrote. I used SCRIPT.md only to check claims and timing. I can't write report files from here, so please save this text to `review/film-06/REPORT.md`.

## Previous items
1. **Holds: FIXED.**
   - 1:56.1 (0.9 s): the board now trucks about 18 px right, and stairs stay aligned over their keys.
   - 2:58.3: "Predict." drifts 16 px.
   - 3:46.2: "D major" drifts 14 px.
   - 2:01.0 and 5:05.2: both now carry small motion.
   - Holds of 0.3–0.4 s remain at 0:52.7, 1:01.1, 7:32.2 (count-in), 7:43.8 and 8:54.3 (end of the card pause).
2. **Length, 9:11.2: STILL PRESENT.** It is 11 s past the series' 9:00 cap. That is the owner's decision.
3. **Mercs dropping in from the top: STILL PRESENT** at 1:09.1, 2:51.0, 4:46.0 and 6:35.0–6:35.4.
4. **Practise card: FIXED.**
   - "Singing Voice Range" now stays put: its horizontal extent is x 405–1514 on every frame from 8:46.5 to 8:47.4. It is now emphasised by a glow instead of growing.
   - The gear now fades in at full size, 33–36 px wide, over 8:45.97–8:46.2. In film-05 it grew from 15 px to 39 px.
5. **Cosmetic items: STILL PRESENT.**
   - The recall swap and hold at 0:52.6 and the title blur at 0:39.7: both frames are pixel-identical to film-05.
   - The zooms at 3:34.8, 4:39.2 and 5:15.6 are unchanged. The ones at 1:29.6 and 2:22.0 still scale the stairs and keys as one card (a zoom, not a push).
6. **Earlier fixes: unchanged.** Floor glows, pill roll (no pixel above the border row brightens across 4:56.05–4:56.28), end card, tone rise and brackets.

## Shots as read
- **0:00–0:38:** static wide cold open; the house lights up at 0:26.
- **0:38.6–0:40:** through the bead into the title.
- **1:18–2:08:**
  - The keyboard rises at 1:18.6.
  - Letters cross-fade to C D E… at 1:21.4.
  - Zoom-in at 1:29.6, truck right at 1:37, pull-out at 1:44.2.
  - The board drifts through the count.
- **2:08–2:50:** zoom-in at 2:22. The low group's outline lifts and lays over the high group at 2:23–2:24, then a pull-out at 2:30.2.
- **Chapter cards:** 2:50.2, 4:23.0 and 6:34.4.
- **Predict, 2:55–3:46:** slow push during the 3 s pause, with a countdown ring between the pills.
- **Names, 4:39.4–4:46.3:** zoom-in, then a truck along the stairs as each label switches. The 0.4 s pull-out eases smoothly with no frame jump.
- **Tiers:** 5:55–6:09.
- **Guide:** 6:36.6.
- **Your turn:** 7:09.4–7:42.6.
- **Recap:** 7:44–8:39.
- **Practise card:** holds 8:51–8:55.
- **End card:** builds from 9:05.

## Problems, ranked
1. **Length, 9:11.2.** It is past the brief's 7:30–9:00 range and the series cap. Fix: the owner either approves it or takes the cuts listed in DECISIONS. Changing the picture won't fix it.
2. **Drops from the top, four times.** The reference films bring the Mercs in by hops and sinks at floor level, never from above. Fix: a side leap at floor level, like Tavi's entrance at 2:07.0.
3. **Cosmetic:**
   - **8:46.7–8:47.2:** the new glow on "Singing Voice Range" edges towards the "glow on chrome" look. A weight or colour change would be cleaner.
   - **8:47.3–8:47.6:** the gear still pulses to about 1.17× (36 → 42 px).
   - **Leftovers:** the recall swap at 0:52.6, the title blur at 0:39.7, and the uniform zooms.
   - **Observation, not a defect:** from 1:18 to 6:33 most beats are the same wide staircase-over-keyboard. Lesson 2's overview varies its compositions more. Shot size changes carry the variety here.

## Numbers
- **Film:** 551.2 s, 1080p, 60 fps.
- **Holds:** 8.2 s in 63 runs, 0.45 s per 30 s, longest 0.4 s, no final hold.
- **Single-frame events:** the top 20 are the same as round 5's. There are 22 new weak events (each changing at most 0.17% of pixels); all are whole-pixel steps in the new drifts.
- **Loudness:** −16.0 LUFS integrated, LRA 5.5 LU, true peak −2.4 dBTP.
- **Whooshes:**
  - At 1:18.1, 2:49.4, 4:22.4, 6:33.6 and 7:43.8: +23.9 to +26.4 dB in band, measured against silence.
  - Their loudest 50 ms sits 14–16 dB below the narration (−21 to −24 dBFS against −7.5 to −8.4 dBFS), and their 2–8 kHz peak about 16 dB below the voice's 2–8 kHz.
- **Claims:**
  - The card reads "Settings › Practice › Singing Voice Range", plus "On a phone, Settings and Exercises are under ··· More". Both match FACTS 85.
  - The credits read "Krumhansl & Shepard, 1979" and "as summed up in Janata et al., 2003". Both match FACTS 81.
  - The ladder is labelled "Illustration".
- **Contrast:** the "still hanging?" label measures 14.4:1.
- **Loop seam:** 21.65. This only matters if the landing page loops the film.

## For a human
- **Voices:** whether these takes and voices are the approved ones.
- **Phone speakers:** check the whooshes, which play over room tone, and the near-silent end.
- **Captions:** they aren't in the render. Check that they stay clear of the care block.

## Files
- **Kept in `review/film-06/`:**
  - `measure/`: `summary.md`, `audio.md`, `events.csv`, `motion.csv`
  - `crops/`: the pill, gear, range line, card, alignment, zooms and ring
  - `dense/`: the Merc drops, the names truck and the card emphasis
- **Cleaned up:** my scratch folder in /dev/shm is deleted. The films in /dev/shm/l4film are untouched.
