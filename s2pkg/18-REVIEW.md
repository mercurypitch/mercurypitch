# Lesson 18 review: Read and sing a whole line

This is an independent review of `docs/plans/find-your-pitch/lessons/18-read-a-line/` (FACTS.md,
LESSON.md and WEB-SPEC.md). I read it in `/dev/shm/s2plan` at `26d90e225`, with the package
uncommitted. The scratchpad copies in `s2pkg/18/` are byte for byte the same as the worktree files.
The branch changes only docs, so the worktree's `src/` is the app at `c60f0fdcb`. I read every app
line through `git show c60f0fdcb:<path>`.

I checked it against:

- RESEARCH.md, ARTICLE-PLAN.md, BRIEF-18 (the lead's four answers, the teases, the notes from
  Lesson 20) and the common brief's list of what earlier reviews caught;
- SEASON-2 § 1.4, § 1.5, the Lesson 18 card (`SEASON-2.md:294-330`), § 4.3, § 5.2 items 10, 11
  and 21, § 6.2 item 7 and § 7;
- CURIOSITY-MOMENTS § 1, TEACHING-PLAYBOOK (its rules and house rules), MERC-BIBLE § 2, HANDOFF § 5
  and § 6, SEARCH.md § 12, and the copy rules in the `kit/lesson-copy.ts` header;
- Lesson 16 (all three files, committed), Lesson 17 (its LESSON.md, its FACTS 5, 65 and 66, its
  WEB-SPEC quiz ids), Lesson 19's FACTS 5b and stage, Lesson 20 (committed: its Run word, Step 4,
  FACTS 28 to 30 and coach lines), Lesson 14's Step 2 and FACTS 26, and Lesson 23's lock and free
  play as the model;
- the app at `c60f0fdcb`: Sight-Singing's controller and component, The Chart, `VOCAL_RANGES`, the
  kit's predict, take, band-words, listen, comfort, quiz, tap pad, tour gate, lesson menu and step
  deck, `match-bands.ts`, `mic-manager.ts`, `f0.ts`, the head test and the lesson marker.

How the review was done:

- **Read-only.** I edited nothing in the worktree and downloaded nothing.
- **Node scripts.** plan-cites: 221 citations, 0 findings. lesson-words: 2,120, 259 under the cap,
  which matches FACTS 3 and WEB-SPEC Length. Each step's own text runs 82 to 118 words.
- **The cited lines.** I printed all 111 distinct `src/`, `workers/`, `tools/` and `scripts/`
  citations at `c60f0fdcb` and read each one. Every one says what the package says it does. The
  findings below are about what the package builds on those lines, not about the citations
  themselves.
- **Sources.** I made two WebFetch reads. Wikipedia "Dynamics (music)" at revision 1380057565
  matches both FACTS 26 quotes, which carry no footnote, as FACTS says. Open Music Theory 2e 1.7
  matches every quote in FACTS 25 to 28 and 30, except where the Example 2 wording sits (nit 1). The
  RCM 2025 quotes match the writer's own extraction notes; I did not re-read the PDF.
- **The hand-back.** I read it last, only to check its claims (see the end of this report).

**Counts: 3 blocking, 10 should fix, 12 nits.**

Line numbers are the package files' as they stood at 03:26.

---

## Blocking

### 1. The title and the step headings answer the predict, and the predict's answer is constructed, not heard

**Where:** the title and hook, LESSON.md:79-80, the head description and og/twitter descriptions
(WEB-SPEC.md:95-102), and Lesson 17's next-lesson card, which prints the hook; the predict,
LESSON.md:108-110; Step 1's heading, LESSON.md:160, which the lesson menu lists from the first paint;
Step 2's heading, LESSON.md:182; Merc's bubble, LESSON.md:106; FACTS 1a (FACTS.md:46).

**What is wrong:**

