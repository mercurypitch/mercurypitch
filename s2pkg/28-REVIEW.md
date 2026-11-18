# Lesson 28, Cadences, form and a song in two parts: independent review

Package read in `/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/28-cadences-form/` (FACTS.md,
LESSON.md, WEB-SPEC.md, untracked in the worktree at `85ccd03dd`), against its RESEARCH.md and
ARTICLE-PLAN.md, BRIEF-28, the writers' shared brief, SEASON-2 (§ 2 row 28, card 28, § 1.3 to
§ 1.5, § 4.3, § 5.1 row 28, § 6.2, § 7 item 8), CURIOSITY-MOMENTS § 5 item 4, MERC-BIBLE § 2, the
models (Lessons 12, 14, 18, 23, 26 and 27) and the app at `c60f0fdcb` (the worktree's `src/`,
`scripts/`, `workers/` and `tools/`). The hand-back was read last.

- `node scripts/plan-cites.mjs check …/28-cadences-form`: 314 citations read, 0 findings (the
  hand-back says 312; the files moved after it was written). About 70 cited lines were also read by
  hand (list at the end).
- `node scripts/lesson-words.mjs …/LESSON.md`: 2,051 words, cap 2,379, 328 under; the steps' own
  text 100, 107, 109 and 117. Matches LESSON.md, WEB-SPEC Length, FACTS 3 and the hand-back.
- `python3 -I verify28.py`: runs clean; every number I re-derived by hand agrees (below).
- The Wikipedia revision the package cites (1373604555) was fetched as raw wikitext and every
  quotation the package takes from it checked verbatim; the copy was deleted after. OMT was not
  re-read.

Counts: **1 blocking, 9 should fix, 13 nits.**

---

## Blocking

### B1. The hero's free play sounds both ways before the choice: bars 9 and 10 are the ending's bars 7 and 8 (LESSON.md:146-150, :89-92; FACTS.md:38, :81, :91; WEB-SPEC.md:229-231, :495-496, :795-799, :871)

The predict asks which part changes its note at bar 8 between "the way the song ends" and "the way
it kept going". Play the song, the `[data-free]` play that works from first paint, plays "the song
as it kept going, ten bars". By the package's own arithmetic those ten bars hold both ways, in
order:

- FACTS 33 (FACTS.md:81): "bar 8 with E3 in Merc's part under Tavi's G4, then bars 9 and 10, which
  are bars 7 and 8 of the ending again, A4 F♯4 | G4 over D3 D3 | G3".
- `verify28.py`, section 3: "bars 9-10 are bars 7-8 of the ending, both parts: True True"; bar 8
  "G4 over E3", bar 10 "G4 over G3".

So the learner hears A4 F♯4 G4 over D3 D3 E3, then A4 F♯4 G4 over D3 D3 G3: the top line twice
the same, the bottom line different at the landing. That is the comparison the predict asks for,
heard before the choice. The top voice is the easiest line to follow, and both parts sing in one
timbre an octave and more apart, so an attentive learner can hear that Tavi's line repeated
exactly. Nothing drawn adds to it (the strip lights a box a bar, and `mercSing` only animates), but
the sound alone does it.

The package's leak check says the opposite, and its locks rest on that:

- FACTS 1a (FACTS.md:38): the hero's free play is "the way the song kept going, the only version
  that sounds before the choice, so the ear has nothing to compare it with". False by FACTS 33.
- FACTS 1a again: every play that sounds the song's ending waits "because the ending set against
  the hero's free play is the comparison the predict asks for". The hero's free play sounds the
  ending itself, at bars 9 and 10.
- WEB-SPEC Audio, rule 5 (:495-496): "any play that sounds the song's ending, stays disabled until
  its choice, wherever it sits on the page". The hero's play breaks it.
- WEB-SPEC Tests 5 (:798): "no play anywhere sounds the song's ending"; Page QA (:871): "No source
  on the page sounds the song's ending before the cold open's choice". Both would fail on the hero
  as specified.
- LESSON.md:89-90: "Nothing on the page sounds or states the predict's answer before its choice."
- The kit defines a free play as "an example the cold open's line already answers"
  (`src/features/lessons/kit/predict.ts:15-16`). This one carries the answer itself.

Lesson 26's hero, the closest model, plays only the tune and leaves the copy to the locked play
(`lessons/26-second-voice/LESSON.md:129-132`).

