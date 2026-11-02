# Lesson 26, "A second voice": your lesson

Folder: `docs/plans/find-your-pitch/lessons/26-second-voice/` (RESEARCH.md and ARTICLE-PLAN.md are
there). Scratch copy folder: `.../scratchpad/s2pkg/26/`. Hand-back note:
`.../scratchpad/s2pkg/26-HANDBACK.md`.

Read the shared brief first: `.../scratchpad/s2pkg/BRIEF-writer-common.md`.

A voice lesson (S20b, new; T23 light), scored on the page. It needs Lessons 12 and 24 (SEASON-2
§ 4.3), both committed on the branch. Lesson 24 is your closest model and the page you build on (its
drone, headphones prompt, scoring band, six-preset table and coach's list); Lesson 23's two notes
held together, Season 1's Lesson 6 ("Twinkle", moving a tune) and Lesson 12 (the chords, ii) and
Lesson 2's ring are the rest. Lesson 28 builds on yours: it sings one part of a two-part song with
the other part played, so whatever you specify for playing a part with the learner, the kit should
be able to reuse. The plan was verified at `b803c7d43`; check every app claim again at
`c60f0fdcb`, above all Jam's Harmony Stack (`src/lib/jam/jam-modes.ts`), Drone Intonation's thirds
slug and `src/lib/voice-capture.ts`.

The lead's answers to the plan's open questions:

1. **"Passing note"**: the British term, as MASTER-PLAN § 12 item 5 has the series' English, with
   "passing tone" in brackets once. Read and cite a source that gives the term (one that names both
   is best); if none is read, define it from the sources you did read and say so in the hand-back.
2. **The line reader**: share Lesson 18's work on reading notes in time (SEASON-2 § 5 item 11); one
   reader in the kit, specified once. Your WEB-SPEC adds only what is new for a sung part against a
   played one, and names Lesson 18's package for the rest (cite it by path; it is committed).
3. **The recorder**: if your page plays the learner's take back, build it on
   `src/lib/voice-capture.ts` through the kit and specify it so Lesson 28 can reuse it; if it does
   not, leave the recorder to Lesson 28 and say so.

Check every note the page asks of a voice against all six presets (`VOCAL_RANGES`, two semitones
inside), including the role swap, where the learner sings the tune: the plan's tune starts on C4,
the soprano preset's floor, so the higher voice's line there may need another octave or the page a
key that fits every preset, as Lessons 15 and 16 moved to G. Put the table in FACTS and list the
two five-note lines, their range per voice, the tempo and the role swap for the coach. "Step 3's
tenth" is the hosts' character moment, labelled once (SEASON-2 § 7 item 10).

The teases:

- Your own, one line above your hook on Lesson 25's card: the lead's line, your opening in
  miniature, "‘Twinkle’, and the same tune four semitones higher, played together.", with the
  alternative `plan` bound at Lesson 25's review, "Lesson 24's other part was a drone. What if it's
  a tune?" (Lesson 25 FACTS 5). The plan's own line, "So far the other part was a drone. What if
  it's a tune?", is withdrawn: Lesson 12's sing-along already had the learner sing over moving
  chords. You own it: check it against your final opening and predict.
- Lesson 27's, on your next-lesson card (Lesson 27's writer owns it and may be writing beside you):
  the lead's line, "G, B and D going home to C, E and G. Now stack one more third.", with your plan's
  line as the alternative `plan`, "Stack thirds and you get a chord. Stack one more on V, and it
  pulls." The lead binds both packages at review.

Go deeper items stay out unless a source is read for them.