- **The title rules out the first choice.** The predict has two choices: "Seven: one note at a time"
  and "Two: a run of steps, then do-mi-so". Directly above it, the title asks how singers read
  "without stopping on every note". So it already says singers do not read one note at a time. With
  only two choices, ruling one out gives the answer. CURIOSITY-MOMENTS § 1 rule 4 says "The title
  must not answer the predict", and HANDOFF § 5 calls a leak the season's most common finding.
  - The plan's header says the title "names no pattern and no number, so it does not answer the
    predict" (ARTICLE-PLAN.md:14-15), and FACTS 1a repeats it. That test is too narrow. The title
    does not need to name the right answer to leak it: ruling out the wrong one is enough.
  - The same hook sits in the meta description, in og:description and on Lesson 17's next-lesson
    card. So a learner meets it before they reach this page.
- **The menu and the bubbles push the same way.** The menu lists Step 1's heading from the first
  paint: "Do I have to name every note?". As a step heading, a yes-or-no question reads as "no".
  Step 2's heading, "What should my eye look for?", says there is something to look for besides
  the notes. Merc's bubble, "Watch what my eyes catch.", says his eyes catch something bigger than a
  note.
  - Merc's line also brings back the eye claim the package dropped elsewhere. FACTS 24 says no
    source tells how readers see a line.
- **The recall makes it worse.** The recall question is mandated, so it is not the writer's to
  change. It sits under the predict, where a phone shows it before the choice, and it reminds the
  learner that do-mi-so is a shape on the staff.
- **The answer is never heard.** The reveal says "Two" because Merc's read is built that way:
  brackets light over the two patterns (FACTS 35 and 36, "by construction"). A learner who chose
  "Seven" hears seven notes sung on the beat. Nothing in the sound tells the two answers apart.
  - CURIOSITY-MOMENTS § 1 rules 2, 3 and 7 ask for a reveal that is heard and shown, and every
    hook answered from FACTS.
  - Step 1's note-by-note read is the only demonstration with a result you can hear.

**Fix:** this is the lead's call. Either option works with Step 1's heading kept.

- **(a) Recommended: put Step 1's demonstration into the predict.** It stays local to this page and
  makes the answer heard. The predict would read:

  > Merc gives each note a beat to name it, then sings it. At 60 BPM, how much of the tune does he
  > sing before the two bars end?
  >
  > [ All seven notes, each a beat late ] [ Only the first four ]

  - The answering play is the note-by-note read.
  - The reveal: "Only four. Each name costs a beat, so every note falls a beat further behind, and
    do, mi and so never come. Merc reads a run of steps, then do-mi-so, each as one thing, and keeps
    up." Then Merc's way plays.
  - "All seven, each a beat late" is a fair guess: the package itself makes that very error (finding
    2).
  - The title does not decide between the two. Both answers are costs of stopping on every note.
- **(b) Keep the predict and change the season's hook.** Keep the current hook as an alternative,
  as HANDOFF § 6 asks for any changed hook. For example: "How do singers read a tune they've never
  heard and keep up with the beat?". Then:
  - change Merc's bubble to a line that promises nothing about eyes, such as "Watch me read it.";
  - change Step 2's heading, for example to "Which notes should I read together?" once the
    predict no longer turns on grouping, or keep it under option (a);
  - update FACTS 1a. Lesson 17's next-lesson card and SEASON-2's table follow the hook.

### 2. Step 1's Notice, its live region and three spec lines get the note-by-note read wrong

**Where:**

- LESSON.md:168: "read note by note, every note comes a beat late";
- FACTS 38 (FACTS.md:100): "each a beat after its place";
- WEB-SPEC.md:236-237: "each note sounds a beat after its place ... while the cursor is a beat
  ahead";
- WEB-SPEC.md:240, the live region: "four notes sounded, each a beat late".

**What is wrong:** the read the package specifies plays do, re, mi and re on beats 2, 4, 6 and 8.
Their written places are beats 1, 2, 3 and 4. So:

