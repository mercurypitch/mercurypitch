# Find Your Pitch: a curiosity moment per lesson

2026-10-20

A brief for whoever builds it. Each lesson gets one curiosity moment: an opening that plants a question, a payoff
that answers it inside the lesson, and a closing tease that plants the next lesson's question, on the pages now and
in the films later. Paths run from the repository root; lesson folders are under `docs/plans/find-your-pitch/lessons/`.
"FACTS 12" is that lesson's FACTS.md, "L4 FACTS 12" another lesson's. Quoted lines are draft copy, in British English.

**In short.**

- Each lesson opens on one question the learner hears and sees at once, asked as a predict, and answers it inside
  the lesson.
- Each lesson ends on a one-line tease and a still that set up the next lesson's question, on the page's
  next-lesson card and on the film's end screen.
- §2 has one entry per lesson, §3 says how it lands on the page and on film, §4 is the build order, and §5 lists
  what the owner decides first.

## 1. Goal and rules

**Goal.** Every lesson opens on one thing the learner hears and sees, drawn in the app's own picture of sound, that
poses a question they want answered. The lesson answers it honestly before the Wrap, and the Wrap ends on the next
lesson's question, posed the same way. The facts and animations added later go into the slots this plan names.

1. **One open loop.** One question in the first 10 to 30 s: in the title and the first sound on the page, said by
   0:15 on film (playbook rule 1). Curiosity is an information gap, and it helps memory (production-research §5.2:
   Loewenstein 1994; Kang et al. 2009).
2. **Predict, then reveal.** Use `kit/predict.ts` as it is: the choice locks, the answer plays only after a choice,
   the reveal waits until it is heard, no choice is called wrong, and the other choice is "a fair guess" (rules 2, 15).
3. **Show, don't tell.** A sound and a figure, pitch drawn as height or the lesson's own object, with the words
   beside it. The Mercs act; they don't decorate (rules 5, 10, 13, 20).
4. **The title must not answer the predict,** which sits right under it. Lessons 6 and 13 need this fix.
5. **Pay off within the lesson,** at a named step. Both films close their main loop at about 40 % and carry the next
   lesson's loop to the end: keep that (production-research §5.2 gives 70 to 80 % for a film with one loop).
6. **End on the next lesson's question.** The tease is the next opening in miniature: its set-up, never its answer,
   then the next hook word for word (CURRICULUM principle 3).
7. **No clickbait.** Every hook is answered, from FACTS.md: "legit bait", never a click trap (curriculum-benchmark §4,
   §8). A wonder fact is about the idea and never precedes the question (pedagogy-research §1.7; rule 12).
8. **House rules bind.** Orange asks deep questions or makes sincere guesses; blue never mocks; no labels (rule 21).
   "Sore, hoarse or unwell today? Just listen along." comes before holds, sirens and range; never reward range or
   length. Voice lessons (3, 5, 7, 9, 11, 13, 14) need the coach; orange has no name or pronoun (MASTER-PLAN §12 item
   1). Sound is synthesised (MASTER-PLAN D9); tunes are public domain (L6 FACTS 28 to 30) or written for the lesson.

**Later facts and animations** go in the reveal card (one fact about the idea, with its FACTS ID), the Go deeper
drawer, the tease figure and, on film, the beat after the reveal. Never before the hook.

## 2. One entry per lesson