**Fix.** The hero must not sound G4 over G3 at a cadence before the choice, and must still let
the tease and Tavi's bubble be true ("At bar 8 it seems to end, then keeps going", bound on
Lesson 27's card). Two routes, the writer's call:

- (a) Keep the free play as the song that seems to end at bar 8 and keeps going, but make bars 9
  and 10 the song going on into its next section instead of a repeated perfect cadence: for
  instance bars 1 and 2 again, B4 A4 | G4 B4 over G3 F♯3 | E3 G3 (verticals 16, 15, 15, 16,
  consonant; no G4 over G3 anywhere), fading or stopping there. Step 2's Interrupted play and its
  "Bars 9 and 10 then end it V to I" (LESSON.md:237-238), FACTS 33, verify section 3 and Tests 2
  follow. Bar 8's vi then sounds once and the ending's G over G never sounds before the choice.
- (b) Make the free play the ending only (bars 1 to 8, V to I) and leave the way it kept going to
  the answering plays. This breaks the bound tease as the opening in miniature and needs new
  bubbles, and quick check 4's play (bars 5 to 8 the other way) would then have to wait for the
  choice, as Lesson 26 holds its question 4's play.

Whichever is taken, FACTS 1a, LESSON.md's preamble, Audio rule 5, Tests 5 and Page QA must say what
the hero actually plays.

---

## Should fix

### S1. The stem can be read two ways (LESSON.md:155-157; FACTS 42)

"Which part changes its note at bar 8?" is meant as "which part sings a different note at bar 8
in the two ways". It also reads as "which part moves to a new note at bar 8", and both parts do,
both ways: Tavi F♯4 to G4, Merc D3 to G3 or E3 (verify section 2 and 3). A learner who reads it the
second way has no right answer. "The way the song ends" also points, on the current hero, at bars
9 and 10 the learner has just heard, which is B1's comparison handed to them.

**Fix.** "Merc and Tavi sing bars 7 and 8 two ways: ending the song there, and going on as you
heard. At bar 8, whose note is different the second way?" (or similar), and the answering plays'
labels to match. Re-check it against whichever B1 route is taken.

### S2. A chain below the predict still gives bar 8's chord and the parts' notes before the choice (WEB-SPEC.md:326; LESSON.md:430, :439-440; FACTS 1a, 47)

FACTS 47 removed the plan's word "Interrupted cadence: V going to vi" because it "names the change of
chord at bar 8 from below the predict". The same news is still there before the choice, and the
pieces FACTS 1a says are missing are on the page:

- Quick check 4's right answer (LESSON.md:430), open before the choice: "It seemed to end at bar
  8, then kept going." So bar 8 is the interrupted cadence. The tease says the same ("At bar 8 it
  seems to end").
- The Wrap's first line (LESSON.md:439-440), static: "interrupted, V to vi, seems to end".
- Sing it's staffs, which "show the song as written" before the choice (WEB-SPEC.md:326; FACTS 1a,
  "Sing it's staff, which writes the song as it ends, G over G at bar 8"): bar 7 is A4 F♯4 over
  D3 D3, ti and so.
- Lesson 12's Step 4, which every learner here has: "From V to vi, all three notes move up a step"
  (`lessons/12-chords-four-chord-song/LESSON.md:201-202`).

From those, ti steps to do either way and so goes to la instead of do: Merc's part. FACTS 1a's
defence, that this "needs D, F♯ and A set note by note against E, G and B and the parts' notes,
which the page does nowhere before the reveal", is false on the parts' notes (Sing it draws them)
and Lesson 12's rule stands in for the chord spelling. The deduction is long, but the package's own
standard (FACTS 47) counts its first step as a leak.

Sing it's staffs are also inconsistent with the rest of the page: the steps' figure, which draws
the same A section, shows only the empty strip until the choice "since bars 5 to 8 sound the
song's ending" (LESSON.md:222-223, :230-232), and FACTS 1a says Sing it's staff "like Step 1 shows one way
only", when Step 1's figure shows nothing before the choice.

Quick check 4's feedback also describes the hero, not its own play: its play is bars 5 to 8 and
stops on vi (LESSON.md:434-435), so nothing in it "kept going".