| Note       | Written beat | Sounds on beat | How late |
| ---------- | ------------ | -------------- | -------- |
| do         | 1            | 2              | 1 beat   |
| re         | 2            | 4              | 2 beats  |
| mi         | 3            | 6              | 3 beats  |
| second re  | 4            | 8              | 4 beats  |

The lag grows by a beat with every note. If every note really came one beat late, the tune would
end on beat 9, and only the last beat of so would be cut. That contradicts Step 1's own text, "the
two bars end with do, mi and so still unsung" (LESSON.md:164), which is the right one. FACTS 38
contradicts itself in a single sentence ("beats 2, 4, 6 and 8 ... each a beat after its place").

The common brief asks that "What is drawn must match the copy, the sound and the screen-reader
line". This is the step's central demonstration.

**Fix:**

- Notice: "read note by note, each note falls a beat further behind, and the bars run out first."
- Live region: "Read note by note: four notes sounded, each further behind the beat. Do, mi and so
  never came."
- WEB-SPEC Toys 2: "do sounds a beat after its place, re two beats, mi three and the second re
  four, while the cursor pulls further ahead".
- FACTS 38: the same, with the table above.

### 3. The in-time reader turns timing into false pitch lines, while the page says it doesn't score timing

**Where:**

- WEB-SPEC.md:413-439, the in-time reader, and :690-692, the edge case "a whole tune sung a beat
  late reads gaps or not-steady lines";
- FACTS 52 and 54 (FACTS.md:140, :142);
- the "What this does" box, LESSON.md:256-260: it says the page "measures how far each of your
  notes sits from the written note" and "doesn't score your timing";
- the coach's "a note left out ... changes nothing else", LESSON.md:497-499.

**What is wrong:** each note's window reaches a quarter of a beat into its neighbours. A note that
misses the 0.45 s in the band is then read from the median of all voiced frames in its window.

- **A late singer gets wrong pitch lines.** A singer who is in tune but more than 0.8 s late on a
  quarter note (FACTS 52 gives that limit) has mostly the previous note in the window. So the line
  gives a cents gap from the wrong note. Take tune 1 sung a beat late:
  - mi's window holds the singer's do, so mi reads "About four semitones below, nearer a different
    note." (`semitonesAway`, `take.ts:80-86` at `c60f0fdcb`);
  - every later note reads the same way.
  - The page tells the learner they sang four semitones flat, when they sang in tune and late.
    That breaks the box and the card's "timing is not scored", and it is not a description of the
    sound (playbook rule 21).
  - At 60 BPM, with a silent cursor and no click during the take, a reader lagging by about a beat
    is a likely case, not a rare one.
- **A note left out is fragile.** The page tells the learner to leave out a high so. The second
  so's window, [2.75 s, 4.25 s], ends 0.25 s into bar 2's mi. A learner who comes back in only
  0.05 s early has 0.3 s of mi in the window. That meets the 0.3 s "steady" test, so the left-out
  so reads "About three semitones below, nearer a different note", not "We didn't hear a steady note
  there."
- **The app's own reading drill does it differently.** The Chart anchors its take on the reader's
  first onset: "silence until the first tap, which anchors the take as the pattern's first onset"
  (`src/features/ear-lab/ChartDrill.tsx:5-13`). It also keeps the beat sounding: "From there the
  beat keeps you company" (`ChartDrill.tsx:54`). This page anchors on the scheduled first beat and
  keeps the beat silent.

**Fix:** keep the lead's answer, each note judged in its own beats, and change how the reader
places the windows and words the misses.

1. Anchor the windows on the singer's first voiced onset of do, when it falls within a beat of bar
   1's first beat, as The Chart anchors on its first tap. A late entry then shifts every window
   with it.
2. Read a note that is not in the band only from frames inside its own beats, not the widened
   window.
3. When those frames sit within 60 cents of a neighbouring written note, folded, say so: "Mi · We
   heard do there." Or give the not-steady line. Never give a cents gap measured from the wrong
   note.
4. Add reader tests:
   - a tune sung on pitch but a whole beat late gives no cents-gap line;
   - so left out, with mi coming in 0.1 s early, reads "We didn't hear a steady note there."
