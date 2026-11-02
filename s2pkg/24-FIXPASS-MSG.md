Lesson 24 fix pass. The independent review is at
/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/24-REVIEW.md
(2 blocking, 12 should fix, 21 nits; the head, the hero, Lesson 23's tease, the four words, the
recall, every pitch, cents figure and beat rate, the six-preset table, Drone Intonation's 79 and the
shared lines checked sound). Read it in full, then fix the package in /dev/shm/s2plan (same rules as
before: no git, no pnpm; the worktree is RAM, so copy the three files to s2pkg/24/ when you finish).
Lesson 25's writer is in the same worktree on its own fix pass; its files are not yours.

The lead's calls:

1. Blocking 1: take it. Step 3's Tavi line, text, Try and Notice become reveal elements of Step 2's
   predict (`src/features/lessons/kit/predict.ts:70-71` takes several), with one held line in their
   place until that reveal, worded as the page's other lock lines are. Say so in WEB-SPEC Toys 3,
   Edge cases and Tests 5 and 6, make the preamble's and FACTS 48's sentence true, and rewrite FACTS
   1a's line on Step 3.
2. Blocking 2: take it, but not on the review's figure for ±50 cents, which is wrong. The lead
   worked it two ways. The slow beat's part of the envelope follows J0 of the phase swing
   (beta = the wave's extent in hertz on that harmonic, over its rate): for E4's second harmonic
   against A3's third (0.62 and 0.38, 0.745 a second apart), straight 0.361; Merc's ±14 cents at 5.5
   a second keeps 0.281 (78 %); ±30 at 5.5 keeps 0.061; Lesson 22's cold-open wave, ±50 cents at
   six a second, keeps 0.117 (about a third), with a fast flutter at the wave's rate on top. A
   numerical envelope over 400 s agrees with J0 to the third decimal. The throb falls to nothing
   only near beta = 2.4 (about ±34 cents at 5.5 a second for this pair), a coincidence the page
   must not use. So: play a singer's wide wave, Lesson 22's cold-open wave (±50 cents at six a
   second), not "Merc's usual wave", and word Step 4's text, Try and Notice to what that sound does:
   the even throb is much weaker and a flutter rides over it, so it is far harder to follow; never
   "gone" or "lost". Rewrite FACTS 38 from the envelope (state it as arithmetic for steady harmonic
   tones, with the figures above), keep Sundberg's "no beats will occur" to sung vibrato and out of
   the copy as a claim about this play, and add a Tests 1 case: under the wave, the envelope's
   component at the beat rate is at most 40 % of the straight play's.
3. Should fix 1: take it. Hold Step 1's sentences that state the cold open's answer as a reveal
   element of the cold open's predict, with a held line in their place, as Lesson 25's Step 1 now
   does; list every other place (Sing it's cue, the mix-up card, quick check 1's third feedback, the
   Wrap's lines, quick check 2's options) in FACTS 1a with the tour-hold argument, in Lesson 22's
   way.
4. Should fix 2: take it ("Do two different notes throb too?" or better), and fix FACTS 12.
5. Should fix 3: any voiced run of 0.3 s or more during the quiet check fails it. The line says
   what was heard and what to do, close to the review's ("The microphone heard a note while the drone
   played, so nothing will listen this time. Check your headphones, stay quiet, then press Start
   again."), and a test covers a voiced run at an unrelated pitch.
6. Should fix 4: take all three additions to the lab test (stop at 2 s on do, at the holds' level
   and full volume; Bluetooth earbuds; the fifth over D4 in the timbre test).
7. Should fix 5: take it. Every note set against the drone starts on the drone's audio time; on a
   snap, Step 1's drag either restarts the top note in phase with the drone or keeps it a few dB
   under the drone's level (choose one, say why); both in Tests 1.
8. Should fix 6: offer "Move do: higher", up to five semitones, as Lesson 20 does, with the drone
   moving with do. The lab's speaker and timbre tests cover the highest moved drone, and anything
   the page states for D (note names, beat rates) either follows the move or is stated for D only.
   Keep the coach's question on it.
9. Should fix 7: write the set's rules in Toys 6 and test them in Tests 10. The lead's defaults,
   unless you find a better reason: Again repeats the whole set; a hold with no voice in 6 s ends the
   set with Lesson 5's no-start line and offers Again or Done for today; a set is one take, three
   takes a set; the celebration needs every hold of a set read and at least 80 % in the band, and
   the summary names any hold it could not read.
10. Should fix 8: take it ("Headphones help here too: its drone plays while it listens."), in place
    of Length cut 2's sentence, and follow N17.
11. Should fix 9: take it: name every control Step 2's `onChoice` unlocks.
12. Should fix 10: check Lesson 25's tease against its final predict in FACTS 5b and say what you
    find. The lead binds the lead's line, "A minor tune, played twice. The second ending changes one
    note.", with the `plan` alternative kept and its soft lean noted (Lesson 25's FACTS says the
    same).
13. Should fix 11: take it. Cite Lesson 22's reader and items 4 to 7 by path and line in place of
    restating them (the review's table), add item 5, and add the three tests.
14. Should fix 12: take it (Step 4's lines after blocking 2, a headphone volume line, the 4-second
    wait and "Sing along again" for the coach to look at). Give "Sing along again" the cap Season 1's
    sing-alongs use, or none if they have none, and say which.
15. The nits: take every one you find correct. N3: at least Tavi's "So", and the others where cheap.
    N18: put the SEASON-2 § 4.1 S20a row in the hand-back's shared-file entries with a true
    replacement (the lead writes it).

The lead's answers to your hand-back's questions:

- Head title: "How to sing in tune with a drone | MercuryPitch" (query-led, SEARCH.md § 13 item 1). Keep the
  description consistent with it, within 160 characters, with "A sixteen-minute lesson" (or the new
  run time as a word if it changes).
- Lesson 23 FACTS 5's quote: the lead updates it in the shared commit; put the exact replacement
  line in the hand-back.
- The drone's colours: accepted (amber band while the drone is the note being tuned to, a chrome
  line from Step 3 when the band moves to the sung note), with N13's rewording and a line in the
  stage's summary when the colour changes.
- Drone Intonation: the lead checked it. Its run score is round(accuracy x 0.4 + best round x 0.15
  + stability x 0.25), at most 80 since richness left the grade on 25 October
  (`src/features/exercises/drone-intonation/use-drone-intonation-controller.ts:284-292`), and its
  level rises only at an average of 90 (`src/features/practice-intelligence/adaptive-difficulty.ts:12-13`),
  so it can never level up, as Scale Runner cannot. Not on the card: list it in "What the kit and
  the app still need" as an app fix (reweight so a full score reads 100), beside the drone harmonics
  item, and have the card's editorial note say that "about 79 a round" is a round's score, not the
  run's.
- Length: the built page must fit the 2,379 cap. Make the named cuts now, the formula drawer first,
  until your built-page estimate is at or under 2,379, and keep lesson-words at or under 2,230.
- Lesson 22: committed (5a283f8d9), so bind every in-words citation of it to path and line.

Re-run plan-cites (0 findings) and lesson-words. Update the hand-back: the CURIOSITY-MOMENTS entry
with the final predicts and choices word for word, the shared-file entries (SEASON-2 § 4.1's S20a
row and Lesson 23 FACTS 5 among them), the kit and app items, and the built-page estimate. Then reply
with what changed, the counts, and anything you did not take and why.
