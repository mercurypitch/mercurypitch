# Lesson 18 hand-back: Read and sing a whole line (after the fix pass)

Package: `docs/plans/find-your-pitch/lessons/18-read-a-line/` in /dev/shm/s2plan, files FACTS.md,
LESSON.md and WEB-SPEC.md (RESEARCH.md and ARTICLE-PLAN.md untouched). Copies of all three are in
`/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/18/`.
The Phase 1 files and hand-back are kept in `.../s2pkg/18-prefix/`. Nothing is committed, and no
shared file, other lesson's file or code was edited.

- Words: 2,177 on `node scripts/lesson-words.mjs`, cap 2,379, 202 under, and under the lead's aim
  of 2,230. Each step's own text is 82 to 119 words. The built page comes to about 2,327 with its
  hints, 52 under the cap, so no cut is needed; the order, if one is, is in WEB-SPEC, Length.
- Run time: 9.15 minutes of reading plus about 7.25 of sound, toys and tasks, about 16.4. The chip
  stays at 16.
- Head description: 149 characters, with the minutes as a word: "How do singers read a tune they've
  never heard without stopping on every note? A sixteen-minute lesson with sound toys: read and sing
  a tune in time." With "seventeen" it would be 151, still inside 160.
- plan-cites: 247 citations, 0 findings.
- Every sung part is written in full: the start, tune 1, tune 2, both octaves, both clefs, and the
  range table for all six presets. LESSON.md, "For the vocal coach", lists every line to sign off,
  now including the three the review found missing. Its "To confirm" items are: the breath mark's
  place, nothing playing during a take, the key G, a so that feels high, how each note is read, and
  the pitch line hidden during a take.

## The fix pass: the review of 2 November 2026

### Blocking, all fixed

1. **The predict is recast on Step 1's demonstration**, so its answer is heard, not asserted. The
   season's hook is kept. The new predict: "Merc gives each note a beat to name it, then sings it.
   At 60 BPM, how much of the tune does he sing before the two bars end?" [ All seven notes, each a
   beat late ] [ Only the first four ]. The read plays the answer. Merc's bubble is now "Let's try
   it your way, on the beat."; the old "Watch what my eyes catch." is gone. FACTS 1a lists every
   place checked against the predict:
   - the title and the hook, the promise and the sound gate;
   - the head, the share card and the structured data's "teaches";
   - Lesson 17's next-lesson card;
   - the bubbles, the choices and the stage;
   - the step headings and the lesson menu, and the section headings;
   - the recall and the four words;
   - Step 1's lock, Step 2's, the tour's hold, and the unlock once the lesson is done.
2. **The beat arithmetic is fixed everywhere.** The notes sound on beats 2, 4, 6 and 8, so they fall
   1, 2, 3 and 4 beats behind. This is now right in Step 1's text and Notice, its live region,
   FACTS 38, the cold open and WEB-SPEC Toys 1 and 2.
3. **The in-time reader is anchored on the singer's first note**, as The Chart's first tap anchors
   its bar. Each note is still judged in its own beats.
   - **The anchor:** the take's first run of voice of at least 0.15 s, if it starts between a
     quarter of a beat early and two beats late.
   - **The windows:** a quarter of a beat either side of each note's beats.
   - **Heard on its note:** 0.45 s within 60 cents, folded, with half-back.
   - **A note not heard on its note** is read only from its own beats, after a 0.15 s attack, with
     0.3 s of voice needed. It reads "We didn't hear a steady note there." when there is too little
     voice, when its voice sits within 60 cents of a written note up to two places away, or when no
     anchor was set. It never reads as a gap measured from the wrong note.
   - "It doesn't score your timing" stays true.

   It is specified in WEB-SPEC Toys 5, and covered by test 7, the edge cases, lab item 15 and the
   Page QA list. It was simulated in `verify18.mjs` section 8, a scratch script. Results:
   - tune 1 a whole beat late, 1.5 beats late or 0.2 s early reads as on time;
   - with both sos left out and mi 0.1 s early, both sos read not steady;
   - 2.5 beats late, or drifting, gives no gap line;
   - re sung as fa reads its gap;
   - mi sung 150 cents flat reads not steady, since it sits near re. This is the cost of never
     measuring from the wrong note, and it is listed in the edge cases.