5. Rewrite the edge case at WEB-SPEC.md:690-692 to match.
6. Add a lab item: whether a quiet click under the take disturbs the reader. SEASON-2 § 5.2 item 11
   plans "a count-in and a click" for the app's own drill, and a click makes timing errors less
   likely.

---

## Should fix

### 1. Free play in the Wrap unlocks Steps 1 and 2 before the choice

**Where:** WEB-SPEC.md:269-270 ("Free play (Wrap). Every state above, unlocked"), against the lock
at :272-276; FACTS 5b (FACTS.md:52), "so the tune sounds only after this page's choice, as Step 1's
lock keeps it".

**What is wrong:** the Wrap is reachable by scrolling before the predict's choice. In Lesson 23's
model, free play runs "whether or not a choice was made" (Lesson 23 WEB-SPEC.md:263-267). So here a
learner could play Read Merc's way, with its brackets, and the cold open's tune before choosing. That
defeats the lock, and FACTS 5b's claim with it.

**Fix:**

- Free play keeps the Step 1 and Step 2 states locked until the predict's `onChoice`, with the same
  lock line.
- Add free play to test 10 and to the edge case "Before a choice".

### 2. The short figures have no written rhythm, and they sound at 100 BPM on a 60 BPM page

**Where:** WEB-SPEC.md:258-268 (Step 4's five examples) and :288-293 (the four words); FACTS 41,
77 and 81 (FACTS.md:103, :179, :183); FACTS 5 (FACTS.md:50), "every bar it writes ... is a bar of
4/4".

**What is wrong:**

- **The written values are never given.** "p, then f", Staccato and Slur play at 0.6 s onsets,
  which is 100 BPM. Notes "carry stems now" (WEB-SPEC.md:43), and Step 4's toy is "your staff", the
  reading staff whose figures are "two bars of 4/4 ... over the beat grid" (WEB-SPEC.md:224-225).
  Yet no note value, bar line, time signature or beat grid is given for these figures.
- **The page is inconsistent with itself.** The hairpin example plays a half note at 60 BPM (2.0
  s), and tune C's breath example plays at 60 BPM too.
- **Lesson 17 did this properly.** Its four words play at 60 BPM as written: "short rhythms with no
  time signature and no bar line" (Lesson 17 FACTS 65).
- **The tease depends on it.** Lesson 19 FACTS 5b rests on those figures having no bar line for
  "Every bar written this season has had four beats." That is the alternative tease on this page's
  next-lesson card.

**Fix:** write the four words' and Step 4's figures as Lesson 17's are:

- quarter notes, and a half note for the hairpin;
- no time signature, no bar line and no beat grid;
- each played at 60 BPM as written.

Retime FACTS 77, 81 and 83 to match: for example, Dynamics becomes 5 s, a beat, then 5 s. Say in
FACTS 5 that these figures have no bar line.

### 3. The practice card reads as an eight-second hold

**Where:** LESSON.md:346-347, "gives you up to eight seconds to hold each one"; WEB-SPEC.md:507.

**What is wrong:**

- Sight-Singing passes a note after 450 ms in the band and gives up after 8 s
  (`use-sight-singing-controller.ts:26`, `:29` and `:211-217`).
- "Up to eight seconds to hold each one" can be read as "hold each note for up to eight seconds".
- On a card that carries the care lines, that is a hold instruction the house rules do not set:
  holds are 5, 10 or 15 s, and only on purpose.

**Fix:** "...with no note lengths and no beat: it moves on once you've held a note for about half a
second, or after eight seconds." Make the same change in WEB-SPEC Practice links.

### 4. The coach's pass rule uses "in the band" for 60 cents, where the lines use it for 35

**Where:** LESSON.md:500-504, "a note counts as in the band once the voice has been within 60 cents
of it"; WEB-SPEC.md:429, "The note is in the band once the total reaches 0.45 s."

**What is wrong:**

- **One phrase, two meanings.** The lines say "In the band" only within 35 cents (`match-bands.ts:22`;
  FACTS 54). So a note "in the band" by the coach's rule can read "Close: 50 cents above the written
  note."
- **Lesson 16 avoided this.** It says "the lines still say 'in the band' only within 35".
- **Nothing passes.** Nothing moves on this rule, unlike Lesson 16's cursor. It only chooses which
  frames the line is read from, so "the pass rule" overstates it for a coach signing it off.

**Fix:**

- Call it "how each note is read".
- Say "counts as found" or "heard on its note" for the 60-cent, 0.45 s rule.
- Add Lesson 16's sentence on the 35-cent lines.

### 5. The reading of a note not found is not Lesson 16's, and its 0.15 s skip lands in the wrong place

**Where:** FACTS 54 (FACTS.md:142), "Lesson 16's" and "carried"; WEB-SPEC.md:431-434.

**What is wrong:**

- **The thresholds are new.** Lesson 16 reads such a note "by `readTake` over its frames, after the
  0.3 s attack and with 0.6 s of steady voice needed" (Lesson 16 WEB-SPEC.md:386-388; `ATTACK_SEC`
  and `STEADY_SEC`, `take.ts:50-52`). This page uses 0.15 s and 0.3 s, and does not say they are new
  or why.