Each entry gives the **Opening** (the first 10 to 30 s; it plants the predict's question unless another is named), the
**Visual** (kit or new), the **Payoff**, the **Tease** (in the next-lesson card, and after the film's "Next time."), the
**Hook** if it should change, and the **Facts**. Films reuse the page's opening (§3.2); only 1 and 2 get a film note.

### Trailer · Find your pitch · a 2 to 3 minute film; no script, page or FACTS.md · hook kept

- **Opening:** a bright, finished frame 0, the amber band on the dark canvas. Blue Merc sings; the violet line rises
  into the band and turns mint; the hook is on screen by 0:05. Orange "Wait. Is that line the note?" Blue "Every
  note, as you sing it."
- **Visual:** the band chart's look (`kit/band-chart.ts`), then the explorer map (`kit/explorer.ts`) lighting each
  lesson's hook for about 5 s, over its opening where one exists; both exist. **Payoff:** the line, at once.
- **Tease:** Lesson 1's first seconds, word for word (blue's A3, orange's A4, "Ha! Same note." "Is it?"), then the
  end screen with Lesson 1's video.
- **Facts:** the voice as a line, L1 FACTS 21; the two As, L1 FACTS 7 and 12b; "free" only as YOUTUBE.md §C allows.
  The rest needs a source: write the trailer's FACTS.md before its script.

### Lesson 1 · What is a note? · page live; film made, not uploaded · hook kept

- **Opening (exists):** Orange "Ha! Same note." Blue "Is it? Mine shook the air 220 times a second. Yours shook it
  440."; the predict "Two different notes, or the same one?" unlocks the plays. Question: twice as fast, so how is
  it the same note?
- **Visual:** the stage and the Mercs (exist). Optional: the film's gold "× 2" between the numbers (new, static).
  **Payoff:** Step 4 (twice as fast: the peaks line up) and Step 5 (pitch is a spiral).
- **Tease:** Step 5's Notice plants it. Add to the card a still of the kit's spiral with its five "?" beads, the
  frame Lesson 2's film opens on, and "Seven letters, but twelve notes." (new).
- **Facts:** FACTS 7, 8, 12, 12f ("melt into one note", never "most people hear one note"), 9 (never "everyone");
  the tease, 13 and 14.
- **Film, keep:** sound at 0:00.9, the question at 0:14.8 with the gold "× 2", the sting at 0:23.8; the loop closes at
  2:02 to 2:20 of 5:14, and a second opens at 3:17 (five dim "?" beads) and runs to the end: the pattern to copy. **Re-cut
  only:** the spoken promise after the sting (Phase 1 re-voice, MASTER-PLAN §7); the 12.2 s end screen already works.

### Lesson 2 · Twelve notes · page live; film made, not uploaded · hook kept

- **Opening (exists):** Orange "Seven letters on the way round. Is there a hidden note between every two letters?"
  Blue "Count the steps and find out."; the predict [Yes, every gap] [No, only some], with Play the climb.
  Question: if not every gap, which ones, and why?
- **Visual:** Lesson 1's spiral and beads (`kit/spiral.ts`, exists). **Payoff:** Step 4, "So where do the other five
  come from?"
- **Tease (exists):** the card's two figures, Asked 59 % of 1,105 and Tested 10–16 %: the precedent for the rest.
- **Facts:** FACTS 13 to 15, 10 ("the smallest step a piano has", never "in music"); the tease, 36 and 36a.
- **Film, keep:** frame 0 is Lesson 1's spiral with its "?" beads; a recall question, orange's seven dashed rings, "the
  other five?" by 0:24, the payoff at about 2:58 of 7:11, a violet line edging to the band for Lesson 3. **Re-cut
  only:** a 12 to 15 s end card, lower-left third clear (YOUTUBE.md owner decision 8, open), for Lesson 3's video.

### Lesson 3 · Match a note · voice; page built, a draft until the coach signs off

- **Opening (exists):** Orange "I can't sing." Blue "Lots of people say that. So two researchers tested it."; the
  two figures; Play: on the note and Play: a semitone off; the predict on 39 students who said they couldn't copy a
  note, [Most of them] [About as few as anyone else]. Question: if the ears are fine, why is the note off?
- **Visual:** `kit/band-chart.ts` and Lesson 2's figures (exist). **Payoff:** the reveal (4 of 39), then Step 3 (why).
- **Tease:** a still of Lesson 4's compact staircase, C to B, stopped one stair under the house glyph (new still):
  "Merc climbs seven stairs and stops, one short of home." Optional, above the card: Play: Merc stops on ti.
- **Hook, optional:** "Asked, most students said they couldn't copy a tune. Tested, most could. So what's going
  on?" Reason: at 163 characters it is the longest hook, and the page already shrinks its title to fit; this keeps
  the "Asked... Tested..." of Lesson 2's film. Check "most could" against FACTS 2 to 4 and 6.
- **Facts:** FACTS 1 to 8, 13 to 15; the tease, L4 FACTS 17, 22, 23 and 58.

### Lesson 4 · The major scale and home · page built, a draft until the owner's go-ahead · hook kept

- **Opening (exists, placed too low):** the hero has the hook, a staircase on C and Play the scale; the cold open
  (Play from C, Land on do; Orange "It just hangs there, waiting. Is that because we started on C?"; the predict
  from D) waits behind a full recall section (§3.1). Question: why does ti hang, and is it because of C?
- **Visual:** the compact staircase and the house glyph (exist). **Payoff:** the reveal (home moves with the start)
  and Step 5, "Ti leans home".
- **Tease:** a band-chart still, Lesson 5's easy take settled in the band and the pushed take dashed ink-2 with a
  "?" (new; no answer shown): "One long note, sung easily, then with a harder push."
- **Facts:** FACTS 2, 8, 14, 22, 23, 23a, 26, 27 ("most listeners": those who grew up with this music); the tease,
  L5 FACTS 7, 8 and 72 (the takes are drawings, not recordings).

### Lesson 5 · Breath and a steady note · voice; page built, a draft until the coach signs off · hook kept

- **Opening (exists):** Orange "So if I push the air out harder, the note holds steadier?" Blue "Let's listen.
  Here's one note, sung easily."; then the predict [Settle, steadier than before] [Get louder and drift higher].
  Question: if pushing moves the note, what keeps it steady? On phones an open recall comes first (§3.1).
- **Visual:** the band chart and loudness strip (`kit/band-chart.ts`, `kit/loud.ts`, exist). **Payoff:** Step 1
  (pushing moves the note), Steps 2 to 4 (breathe in low, start easily), Step 5 and the hold in Sing it.
- **Tease:** seven beads on faint semitone rows, "Twinkle"'s first line unnamed, and a dashed copy six rows up with
  a "?" (new, a plain SVG): "Merc moves every single note of 'Twinkle, Twinkle' up."
- **Facts:** FACTS 7, 8, 11, 15, 18, 25 (no agreed meaning of "support"), 41 to 44, 48, 72; tease, L6 FACTS 20, 36.

### Lesson 6 · Intervals: the distance between notes · page built, a draft until the owner and the coach sign off · hook kept

- **Opening (LESSON.md):** Play from C on the compact tune line; Orange "If every note changes, isn't it a different
  tune?" Blue "Let's change every one and listen."; Play from F♯ lifts the line six rows. Question: with every note
  changed, what keeps it the same tune?
- **Fix before building:** the title already says it is the same tune, which answers the written predict. Ask:
  "Merc moves the whole tune up six semitones. What will still match the version from C?" [Some of the notes] [The
  gaps between the notes]. Reveal: "The gaps. Not one note matches, but every gap is the same, so it's still
  'Twinkle, Twinkle'. (It still sounds like 'Twinkle', so 'some of the notes' was a fair guess.)"
- **Visual:** the tune line (new here). **Payoff:** the reveal, Step 3 (transpose) and Step 4 (swap two sizes).
- **Tease:** a still of Lesson 7's two-octave column, middle half lit, no tune (new): "Books often give a voice type
  two octaves."
- **Facts:** FACTS 17, 20, 32, 34, 36 (no note shared), 37, 28 to 30; the tease, L7 FACTS 23 and 27.

### Lesson 7 · Slides, sirens and your range · voice; written; no page yet

- **Opening (LESSON.md):** Orange "If I could reach more notes, would I be a better singer?" Blue "Let's see how many
  a song asks for."; Play "Twinkle" by the two-octave column; the predict "How much of it does 'Twinkle, Twinkle'
  use?" [Most of it] [Less than half]. Question: a song needs only a slice, so where should it sit?
- **Visual:** the range chart (new here; Lesson 11 reuses it). **Payoff:** Step 4, "So why is the middle worth
  more?", with the push gauge.
- **Tease:** a four-beat grid, claps on 1 and 3, and a dashed row on 2 and 4 with a "?" (new): "Same song, same
  speed. Only the claps move."
- **Hook, proposed:** "Why is your comfortable middle worth more than your highest note?" Reason: one question, not
  two, with no first half inviting a count of notes, which the lesson steers away from; YOUTUBE.md's own title.
- **Facts:** FACTS 23, 25 to 28, 30 ("may": one small, preliminary study), 32, 33, 38, 48, 57.

### Lesson 8 · Beat, tempo and the backbeat · theory; written; no page yet · hook kept

- **Opening:** a metronome ticks under "Twinkle", claps on 1 and 3; the Mercs hop on the claps (no hands). Orange
  "If it's no faster, can moving the claps change anything?" Blue "Let's move them and listen." Predict: "Same tune,
  same speed. The claps move to 2 and 4. Musicians call some beats strong and some weak. Will the claps now land on
  strong beats, or weak ones?" [Strong beats] [Weak beats].
- **Visual:** the metronome (explorer art in `kit/explorer-figures.ts`) whose arm becomes a beat grid (new);
  `Sound.tick` and `playNoise` (exist). **Payoff:** the backbeat step; the checkpoint, taps on 2 and 4.
- **Tease:** two lines into the amber band, one stepping, one a dashed arc with a "?" (new): "One note, two ways up:
  step by step, or one leap."
- **Facts:** "Twinkle", L6 FACTS 20 and 28 to 30; needs a source for the backbeat and bars of 2, 3 and 4 (a theory
  text, or Ableton Learning Music, which the card names). Show the feel; never state it as a statistic.

### Lesson 9 · Landing a leap · voice; written; no page yet

- **Opening:** Merc sings do, then leaps to so, drawn as an arc into the band. Orange "Can't I just jump to the top
  note and hope?" Blue "Let's find something to aim with." Predict: "Merc sings do and so again, with one note in
  between. Which one splits the leap most evenly?" [re] [mi] [fa] (the widget takes two to four choices).
- **Visual:** `kit/band-chart.ts` (exists) with the arc and its landing zone (new). **Payoff:** the arpeggio as a
  ladder, slow leaps first; the checkpoint, do-mi-so-do, slowly.
- **Tease:** do, mi and so lit on the spiral, one "?" over all three, not over mi (new still): "Three notes, one
  chord. Move one by a semitone."
- **Hook:** keep only if a source backs "so much harder"; otherwise "How do you land a note you have to leap to?"
  Reason: there is no comparison to prove, and it names what the lesson pays off.
- **Facts:** needs a source for leap against step accuracy (sung-interval studies by size) and for the ladder and
  slow-first advice (a singing-pedagogy text; the card names RCM's order and Kodály's sol-mi); names, L6 FACTS 10 to 13.

### Lesson 10 · Major and minor · theory; written; no page yet

- **Opening:** do, mi and so lit on the spiral and played together (both exist). Orange "If one note moves a
  semitone, can the whole chord change?" Blue "Choose one, and we'll move it." Predict: "Do stays home. Which note,
  moved down a semitone, makes the chord minor?" [mi] [so]. Keep do fixed: lowering it gives B, E, G, also minor.
- **Visual:** the bead sliding and the chord's colour changing (new), never a "sad" blue. **Payoff:** the thirds
  step; the checkpoint, do-mi-so then do-me-so (do-based minor, decided).
- **Tease:** the siren's line crossing a shaded grey seam on the range chart, never red (new still): "Slide up
  slowly, and your voice may flip."
- **Hook, proposed:** "Which single note turns a major chord into a minor one?" Reason: "bright" and "dark" are mood
  labels, and the lesson refutes "minor means sad"; YOUTUBE.md's title drops them too.
- **Facts:** a minor interval is a semitone smaller than the major, L6 FACTS 11 and 12; needs a source for triads (a
  theory text, such as OMT 2e's triad chapter; the series already cites OMT 2e).

### Lesson 11 · Registers and the break · voice; written; no page yet

- **Opening:** Merc's slow "ng" siren climbs the range chart; partway, the sound changes gear and the line crosses a
  grey seam. Orange "My voice just flipped. Did I do it wrong?" Blue "Let's slide again and listen." Predict: "A flip
  like that: a mistake, or something every voice can do?" [A mistake] [Every voice can]. The plan's "a sign something's
  wrong" made it a health question, and a lesson cannot tell anyone their voice is healthy, so the written lesson asks
  whether a flip is a mistake (Lesson 11 FACTS 11, 12).
- **Visual:** Lesson 7's range chart, the seam and a synthesised gear change (new), labelled a model as Lesson 5 labels
  its takes. The app does not detect registers, so the seam is never the learner's measurement and its narrowing is an
  illustration. **Payoff:** the gears step; the checkpoint, one slow, quiet siren on "ng", up only as far as is easy.
- **Tease:** four chords as four rooms on the spiral, with no tune note on the ring (new still; Lesson 12's WEB-SPEC,
  Decisions for the owner, item 13): "Four chords, round and round."
- **Hook, proposed:** "Why does your voice sometimes flip as you slide up?" Reason: the same question, without the
  unsourced "every time"; the old wording stays as the alternative `same-note` until FACTS.md has a source (Lesson 11
  FACTS 1).
- **Facts:** sourced in Lesson 11's FACTS: registers and the break (Henrich 2006; Herbst & Elemans 2025), breaks in
  choir singers' slides (Cardoso 2023) and Arneson on register coordination; "the same note every time" is still
  unsourced (FACTS 1).

### Lesson 12 · Chords and the four-chord song · theory; written; no page yet

- **Opening:** four faint rooms on the spiral seen from above; Merc plays the four chords, then sings one tune over
  them, then another. Orange "Same four chords. Isn't it the same song, then?" Blue "Listen to both, and watch where
  each tune lands." Predict: "Each chord lights a room on the ring, with its three notes as the corners. As Merc
  sings a tune over the chords, how many of its notes land on a corner of the lit room?" [Most of them] [Hardly
  any]. The plan's "One song or two?" is answered by the hook right above it, so the written lesson asks where a
  tune's notes land instead (Lesson 12 FACTS 39).
- **Visual:** the spiral (exists) with rooms and a melody walking through (new). **Payoff:** the step where the tune
  and its rhythm make the song (Lesson 6 again); the checkpoint, each chord's root, sung.
- **Tease:** one level pitch line over a spectrum strip whose peaks show only "?" (new still): "Same note, two vowels:
  'ee', then 'ah'."
- **Hook, proposed:** "How can two songs share the same four chords and still sound different?" Reason: "hundreds"
  needs a counted source (YOUTUBE.md already avoids it), and two is what the cold open shows.
- **Facts:** sourced in Lesson 12's FACTS: chords on the scale and Roman numerals (Open Music Theory, Hooktheory I),
  I-V-vi-IV (Ableton's Learning Music, Hooktheory); both tunes are written for the lesson (FACTS 33).

### Lesson 13 · Resonance and vowels · voice; card only · hook kept

- **Opening:** Merc holds one note from "ee" to "ah"; the pitch line stays flat while a strip under it shows the
  harmonics. Orange "A different vowel must be a slightly different note, surely?" Blue "Watch the line, and
  listen." The title says the line stays put, so the predict is on the strip: "When 'ee' turns to 'ah', what will
  the peaks under the line do?" [Stay where they are] [Move].
- **Visual:** the pitch line (exists), a spectrum strip in the LED-analyser look and synthesised vowels (new; the
  kit's voices are partials through a low-pass). **Payoff:** the vowel step; the checkpoint, one note through "ee",
  "eh", "ah", "oh", "oo". Never claim to assess a vowel.
- **Tease:** a whole song's line, every note mint, beside a dashed copy with breath marks, a swell and a "?" (new
  still): "Every note in the band, start to finish."
- **Facts:** needs a source for formants (a voice-science text; the series cites Sundberg and Titze elsewhere);
  "approximately" for Chladni ratios; say the line stays flat of Merc's synthesised note, not yet of a real voice.

### Lesson 14 · Phrasing: sing a whole song · voice; card only · hook kept

- **Opening:** Merc sings one phrase twice, every note in the band: once with a breath snatched mid-phrase and no
  shape, once with a planned breath at its end and a swell drawn in light. Orange "Every note was in the band.
  Isn't that the whole job?" Blue "Listen to it twice." Predict: "Both takes hit every note. Will they sound the
  same?" [The same] [Different].
- **Visual:** the line with breath marks (Lesson 6 draws the first) and the swell (new). **Payoff:** the breath and
  swell steps; the checkpoint, one phrase twice, the second planned. Never rate breath; never reward length.
- **Tease:** none: `nextCard` returns null after Lesson 14. A season-end card (new; §5 item 4) could close the
  trailer's loop, "You've seen every note you sing. Now sing a whole song.", with Karaoke Night and the map.
- **Facts:** needs a source for messa di voce (Titze, per the card) and breath planning (Arneson, per the card); the
  tune needs a rights check ("Auld Lang Syne" and "Twinkle" have one).

## 3. How it lands in each medium

### 3.1 The page

**Place.** The opening sits in the cold open, straight under the title, before anything asks for an answer. On a
phone the order differs from page to page today:

| Page         | Phone order today                                                | Change                        |
| ------------ | ---------------------------------------------------------------- | ----------------------------- |
| 1 (live)     | hook, stage, gate, predict                                       | none                          |
| 2 (live)     | hook, stage, gate, predict, then the recall                      | none: the order to copy       |
| 3 (draft)    | hook, a collapsed recall (once Lesson 2 is done), stage, predict | none                          |
| 4 (live)     | hook, staircase, a full recall section, then the cold open       | cold open first, recall after |
| 5 (draft)    | hook, gate, an open recall quiz, then stage and predict          | as Lesson 4                   |
| 6, 7 (specs) | as Lesson 4                                                      | build in Lesson 2's order     |

MASTER-PLAN §4.2 lists the recall before the cold open, so this is the owner's call (§5 item 1). If the order
stays, collapse the recall into a `details`, as Lesson 3 does.

**Above the fold.** On a phone (390x844) the title and the opening's first control (its Play, or the predict's choices)
should be on the first screen; on a tablet in landscape (1024x640, 564 px for a stuck stage, PRODUCTION-PIPELINE §5),
the stage and the choices too.

Measured on dev on 20 October (main at `cbc0b4905`): every title is on the first screen, but on none of the five
pages are the predict's choices. At 390x844, where the screen ends at 844 px, the first choice starts at 963 px on
Lesson 1, 1166 on Lesson 2, 1779 on Lesson 3, 2359 on Lesson 4 and 2504 on Lesson 5. At 1024x640 it starts between
1016 px (Lesson 1) and 2149 px (Lesson 4). The opening's first Play is on the first screen only in Lesson 4's phone
layout. On a phone, Lessons 3 and 5 put the sound gate and the recall above the stage, so the stage starts below
the first screen too.

New: `src/e2e/learn-cold-open-fold.spec.ts`, like
`learn-stage-fit.spec.ts`, at 390x844, 844x390, 1024x640, 1133x631, 1280x680, 1366x657 and 1440x900: the title and
first control in the viewport at load; a report with app-check screenshots first, then enforced. Levers: the hero's
Merc size (`--merc`), the recall's place, the hook's length. A first Play tap turns sound on (`Sound.canPlay`), and
"Start lesson" lands on the page's top (`kit/lesson-state.ts`), so the cold open is never skipped.

**The next card and the tease.**

- Exists: `kit/next-card.ts` draws the next lesson's eyebrow, hook (`.q2`) and action; keeps what the page's
  `[data-next-card]` mark holds (Lesson 2's figures, `.tease` in `lesson-02.css`); flips to "Start lesson" on release.
- New, one kit PR: an optional `tease` field on `Lesson` in `season.ts`, one line of about 70 characters at most,
  drawn above the hook. Each §2 Tease line goes in the next lesson's field; the film's "Next time." reuses it. Give it
  its own class (`.tease` is Lesson 2's figure, and `learn-next-card.spec.ts` tests it). It is drawn copy, so
  `learn-no-planning-text.spec.ts` applies; `sig` stays admin-only. Tests: `next-card.test.ts`, `season.test.ts`
  (length) and `learn-next-card.spec.ts` (Lesson 1's card shows Lesson 2's line). Hooks must still end in "?".
- New, per page: the tease figure in the card's slot. The card is a link, so the slot takes no buttons; a tease
  sound's Play sits just above the card. Move the `.tease` stat styles into `lesson-sections.css` for reuse.
- Keep the card's place in the Wrap: after the challenge and the practice card, with free play after it.

**Kit pieces.** Exist: `predict.ts`, `next-card.ts`, `band-chart.ts`, `spiral.ts` and its "?" beads, `loud.ts`,
`home-glyph.ts`, `explorer.ts`, the metronome and Chladni drawings in `explorer-figures.ts`, and in `sound.ts`
glides (`playContour`), ticks (`Sound.tick`) and noise bursts (`playNoise`). New, in the lesson that needs it: the
tune line (6), the range chart (7, reused in 11), the beat grid (8), the leap arc (9), the bead slide (10), the
seam and gear change (11), the four rooms (12), the spectrum strip and vowels (13), breath marks (6) and the swell
(14). New in the kit: the `tease` line, shared tease styles, one still per card, the season-end card, the fold spec.

### 3.2 The film

- **First 5 seconds.** A finished, bright frame 0, never a logo (brand-motion §5.2, §6 item 14); a sound by 1 s (both
  films: 0:00.9); the question by 0:15, the promise by 0:30, then a sting of at most 5 s. YouTube's "Intro" moment is
  the share still watching at 0:30; the 15 s figure is a rule of thumb, not YouTube's (production-research §5.1).
- **One puzzle in both media.** The cold open is the page's opening: the same sounds, figure and orange line. The
  predict is the chapter's one "think about it" pause, at most 2 s (brand-motion §5.2).
- **End-screen tease.** A 12 to 15 s end slate (production-research §5.4): blue's "Next time.", the tease line and
  the next hook said aloud, the tease figure on screen, the Mercs to one side, the lower-left third clear for the
  next lesson's video and room for Subscribe. YouTube allows elements only in the last 5 to 20 s.
- **Title and thumbnail.** The title is the hook, or YOUTUBE.md §C's recommended form; the description's first line
  is the hook (MASTER-PLAN §4.1); the thumbnail's words are the question in short ("Same note?", "No black key?")
  over a frame from the first 5 s, so the click is paid at once. When a hook changes, change its YOUTUBE.md row
  the same day. Shorts take the opening moment as their first 2 s (production-research §5.4).

## 4. Build order and measures

1. **Kit, one PR, first because the live pages need it:** the `tease` field, its drawing and tests; the shared tease
   styles; the fold spec, as a report.
2. **Live pages:** Lesson 1 (the tease line and five "?" beads; the optional "× 2"), Lesson 2 (nothing: its figures
   already tease Lesson 3) and Lesson 4 (the cold-open order once §5 item 1 is settled; the Lesson 5 still). Fix what
   the fold spec flags, then enforce it for these three.
3. **Drafts:** Lesson 3 (the staircase still; the hook, if approved) and Lesson 5 (the recall order; the "Twinkle"
   beads). Both stay behind `drafts.ts` until the coach signs off; this work need not wait for that.
4. **Lessons 6 and 7:** write §2 into LESSON.md and WEB-SPEC.md first (Lesson 6's predict, the page order, the
   teases, Lesson 7's hook), then build.
5. **Lessons 8 to 14,** as each script is written: §2's entry is the starting point, and FACTS.md settles every
   "needs a source" before the copy is final. The explorer and lesson menu already print every hook: settle early.
6. **Films:** Lessons 1 and 2 stay as they are; their items go on the next render's polish list. Each later
   storyboard starts from §2 and §3.2. The trailer comes last, once all fourteen hooks are final.

A hook change touches `season.ts`, the page's title and head (SEARCH.md §3.1), LESSON.md's header, FACTS.md's title
row, the previous lesson's next-lesson line and FACTS row, `next-card.test.ts` where it quotes a hook, and YOUTUBE.md.

**Measures, from what exists today:**

| Question                                                                              | Where                                        | Status                                    |
| ------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------- |
| Do viewers stay past the opening? Share at 0:30 ("Intro"), first 5 s, average view %  | YouTube Studio                               | exists, once uploaded                     |
| Does the tease pull? End-screen video clicks, Lesson 1's card at 3:22, Test & compare | YouTube Studio                               | exists                                    |
| Do readers go on? Views of /learn/N+1 against /learn/N, same weeks (rough)            | Cloudflare Web Analytics (`public/_headers`) | exists; check for same-site referrers     |
| Does the hook, as page title, earn clicks? Click rate per lesson page                 | Search Console (SEARCH.md §11)               | check the property is verified            |
| Did the reader play the opening, predict, scroll past it, open the next card?         | nothing                                      | needs new tracking                        |
| Lesson-to-app clicks by `?lesson=NN`                                                  | nothing: it only steps First Light aside     | needs new tracking (CURRICULUM §4 item 6) |

New tracking means counts-only events from the lesson pages (which load no first-party analytics today), new names in
`src/lib/funnel-event-catalog.ts`, and the owner's call on consent and the privacy notice: the banner covers only GA4
and Ads, and MASTER-PLAN §12 item 11's lesson-telemetry exception is only proposed. Build none of it before then. Quiz
answers stay on the device. Baseline: Lessons 1 and 2 as uploaded; a YouTube re-cut is a new video (Phase 4).

## 5. Open questions for the owner

**Answered on 20 October 2026.** The owner asked for the recommendations below to be used, and for the hooks and
teases to be easy to change, with a switch for them in the admin console. So:

- items 1, 3 and 4 follow their recommendations;
- for item 2, each proposed hook goes live with the current wording kept as an alternative. The admin console
  switches between them, and a hook that needs a source keeps its current wording until FACTS.md has one;
- item 5 waits for a later conversation, so the lesson pages send no events.

The questions as they were put:

1. **Opening before recall?** Should every page open on the cold open and ask the recall straight after, as Lesson 2
   does, though MASTER-PLAN §4.2 lists the recall first? It changes Lessons 4 to 7. Recommended: yes.
2. **Hooks.** Approve the changes for Lessons 7, 10 and 12, and Lesson 3's shorter hook if wanted. Lessons 9 and 11
   keep theirs only if their sources turn up.
3. **The tease line:** a `season.ts` field (recommended: one source for the card, the film and the end screen), or a
   line written into each page's slot?
4. **The season's end:** close on the trailer's question (recommended), or tease Season 2? That needs Season 2
   committed, or the loop is never paid, and words that pass the planning-text test, which bans "planned".
5. **Lesson-page events:** wanted, given what §4 says about consent?