**Fix.** Draw Sing it's staffs as the hero's empty strip until the choice, as the steps' figure
does (WEB-SPEC Toys 6 and Edge cases; FACTS 1a, 46). Give quick check 4 a line true of what it
plays and silent on bar 8, such as "V went to vi, not I: it seems to end, but it isn't home."
Then rewrite 1a's paragraph on the Wrap honestly. Holding quick check 4's Play until the choice,
as Lesson 26 does, is the stronger option if B1 takes route (b).

### S3. The coach would sign off a line the page does not print (LESSON.md:385 against :636-638)

The page's Easy or Workable line is "Your part, read in time from the page." (LESSON.md:385; FACTS
66; WEB-SPEC Length names it as an 8-word cut candidate). The coach's list quotes "Your part of a
song in two parts, read in time from the page.", new (LESSON.md:637-638): the pre-cut wording.

**Fix.** Quote the page's line in the coach's list. While there, the coach's list leaves out the
new line under the voice choice, "Lower voices sing Merc's part, in the bass clef; higher voices
sing Tavi's, in the treble." (LESSON.md:323), which assigns parts by voice: add it beside the voice
choice (LESSON.md:547-548), since the preamble lists it as new (LESSON.md:62).

### S4. "So" means "therefore" in five learner lines, against the package's own rule (LESSON.md:47-48; FACTS 10)

The preamble and FACTS 10 say the page "keeps "so" for the syllable, and none of its own lines uses
it to mean "and therefore"". It does, five times:

- LESSON.md:152, Tavi: "But it went on, so I can't have landed on do, can I?"
- LESSON.md:172, the reveal: "Merc's part leapt up from D to G, so both parts landed on do". In
  G, D is so; "from D to G, so both parts" is the one real misreading on the page.
- LESSON.md:268, Step 3: "ends on V, unfinished, so A comes back."
- LESSON.md:417, quick check 1: "It stops on V, so it sounds unfinished."
- LESSON.md:425, quick check 3: "Here it ends on V, so A comes back."

(The shared lines "so you can play it back" and "Thanks for saying so" are Lesson 14's and Lesson
3's and may stay.)

**Fix.** "and" or a full stop in each: "Merc's part leapt up from D to G, and both parts landed on
do"; Tavi: "But it went on. Did I miss do?"; "ends on V, unfinished, and A comes back"; "It stops
on V and sounds unfinished."; "Here it ends on V, and A comes back."

### S5. Two of the three breath marks sit mid-phrase, against what the series teaches, and the page does not say why (LESSON.md:31, :286, :593-596; FACTS 67)

Lesson 18 teaches that a breath mark "shows where to breathe, at a phrase's end"
(`lessons/18-read-a-line/LESSON.md:234-235`), and Lesson 14's quick check 2 marks "At the end of a
phrase, where the words pause" right (`lessons/14-phrasing-whole-song/LESSON.md:287-289`). This
page's Step 1 makes the phrases bars 1 to 4 and 5 to 8 (LESSON.md:214-217), then marks breaths
after bars 2, 4 and 6: two of them inside a phrase. Step 4 says only "Breathe at the breath marks."
FACTS 67 argues the 13.3 s phrase but not the contradiction, and the coach's question (LESSON.md:
595-596) does not mention it.