- **The skip comes too early.** The 0.15 s is counted from the window's opening, which is a quarter
  of a beat (0.25 s) before the note's beat. So the skip drops the previous note's tail and keeps
  this note's attack, the opposite of what an attack skip is for.

**Fix:**

- Say these are new values, chosen for a 1.5 s window, and list them for the lab.
- Count the attack from the note's beat, or from the singer's onset (blocking finding 3, point 1).

### 6. The coach's list misses new lines about singing

**Where:** LESSON.md:37-39 ("Four lines are new"); Your turn, LESSON.md:247-252; the take's status,
:265-266; the coach's list, :456-533.

**What is wrong:** these are new lines that tell the learner how to sing, and none is in the coach's
list:

- "If a note slips, come in on the next one.";
- "This time the cursor won't wait for you: it moves on the beat, and nothing plays while you
  sing.";
- the take's status, "Your turn: sing in time with the cursor.".

"Breathe at the breath mark." is covered under the breath mark. So the preamble's count of four new
lines is short.

**Fix:** list all three under "The exercise", and correct the preamble's count.

### 7. The mix-up card overstates what the study left out

**Where:** LESSON.md:172-175; FACTS 22 (FACTS.md:75).

**What is wrong:**

- **"The study tried no other way of teaching"** is not literally true. Henry taught two ways, new
  melodies and familiar ones (R18-1). What it lacked was a group taught without the 15 skills.
- **"Teachers train patterns too: in one study..."** builds a general claim on a single abstract.
  RESEARCH grades it Weak for "pattern teaching works".

**Fix:** "Some teachers train patterns: in one study, ... and their sight-singing improved. Every
group was taught the skills, so it shows a gain, not a winner."

### 8. The breath mark sits mid-tune, and the page never says where Lesson 14's rule stops

**Where:** Step 4, LESSON.md:214-215; Your turn's "Breathe at the breath mark."; FACTS 30
(FACTS.md:86): "leaves out 'at a phrase's end', since its breath marks sit mid-tune".

**What is wrong:**

- **Lesson 14's rule.** Lesson 14 taught that a breath belongs "at the end of a phrase", and that
  "a breath inside a phrase breaks its legato" (Lesson 14 LESSON.md:146-150).
- **This page's breath.** This page asks for a breath in the middle of each two-bar tune, and drops
  the phrase from the definition so the clash does not show.
- **The common brief's rule.** It says: "When an earlier lesson's rule stops being true, say so
  where it breaks."

**Fix:**

- Let each bar be a short phrase. Each bar 1 ends at a natural resting point: so in tune 1, mi in
  tune 2, do in tune C.