### Should fix, all taken

1. **Free play:** Step 1's state stays locked in the Wrap until the choice. Step 2 is no longer
   locked anywhere (see "Not taken as asked").
2. **The short figures** are quarter notes, with a half note for the hairpin, with no time
   signature, bar line or beat grid, played at 60 BPM. Each changed timing:
   - Dynamics: 7.0 s;
   - Staccato and Slur: 3.0 s each;
   - Step 4's marks: 7, 2, 3, 3 and 8 s;
   - quick check 4: 7.0 s.

   FACTS 5, 41, 77, 81 and 83 are updated.
3. **The practice card:** "...and moves on once you've held a note for about half a second, or after
   eight seconds." The same change is made in WEB-SPEC's Practice links.
4. **The coach's rule** is now "how each note is read", with "heard on its note" for the 60-cent
   rule and Lesson 16's sentence on the 35-cent lines.
5. **The reading values (0.15 and 0.3 s)** are now marked as new and listed for the lab. The attack
   is counted from the note's own beat, after the anchor.
6. **Three coach lines added:** the cursor that won't wait, a note that slips, and the take's status.
   The preamble now says seven new lines.
7. **The mix-up card:** "Some teachers train patterns: in one study, ... Every group was taught the
   skills, so it shows a gain, not a winner."
8. **The breath mark:** each bar is a short phrase, so the breath comes at a phrase's end, and Step
   4 says so. FACTS 30 keeps "at a phrase's end".
9. **Lesson 20:** it is now cited by path, listed at the end. FACTS 10 says that "a run of steps"
   means neighbouring places at any speed, and that Lesson 20's Run adds "quick".
10. **Tune 1 is now do re mi so, so mi do (half)** (see "Not taken as asked"). FACTS 34 says that the
    cold open's first five notes are Lesson 16's first phrase. FACTS 39 says that the longest
    stretch heard before a take is three notes for tune 1 and two for tune 2.

### Nits, all taken

1. OMT's Example 2: the caption and the alt text are now told apart.
2. p, f, the hairpins and the breath mark sit above the staff, sourced to OMT 1.7 and to Wikipedia,
   Dynamics, which was re-read.
3. Quick check 4 has a new clip: so, fa, mi, loud then quiet.
4. Quick check 2's right answer is "The same note, sung twice". The answers to questions 1 and 3
   were rebalanced.
5. The section headings line now reads "names the one object".
6. Sing it's heading is now "Sing it: two tunes from the page".
7. Step 3 says "count "1 (2) 3 (4)", the bracketed beats in your head".
8. The coach's range item notes so at the top, held two beats. Lab item 15 names the 0.6 s note
   before each breath.
9. The bracket's height over D4 is now in lab item 15 and FACTS 84.
10. Step 1's toy opens unlocked once Lesson 18 is done (`Done`, `progress.ts:22-29`).
11. Each tune has its own Play the start on the no-microphone path.
12. The drill "never writes the same note twice running", and the claim about "line" is softened.

### Not taken as asked, and why

- **Step 2's lock was removed**, where the lead asked for free play to keep Steps 1 and 2 locked.
  Under the recast predict, Step 2's tunes and brackets bear on nothing the predict asks, so its
  lock guarded nothing. Step 1's lock holds in the step and in free play. If the lead wants Step 2
  locked as well, the change is small: Toys 2's lock paragraph and state 2, edge case "Before a
  choice", tests 10 and 20, and FACTS 1a.
- **Tune 1 was changed**, where the review recommended only documenting it. The plan's tune shared
  four notes in order, so mi re do, with Lesson 16's second phrase, which the learner sang. The
  review's alternative shared four, mi so mi do, with Lesson 16's start. A search found do re mi
  so, so mi do (half), which shares at most three with anything the learner has heard.