**Fix.** Either say it on the page in Step 4, in a sentence the coach signs ("At this slow tempo
each phrase takes a quick breath halfway, at bars 2 and 6."), or make bar 4's mark the default and
ask the coach whether to add the halfway ones. Put the conflict with Lessons 14 and 18 in FACTS 67
and in the coach's question.

### S6. The No headphones path is not the season's turn-taking fallback as written, and the plan's first step is dropped without a word (LESSON.md:96-98, :355; FACTS 63; hand-back § 3 item 3)

SEASON-2 § 6.2 item 7 defines the fallback as "the page plays, then the learner sings"
(`SEASON-2.md:985-990`), and the plan's No headphones version starts "the page plays the other part
once" (`ARTICLE-PLAN.md:162`). This page's alone path plays only do and the count-in, takes the run
alone, then plays both: the learner sings, then the page plays. FACTS 63 calls it the fallback "in
the order a recording allows", citing the steps and "Just listen today" as the page's turn, but a
learner on the singing path has not taken "Just listen today", and the steps may be far above. The
departure list (LESSON.md:96-98; hand-back § 7 item 12) compares it with Lesson 26 and not with the
plan, and the clause proposed for § 6.2 item 7 (hand-back § 3 item 3) does not say the order is
reversed. Lesson 26 FACTS 62 also gave "no harmony to hear while singing" as a reason against turns;
that is still true here.

**Fix.** Either give the alone path the plan's first turn, an optional "Hear Tavi's part first"
(26.7 s, not timed into the chip), which makes it § 6.2 item 7's order and lets the learner hear
what their part will sit under; or keep it and say plainly in FACTS 63, the preamble and the
hand-back's § 3 clause that this page reverses the order (sing, then hear both) and drops the plan's
"plays the other part once", and why.

### S7. The playback's alignment cannot be built as specified (WEB-SPEC.md:420-434; FACTS 62)

"Hear it with Tavi's part schedules, on one audio-clock time, the buffer from the point that was
bar 1's first beat in the take and the other part's contour voice from its bar 1". The recorder
gives no audio-clock time for its first sample: `TakeRecorder` is `start`, `pause`, `resume`,
`stop` (a `Blob`), `discard` and `dispose` (`src/lib/voice-capture.ts:10-22`), over MediaRecorder,
whose start is asynchronous. So "the point that was bar 1's first beat" in the decoded buffer is
not known, and the error varies per take, not only per device; the lab item (:684-686) measures a
fixed round trip. Lesson 14's plan, which this page builds on, aligns differently: "from 0.2 s
before the take's first voiced frame" (`lessons/14-phrasing-whole-song/WEB-SPEC.md:575-576`), and
`verify28.py` section 8 times the playback that way while the spec says bar 1.

**Fix.** Specify the alignment from a moment both clocks see: find the first voiced onset in the
decoded buffer and set it to the audio-clock time of the listener's first voiced frame in the take
(the reader anchors there anyway), then start the part from bar 1 on that clock. A learner who came
in late then plays back late, which is honest. Add a test (a synthetic take whose recording starts
at a random offset still plays back aligned) and keep the lab's round-trip item.

### S8. The mix-up card's better idea overstates the source and contradicts Step 1 (LESSON.md:247)

"The better idea: a cadence is a full stop. It ends a sentence, not always the story." The source
is "kind of like punctuation marks" (FACTS 11, OMT 4.01), and Step 1 has just taught a cadence that
"sounds unfinished and calls for more" (LESSON.md:215-216): an imperfect cadence is no full stop.
The plan had it right: "a cadence is punctuation. A full stop may end a sentence, not the story."

**Fix.** "The better idea: a perfect cadence is a full stop. It ends a sentence, not always the
story." (or the plan's wording). FACTS 49 to match.

### S9. The SEARCH § 8 entry would fail the entry-page test as written (WEB-SPEC.md:706-708; hand-back § 3 item 6, § 6 item 9)

`src/tests/entry-page-model.test.ts:497-529` holds SEARCH § 8's table equal to the entry pages'
`lessonsPractised`, room by room. The `/karaoke-night` row is shared with `/jam`
(`SEARCH.md:373`, "`/karaoke-night`, `/jam` | 14"), and Jam's entry page has its own
`lessonsPractised: [14]` (`src/seo/entry-pages.ts:515` onwards). Adding 28 to that row would require
Jam's page to link Lesson 28, which does not link Jam; and adding 28 to `/ear-lab`'s row
(`SEARCH.md:370`) requires Ear Lab's `lessonsPractised` (`src/seo/entry-pages.ts:503`, `[2, 6, 10]`)
to gain 28 too. Item 15 and the hand-back name only Karaoke Night's (`:272`).

**Fix.** Say the row splits, `/karaoke-night` 14, 28 and `/jam` 14 (26 too, once Lesson 26's entry
lands, which touches the same row), and that Ear Lab's `lessonsPractised` gains 28 beside its row.

---

## Nits

1. **Hand-back § 3 item 1, card 28's misconception.** The proposed text keeps "Shown half right"
   but drops the half that was right. "A perfect cadence does sound final" is why it seems right; the
   belief's true half is that a song can end on one, which is sourced (Lesson 14's "Twinkle", R3,
   this song). Proposed: "A perfect cadence does sound final, and a song can end on one, as
   'Twinkle' does in Lesson 14 (lessons/14-phrasing-whole-song/LESSON.md:182-184); but cadences end
   phrases all through a song, and the interrupted cadence, V to vi, seems to end, then keeps
   going." "as Lesson 14's perfect and imperfect cadences show" does not follow: an imperfect
   cadence shows the other thing. The rest of the entry holds (`SEASON-2.md:692-695`, `:711`).