- Add to Step 4: "Here each bar is a short phrase, so the breath mark sits at the bar line." Then
  Lesson 14's rule holds and FACTS 30 can keep "at a phrase's end".
- The coach confirms the place anyway.

### 9. Lesson 20 is committed now, and "a run of steps" is not one kind of its run

**Where:** FACTS.md:40-41 ("Lesson 20's package was not committed ... cited in words"); FACTS 10,
27, 33 and 42 (FACTS.md:57, :83, :92, :104); LESSON.md:47-49 and :452.

**What is wrong:**

- **The citations are out of date.** Lesson 20 is committed at `26d90e225`, so the
  citations-in-words should now be paths.
- **The run claim is not true.** FACTS 10 says "a run of steps is one kind of" Lesson 20's run.
  But Lesson 20's word is "quick notes one after another, by step or by leap" (Lesson 20
  LESSON.md:156). This page's run of steps is quarter notes at 60 BPM, one a second, which are not
  quick.

**Fix:**

- Cite Lesson 20 LESSON.md:156, :225-233 and :447-451, and its FACTS 28 to 30 (FACTS.md:86-91).
- In FACTS 10, say that "a run of steps" names notes on neighbouring places at any speed, and that
  Lesson 20's Run adds "quick". The two pages still agree: neither calls a slow stepwise line simply
  "a run".

### 10. Tune 1 is Lesson 16's start with one note doubled and one added, and FACTS says only "it differs"

**Where:** FACTS 50 (FACTS.md:115); FACTS 39's stretch claim (FACTS.md:101).

**What is wrong:**

- **Tune 1 and Lesson 16's start.** Tune 1 is do mi so so, mi re do. Lesson 16's start, sung before
  every Lesson 16 take, is do mi so mi do, in the same octave. On this page, do mi so mi do also
  plays twice in the four words' Dynamics and twice more in Step 4's p then f, all before the take.
  So tune 1 is the start with so doubled and re added. It does differ, as the lead asked, but only
  just.
- **The cold open and Lesson 16's first phrase.** The cold open's first five notes, do re mi re do,
  G3 A3 B3 A3 G3, are Lesson 16's first phrase note for note. That could help the reveal ("you read
  that run in Lesson 16"), but FACTS 34 does not say it.
- **The stretch claim is incomplete.** FACTS 39 says the longest stretch of a sung tune played
  before its take is "do, mi, so". mi re do, the cold open's notes 3 to 5, is also three notes.
- **The tonic triad.** Because tune 1 opens on do-mi-so, the start leaves out the exam's broken
  tonic triad (FACTS 49). The card allows that.

**Fix:** say all of this in FACTS 50 and 34 so the lead can judge. One alternative for tune 1, if
the lead wants more distance: do do re mi, so mi do (half).

- It still holds a repeated note, steps and do-mi-so.
- The longest stretches heard on the page stay at three notes: do re mi in the cold open, and so mi
  do in tune B.
- It no longer opens on the triad, so the start could give do-mi-so as the exam does.

---

## Nits

1. **OMT's Example 2.** The left and right wording is the image's alt text, not its printed caption.
   The caption reads "A crescendo and decrescendo ("hairpins")." Say "its Example 2's alt text" in
   the Sources (FACTS.md:28) and in FACTS 26.
2. **Where the marks sit.** WEB-SPEC.md:58-59 puts p, f and the hairpins under the notes. In vocal
   scores they usually sit above the staff, because the words go below. This page also puts the
   syllables (Names) and Step 3's count under the notes, so they would collide. Settle the placement
   against a theory text, as WEB-SPEC already requires for the paths.
3. **Quick check 4 can be answered from memory.** It replays the very clip of the four words'
   Dynamics and Step 4's p then f: the same five notes, quiet then loud. Use a different clip, such
   as do re mi re do, loud then quiet, so the ear answers rather than the memory of a labelled sound.
4. **Quick check answers.** Quick check 2's right answer, "One note, sung twice", sits close to the
   distractor "One long note". "The same note, sung twice" is clearer. In quick checks 1 and 3 the
   right answer is also the longest.