- **The anchor's span is a quarter of a beat early to two beats late**, where the review offered
  "within a beat". It is made safe by the two-place neighbour rule. The lab sets it.
- **"Mi · We heard do there." is not used.** The lead's not-steady line is used instead: naming the
  neighbour would describe the timing.
- **The planning-text test's pattern gap stays a kit item (16).** Code is off limits here.
- **A small change of my own:** nobody celebrates at the reveal. It now names the answer, and the
  way that fell behind was Tavi's guess.

## Shared-file entries for the lead to paste

### MASTER-PLAN § 11

- Lesson 18: a written lesson, text only, reviewed once and fixed, in
  [`lessons/18-read-a-line/`](lessons/18-read-a-line/) (research, article plan, facts, copy and
  page spec). Its scored checkpoint waits on the vocal coach's sign-off (§ 12 item 8). No page is
  built yet: it waits on Season 2's kit (seasons, the staff toy with both clefs and rhythm on the
  staff, SEASON-2 § 6.2 items 1 to 3, with Lesson 17's woodblock and pitch-line view of a rhythm and
  Lesson 12's sing flow with Lesson 16's additions moved into the kit; new on this page, a count-in,
  a cursor at tempo, brackets, the song sheet's marks and a take read in time from the singer's
  first note) and on the lesson plumbing for Lessons 15 to 28 (SEASON-2 § 5.2 item 21). It goes live
  with Lesson 16 (SEASON-2 § 8.2 item 4) when the console publishes it, after the coach's sign-off,
  Sight-Singing's work for the lessons and sight-singing in time (SEASON-2 § 5.2 items 10 and 11),
  and once `/learn/16` and `/learn/17`, the pages its chips and its recall link to, are live.

### CURIOSITY-MOMENTS § 2

### Lesson 18 · Read and sing a whole line · voice; written; no page yet · hook kept

- **Opening:** a bass staff of two bars of 4/4 over Lesson 17's beat grid, between Merc and Tavi,
  with Merc's tune: G3 A3 B3 A3, then G3 B3 and a long D4. Tavi "Seven notes. Don't you have to work
  out each one's name, then sing it?" Merc "Let's try it your way, on the beat." Predict: "Merc gives
  each note a beat to name it, then sings it. At 60 BPM, how much of the tune does he sing before the
  two bars end?" [All seven notes, each a beat late] [Only the first four]. Until the choice, the
  read and Step 1's toy are locked, in the step and in the Wrap's free play, and the page's tour
  waits, since Step 1 states the answer. The read: do, a bar's count-in, then the bars over the
  click. Each note's name appears over it on beats 1, 3, 5 and 7, and Merc sings it on "ooh" on
  beats 2, 4, 6 and 8, so do, re, mi and re fall one to four beats behind, and the bars end with do,
  mi and so unsung. Reveal: "Only four. Each name takes a beat, so each note falls a beat further
  behind than the last, and the bars end before do, mi and so. Merc's own way is to read a run of
  steps, then do-mi-so, each as one thing:" [Read Merc's way] "That's this lesson's story. (Seven
  was a fair guess: it's easy to miss that every name costs another beat.)" Read Merc's way sings
  the tune on the beat while a gold bracket lights over each pattern as the cursor reaches it.
- **Visual:** Lesson 16's staff over Lesson 17's beat grid (new with Season 2's kit, SEASON-2 § 6.2
  items 2 and 3); on it, all new: a cursor at tempo, names written over the notes, gold brackets
  over patterns, and the song sheet's marks written as they sound. **Payoff:** Step 1's two reads,
  Read note by note tagging each sung note with how late it came and Merc's way keeping up; the
  checkpoint, after do and a count-in, two bars read and sung in time, each note heard in its own
  beats counted from the singer's first note, timing shown, not scored.
- **Tease:** Lesson 19's stage as a still, six of Lesson 8's pads in a row, all one size and
  ungrouped, which does not play: "Same six notes, same speed. Only the accents move.", with its
  alternative `written` (Lesson 19 FACTS 5b). Lesson 18's own tease, on Lesson 17's card, is "Now you
  can read when each note comes, and where it sits." (Lesson 18 FACTS 5b).
- **Facts:** sourced in Lesson 18's FACTS: the count-in and the exam's two-bar unaccompanied tune
  (RCM 2025, pp. 7 and 9); dynamics, hairpins, staccato, slurs, ties and breath marks, and where
  dynamics sit (Open Music Theory 2e, 1.7 and 1.8; ABRSM 2023; Wikipedia, Dynamics, at a named
  revision); pattern teaching (Henry 2004, abstract only); the app at `c60f0fdcb`. Not claimed: how
  readers see or group a line. The note-by-note read's beat a name is the page's illustration, not a
  measured time.

### SEASON-2 § 5.2 item 11, new

Add to item 11, after "pitch scored per note, timing shown.":

> Each note's beats counted from the singer's first note, as The Chart anchors a tapped bar on its
> first tap (`src/features/ear-lab/anchored-take.ts:10-11`), so a steady delay or a late entry is
> never read as a wrong pitch, and a note not heard read as not heard, never as a gap from another
> note (Lesson 18 FACTS 52, 54). Whether the click sounds under the singing, where a raw-signal
> microphone hears it, is a question for Lesson 18's lab (its WEB-SPEC, What the kit and the app
> still need, item 15).