2. **Harmony Stack "sings a scale"** (LESSON.md:472-473; hand-back § 7 item 14, "a scale's chord
   tones"). It harmonises the room's tune, the next singers a third and a fifth above in the key
   (`harmoniseItems`, `src/lib/jam/jam-modes.ts:134-153`; FACTS 74 says it right). Say "it needs a
   friend, and its parts are the room's tune moved up a third or a fifth, not a written part".
3. **The answering plays' spoken summaries drop A4** (WEB-SPEC.md:249-251): "Tavi's part F sharp 4
   to G 4, Merc's D 3, D 3, then G 3". Tavi's bars 7 and 8 are A4, F♯4, G4; the summary lists all of
   Merc's notes and two of Tavi's. "Tavi's part A 4, F sharp 4, then G 4".
4. **The plagal tag's chords are not "under" both parts** (LESSON.md:36-37, "over the chords";
   :258, "the chords IV and I sound under them"). C4, E4, B3 and D4 sit between Merc's G3 and Tavi's
   G4. "with the chords IV and I in the soft tone".
5. **The coach's list says "the plagal tag's chords, C3 to G4"** (LESSON.md:559-560). The soft
   tone plays C3, C4, E4, B3 and D4: C3 to E4; G4 is Tavi's sung part.
6. **The playback's 26.9 s** (FACTS 38, 62; LESSON.md:380; WEB-SPEC.md:428) comes from Lesson 14's
   "0.2 s before the first voiced frame" (verify section 8), not from the spec's own start at bar 1,
   which gives 26.67 s and a release. Settle it with S7.
7. **"Each two-bar span is 6.25 s of singing"** (LESSON.md:595; FACTS 67): the last, bars 7 and 8,
   has no mark after it and runs 6.67 s. "Each of the first three".
8. **238 words a minute has no source** in FACTS 3 or Sources; Lessons 20 to 24 cite it ("Brysbaert
   2019, as Lesson 3 FACTS 61 reads it").
9. **The kit's Listener exposes no stream** at `c60f0fdcb` (`Listener` is `holding`, `latest`,
   `release`, `releaseNow`, `src/features/lessons/kit/listen.ts:36-45`), and
   `createTakeRecorder(listener.media)` needs one. Lesson 14's spec does not list it either; add it to
   item 8 here.
10. **The fair-guess line skips its step** (LESSON.md:173-174): "an ending on do sounds finished
    ... which made "Tavi's part" a fair guess" leaves out why: a song that goes on seems not to have
    reached do in its tune. "To most listeners an ending on do sounds finished, as in Lesson 4: a song
    that went on seems not to have reached do, which made "Tavi's part" a fair guess."
11. **The voice choice after "Just listen today"** (LESSON.md:325-327): nothing on that path uses
    it (Play the song sounds both parts at their pitches for everyone, FACTS 83), and there is no
    later lesson this season to store it for. Skip it on the listening path, or say why it is asked.
12. **The coach's list names D3 twice in bar 7 but not bar 4's whole note on D3** (LESSON.md:
    564-567), the longest note at the lowest pitch, two semitones above the tenor's floor, held four
    beats less the breath. Worth a line beside the question on D3 feeling low (:587-588).
13. **Sing it's lock line says "unlock this figure"** (LESSON.md:405-407) where it locks three
    buttons. "Choose an answer at the top to sing or listen here."

---

## What I checked and found sound

- **The music, worked by hand.** Both parts note by note in both clefs; syllables (mi re do mi fa
  mi re mi fa so mi re ti do; do ti la do re do so do re mi do so so do); every vertical (tenths
  11 of 14, twelfths 2, octave 1; the bridge 24 tenths and a twelfth); widest moves 4 and 5
  semitones. Bar 4 A4 over D3, V, re over so: imperfect. Bars 7 and 8 V to I, root position, do on
  top: perfect. The way it kept going: E3 under G4, the root and third of vi: interrupted; only the
  lower part's bar 8 differs. Plagal: C3 G3 C4 E4 G4 then G3 B3 D4 G4, root position, G common.
  Bridge opens on vi and ends on V; A A B A, 32 bars. "Leapt up from D to G" (a fourth, four
  letters) and "stepped up to E" are right, and the plan's "fell to G" was rightly corrected. No
  ledger lines; clef positions right (D3 the bass staff's middle line, F♯4 the treble's bottom
  space, D5 its fourth line).