5. **Section headings.** The steps' line says "one object" (LESSON.md:404), while the paragraph
   under the table says it "names the two objects" (:410-411).
6. **Sing it's heading.** "Sing it: a tune from the page" (LESSON.md:223) heads a section that offers
   two tunes. Lesson 16's reads "two phrases".
7. **The count in Step 3.** Step 3's "count '1 (2) 3 (4)' in your head" (LESSON.md:200-201) puts the
   whole count in the head. In Lesson 17 only the bracketed counts go unsaid (Lesson 17
   LESSON.md:178-179, :199-200). Try "count 1 (2) 3 (4), the bracketed beats in your head".
8. **The coach and the lab.**
   - So is held for two beats at the top in both tunes: two quarters in tune 1, a half note in tune
     2. That is D4, two semitones under the bass preset's top. Say so in the coach's range item.
   - The note before each breath mark has about 0.6 s of sound to reach 0.45 s in the band. Name it
     in lab item 15.
9. **Bracket room.** In the bass clef the brackets and labels sit above D4, but the toy's room stops
   at E4 (FACTS 84). Lab item 15 checks the width only. Add the figure's height with a bracket over
   D4.
10. **The lock comes back every visit.** It returns even after the lesson is done. The kit's
    predict stores nothing, but `fyp-done` does (`progress.ts:12-15`). Unlocking Steps 1 and 2 once
    Lesson 18 is done would spare a returning learner.
11. **No-microphone path.** "Both tunes drawn" (WEB-SPEC.md:384) does not say which tune Play the
    start's silent cursor runs over. Say tune 1, then tune 2 on a second press, or a choice.
12. **Small wording.**
    - LESSON.md:68-69, "the drill ... never repeats one": the drill never writes the same note twice
      running, but it can repeat a note later in the round (FACTS 66). The hand-back's "never repeats
      a note" has the same slip.
    - LESSON.md:26-27, "the one word keeps one meaning": the shared lines use "line" for a line of
      text too ("a line for each note", "the stop line"). Soften the claim.

---

## Checked and sound

- **Notes and staff places.** Every note, staff place, interval and bar sum works out:
  - The cold open is G3 A3 B3 A3 | G3 B3 D4, 4 + 4 beats.
  - Tunes A, B and C, and tunes 1 and 2, each make two bars of 4/4 in both clefs.
  - G3 is the bass staff's top space and A3 its top line. B3 is the space above the staff, C4
    middle C's ledger line and D4 the space over it.
  - G4, B4 and D5 sit on three lines in a row. G3, B3 and D4 sit in three spaces in a row.
  - Tune 1's breath falls after the second so and tune 2's after the second mi, each on beat 4.
- **Timings.** All of them check out:
  - 13.4 s for the read and for Play the start; 12.0 s for each Step 1 read; 26.4 s for Play Merc's
    tunes.
  - The window opens 5.15 s after Start, 0.75 s after the last click starts.
  - A quarter note's window is 1.5 s, which leaves room for a lag of up to 0.8 s.
  - FACTS 3's 430 s of sound plus 8.91 minutes of reading gives 16.1 minutes.
- **The range table.** It matches `VOCAL_RANGES` (`settings-store.ts:91-152`): bass 40-64, baritone
  43-67, tenor 48-72, alto 53-77, mezzo 57-81, soprano 60-84. The other range figures hold too:
  - every room figure, and "at least two semitones";
  - the octave-lower table, which fails four presets;
  - do a semitone higher leaves 1 at the bass preset's top;
  - with so left out, at least 5 semitones to spare.
- **The recall.**
  - Item 1 is Lesson 16's quick check 3 word for word (Lesson 16 LESSON.md:337-342). Its step link
    becomes "Try Lesson 16, Step 4 again" through `linkAway`.
  - Item 2 is Lesson 17's quick check 1 word for word (Lesson 17 LESSON.md:300-305).