Optional, in § 3's Lesson 18 card: its Signature's "(a run, a repeat, do-mi-so)" could read "(a run of
steps, a repeated note, do-mi-so)", as the page does, so "run" stays Lesson 20's word. Its
Misconception's "so the eye takes in groups" is not claimed by the page (FACTS 24).

### kit/season.ts (Season 2's data module), with the prerequisites (unchanged)

```ts
  {
    n: 18,
    lane: 'voice',
    title: 'Read and sing a whole line',
    short: 'Reading in time',
    topics: ['S11b', 'T32'],
    // A draft until its sign-off (drafts.ts), as Lesson 3 is.
    minutes: 16, // once the page is built
    page: '/learn/18', // once the page is built
    hook: "How do singers read a tune they've never heard without stopping on every note?",
    pr: {
      needs:
        'Sight-singing in time: a count-in, a click and notes that move on the beat, pitch scored per note (SEASON-2 § 5.2 item 11)',
      link: {
        href: '/pitch-training?lesson=18',
        addr: 'mercurypitch.com/pitch-training',
        label: 'Exercises',
        note: 'then tap Sight-Singing',
      },
    },
  },
```

- `EDGES`: [16, 18] and [17, 18] (SEASON-2 § 4.3).
- Topic names: S11b and T32 as SEASON-2 § 4.1 gives them.

### kit/lesson-copy.ts (unchanged)

```ts
  18: { tease: 'Now you can read when each note comes, and where it sits.' },
```

- 57 characters, inside `TEASE_MAX` (70). There is no alternative, so no `teaseAlts` and no team
  note.
- The hook is the season's, word for word, and goes in season.ts, so there are no `hookAlts`.

### Other one-liners (unchanged)

- drafts.ts: `18: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)",`
- The admin console's signature line: "Lesson 16's staff over Lesson 17's beat grid; a cursor moves at
  tempo, patterns bracket themselves as it reaches them, and the song sheet's marks appear over the
  sounds they ask for."
- llms.txt, on release: "Lesson 18, Read and sing a whole line: count in, read and sing a short tune
  in time, and read the marks a song sheet carries."

### Lesson 17's package needs three edits, for the lead

Lesson 17's still of this stage uses the plan's C pitches and "the learner's clef", and its FACTS 5
quotes the plan's old predict. This stage is Merc's tune in G, on the bass staff for everyone. Line
numbers are at `26d90e225`.

