# Lesson 16's page (lead-only; agents off until 12 Nov 01:00Z)

Branch feat/lesson-16-page from main AFTER #1393-style L21 PR #1397 merges (needs the kit staircase's
new starts and the staff toy's key signatures). Worktree: reuse W (l10-page) once L21 is merged.
Spec: docs/plans/find-your-pitch/lessons/16-sing-what-you-see/ (WEB-SPEC 724, LESSON 547 lines).
A SCORED sing-along page (microphone): read along written notes; draft until the vocal coach's
sign-off (draft line `16: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`).
Model page: Lesson 15 (staff toy) + Lesson 21 (stairs in kit, sticky stage pairs).

## Kit work (WEB-SPEC, What the kit and the app still need, items 4-6)

K1 staff toy options: Hear it inside (a run lights each note 1.0 s before its onset); Names on/off
   (hide syllables, keep house); drawn sung notes in a colour (orange notehead at the sung pitch's
   place, for Tavi's tries); a fixed state (no taps; hero and Sing it); the take's pitch line (a lane a
   semitone beside the staff, drawing a take's frames after it ends). Clef switch from fyp-voice.
K2 staircase turn into the staff: stairs rotate 90 deg onto the staff toy's places in 0.8 s, from G3
   or G4; reduced motion = cross-fade; then plays the five notes (3.7 s). Five stairs do..so.
K3 read-along take: kit/read-along.ts (pure cursor reader, tests); TakeOptions.until (ends the take
   as the last note passes, kit/listen.ts:95-116); rungLine/gapWords take the written note's name
   (kit/band-words.ts:56-61, kit/take.ts:296-303); the start sung before each take in the voice.
App items 9-10 (lesson marker/answers bounds; Sight-Singing link) are the app's: check, else record.

## Page parts (Toys)
1 hero: fixed treble staff G4 A4 B4 A4 G4; predict alone/note (Tavi F G A G F orange one place under;
  G4 first then on the notes); revealAfter 'all'; holdTour; live lines.
2 steps: five states (staircase turns; Play do; Hear it inside; triad plays; Names) + free play.
3 staircase (Step 1) with the turn.  4 three words (small staves).  5 recall + quick check (l16-q1..4,
  l15-q1 from lesson-15/quiz-questions.ts, Lesson 9's question).  6 Sing it (cursor take, start note
  before each phrase, pitch line after, flow rule).  7 tease still: Lesson 17's stage, a still.

## Commits (draft; re-read each spec section first)
C0 baseline on main after #1397. C1 shell + registration. C2 K1 staff options. C3 K2 stairs turn.
C4 K3 read-along take. C5 steps. C6 hero/cold open. C7 recall + quick check. C8 words. C9 Sing it.
C10 wrap + free play + tease. C11 e2e + phone (390/344, stage < 786). C12 seo fingerprint.
C13 Length (open text: count only what SHOWS, not live regions) + ceilings a quarter over + As built
+ cites + INDEX. <= 2 review rounds (browser walk at 390/344/1440 with console/negative-attr hooks).

## Read so far (WEB-SPEC line refs; re-read before each commit)
- Sections 60-116: masthead {lesson:16, deck}; hero Lesson 2 order, 5 chips ("15 minutes", "After
  Lesson 9: Landing a leap", "After Lesson 15: The staff: where notes sit" [links, plain when not
  live], "Sound on", "Microphone optional"); head title "How to sight-sing a melody from the staff |
  MercuryPitch" (56); description 142 ch; og/twitter title "Sing what you see · Find Your Pitch,
  Lesson 16"; og desc = hook; card learn/lesson-16-og.jpg (treble staff 5 plain notes between Merc and
  Tavi, no light/name/house) + alt (127); Article: headline "Sing what you see", alternativeHeadline
  hook, PT15M, position 16, teaches x4. Order: hero, recall (L9 + L15), three words (Sight-singing,
  Tonic triad, Audiation), steps (5; Step 2's mix-up card), Sing it, quick check, wrap (+ free play,
  L17 still), explorer, footer.
- Toys 1-3 152-247 (hero fixed staff + Tavi's orange tries; staff toy states 1-6; staircase turn).
- Sing it 279-397: flow states 1-9, retry rules (<=3 takes/visit, phrase 2 only after Easy/Workable
  on 1, never after Stop here / Effortful / Uncomfortable), lesson-16/sing-flow.ts pure rule;
  the start (do 1.0 s, 0.4 s gap, do mi so mi do 0.6 s = 4.4 s; only do lights amber); take: first
  note lights 0.4 s after the start, waits 8 s for voice, cursor reader, ends at 5th note or 40 s;
  after: violet pitch line over amber bands (lane a semitone, folded, octave tag), one line a note;
  no-voice line + Start again (<3 takes); feelings; Play Merc's phrases (start + both phrases, 12.0 s)
  only once singing ended; no-mic path (Play the start + Play Merc's phrases).
- read-along (kit/read-along.ts): voiced = preprocess keeps it; current note from first voiced frame;
  frame within 60 cents (folded) adds its time to hold, else takes back half its time (>= 0); pass at
  0.45 s hold; move on at 8 s from the note's start; reading: passed note = median folded distance of
  counted frames (+ octave); moved-on note = readTake over its frames (0.3 s attack, 0.6 s steady) ->
  not-steady line; lines = rungLine with syllable + "the written note" ("Re · In the band: 20 cents
  below the written note.", "Right in the middle" within 15 cents, octave line within 50 cents of a
  note an octave+ away, "Do · We didn't hear a steady note there.").
- Phone: five notes 52 px apart on a 26 px staff space; pitch line below the staff full width 160 px.
- Tease still 399-406: SVG of Lesson 17's stage before its first play (L8's four beat pads 1-4, empty
  line above, empty stopwatch strip under), aria-hidden, own class.