- **Tempo and durations** at quarter note = 72: beat 0.833 s; two bars 6.67, four 13.33, eight
  26.67, ten 33.33, sixteen 53.33; a breath 0.42; the run 31.4 s, 33.4 s with the quiet check.
- **Ranges** against all six `VOCAL_RANGES` presets (`src/stores/settings-store.ts:91-152`): lower
  D3 to B3, bass 10/5, baritone 7/8, tenor 2/13; upper F♯4 to D5, alto 13/3, mezzo 9/7, soprano 6/10.
  Every edge at least 2; the table in LESSON.md and FACTS 37 is right, and so is the Move do and
  octave arithmetic (FACTS 68).
- **Leak surfaces other than B1 and S2**: title, promise, sound gate, chips, head title and
  description, og and twitter lines, share card alt, structured data, llms.txt line, the bound tease,
  both bubbles (Tavi's argues for the wrong part; Merc's names none), the recall (Lesson 18 Q2 and
  Lesson 26 Q2, word for word as their packages stand), the three words (Cadence plays bars 3 and
  4), the lesson menu's four headings (`stepsOf`, `lesson-menu.ts:143-164`), Steps 1, 3 and 4's text,
  Step 2's text held as a reveal element, the tour held (`holdTour`, `tour-gate.ts:57-69`; "One step
  at a time" targets `#stepsStage`, `tour-copy.ts:44-46`), the steps' figure and free play drawing
  the empty strip. None states the answer. No earlier lesson names the interrupted cadence on the
  page.
- **The season's close.** At `c60f0fdcb` the kit's close is `SEASON_END`, "End of Season 1",
  "You've seen every note you sing. Now sing a whole song." (`lesson-copy.ts:130-141`), drawn once
  (`next-card.ts:188-193`) and not rest-aware; `nextCard` returns null for a lesson its season lacks
  (`next-card.ts:106-107`), and `LESSONS` holds 0 to 14 (`season.ts:405-419`), so a Lesson 28 page
  today draws no card and keeps its mark: the writer is right. No Lesson 14 page exists in the app
  (no `learn/14.html`), so "as the app has them" means the kit's close and Lesson 14's package; L28's
  close, its rest version and its last "How did that feel?" match Lesson 14's package
  (`LESSON.md:257-267`, `:340-347`). No tease anywhere.
- **Karaoke Night**: the card is Lesson 14's word for word; entry page lines `:271`, `:290`, `:294`;
  pitch class scoring by default (`pitch-compare-engine.ts:39-40`, `:98`; called without the option,
  `useStemMixerMicController.ts:107-110`); its in-memory take; free outside `PREMIUM_EXERCISES`.
- **Ear Lab's Cadence**: eight progressions (`chord-progression.ts:13-22`, seeded in
  `progressions.ts:56-64`), five ending on V, one V to I, two on IV; the drill strums only the listed
  degrees; timing, roving (C3 to B3), four pads, nothing locked: as FACTS 72 and 73 say.
- **Harmony Stack's reasons** for leaving it off hold (two peers, `jam-modes.ts:45-51`; Lesson 26's
  card carries it; the 27-word headroom), bar nit 2.