- `lessons/17-note-lengths/FACTS.md:52` (fact 5):
  - "which asks how many separate things Merc reads in a line ("Seven: one per note" or "Two: a run
    and a chord")" becomes "which asks how much of his tune Merc sings before two bars end when he
    gives each note a beat to name it ("All seven notes, each a beat late" or "Only the first
    four")". Its citation moves from Lesson 18's ARTICLE-PLAN.md:34-35 to Lesson 18's
    LESSON.md:124-126.
  - "it leaves out the card's "Put the two together", whose "two" would lean towards that predict's
    answer": under the recast, "two" no longer leans. The tease can stay as settled, and this
    reason can be cut.
  - The still: "in the learner's clef: two bars, four quarters and then two quarters and a half
    note, C4 D4 E4 D4 and C4 E4 G4 on the treble staff, or an octave lower on the bass, with the beat
    grid under them and no cursor, no bracket and no syllable" becomes "on the bass staff with its
    clef and 4/4, for everyone, since the tune is Merc's: two bars, four quarters and then two
    quarters and a half note, G3 A3 B3 A3 and G3 B3 D4, with the beat grid under them and no cursor,
    no bracket, no name and no syllable" (Lesson 18 FACTS 34; WEB-SPEC, Toys 1).
- `lessons/17-note-lengths/LESSON.md:362-364`: "in the learner's clef: two bars on the staff"
  becomes "on the bass staff, as Lesson 18's stage draws it for everyone: two bars". "no cursor, no
  bracket and no syllable on them" gains "no name".
- `lessons/17-note-lengths/WEB-SPEC.md:538-545` (Toys 11):
  - "in the learner's clef from `fyp-voice` (treble for the higher voice, bass for the lower or for
    none stored)" becomes "on the bass staff for everyone";
  - "C4 D4 E4 D4 and C4 E4 G4 on the treble staff or an octave lower on the bass" becomes "G3 A3 B3
    A3 and G3 B3 D4";
  - "so it shows no group and no count, which Lesson 18's predict asks about" becomes "so it shows
    no name, no group and no count, nothing Lesson 18's predict turns on";
  - Lesson 17's Toys 1 engraves only A3 or A4, so "engraved as Toys 1 engraves" needs the pitch
    generalised. This page asks for that in its kit item 4.

## Kit and app work

In full in WEB-SPEC, "What the kit and the app still need", items 1 to 16. In short:

1. The host, `learn/18.html`, and the draft line.
2. Seasons in the kit.
3. **The reading staff:** Lesson 15's staff toy plus Lesson 17's rhythm on the staff, with:
   - quarters and halves at any pitch in either clef, each stem set by its side of the middle line;
   - short figures with no bar line;
   - the beat grid under two bars, a count-in strip, and a cursor at tempo;
   - names written over notes, and Step 1's lag tags;
   - gold brackets that are buttons;
   - the marks: p, f, the hairpins and the breath mark above the staff, written as they sound;
   - Step 1's lock until the predict's choice, in the step and in free play, with none once Lesson
     18 is done;
   - loudness shown as brightness.