- **Shared lines.** These match Lesson 16's current text word for word, adapted only as stated:
  - the comfort check, "Just listen today", the voice choice and Lesson 15's line under it;
  - the speaking-volume line, the stop line and the four feelings with their lines;
  - the doctor lines, the rest card's form and the sound gate's form.
- **The pass rule.** As far as it goes, it agrees with Lesson 16 and Sight-Singing: 60 cents, 0.45 s
  in all, folded, half back with or without voice (`use-sight-singing-controller.ts:199-202`).
  Should fix 5 is about the separate reading of a note not found.
- **Sight-Singing.** The practice card's claims match the drill:
  - six notes, within 7 semitones of each other, never the same note twice running;
  - no stems and no click;
  - "No audio preview.";
  - the treble clef only and the written octave;
  - the names under the notes, and "Singing Voice Range".
- **The Chart.** "tap it at sight" is right, its triplets come in Lesson 19, and it asks for no
  voice.
- **Not linked.** The sheet view is correctly left unlinked.
- **The head.** The head checks out:
  - The title is 49 characters, ending " | MercuryPitch".
  - The description is 149 characters and contains "A sixteen-minute lesson". `MINUTE_WORDS[16]`
    is "sixteen", and the chip will read "16 minutes".
  - og:title, 55 characters, contains the headline and "Find Your Pitch".
  - The share alt is 150 characters.
- **The teases.**
  - Lesson 19's tease and hook match Lesson 19's package, and its still matches Lesson 19's stage.
  - This page's tease is 57 characters, true and inside `TEASE_MAX`.
  - "Every bar written this season has had four beats" holds for Lessons 15 to 17. It holds here
    only once should fix 2 is done.
- **Lesson 20.** The staccato dot is kept in the four words and Step 4. "A run of steps" is used in
  the predict, the reveal, Steps 1 and 2 and the Wrap, and no bare "run" remains. "Lesson 20 plays
  staccato and asks no one to sing it" matches Lesson 20's coach lines.
- **Sources.**
  - The OMT and Wikipedia quotes match, apart from nit 1.
  - The RCM 2025 count-in and silent-review sentences match the writer's extraction.
  - Henry's numbers match the abstract quoted in RESEARCH.
  - Mishra and the eye claim are correctly kept off the page.
- **Copy.** British spelling throughout, no emojis, and no model names, scratch paths or agent ids.
  Every heading is Tavi's question, and Tavi's bubble is a sincere guess.
- **The spec's kit claims.** The ones I checked hold:
  - the predict's `onChoice` and `revealAfter`;
  - `holdTour` and the tour's stage step;
  - `createTapTempo`;
  - `listen`'s `TakeOptions`, which counts `run` from the first voiced frame;
  - `MAX_TRIES` of 3;
  - `rungLine` and `gapWords` taking whose note it is;
  - `octaveTag` and `octaveLine` within 50 cents;
  - the lesson-answer bounds of 1 to 14;
  - the lesson marker for 01 to 14;
  - the planning-text pattern `\b[TS]\d\d\b`, which misses S11b. That is a real catch.

## The hand-back's claims

- **Counts.** The word count (2,120) and plan-cites (221 citations, 0 findings) are confirmed.
- **Lesson 17.** Its still and FACTS 5 do give this page in C, "in the learner's clef", with the old
  choices (Lesson 17 FACTS.md:52, LESSON.md:361-367). The three edits it lists are needed.
- **Lesson 20.** "Only Lesson 20 ... uncommitted": it is committed now at `26d90e225` (should fix 9).
- **The drill.** "the drill never repeats a note" (departure 13) should read "never the same note
  twice running" (nit 12).
- **The coach's list.** "The vocal coach's lines to sign off are listed" is short by three lines
  (should fix 6).
- **The rest.** The other entries for the shared files are consistent with the package: season.ts,
  lesson-copy and drafts. Its CURIOSITY-MOMENTS entry will need the predict line changed if blocking
  finding 1 changes the predict.