- **Sing it**: shared lines word for word with Lesson 26 (comfort check, "Just listen today" form,
  voice choice, headphones line and quiet check with "Tavi's part", "What this does" with Lesson
  14's two sentences, reading lines, endings) and Lesson 18 (cues, do first, count-in); the kit
  pieces it reuses exist (`MAX_TRIES`, `afterFeeling`, `VisitEnding`, `mountPractiseCard`,
  `gapWords` with its `whose`, `contourVoice`, `at`, the hush, `playNotes`), and every new piece is
  listed as new in What the kit and the app still need; Lesson 26's item 6 does give the part under a
  take "so Lesson 28 can". The voice-safety house rules hold.
- **Length and time**: 2,051 + 150 = 2,201 the brief's way, under the 2,230 aim; with the page's 151
  own lines, 2,352, as Lesson 26 counts it. 2,352 / 238 = 9.88 min; the activity list sums to 539.0
  s; 18.87, so 19. The head description is 130 characters and contains "A nineteen-minute lesson"
  (`lesson-pages.test.ts:156-159`, `:191-210`; "nineteen" in `MINUTE_WORDS`); title 45 characters.
- **Sources**: the Wikipedia quotations (lead, Common classifications, Authentic, Half, Plagal with
  Caplin's "Most examples of plagal cadences given in textbooks", Deceptive with "hanging" and
  "frequently used in popular music") are verbatim at revision 1373604555. Claims stay at their
  sources' strength ("seems to end", "sounds final"), bar S8.
- **No asterisks in cited quotations**; the one bolded address inside a quoted line, the rest card's
  (LESSON.md:461-462), is Lesson 14's own form.

## Cited lines read by hand

`kit/predict.ts:1-80`; `kit/next-card.ts:1-210`; `kit/lesson-copy.ts:1-80`, `:120-141`;
`kit/page-state.ts:45-70`; `kit/season.ts:95-112`, `:400-460`; `kit/lesson-menu.ts:100-170`;
`kit/tour-gate.ts:55-70`; `kit/tour-copy.ts:42-47`; `kit/comfort.ts:38-42`, `:56-60`, `:99-150`;
`kit/take.ts:52-55`; `kit/band-words.ts:40-75`; `kit/listen.ts:14-60`; `kit/run.ts:1-42`,
`:110-116`, `:160-170`; `kit/sound.ts:20-50`, `:105-120`, `:175-185`, `:310-350`, `:525-545`;
`kit/merc-duo.ts:110-225`; `kit/drafts.ts:25-41`; `kit/team-notes.ts:28-46`;
`kit/page-chrome.ts:125-130`; `kit/step-deck.ts:1-10`; `kit/now-playing.ts:36-41`;
`stores/settings-store.ts:88-152`; `seo/entry-pages.ts:240-300`, the `paths` and
`lessonsPractised` lines; `seo/render-entry-page.ts:70-95`; `tests/entry-page-model.test.ts:485-530`;
`tests/lesson-pages.test.ts:60-90`, `:150-215`; `lib/ear/progressions.ts:1-80`;
`lib/guitar/chord-progression.ts:13-22`; `features/ear-lab/CadenceDrill.tsx:1-20`, `:87-180`,
`:210-222`; `lib/ear/timing.ts:205-222`; `lib/ear/item-bank.ts:158-168`; `lib/ear/drills.ts:190-203`;
`features/ear-lab/instruments.ts:95-108`; `lib/ear/path.ts:1-10`; `lib/jam/jam-modes.ts:30-160`;
`lib/pitch-compare-engine.ts:30-60`; `features/stem-mixer/useStemMixerMicController.ts:100-114`;
`lib/use-karaoke-voice-capture-controller.ts:1-8`; `lib/voice-capture.ts:1-30`, `:60-100`;
`stores/mic-latency-store.ts:18-23`; `lib/mic-manager.ts:44-58`; `lib/native-build.ts:50-70`;
`lib/lesson-marker.ts:9-20`; `workers/db-worker/src/mirror-metrics.ts:55-63`; `lesson-gate.ts:132-136`;
`lib/sw-runtime.ts:90-95`, `:121-125`; `tools/draft-lessons.ts:80-92`; and in the plans SEASON-2
`:140-158`, `:680-722`, `:73-100`, `:813-816`, `:838-846`, `:955-990`, `:1080-1092`, `:1144-1148`;
CURIOSITY-MOMENTS `:520-545`; MERC-BIBLE `:25-45`; HANDOFF `:260-268`; Lessons 12 (`:196-204`,
`:336-346`), 14 (`:125-131`, `:178-186`, `:225-360`, WEB-SPEC `:564-591`), 18 (`:228-345`), 23
(`:193-197`), 26 (`:95-200`, `:240-250`, `:270-372`, `:372-400`, `:484-515`, WEB-SPEC `:661-713`,
`:727-730`, FACTS 62 to 68) and 27 (FACTS 5, WEB-SPEC `:384-392`, `:538-548`, LESSON `:410-422`).
