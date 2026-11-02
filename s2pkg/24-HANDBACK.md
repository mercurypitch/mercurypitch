# Lesson 24 hand-back: "Harmony against a drone"

Files: `docs/plans/find-your-pitch/lessons/24-drone-harmony/` FACTS.md, LESSON.md, WEB-SPEC.md in
`/dev/shm/s2plan`, copied to `s2pkg/24/`. RESEARCH.md and ARTICLE-PLAN.md are unchanged. Lesson 25's
folder was not touched; Lesson 25 is cited in words only.

Checks, run from `/dev/shm/s2plan`:

- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/24-drone-harmony`: **0
  findings** (about 240 citations read).
- `node scripts/lesson-words.mjs docs/plans/find-your-pitch/lessons/24-drone-harmony`: **2,227
  words**, cap 2,379 (152 under); steps' own text 111, 120, 100, 83 (inside 50 to 120).
- Built page, estimated: 2,227 + about 150 of hints and status lines (Lesson 8's reckoning) + 65 for
  this page's seven lock and status lines = about 2,442, some 63 over. WEB-SPEC Length names the
  cuts a build makes while its count runs over: Step 2's Go deeper drawer (52 words, to about
  2,390), then the card's sentence on Drone Intonation's drone (16, to about 2,374), then, only if
  still over, the sound gate's headphones clause (8).
- Chip: **16 minutes** (9.36 of reading at 238 a minute + 7.00 of sound and tasks = 16.36), as the
  plan's "about 16"; head description **136 characters** with "A sixteen-minute lesson"; the head
  test has the word (`src/tests/lesson-pages.test.ts:84`); `timeRequired` `PT16M`.
- The claims validator's patterns (`src/lib/guided-voice/claims.ts`), applied by script over
  LESSON.md and WEB-SPEC.md, line by line: no matches. The validator itself was not run (no pnpm).
  No emoji, no model name, no scratch path in the three files.

Process notes: no git, no pnpm, no downloads (web pages read with the fetch tool; nothing under
`/dev/shm/s2dl/`), no shared file or code touched. Only the two node scripts ran. The arithmetic is
`s2pkg/24-tools/verify24.py`, run with `python3 -I` and a word count (sections 1 to 12: frequencies,
cents, beat rates, the slide, beating harmonic pairs, a wave's sweep, the band, Drone Intonation's
round scores at every difficulty, the six-preset range check, lengths, the timbres' harmonic levels,
the run time); the claims check is `s2pkg/24-tools/claims_check.py`.

## 1. MASTER-PLAN § 11 (proposed line, after Lesson 23's)

- Lesson 24: a written lesson, text only, in
  [`lessons/24-drone-harmony/`](lessons/24-drone-harmony/) (research, article plan, facts, copy and
  page spec). A voice lesson with a scored checkpoint, three holds over a drone with headphones, and
  an unscored sing-along without them; both gates of the vocal coach bind it (§ 12 item 8). No page
  is built yet: it waits on Season 2's kit (seasons), on Lesson 22's three kit pieces (Merc's voice
  with its vibrato as a parameter, the centre-line reader, Lesson 5's hold flow in the kit), on its
  own (the drone chart's states, a drone under a take, the headphones check and the quiet check),
  on two lab tests (silence over a speaker drone; the drone's timbre) and on the lesson plumbing for
  Lessons 15 to 28 (SEASON-2 § 5.2 item 21). Until the first lab test passes, its Sing it ships as
  the sing-along only. It goes live after the coach's sign-off and once `/learn/05`, `/learn/10` and
  `/learn/23`, the pages its chips and its recall link to, are live.

## 2. CURIOSITY-MOMENTS § 2 (proposed entry)

### Lesson 24 · Harmony against a drone · voice; written; no page yet · hook kept

- **Opening:** Lesson 5's band chart between Merc and Tavi, a wide amber band at A3 named "drone ·
  A3" and a thin chrome line just above it, still, as Lesson 23's card drew them; Play the drone and
  the top note works before the choice, 220 Hz with 224 Hz, throbbing four times a second. Tavi
  "They're nearly the same note. Push them closer: won't they clash even more?" Merc "Hear them
  together first. Then I'll slide the top note down." Predict: "Merc slides the top note down,
  slowly, until it matches the drone. What happens to the throbbing as it arrives?" [It slows, then
  stops] [It speeds up]. The slide holds 224 for 1.5 s, glides to 220 over 6 s and holds 220 for 2.5
  s; the reveal waits for its end. The plan's Beats word, whose definition and 220-against-222 play
  sat below the predict and answered it, is replaced by Harmonic; every play of the steps, the Pure
  word's play, quick check 4's play, Step 2's predict and the tour wait for the choice (Lesson 24
  FACTS 1a, 40 to 47, 71). Lesson 3's closed Go deeper said the answer once, as the season's card
  intends.
- **Visual:** the drone chart, Lesson 5's band chart with a drone under it, the throb drawn as
  brightness at the beat rate, under 10 % luminance, never a flash (new states on the kit's band
  chart): the drag and the octave, Lesson 10's beads with Piano · Pure, Lesson 5's band on mi with
  the piano's tick and the pure one, a wave on the fifth. **Payoff:** the cold open's reveal (two
  close notes beat as fast as their difference, and stop in tune); Step 2's second predict, the
  piano's major third beating much faster than its fifth, and the pure chord ringing still; Sing it,
  do, so and mi held over a drone on do, with headphones, read on the middle of the line.
- **Tease:** a still of Lesson 25's opening as Lesson 25's package draws it, silent: "A minor tune,
  played twice. The second ending changes one note." (the lead's line), with the plan's line as the
  alternative `plan`, "Do, mi and so made a major chord. Minor keys hide another change.", true of
  this page (Step 2's Play all three). Lesson 24's own tease, on Lesson 23's card, is "A drone, and
  a second note just above it, almost in tune.", with the alternative `fifths` (Lesson 24 FACTS 5,
  5b).
- **Facts:** sourced in Lesson 24's FACTS: beats (Wolfe, UNSW, both pages, read again), harmonics
  and pure intervals, the piano's fifth and third against a drone (arithmetic), singers in pairs
  (Dai & Dixon 2019) and a quintet's thirds (D'Amario et al. 2020), a vibrato hiding beats
  (Sundberg 1994, as RESEARCH reads it); the app at `c60f0fdcb`. Kodály's part singing is not
  verified and not used.

## 3. `kit/season.ts` (Season 2's module) entry and prerequisites

```ts
{
  n: 24,
  lane: 'voice',
  title: 'Harmony against a drone',
  short: 'Drone harmony',
  topics: ['S20a'], // "Hold a part against a drone; beats"
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 16, // once the page is built
  page: '/learn/24', // once the page is built
  hook: 'Hold a note against a drone: how can you hear when the two are in tune?',
  pr: {
    needs:
      'The fifth, third and octave slug and a pure-tuning option (SEASON-2 § 5.2 item 15); a drone with harmonics',
    link: {
      href: '/exercises/thirds-on-a-drone?lesson=24',
      addr: 'mercurypitch.com/exercises/thirds-on-a-drone',
      label: 'Drone Intonation',
      note: 'the two thirds',
    },
  },
}
```

- `EDGES` gains `[5, 24]`, `[10, 24]` and `[23, 24]` (SEASON-2 § 4.3 row 24); `PREREQ[24]` is then
  `[5, 10, 23]`.
- `drafts.ts`: `24: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`.
- `team-notes.ts` `SIGNATURES[24]`: "Lesson 5's band with a drone under it: a top note sinks into it
  and its throb stills, the beads stand over it tuned two ways, and a wave smears the fifth's slow
  beat."

## 4. `kit/lesson-copy.ts`

- Lesson 24 (set on Lesson 24): no hook alternatives; the default hook is the season's.
  - `tease`: "A drone, and a second note just above it, almost in tune." (57), settled at Lesson
    23's review. The cold open keeps it true: it plays 220 with 224 Hz first.
  - `teaseAlts`: `[{ id: 'fifths', text: 'Fifths count as settled, tritones lean. Next, a note
    against a drone.' }]` (69), as Lesson 23 FACTS 5 and the SEASON-2 card give it.
  - `TEASE_NOTES[24].fifths`: as Lesson 23's hand-back proposed it, with its wording updated to
    "count as settled".
- Lesson 25 (set on Lesson 25, Lesson 25's writer's): the lead's line, "A minor tune, played twice.
  The second ending changes one note." (63), with `plan`, "Do, mi and so made a major chord. Minor
  keys hide another change." (65). **The alternative is true of this page**: Step 2's Play all three
  sounds do, mi and so together over the drone, A3, C♯4 and E4, Lesson 10's major chord on A, and
  Sing it holds do, so and mi over a drone on do (FACTS 5b, 30). Neither line names te, ti, the
  seventh or a raised note.

## 5. Kit and app work the page waits for (WEB-SPEC, What the kit and the app still need)

1. The lesson host, `learn/24.html`, the draft line, and seasons in the kit (items 1 to 3).
2. Lesson 22's three pieces (item 4): Merc's voice with `vibrato` (null for a straight note), the
   centre-line reader, Lesson 5's hold flow in the kit. Shared, not duplicated.
3. **A drone under a take** (item 5): `Sound.hush` keeps one drone voice started before the take.
4. **The headphones check and the quiet check in the kit** (item 6), since Lesson 26 asks for both:
   `kit/headphones.ts` and a pure `kit/quiet-check.ts` (fails on a voiced run of 0.3 s or more in
   two seconds of the drone).
5. **Two lab tests** (item 7), before the scored path ships and before any beat rate goes on screen:
   silence over a speaker drone never gives a reading in the band on any lab phone or laptop (the
   lead's answer 1), recording whether the detector hears the drone and how headphones fare; and the
   drone's timbre, the fifth's 0.5 to 1 beat a second and the third's 6 to 12 heard on phone speakers
   and headphones through the compressor (the lead's answer 2). The same session times the chip and
   checks the brightness's luminance cap.
6. The hold flow's options for this page (item 8): 5-second holds (the reader's `length` type is
   "10 or 15" today), a set of three model notes, then two; the drone under each take; per-note
   summary subjects.
7. The drone chart's states on the band chart (item 9).
8. The lesson copy (item 10), the plumbing (item 11, SEASON-2 § 5.2 item 21), the head and share
   card (item 12), Lesson 23's questions as a module (item 13).
9. **The app (item 14)**: Drone Intonation's fifth, third and octave slug and pure-tuning option
   (SEASON-2 § 5.2 item 15); and, **proposed here, new: a drone with harmonics** for Drone
   Intonation, whatever the app's instrument. Today its drone is the engine's instrument, a sine by
   default (`src/stores/app-store.ts:45`, `src/lib/audio-engine.ts:149`), changed only by the Piano
   and Guitar tabs and the editor's menu (`src/App.tsx:672-681`), so its fifths and thirds cannot
   beat through harmonics as this page's do. A line for SEASON-2 § 5.2 if the lead takes it.

## 6. Departures from ARTICLE-PLAN.md, and why

- **The four words**: "Beats" becomes "Harmonic" (the plan's definition and its 220-against-222 play
  sat under the predict, visible before the choice on a phone, and answered it); "Pure" drops
  "nothing beats" and its play waits for the cold open's choice; "Drone" drops "low", which its
  source does not say; "Equal-tempered" plays a semitone scale, since the plan's piano fifth beats
  and answers half of Step 2's predict (FACTS 1a, 24, 71).
- **The hero is Lesson 23's still** (the drone band with a thin chrome line just above it), not the
  plan's beads, which arrive in Step 2; the tease and the still promised that picture (FACTS 40).
- **Tavi's line** is a sincere guess for the other choice; the plan's fitted neither. Merc slides
  "the top note", a played tone drawn chrome, not his own sung note (FACTS 42).
- **The slide** holds 224 Hz for 1.5 s before the glide and 220 for 2.5 s after it, so the throb and
  the stillness are each heard, not passed through (FACTS 44). The first choice reads "It slows,
  then stops", the plan's "It slows down, then stops" shortened to match the reveal (FACTS 43).
- **Locks**: Step 1's toy and every play over the drone, the Pure word's play, quick check 4's play,
  Step 2's predict and the tour wait for the cold open's choice; Step 2's taps, switch and chord,
  Steps 3 and 4's plays (the piano's mi and so over the drone) and "Just listen today"'s play for
  Step 2's choice. Step 4's words no longer call the fifth's throb "slow", since they sit below
  Step 2's predict (FACTS 1a, 38, 46, 47). The plan had no locks.
- **Step 2 adds the chord**, do, mi and so together, which makes Lesson 25's alternative tease true
  (FACTS 30). Its fair-guess line says "interval" for "leap", since the notes sound together (45).
- **Step 3's heading** names no third, since the lesson menu shows every heading before Step 2's
  choice; Drone Intonation's score moves from Step 3 to the practice card, said once (FACTS 48).
- **Step 4's toy** plays the piano's fifth with a wave and straight, which the step's point needs;
  a second singer's line is Lesson 26's (FACTS 38). The mix-up card leaves out the quintet's
  rehearsals (32), and **the "Lock and ring" Go deeper is cut**: the weakest source on the page,
  "generally forbids vibrato" could read as a rule against vibrato, and the words were needed (39).
- **Sing it**: the headphones check and a new quiet check (two seconds of drone with the
  microphone open; a voice heard there sends the learner to the sing-along), the lab test's guard;
  Merc gives each note alone and straight before the drone; the holds read on the middle of the
  line (Lesson 22's reader), so a vibrato counts in full; feelings after each set; no Move do and no
  other octave; the ten-second holds follow Easy or Workable, as Lesson 5's fifteen-second hold
  does; the no-headphones path is the sing-along in its own words, not the plan's line (FACTS 49
  to 59).
- **Chips and sound gate**: all three prerequisites as chips, "Microphone optional" and "Headphones
  optional" (the page works without either); the sound gate is Lesson 5's form plus a headphones
  clause (FACTS 2, 6).
- **The quick check**: question 1 keeps the plan's words, for Lesson 26's recall, but its third
  feedback drops "most clearly", which no source supports; question 2's feedback drops "under once a
  second" (true only for drones up to about D4) and "the piano's own system"; others reworded to fit
  (FACTS 74 to 77).
- **The practice card** says what its link opens (the two thirds only: so and do are not in it),
  that it scores against the piano's tuning so a pure major third scores about 79 a round, and that
  its drone is a plain tone by default; it drops Lesson 10's sharps line (FACTS 60). Beat Hunt is
  the second drill and stays on the rest card (61, 63).
- **The next-lesson tease** is the lead's line, with the plan's as `plan` (FACTS 5b).
- **The promise** says "over one" for "above one", since do is the drone's own note (FACTS 1).
- **Colour**: the plan's beads are chrome on this pitch canvas and the "pure" tick a dashed ink
  line: no gold on a pitch canvas (FACTS 29).

## 7. Citations made in words

- **Lesson 22** (vibrato): its WEB-SPEC's kit items 4, 6 and 7 (Merc's `vibrato` option, the
  centre-line reader, Lesson 5's hold flow in the kit), its summary's "the middle of your line", and
  its preamble's answer that Lesson 24's straight notes stay in Lesson 24. The brief asked for words;
  Lesson 22 is now committed (`5a283f8d9`), so the lead can bind these to path and line.
- **Lesson 25**: its tease and its alternative (owned by Lesson 25's writer), and the still of its
  opening in this page's next-lesson card, "as Lesson 25's package draws it".
- Lesson 26's ARTICLE-PLAN is cited by path (its recall asks this page's quick check 1 word for
  word): `lessons/26-second-voice/ARTICLE-PLAN.md:47-49`.

## 8. Questions and notes for the lead

1. **The page's title** (WEB-SPEC, Decisions for the owner): "Singing with a drone: pure intervals
   | MercuryPitch" (51) recommended, or the question form "How to sing in tune with a drone |
   MercuryPitch" (47).
2. **Lesson 23 FACTS 5** quotes this page's first choice as the plan's "It slows down, then stops";
   it now reads "It slows, then stops". A one-word bind in Lesson 23's fact.
3. **The drone's colour changes once**: an amber band in the hero and Steps 1 and 2 (the note tuned
   to, matching Lesson 23's still), a chrome line from Step 3 on, where the amber band is Lesson 5's
   on the note to sing. The alternative, the drone always chrome, would need Lesson 23's still
   redrawn.
4. **Drone Intonation**: take the proposed app item, a drone with harmonics? And should the card say
   that the run's score tops out at 80 (the round score is the one it names)? It does not today.
5. **For the coach, through you**: "Move do: higher", up to five semitones, passes the six-preset rule
   if the coach wants a way up; the page offers no move now (FACTS 57). The quiet check runs before
   each set, two seconds of drone each time.
6. **Lesson 26**: its recall asks quick check 1 word for word; the question and answers are the
   plan's, the third feedback is reworded. Lesson 26's writer should import `l24-q1`, and reuse this
   page's headphones check, quiet check, drone and band from the kit (WEB-SPEC items 5 and 6).
7. **Words**: the package sits at 2,227, under the series' 2,230 aim, but this page's seven lock
   and status lines put a built page about 63 over the cap; the first two named cuts bring it under.
   If the lead prefers a package that fits without cuts, cut Step 2's formula drawer now.