4. The woodblock in the kit (Lesson 17's item 11) and a count-in.
5. The tap pad's tempo readout, from the existing `createTapTempo`.
6. **The sing flow in the kit** with Lesson 16's additions, and a take read in time:
   - the start, do and then the count-in, on the audio clock;
   - frames kept from half a beat before bar 1, until the last note's window closes, moved by the
     anchor, through Lesson 16's proposed `until`;
   - `kit/read-in-time.ts`, new: the anchored reader above, with no device delay to measure;
   - the silent cursor during the take;
   - the pitch line on the bars' time axis.
7. Dynamics, staccato, slurs and breaths in the kit's runs.
8. No decorative staff.
9. The lesson copy.
10. The app's lesson plumbing (SEASON-2 § 5.2 item 21).
11. Sight-singing in time and Sight-Singing for the lessons (§ 5.2 items 11 and 10).
12. The head and share card.
13. Lessons 16 and 17's questions as modules.
14. **The lab on a phone**, with the coach where a take is sung:
    - the reader's values on real takes;
    - whether 0.45 s is reachable, on the 0.6 s note before each breath too;
    - how often learners come in late or drift;
    - whether a quiet click under the take helps without disturbing the reader;
    - the p, f and woodblock levels;
    - the figure's width and height at 344 to 390 px, with a bracket over D4;
    - the run time.
15. Found here: `src/e2e/learn-no-planning-text.spec.ts:39`'s topic-code pattern, `\b[TS]\d\d\b`,
    misses Season 2's lettered codes S11a, S11b, S20a and S20b. It needs an optional `a` or `b`
    before Lesson 16, 18, 24 or 26 is built.

## Departures from ARTICLE-PLAN.md

Each is explained in FACTS. The main ones are in LESSON.md's preamble.

1. Every pitch is in G, not C (the lead's answer). The range table is Lesson 16's.
2. **The predict asks what reading note by note costs, and its answer is heard.** The plan asked
   "Seven: one per note" or "Two: a run and a chord". The title ruled out the first, and the
   answer was drawn, not heard.
3. The reveal says what the read played and what Merc's way does. It drops "the eye takes in a
   group", which no source supports.
4. The predict asks about "the tune", not "this line": "line" means a line of the staff here.
5. No step heading names a pattern. Step 1's toy is locked until the choice, in the step and in free
   play, and opens unlocked once the lesson is done. Step 2 is never locked. The tour waits.
6. The cold open's tune is Merc's, on the bass staff for everyone, sung on "ooh".
7. The checkpoint's tunes are never played before they are read. Step 3 has tune C.
8. **Both checkpoint tunes are new.**
   - Tune 1 is do re mi so, so mi do (half). The plan's, and the review's alternative, each shared
     four notes in order with Lesson 16.
   - Tune 2 is do do mi mi, so (half) do (half). The plan's was the cold open's tune with its last
     note changed.
9. **The start and the take.** The start is do and the count-in, with no tonic triad, which would
   sing tune 1's last three notes. Nothing plays during a take. Each note is read in its own beats,
   counted from the singer's first note.
10. Step 2's second tune is new, and its "Patterns on · off" switch is dropped.
11. Step 4's breath mark plays on tune C. Each bar is a short phrase.
12. The quick check asks one question a step, and question 4's clip is new.
13. The practice card says what Sight-Singing does today, and when it moves on. The plan's
    "practise the patterns here" is dropped, since the drill never writes the same note twice
    running.
14. The promise drops "two-bar".
15. There is no Go deeper drawer, for length.
16. The sound gate and the chips use Lesson 16's form.
17. The mix-up card cites Henry 2004 alone, as a gain, not a winner. Mishra 2014 is left out.
18. Step 3 names the Royal Conservatory's voice exams. Half notes are counted "1 (2) 3 (4)".
19. The feedback is Lesson 16's lines, one a note.
20. The tease on this page's card is Lesson 19's own.
21. The coach's range is G3 to D4 and G4 to D5. The plan's "Lesson 20 sings staccato" is corrected.
22. The short figures play at 60 BPM as written, and the marks sit above the staff.
23. The length is 2,177 words, against the plan's budget of about 1,950. It is 202 under the cap.

## Lesson 20, now cited by path

Lesson 20 is committed at `26d90e225`, so every citation of it is a path now:

- FACTS 10: its Run word (`lessons/20-runs-pentatonic/LESSON.md:156`) and its FACTS 28
  (`lessons/20-runs-pentatonic/FACTS.md:86`).
- FACTS 27: its Step 4 (`lessons/20-runs-pentatonic/LESSON.md:225-233`) and its FACTS 29 and 30,
  "the dot is left to Lesson 18" (`lessons/20-runs-pentatonic/FACTS.md:90-91`).
- FACTS 42: its coach lines (`lessons/20-runs-pentatonic/LESSON.md:447-451`).
- FACTS Sources: Lessons 16 and 20 are cited by path at the branch head.

LESSON.md names Lesson 20 twice, in its preamble and its coach list, and points each to these FACTS.

## Owner questions

None is open. Both owner decisions were taken as recommended (WEB-SPEC, Decisions for the owner):
the title "How to sight-sing a melody in time | MercuryPitch" (49), and release after SEASON-2
§ 5.2 items 10, 11 and 21, with Lesson 16.
