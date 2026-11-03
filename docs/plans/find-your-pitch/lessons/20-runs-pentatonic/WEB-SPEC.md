# Lesson 20 web page: spec

The Lesson 20 page is the web lesson for "Runs and the pentatonic scale": written steps, two toys on
the step deck's stage (Lesson 4's staircase and the run toy, Merc's run as beads on a string, with
the staff as a switch), one research predict, the four words, a sung checkpoint scored on the page,
the run or a smaller one, two quizzes (the recall and the quick check) and the lesson explorer.
Copy is in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a text-only
package: no film exists for Lesson 20, so the page has no Watch section and the masthead's anchors
are Lesson, Sing and Explorer.

It is built on the kit (`src/features/lessons/kit/`) as Season 2's kit PR leaves it (SEASON-2 § 8.2
item 1): the season structure, the staff toy with both clefs and the lesson plumbing. Like every
lesson page it reuses and never copies: a part that lives in an earlier lesson's module moves into
the kit first. It reuses Lesson 4's staircase, which Lesson 21's kit work moves into the kit
(Lesson 21 WEB-SPEC, Toys 1), the kit's band chart with its rungs over slots, which Lesson 9's
ladder chart already uses (`src/features/lessons/kit/band-chart-rungs.ts:1-17`), Lesson 9's scored
take and its flow, which move into the kit here (What the kit and the app still need, item 5), and
Lesson 15's staff toy for the staff switch. Where this page shares a behaviour with Lesson 9's Sing
it, it is Lesson 9's, unchanged unless this spec says otherwise (Lesson 9 WEB-SPEC, Toys 4).

One object carries the lesson: Lesson 4's staircase becoming a run. In Step 1 it loses fa and ti,
and both of its semitone risers go with them; in Step 2 the same five notes start on la; from Step 3
the five are Merc's run, do re mi so la so mi re do, drawn as nine beads on a string on the pitch
line, spaced in time, drawn closer as the tempo rises, each bead still in its band, while an
illustrated singer's smudged run slips out of the bands; in Sing it the learner's line joins the
beads.
It is the card's signature (FACTS 4).

Its public home is `mercurypitch.com/learn/20` (SEASON-2 § 7 item 1): a hand-written document
`learn/20.html` with its module in `src/features/lessons/lesson-20/`, wired as Lesson 15's page is.
It joins `kit/drafts.ts` in its first commit, held back on mercurypitch.com until the vocal coach has
signed off Sing it and the console publishes it, and it publishes only after `/learn/05`,
`/learn/09` and `/learn/10` are live, because its prerequisite chips and its recall link there and
its recall imports Lessons 9 and 10's own questions (FACTS 2, 7). The next-lesson card on Lesson
19's page draws this lesson's tease above its hook from the season data, and this page's card draws
Lesson 21's; neither is written into a page's markup (FACTS 5, 5b).

## Look

Lesson 15's look, unchanged: the dark listening room, the series colour code, Lesson 1's type and
wordmark, and the motion rules (Lesson 15 WEB-SPEC, Look). On this page:

- **The run** is a pitch canvas, so it takes the app's canvas set, as Lesson 9's ladder chart does
  (Lesson 9 WEB-SPEC, Look): each of Merc's notes is a bead on Merc's steady line inside its amber
  band `#f59e0b`, 35 cents either side, and a thin chrome string `#c3ccd6` joins bead to bead in
  time. A bead glows while its note sounds. The learner's line in Sing it is singer violet
  `#a78bfa`, which means a singer only, and a band's edge lights mint `#80ffca` with the words "IN
  THE BAND" while the line sits inside it (`drawLitEdge`), so the word, not the colour, carries it.
  Play it smudged's illustrated singer, in Step 3, is a violet line too, labelled "An illustration"
  as Lesson 9's illustrated landing is, and sounds in the soft tone, never in Merc's voice (FACTS
  82a). Gold `#ffd84d`, "the fit", is not used: the band is the landing zone.
- **The staircase** keeps Lesson 4's drawing (Lesson 4 WEB-SPEC, Toys 1), with a number in place of
  T or S on each riser and each stair's syllable printed in ink over its letter (Toys 1). **The
  house** marks do, never a colour (`src/features/lessons/kit/home-glyph.ts:1-13`).
- **The staff**, when its switch is on, is Lesson 15's: chrome lines, clefs and noteheads, a
  notehead ink `#e6edf3` while its note sounds; the sharp on F♯ in ink, beside its note. It draws no
  staccato dot (FACTS 30, 47).
- Merc's blue `#58a6ff` and Tavi's orange `#ff7448` are their own: their bubbles, and in Sing it the
  still of the one who sings.
- **No decorative staves or clefs** anywhere on the page: on this page a staff is always music
  (SEASON-2 § 1.5 item 7).

What moves: Merc and Tavi's idle loops; while something the learner started plays, the lit beads
and stairs, the string drawn bead to bead, the smudged run's violet line, the house sliding with
Slide or moving to la, and in Sing it the guide's glow and the learner's line. Under
`prefers-reduced-motion`, or with the masthead's Pause animations on, Merc and Tavi stop, a bead
lights without a swell, the string and the lines draw whole, and the house jumps to where it ends;
what the learner starts still sounds (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Season 1's departures kept: the step toys double as the
Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it (Step 3); the
practice card sits in the Wrap. No Watch section. The page opens in Lesson 2's order (FACTS 5a).
Each section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Season 2's, "Season 2 · Lesson 20", with Lesson, Sing and Explorer, the Sound
   toggle off by default and Pause animations, through `initMasthead`
   (`src/features/lessons/kit/page-chrome.ts:127-130`) with `{ lesson: 20, deck }`. Its lesson
   menu lists the four step headings from the first paint and heads its card "Lesson 20 · What's
   left when fa and ti go?"; no heading names the study's finding (FACTS 1a). On a first visit its
   welcome tour waits for the predict's choice (Toys 3).
2. **Hero, with the cold open**, laid out as Lesson 2's: the kicker, the hook question as the title
   (`<h1 class="hook" id="hook">`), the meta as seven chips, the promise and the sound gate from
   LESSON.md. The chips are "15 minutes" (FACTS 3); "After Lesson 5: Breath and a steady note",
   "After Lesson 9: Landing a leap" and "After Lesson 10: Major and minor", each a link to its page
   that stays a plain chip wherever that page is not live
   (`src/features/lessons/kit/page-state.ts:14-20`; FACTS 2); "Also useful: Lesson 19, Threes and
   offbeats", a plain chip; "Sound on"; and "Microphone optional". Its stage holds Tavi's and Merc's
   bubbles over Merc and Tavi on the floor line, the pitch line with the run's nine beads between
   them (Toys 2), and under it the cold open's two free plays. The predict card sits under the stage
   (Toys 3). On a phone the hero's parts run kicker, title, meta, the stage, the gate, the predict,
   then the promise, as on Lesson 23's page, so the title and the first play come before anything
   asks for an answer. The head, proposed, as Lessons 15 to 23 propose theirs: the title, at most 60
   characters, "Pentatonic scale and singing fast runs | MercuryPitch" (53), in searchers' words;
   the description, "How do singers sing a fast run without the notes smudging together? A
   fifteen-minute lesson with sound toys: the pentatonic scale and a run to sing." (148), which the
   head test holds to 80 to 160 characters and to the chip's run time in words
   (`src/tests/lesson-pages.test.ts:155-159`, `src/tests/lesson-pages.test.ts:191-210`);
   og:title and twitter:title "Runs and the pentatonic scale · Find Your Pitch, Lesson 20" (58), in
   Lesson 4's form; og:description and twitter:description the hook alone (67); the share card
   `learn/lesson-20-og.jpg`, 1200 by 630, its alt "The title card: Find Your Pitch, Lesson 20, Runs
   and the pentatonic scale, above a pitch line with nine beads on a string, each in its band,
   between Merc and Tavi." (163); the two structured-data blocks from Lesson 1's, the Article's
   `headline` the lesson's name, its `alternativeHeadline` the hook, `timeRequired` `PT15M`,
   position 20, and `teaches` "The major pentatonic scale: the major scale without fa and ti", "The
   minor pentatonic scale, sung from do", "Singing a run evenly" and "Practising a run for speed";
   and, on release, the llms.txt line in Season 1's form: "[Lesson 20: Runs and the pentatonic
   scale](https://mercurypitch.com/learn/20): How singers sing a fast run without the notes
   smudging together. The major and minor pentatonic scales, singing a run evenly, and a plan for
   making it faster." (SEARCH § 3.2 and § 3.4). None of them says what the study found or names a
   practice method; "a plan for making it faster" names the plan without saying what it is (FACTS
   1a).
3. **Recall from Lessons 9 and 10**, straight after the hero: Lesson 9's question 2 and Lesson 10's
   question 4, shown to everyone (Toys 8; FACTS 7).
4. **Four words you'll meet**: Run, Pentatonic scale, Minor pentatonic and Agility, each with its
   definition and its play, Agility's none (Toys 4).
5. **Steps**: the step deck, four steps, the staircase (Steps 1 and 2) and the run toy (Steps 3
   and 4) stuck beside the text (Toys 1 and 5), Step 3's mix-up card in its text, a Go deeper
   drawer in Steps 1 and 2 (Toys 7).
6. **Sing it**, `#sing`: the comfort check, the voice choice, the warm-up, Your turn with the run
   choice and Move do, the take on Sing it's chart, the reading lines, "How did that feel?", Again
   (or Again, smaller) and Again, faster (Toys 6).
7. **Quick check**: four questions (Toys 8).
8. **Wrap**: the three lines, the one-sentence challenge, the practice card in the version Sing
   it's ending picks (Practice links), the next-lesson card with its still (Toys 9), and free play,
   the step toys unlocked: the staircase with every state, and the run toy with every control.
9. **Explorer**: the season's map, opening on Season 2's tab (Explorer and season data).
10. **Footer**: LESSON.md's, with the practice link, "Scale Runner and Staccato Precision are
    free.", the fonts line and "Every sound on this page is synthesised in your browser."

## Length

The learner copy is 2,221 words on `scripts/lesson-words.mjs`, every branch counted, under the
series' cap of 2,379 by 158 (FACTS 3). The page runs about 15 minutes: 9.33 minutes of reading at
238 words a minute and about 6.1 of sound, toys and tasks. That is past MASTER-PLAN § 4.2's budget,
"8 to 12 minutes of active time, 500 to 900 words", as every Season 1 page from Lesson 3 is. The
chip's figure is an estimate until the run toy and the take are timed in their lab, as SEASON-2 §
1.3 asks; the chip is then set from the lab. Each step's own text, with its Try and its Notice,
runs 82 to 120 words (Steps 1 to 4: 119, 111, 120 and 82), inside § 4.2's 50 to 120 a step. Two
parts carry more beside it:

- **Step 3, 204 words with its mix-up card**, which sits in the step whose toy shows the tempos.
- **Sing it, 545 words.** It carries the series' singing lines, Lessons 3 and 9's word for word and
  not cut, and the choice of the smaller run.

**The built page.** The hints, status lines and labels are stage directions in LESSON.md and are not
counted, as in the text packages of Lessons 9 to 23. A built page writes them in the open and counts
them, and on this page they come to about 151 words, counted from LESSON.md's stage directions and
this spec's toys:

- the cold open's sound-off hint, 13;
- the toys' visible labels, 37: Step 1's "Play up", "Leave out fa and ti", "Start lower" and "Start
  higher"; Step 2's "Major · Minor"; the run toy's "Tempo", its five notches, "Play the run", "See
  it on the staff", "Play it smudged" and "Staccato · Legato";
- the smudged run's label, "An illustration", 2;
- the stairs' printed names, 16 at most, a syllable and a letter on each of eight stairs (Toys 1);
- Sing it's lines, 64: the take's status, "Start on do when you're ready.", the one sound-off hint,
  the no-voice line and "Start again", the faster pass's status, the stored-voice line and the
  listening path's "Choose a voice: it picks who sings.";
- the quizzes' "Right." and "Not quite.", about 12;
- the next-lesson card's "Coming later" and "See it on the map", 7.

The research predict has no lock hints, the beads' names are drawn on canvas, Lesson 4's readout is
hidden (Toys 1), "Do is D3" is the chart's summary for a screen reader, never printed, and Sing it
has one sound-off hint for every button, not one a button as Lesson 9's has, which is what keeps
this page under Lesson 8's measured 174 to 206 (Lesson 8 FACTS 4). The built page then lands near
2,372, 7 under the cap.

**Cuts.** To make room for the smaller run, Play it smudged and the stairs' printed names, the page
has taken the first cut the package named, Step 4's last sentence, "On the staff, a dot over or
under a note asks for staccato (Lesson 18).", 15 words, and the staff's staccato dots with it (FACTS
3, 30); the reveal's last sentence and the take's status are trimmed too. **If the built page still
runs over**, the next cuts, in order: Step 1's drawer's last sentence, "Where they occur, their step
patterns tend to be alike.", 10 words; Step 2's drawer, "Blues", 23 words with its heading; then
Step 4 whole, 91 words with its heading, with the run toy's Staccato · Legato, the second drill
staying on the practice card under "For short notes" (FACTS 3, 31).

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                 | New in Lesson 20                                                                                                                                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The staircase          | Lesson 4's staircase in the kit, as Lesson 21's kit work moves it (`lesson-04/stairs-toy.ts`), with its Slide; the kit's scales (`kit/major-scale.ts`); the house (`kit/home-glyph.ts`); the kit's signs (`signsHtml`) | Leave out fa and ti; a semitone count on each riser; each stair's syllable printed over its letter, with no names switch; Major · Minor, the five notes from do or from la, with the house moving; Play both and Play it on C |
| 2. The hero's pitch line  | The kit's band chart with rungs over slots (`kit/band-chart-rungs.ts`), the beads drawn as the run toy draws them (5)                                                                                                  | Two free plays, the run fast and slowly, Merc's for everyone                                                                                                                                                                  |
| 3. Predict widget         | The kit's predict (`kit/predict.ts`) as Lesson 3's research predict mounts it, no plays and no reveal, the reveal shown in `onChoice`; the tour's hold (`kit/tour-gate.ts`)                                            | The hero's own plays outside the predict; the lock hint hidden on the choice                                                                                                                                                  |
| 4. Four words             | The kit's words strip (`kit/words-strip.ts`), with the page's sound owner                                                                                                                                              | Three plays and three small figures: beads on a string, the five-note staircase, the same five from la                                                                                                                        |
| 5. The run toy            | The kit's band chart and rungs over slots; the kit's contour voice (`kit/sound.ts`), Merc's "ooh" and the soft tone; Lesson 15's staff toy for the staff switch                                                        | The bead style: a bead on each rung and the string between them; Tempo's five notches; Play it smudged, an illustrated singer's line; Staccato · Legato; the staff switch's stemless run                                      |
| 6. Sing it                | Lesson 9's Sing it, its take and its flow, moved into the kit (`lesson-09/sing-take.ts`, `lesson-09/ladder-flow.ts`); `kit/comfort.ts`, `kit/voice-choice.ts`, `kit/take.ts`, `kit/move-do.ts`                         | The run choice; nine or seven 0.75 s slots and the reader's two options; Move do higher only; Again, faster, the unscored pass                                                                                                |
| 7. Go deeper drawers      | Lesson 2's `details` drawer                                                                                                                                                                                            | Two items, one drawer each in Steps 1 and 2                                                                                                                                                                                   |
| 8. Recall and quick check | The kit's quiz (`kit/quiz.ts`); Lesson 9's `l09-q2` and Lesson 10's `l10-q4`, imported                                                                                                                                 | Ids and keys; quick check 4's play, E minor pentatonic                                                                                                                                                                        |
| 9. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`)                                                                                                                                                           | One still: Lesson 21's opening, which plays nothing                                                                                                                                                                           |

### 1. The staircase (Steps 1 and 2)

Lesson 4's staircase as the kit holds it after Lesson 21's kit work (What the kit and the app still
need, item 4), on C in the learner's octave: C3 for the lower voice, C4 for the higher (FACTS 8, 26).
It plays as Lesson 4's does, the soft tone at 0.45 s a note with the last note 0.9 s
(`src/features/lessons/lesson-04/examples.ts:31-32`), each stair lighting as it sounds, and each
stair is a real button that plays its note and says its syllable and name on focus ("Stair 3, mi, E
3"), as Lesson 4's do (`src/features/lessons/lesson-04/stairs-toy.ts:5-8`).

- **What each stair shows**: its syllable, and under it its letter, both printed, with no names
  switch. Lesson 4's stairs show one name in the page's names mode, Letters, Numbers or Do-re-mi
  (`src/features/lessons/lesson-04/stairs-words.ts:5-11`); this page needs two at once, since Step
  1's text speaks in syllables and its Notice in letters, and Step 2 speaks in both. Letters follow
  each scale's own spelling as the kit spells it: from D, F♯ and C♯; on the Slide's other black-key
  starts, the kit's D♭, E♭, A♭ and B♭ major with flats, and F major's B♭
  (`src/features/lessons/kit/major-scale.ts:6-10`; FACTS 10). Every ♯ and ♭ prints through
  `signsHtml` (`src/features/lessons/kit/notes.ts:221-227`), the sign shown and hidden from a screen
  reader, its word after it for one. Lesson 4's visible readout, "C major · no black keys", and its
  white-key note are hidden on this page, since the printed names say what they said; its summary
  and its polite line stay, for a screen reader only (`learn/04.html:761-772`; FACTS 26).
- **Step 1**: Play up (the major scale), **Leave out fa and ti** (a switch, off at first) and
  Lesson 4's Slide with Start lower and Start higher, its slider running C3 to B3 for the lower
  voice and C4 to B4, Lesson 4's own range, for the higher. On, Leave out fa and ti takes away fa's
  and ti's treads, with their names; the stairs left close up, and the two risers that held a
  semitone each go: mi to so and la to do are drawn as single risers of three semitones. Every
  riser carries its size as a number, 2 or 3 (1 for a semitone, with the switch off), in place of
  Lesson 4's T and S, since a riser of three is neither
  (`src/features/lessons/lesson-04/stairs-draw.ts:36`). Play up then plays the five with the top
  do, 3.15 s. The inline play, Play C major, then the five, plays the major scale (4.05 s), 0.5 s of
  quiet and the five (3.15 s), 7.7 s, with the switch moving as it plays. Slide is silent, as in
  Lesson 4; from D the five print do, re, mi, so and la over D, E, F♯, A and B, as Step 1's Notice
  reads them. The step's Try reads LESSON.md's.
- **Step 2**: the five notes only, with **Major · Minor** (Major at first) and the house on do.
  Minor moves the house from C to A below it, A2 (or A3), and the staircase draws the same five
  from A to A: A, C, D, E, G and A, the first riser three semitones, named do, me, fa, so, te and
  do, since minor is sung from do (FACTS 24, 27). **Play both** plays C, D, E, G, A, C, then 0.5 s
  of quiet, then A, C, D, E, G, A, the house moving as the second begins, 6.8 s; **Play it on C**
  plays C, E♭, F, G, B♭ and C, the minor pentatonic with C as do, 3.15 s, the stairs showing do,
  me, fa, so, te and do over C, E♭, F, G, B♭ and C while it plays and A's five again after it
  (FACTS 25). Slide is hidden: the step is about C and A.
- **Labels and lines**: each stair's name is spoken as it is printed: E♭ and B♭ in Play it on C
  ("Stair 2, me, E flat 3"), F♯ from D ("Stair 3, mi, F sharp 3") and each Slide start's own
  sharps or flats (FACTS 10). The polite line says each change in words: "Fa and ti left out: five
  notes, steps of 2, 2, 3, 2 and 3 semitones." and "Minor: the same five notes from A, steps of 3,
  2, 2, 3 and 2."

### 2. The hero's pitch line

The cold open's own drawing, `lesson-20/cold-open.ts`, new, on the run toy's drawing (5): the pitch
line standing between Merc and Tavi with the run's nine rungs over their slots, do, re, mi, so, la,
so, mi, re, do from D3, each a bead in its band, joined by the string, faint at rest; no syllable
or name shows until its note sounds (FACTS 11). It plays Merc's run for everyone, D3 up to B3 and
back, since the tease promises Merc and the voice choice comes later on the page (FACTS 8).

- **Play the run fast** and **Play it slowly**, both `data-free` plays outside the predict, working
  before and after the choice: Merc's run at 0.2 s a note, 1.80 s, or 0.6 s a note, 5.40 s (FACTS
  12). Each bead glows and shows its syllable as its note sounds, and the drawing redraws its slots
  for the tempo played, so the fast run's beads crowd together, each still in its band (FACTS 38).
  With sound off the beads still light in time and the hint reads "Sound is off, so nothing played.
  Turn sound on to hear Merc's run." Either play stops the other.
- Merc and Tavi listen while a run plays (Merc and Tavi).

### 3. Predict widget

The kit's predict, mounted as Lesson 3's research predict is
(`src/features/lessons/lesson-03/hook.ts:170-188`): `plays: []`, `reveal: []`, empty hints, and
`onChoice` showing the reveal, since the answer is a finding, not a sound (FACTS 15). The two
choices are LESSON.md's, `data-choice` "time" and "share", each at least 44 px, two a row on a
phone. Until a choice the page's own lock hint reads "Choose an answer to see what the study
found."; on the choice it hides, the choices lock (`aria-pressed`, disabled), the reveal appears
under them with the keyboard's place moved to it, and the page's status line speaks it. The reveal
opens on the answer, "What share of their tries came out right.", whichever was chosen, and never
calls a choice wrong. There is no "Now play the other one." and no play inside the predict.

- **The tour's hold**: on a first visit the welcome tour waits for the choice (`holdTour`,
  `src/features/lessons/kit/tour-gate.ts:57-69`), as on Lesson 23's page, since Step 3's text and
  its mix-up card give the answer and the tour scrolls to the steps (FACTS 1a).
- No step's toy holds anything back: nothing in the staircase or the run toy sounds, draws or reads
  out how practice should go. Play it smudged shows what a smudged run is, as the hero's fast play
  shows what a fast run is, and says nothing of how to practise (FACTS 1a).

### 4. Four words

The kit's words strip with its three plays and one silent word: Run plays Merc's run slowly, D3 at
0.6 s a note, 5.40 s, its figure the nine beads on their string; Pentatonic scale plays C4, D4, E4,
G4, A4 and C5 in the soft tone, its figure the five-note staircase; Minor pentatonic plays A3, C4,
D4, E4, G4 and A4, its figure the same staircase with the house on A; each 0.45 s a note with the
last 0.9 s, 3.15 s (FACTS 28). Agility has no play and no figure. The plays are the same for
everyone, before the voice choice.

### 5. The run toy (Steps 3 and 4)

New, `lesson-20/run-toy.ts`, on the kit's band chart and its rungs over slots (What the kit and the
app still need, item 7): the run as Merc's rungs over their slots, each rung's band 35 cents either
side with Merc's steady line at its centre, drawn in the bead style, new to
`kit/band-chart-rungs.ts`: a bead on the steady line at the start of each slot and the string
joining bead to bead. The window runs from a semitone under do to a semitone over la, 11 semitones;
the time axis is fixed, 6.75 s across, so each tempo draws the same nine beads over a shorter span,
closer together, their heights unchanged (FACTS 39). It sings in the learner's voice: Merc from D3,
or Tavi from D4 (FACTS 8), the kit's contour voice, held on each note and glided between them over
50 ms (`src/features/lessons/kit/sound.ts:15-20`).

- **Step 3**: **Tempo**, a segmented control with five notches, "0.75 s", "0.6 s", "0.45 s", "0.3
  s" and "0.2 s" (a note), at 0.6 s at first; moving it is silent and redraws the slots. **Play the
  run** sings the run at the notch's tempo, each bead glowing as its note sounds (5.40 and 2.70 s at
  the Try's two notches). **Play it smudged** moves Tempo to 0.2 s (and in free play Staccato ·
  Legato to Legato, since its notes glide), then plays an illustrated singer's run from D3 (or D4),
  1.80 s, in the soft tone, never in Merc's voice, drawn live as a violet line over Merc's beads
  and labelled "An illustration" (FACTS 82a). Each of its notes glides for 0.12 s of its 0.2 s and
  lands short: re 20 cents flat, mi 50, so 45 and la 60 on the way up; so 45 and mi 50 sharp on the
  way down, re 25 and do 15 at the end. The four notes that land light their edges, "IN THE BAND",
  and the five that slip out of their bands do not, so the Notice's "notes slip out of their bands"
  is what the chart shows. Nothing of Merc's plays, nothing scores it, and the line stays until the
  next play. **See it on the staff** (below).
- **Step 4**: **Staccato · Legato** (Legato at first), the tempo held at 0.45 s and Tempo hidden.
  Staccato sings each note for 0.15 s, its own voice with its own start, a note every 0.45 s, 3.75
  s; each rung is drawn 0.15 s wide with the gap after it, and no string joins the beads. Legato
  sings the run joined, 4.05 s, and draws the string. The inline play, Play staccato, then legato,
  plays both with 0.5 s between, 8.3 s (FACTS 31). The staccato voice keeps the house envelope
  rules, an exponential rise and a decay with no click, its attack and release short enough that
  each note ends before the next starts, tuned in the lab.
- **See it on the staff**: a switch, off at first, in Steps 3 and 4 and in free play. On, Lesson
  15's staff toy appears under the beads in the learner's clef, bass for the lower voice and treble
  for the higher, and the next play writes each note as it sounds: nine stemless noteheads in
  order, F♯ with its own sharp to its left, no key signature, no ledger line, and no staccato dot,
  with Staccato on or off. The written run stays after the play, and each notehead lights
  as its note sounds on any later play; switched on before any play, the staff shows its clef and
  nothing more until the run plays, so the sound always comes first. Off, the staff goes and the
  beads stay (FACTS 47). Play it smudged leaves the staff as it was: the staff writes the run, not
  a singer's miss.
- **Labels and lines**: each bead says its syllable and name on focus ("Bead 3, mi, F sharp 3");
  the polite status says what plays, "The run at 0.45 seconds a note.", "The run, staccato." and
  "An illustration: a smudged run, five of its nine notes outside their bands.". Nothing in the run
  toy listens.

### 6. Sing it

Lesson 9's Sing it, moved into the kit with its take and its flow (What the kit and the app still
need, item 5), with the run in place of the ladder; every state, rule and line not named here is
Lesson 9's (Lesson 9 WEB-SPEC, Toys 4).

1. **Comfort check**, **voice choice**, **Just listen today** and the **warm-up**: Lesson 9's states
   1 to 4 and their lines, word for word, with "Merc sings the run" (FACTS 41 to 46); after Just
   listen today with no voice stored, the line above the voice buttons is "Choose a voice: it picks
   who sings.", Lesson 9's with "who" for "the Merc who", since Tavi sings for the higher voice.
   Just listen today offers the run choice, Move do and Play Merc's run, in the chosen voice, and
   nothing listens.
2. **Your turn and briefing**: LESSON.md's Your turn text with its two controls, the run choice and
   **Move do**; the stop line, "What this does", **Play Merc's run** and **Start**, the only control
   that asks for the microphone.
   - **The run choice**: Lesson 9's ladder choice with this page's runs, two buttons with
     `aria-pressed`, "The run: up to la" (pressed at first) and "Smaller: up to so", the smaller
     run do re mi so mi re do, seven notes (FACTS 50, 51). Your turn's "If the top feels high, sing
     the smaller run." is the way past a top that feels high, as Lesson 9's smaller ladder is. The
     run choice and Move do can change before Start or Start again, and before Again; never during
     a take.
   - Sing it's chart is a band chart in `.sing-chart` with the pressed run's rungs over 0.75 s slots
     in the bead style, nine or seven, faint until Merc sings, each rung named on the chart by its
     syllable. Its window runs from a semitone under do to a semitone over the run's top, 11
     semitones for the run and 9 for the smaller, as Lesson 9's live chart follows its ladder (FACTS
     81), and its summary says where do is, for a screen reader ("Do is D3").
   - **Move do**: Lesson 4's control as Lesson 9 has it, a group labelled "Move do:" with "lower"
     and "higher", with this page's reach, `{ lower: 0, higher: 3 }` for the lower voice and
     `{ lower: 0, higher: 4 }` for the higher (`MoveReach`,
     `src/features/lessons/kit/move-do.ts:29-36`; FACTS 52), one reach for both runs, so changing
     run never puts do out of range. "lower" rests at its end at D, `aria-disabled`, never
     `disabled`, so a press there does nothing; after any press of "higher" it is the way back.
     Both buttons stay: the kit marks an end `aria-disabled` so that the keyboard's place stays on
     it (`src/features/lessons/kit/move-do.ts:8-12`), and Lesson 9's flow keeps Move do at its ends
     as the one exception to "absent, never disabled"
     (`src/features/lessons/lesson-09/ladder-flow.ts:15-18`). The rungs, their names and the
     chart's window move with do.
   - With sound off, Play Merc's run, Start, Start again, Again, Again, smaller and Again, faster
     play nothing and ask for nothing, and one hint shows for all of them: "Sound is off, so nothing
     played. Turn sound on to hear Merc's run, then press it again." Sound turned off while Merc
     sings, before the take opens, ends the take uncounted, as on Lesson 9's page.
3. **Merc sings**, or Tavi for the higher voice: the pressed run, at 0.75 s a note, 6.75 s (5.25 s
   for the smaller), each bead glowing as it sounds; the one who does not sing listens.
4. **Take**: at least 0.4 s after the last note, with every sound held off, the status reads "Start
   on do when you're ready.", shorter than Lesson 9's, since Your turn has said "Move on as each
   bead lights". The take waits up to 6 s for the first voiced frame, then runs one 0.75 s slot a
   note from it: nine slots, 6.75 s, or seven, 5.25 s (FACTS 50, 53). Before the voice starts do's
   bead glows; from the first voiced frame each slot's bead glows in turn: that is the guide. The
   violet line draws live, folded around the glowing bead's note, with Lesson 9's octave tag.
5. **Reading**: the ladder reader over the slots, `slotSec` 0.75, with the two new options,
   `attackSec` 0.15 and `steadySec` 0.45, which it passes on to the one-take reader, each the lab's
   to tune (FACTS 56); one line a note, `rungLine` with the labels Do, Re, Mi, So, La, So again, Mi
   again, Re again and Do again for the run, and Do, Re, Mi, So, Mi again, Re again and Do again
   for the smaller (FACTS 58); each bead whose note landed lights its edge, "IN THE BAND". No voice
   within 6 s: Lesson 9's line with this task's cue, "We didn't hear you start that time. Start on
   do when its bead lights.", with **Start again** while the visit has had fewer than three takes,
   and no feeling question.
6. **How did that feel?**: Lesson 3's four answers through `mountFeelings`, locking, after each take
   with voice (FACTS 59). Easy or Workable: the count (`countLine`), "of your 9" or "of your 7", and
   the tricky line where it applies (FACTS 61); then, if the visit's one Again is unused and fewer
   than three takes have been made, **Again** (the same run, named "Again: the run" or "Again: the
   smaller run") and, after the full run, **Again, smaller** too (named "Again, smaller run", which
   holds its visible label), either using the one Again, as Lesson 9's do; **Again, faster** if the
   visit's one faster pass is unused; and **Done for today**. Merc celebrates once when every heard
   note landed. Effortful and Uncomfortable: LESSON.md's lines, no more runs, the run choice, Move
   do and Start go, and the Wrap shows the rest card (FACTS 60).
7. **Again**: states 3 to 6 again, the same run, or the smaller after Again, smaller, at the same
   tempo, Move do free to change before it. Once a smaller run has been sung, the full run is
   offered no more, as Lesson 9's ladder can only get smaller within a visit (FACTS 57).
8. **Again, faster**: the run last sung, at 0.45 s a note, 4.05 s (3.15 s for the smaller), then the
   count-in on do (`COUNT_IN`, `src/features/lessons/kit/move-do.ts:65-67`), then the guide lights
   each bead in turn at 0.45 s; 9.1 s in all (7.3 s). The status reads "Sing along as each bead
   lights, if you like." Nothing listens: the microphone is not opened, the chart draws no line,
   the beads keep the lit edges the last take left them, and nothing is counted (FACTS 63). Then
   **How did that feel?**: Easy or Workable, "That's the run, faster.", with Again (and Again,
   smaller after the full run) if still unused, and Done for today; Effortful and Uncomfortable end
   the singing as in state 6, with no count. Merc does not celebrate. Again, faster is offered once
   a visit.
9. **No microphone**: LESSON.md's line; the run choice and Move do stay, Play Merc's run sings the
   pressed run, then the guide's sweep at 0.75 s, and nothing listens. With no Web Audio at all the
   same card shows, and its plays light the beads in silence, as on Lesson 9's page. The Wrap shows
   the practice card.

**The flow rule**: `lesson-20/run-flow.ts`, pure, in the moved flow's form (Lesson 9's
`ladder-flow.ts`, `src/features/lessons/lesson-09/ladder-flow.ts:1-40`): from the comfort answer,
the voice, the sound, the microphone, the run pressed, Move do's place, the takes so far (each one's
run and what it came to), whether Again and the faster pass have gone and the answers to "How did
that feel?", it gives the card's stage, its controls, its lines and the Wrap's card, so every branch
is unit-tested without a microphone.

### 7. Go deeper drawers

Lesson 2's `details` drawer, closed at first: in Step 1, "Not everywhere" (FACTS 32); in Step 2,
"Blues" (FACTS 33). Neither plays anything.

### 8. Recall and quick check

The kit's quiz. The recall imports Lesson 9's question object `l09-q2`
(`src/features/lessons/lesson-09/quiz-questions.ts:55`) and Lesson 10's `l10-q4`
(`src/features/lessons/lesson-10/quiz-questions.ts:105`), never copied, as Lesson 23 imports Lesson
6's; their "Try Step N again" links become "Try Lesson 9, Step 3 again" and "Try Lesson 10, Step 5
again", opening `/learn/09#step-3` and `/learn/10#step-5` in a new tab (`recallStepHref`,
`src/features/lessons/kit/quiz.ts:142`), as words while that page is not live (`linkAway`,
`src/features/lessons/kit/quiz.ts:191`). The quick check's ids are `l20-q1` to `l20-q4`, three
answers each in a shuffled order, LESSON.md's words; question 4 plays E4, G4, A4, B4, D5 and E5 in
the soft tone, 3.15 s, E minor pentatonic, not the sound the Minor pentatonic word plays (FACTS
76). Storage keys: `fyp-l20-recall-seed`, `fyp-l20-recall-v1`, `fyp-l20-seed`, `fyp-l20-quiz-v1`.

### 9. Tease still

The kit's next-lesson card, drawn from the season and its lesson copy: Lesson 21's title, its hook,
and one line above the hook, its tease (FACTS 5). In the card's slot, a still of Lesson 21's
opening: Lesson 2's ring of twelve beads over Lesson 1's keyboard, D major's seven notes lit on both
and F♯ and C♯ glowing, nothing marking A. It plays nothing, and the card stays one link. Until
Lesson 21's page is live the card says "Coming later" and "See it on the map".

## Audio

Every sound is synthesised in the browser by the kit's `Sound`, after a tap, at the frequencies of
FACTS 79; nothing is recorded or streamed. Merc's "ooh" sings every run but the illustration, Tavi's
an octave higher for the higher voice; the staircase, the four words' scales, Play it smudged and
quick check 4 are in the soft tone (FACTS 37, 82a). One sound at a time across the page: any play
stops whatever else plays, the take holds every sound off while it listens (`Sound.hush`), and
leaving Sing it ends a take uncounted, as on Lesson 9's page.

| Sound                            | Notes                                                           | Timing                                                        | Voice |
| -------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | ----- |
| Cold open, Play the run fast     | D3 E3 F♯3 A3 B3 A3 F♯3 E3 D3                                    | 0.2 s a note, 1.80 s                                          | Merc  |
| Cold open, Play it slowly        | the same                                                        | 0.6 s a note, 5.40 s                                          | Merc  |
| Run (word)                       | the same                                                        | 0.6 s a note, 5.40 s                                          | Merc  |
| Pentatonic scale (word)          | C4 D4 E4 G4 A4 C5                                               | 0.45 s a note, the last 0.9 s, 3.15 s                         | soft  |
| Minor pentatonic (word)          | A3 C4 D4 E4 G4 A4                                               | the same, 3.15 s                                              | soft  |
| Step 1, C major, then the five   | C3 to C4, then C3 D3 E3 G3 A3 C4 (or C4 up)                     | 4.05 s, 0.5 s quiet, 3.15 s; 7.7 s                            | soft  |
| Step 2, Play both                | C D E G A C, then A2 C3 D3 E3 G3 A3 (or up)                     | 3.15 s, 0.5 s quiet, 3.15 s; 6.8 s                            | soft  |
| Step 2, Play it on C             | C3 E♭3 F3 G3 B♭3 C4 (or C4 up)                                  | 3.15 s                                                        | soft  |
| Step 3, the run at each notch    | D3 run (or D4)                                                  | 6.75, 5.40, 4.05, 2.70 or 1.80 s                              | voice |
| Step 3, Play it smudged          | D3 run (or D4), each note gliding and landing short (FACTS 82a) | 0.2 s a note, 1.80 s                                          | soft  |
| Step 4, staccato, then legato    | D3 run (or D4)                                                  | 0.15 s notes every 0.45 s, 3.75 s; 0.5 s; 4.05 s              | voice |
| Sing it, Merc's run and the take | D3 run (or D4), moved by Move do                                | 0.75 s a note, 6.75 s; nine 0.75 s slots                      | voice |
| Sing it, the smaller run         | D3 E3 F♯3 A3 F♯3 E3 D3 (or D4), moved by Move do                | 0.75 s a note, 5.25 s; seven 0.75 s slots                     | voice |
| Sing it, the warm-up             | Lesson 3's sigh and slide                                       | Lesson 9's                                                    | voice |
| Sing it, Again, faster           | the run last sung, the count-in on do, the guide                | 4.05 s, 0.8 s and 0.2 s quiet, 4.05 s; 9.1 s (smaller: 7.3 s) | voice |
| Quick check 4                    | E4 G4 A4 B4 D5 E5                                               | 3.15 s                                                        | soft  |

"Voice" is Merc from D3 for the lower voice and Tavi from D4 for the higher, the stored or chosen
voice; the count-in plays do at the soft tone's half level (FACTS 63). A phone's speaker plays D3,
146.83 Hz, and A2, 110.00 Hz, weakly: the lab checks both on a real phone.

## Merc and Tavi

Lesson 15's pair and poses. Tavi's bubble carries the cold open's sincere guess, "To sing it fast,
you just practise it a lot, don't you?", the predict's first choice in Tavi's words, and Merc's
"Let's see what one study found." (FACTS 13). Both listen (`mercListen`,
`src/features/lessons/kit/merc-duo.ts:207`) while a run plays, in the hero, the steps and Sing it,
Play it smudged's illustration among them; in Sing it the one who does not sing listens to the
take, and Merc celebrates once after "Easy" or "Workable" when every heard note landed, never after
Again, faster (FACTS 59). Neither speaks a line the page does not print.

## Practice links: what exists and what needs engineering

**Today**, both printed as `mercurypitch.com/pitch-training` and linking `/pitch-training?lesson=20`
(FACTS 69):

- **Scale Runner**, then choose Pentatonic: the major pentatonic, six notes up or down from the
  preset's anchor, one note at a time, each played, then a window to sing it back, 2 s at its
  starting level and longer if it eases, scored in the octave it plays (FACTS 64 to 66). The card
  says it is an echo, good for tuning the pattern, that this page is where the run is sung, and
  that it starts from the voice range saved in Settings, under Singing Voice Range (FACTS 66).
- **Staccato Precision**, the second drill: short notes from the major scale, shuffled, eight at its
  starting level, fewer and longer if it eases and shorter if its level rises, each sung back in
  the octave it plays (FACTS 67). The rest card drops it, since it asks for the voice (FACTS 72).
- Not linked: `/exercises/speed-scales`, Scale Runner at level 8 (FACTS 68).

**When SEASON-2 § 5.2 item 13 ships**: Scale Runner's scale-type launch field and minor pentatonic,
then a beginner slug that opens Pentatonic at a slow level (proposed `pentatonic-run`, data); the
card then loses "Under Scale, choose Pentatonic." (FACTS 70). **Not planned anywhere**: a drill that
sings a run continuously and reads it note by note, as this page's take does; § 5.3 should list it.

## Explorer and season data

Lesson 20's entry, proposed for Season 2's data, which goes in its own module that a Season 1 page
does not load (SEASON-2 § 6.2 item 1), in Season 1's entry form (Lesson 9's,
`src/features/lessons/kit/season.ts:325-344`):

- `n: 20`, `lane: 'voice'`, `title: 'Runs and the pentatonic scale'`, `short: 'Runs'`, `topics:
['S18', 'T16']`, with their names as SEASON-2 § 4.1 gives them: S18, "Agility: staccato, runs,
  pentatonic patterns" (`docs/plans/find-your-pitch/SEASON-2.md:773`), and T16, "Pentatonic and
  blues scales" (`docs/plans/find-your-pitch/SEASON-2.md:760`); the hook word for word (FACTS 1).
  `minutes: 15` and `page: '/learn/20'` once the page is built, under the drafts' comment in Lesson
  9's form: `// A draft until its sign-off (drafts.ts), as Lesson 3 is.` The entry decides nothing
  about being live: the draft list and the console do.
- `pr.link`: `href` `/pitch-training?lesson=20`, `addr` `mercurypitch.com/pitch-training`, `label`
  "Exercises" and `note` "then tap Scale Runner", which the explorer's card prints after the address
  as "Exercises, then tap Scale Runner" (`practiseMarkup`,
  `src/features/lessons/kit/explorer.ts:177-181`), as Lesson 9's entry links one of its two drills.
  `pr.needs`, "Scale Runner's Pentatonic by launch, and a drill that sings a run continuously",
  stays until one ships; it is "Admin only, never drawn on a lesson page"
  (`src/features/lessons/kit/season.ts:102-103`).
- `EDGES` gains [5, 20], [9, 20] and [10, 20], as SEASON-2 § 4.3 gives them (FACTS 2); Lesson 20's
  prerequisite list is then [5, 9, 10].
- The tease on this page's next-lesson card is Lesson 21's, set on Lesson 21 in the lesson copy, as
  Lesson 21's spec proposes it: `tease` "D major: seven notes, two black keys, F♯ and C♯. Now step
  up a fifth.", with `teaseAlts` `[{ id: 'lesson-4', text: 'Lesson 4 slid the scale to G, with one
sharp, and to D, with two.' }]` (FACTS 5). This lesson's own, set on Lesson 20 and drawn on Lesson
  19's card: `tease` "Merc sings a run of nine notes, five every second.", with `teaseAlts` `[{ id:
'plan', text: 'Squeeze three notes into a beat, then four, then more.' }]` and its note in the
  team's notes (FACTS 5b). Each is at most `TEASE_MAX`, 70 characters
  (`src/features/lessons/kit/lesson-copy.ts:76`).
- The signature line for the admin console, from the card (FACTS 4): "Lesson 4's staircase loses fa
  and ti, and both semitone risers go with them; what is left climbs 2, 2, 3, 2 and 3; then the run
  is beads on a string, drawn closer as the tempo rises, each bead still in its band." It goes in
  the team's notes, which no lesson page loads.
- No `fig`: the card shows no figure, as Lesson 14's does (`cardFigure`,
  `src/features/lessons/kit/explorer-figures.ts:188-194`). The explorer opens on Season 2's tab,
  and its card reads "Ready · read" with "15 min" once the page is live, as every lesson's card
  without a film does (`chipText`, `src/features/lessons/kit/explorer.ts:153-160`).

## What the kit and the app still need

Found in the kit and the app as they stand on main at `c60f0fdcb`. Every item is proposed. Items 2,
3 and 4 are Season 2's kit PR (SEASON-2 § 8.2 item 1) or Lesson 21's page, which come first; they
are listed so this page's needs are in one place.

1. **The lesson host**: `learn/20.html` at `/learn/20`, which every build takes as a lesson page, a
   draft's included (`lessonPages`, `tools/draft-lessons.ts:82-90`); `/learn/20` and
   `/learn/20.html` in `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`); the first-paint
   budgets. The lesson pages' route already takes any two digits (`LESSON_PAGE`,
   `src/lesson-gate.ts:134`). The draft line, in the draft list's form for a voice lesson with a
   scored checkpoint, as Lesson 9's (`src/features/lessons/kit/drafts.ts:38`):
   `20: "Lessons 5, 9 and 10's pages, and the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`.
   Releasing it is deleting that line, then listing the page in the sitemap and llms.txt (SEARCH.md § 12 item 3).
2. **Seasons in the kit** (SEASON-2 § 6.2 item 1): Season 2's data in its own module, Lesson 20's
   entry and its three edges, the masthead's season from the data, and the explorer's tab per
   season.
3. **The staff toy** (SEASON-2 § 6.2 item 2), Lesson 15's page, with both clefs; this page asks it
   for stemless noteheads in order and a sharp before a note, and for no staccato dot, which is
   Lesson 18's (FACTS 30).
4. **Lesson 4's staircase in the kit** (Lesson 21 WEB-SPEC, What the kit and the app still need,
   item 5), with three new states for this page: Leave out fa and ti, a number on each riser in
   place of T and S, and Major · Minor, the five from do or from la with the house moving; Play both
   and Play it on C as plays of those states. Two options as well: both names on every stair, the
   syllable over the letter through `signsHtml`, in place of the names mode, and the readout and the
   white-key note hidden (Toys 1). Pure helpers with unit tests: the steps of a set of degrees, a
   rotation from la, the minor syllables from do, and a scale's spelling with flats for a minor
   pentatonic.
5. **Lesson 9's scored take in the kit**: `lesson-09/sing-take.ts` and `lesson-09/ladder-flow.ts`
   move into the kit, as Lesson 12's sing flow moves for the sing-alongs (Lesson 15 WEB-SPEC, What
   the kit and the app still need, item 6), with the two exercises of the choice (Lesson 9's full
   and smaller ladders, this page's two runs), the slot length, the reader's options, the rung
   labels, the offers after Easy or Workable and Move do's reach as options; Lesson 9's page then
   imports them. This page adds a second offer, Again, faster, an unscored guide with the count-in.
6. **The reader's two options** (FACTS 56): `readLadder`
   (`src/features/lessons/kit/take.ts:320-337`) reads each slot through `readTake`
   (`src/features/lessons/kit/take.ts:126-147`), which drops the kit's 0.3 s attack and needs 0.6 s
   of steady voice itself (`ATTACK_SEC` and `STEADY_SEC`, `src/features/lessons/kit/take.ts:49-52`,
   read at `:133-134`), more than a 0.75 s slot holds. So `readTake` takes an options argument with
   `attackSec` and `steadySec`, defaulting to the two constants, and `LadderOptions` gains the same
   two, which `readLadder` passes on to it; Lessons 3 and 9's readings do not change. Unit tests on
   synthetic frames: a steady 0.6 s note in a 0.75 s slot reads, a 0.4 s one does not, and the
   defaults read Lesson 9's frames, and Lesson 3's one-note takes, as today.
7. **The bead style** (Toys 5): the bead and the string as an option of
   `kit/band-chart-rungs.ts`, slots that follow a tempo, Staccato's short rungs, and an illustrated
   singer's line drawn over the beads from a contour, with no microphone, as Lesson 9's illustrated
   landing is drawn; with unit tests on the geometry. The run toy's controls and Play it smudged's
   contour stay in `lesson-20/run-toy.ts`.
8. **No decorative staff** (Look; Lesson 15 WEB-SPEC, What the kit and the app still need, item 7).
9. **The lesson copy and the team's notes**: Lesson 20's tease set on Lesson 20 with its variant
   and note (`src/features/lessons/kit/lesson-copy.ts:10-12`; FACTS 5b), and Lesson 20's signature
   (Explorer and season data). Lesson 21's tease is Lesson 21's package's to set.
10. **Season 2 in the app's lesson plumbing** (SEASON-2 § 5.2 item 21), the app's work, not the
    page's, and this page waits for it: the lesson marker's range (`src/lib/lesson-marker.ts:19`),
    so `?lesson=20` steps First Light aside (FACTS 69); the lesson-answer bounds
    (`workers/db-worker/src/mirror-metrics.ts:61-62`), which would refuse Lesson 20's answers whole
    today; the admin console's one row per Season 1 lesson
    (`src/features/admin/lessons/lesson-admin.ts:88`); `RELEASED_LESSONS`
    (`src/lib/current-lesson.ts:34-37`).
11. **The head, the structured data and llms.txt** (Sections, 2): the title, the descriptions, the
    share card `learn/lesson-20-og.jpg` and its alt, the two structured-data blocks with
    `alternativeHeadline`, `teaches` and `timeRequired` `PT15M`, and on release the llms.txt line,
    each checked against the predict (FACTS 1a).
12. **The practise links that wait** (Practice links), the app's work: Scale Runner's scale types
    and launch field (SEASON-2 § 5.2 item 13). Two app notes found on the way, for the app's own
    list: Staccato Precision's help says it scores "timing", which it does not
    (`src/features/exercises/exercise-help.ts:206`); and Scale Runner's grade is at most 80, so its
    level can ease but never rise (FACTS 64, 67).

## Decisions for the owner

None open. The two teases (FACTS 5, 5b) were settled at the lead's reviews on 1 November 2026, each
with an alternative the console can switch to later, and the lead's review of 2 November 2026
settled the rest. The head title is proposed in Sections, 2, as Lessons 15 to 23 propose theirs:
"Pentatonic scale and singing fast runs | MercuryPitch" (53), with "How to sing fast runs: the
pentatonic scale | MercuryPitch" (56) beside it if the lead prefers; neither says what the study
found. Do on D, Move do higher only, the smaller run and its top line, the faster pass's tempo and
its line, Step 3's practice advice and Step 4 are the vocal coach's to confirm before publishing
(LESSON.md, For the vocal coach), not the owner's.

## Edge cases

- **Sound off**: the hero's plays light the beads in time and show the hint; the predict works, since
  it needs no sound; the toys draw as they would play, Play it smudged's line among them; Sing it's
  buttons play nothing and show the one hint, and nothing opens the microphone (Toys 6, state 2).
- **No microphone, or permission refused**: Sing it falls back to the listening path with LESSON.md's
  line; the practice card, not the rest card, shows, since nothing was sung (Toys 6, state 9).
- **A take with no voice**: no feeling question, Start again while fewer than three takes; after the
  last, the line keeps no cue (Toys 6, state 5).
- **A take with voice but too little in a slot**: that note is left out of the count, which reads "N
  of the M notes we heard" (FACTS 61).
- **The smaller run**: chosen before Start, it has Merc sing seven notes, the take read seven slots
  and the count say "of your 7"; once a smaller run has been sung, the full run's button is gone
  and Again offers only the smaller; the faster pass plays the run last sung (FACTS 50, 57, 63).
- **A singer who starts late or races**: the slots run from the first voiced frame at 0.75 s each;
  a singer ahead of the guide is read in the slots the guide sets, so a note sung early is read
  against the note before it. The lab tunes the attack and steady options against real runs before
  the page is built (FACTS 56).
- **Move do at its end**: "lower" at D, where every visit starts, and "higher" after three (or four)
  presses, are `aria-disabled`, and a press neither moves do nor stops what plays; changing run
  keeps do where it is, since one reach serves both runs (FACTS 52).
- **Voice changed mid-visit**: the staircase, the run toy, the staff's clef and Sing it's chart follow
  the new voice at once; a take in progress ends uncounted first.
- **Leaving Sing it during a take**, or hiding the tab: the take ends uncounted and asks no feeling,
  as on Lesson 9's page.
- **Again, faster with sound off**: nothing plays and the hint shows; the pass is not spent.
- **Reduced motion**: the guide's glow lights without a swell; the faster pass's guide steps bead by
  bead, at its tempo, since the guide is the timing.
- **The predict on a phone**: the choices sit below the first screen; the recall, the four words and
  the step headings below them hold nothing of the answer, and the tour waits (FACTS 1a).
- **A narrow screen**: Tempo's five notches wrap to two rows under 360 px, each at least 44 px; the
  staff under the beads scrolls inside the stage rather than the page.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-20/`, and on the kit
parts it adds:

1. **Steps**: the major pentatonic's degrees give 2, 2, 3, 2 and 3; read from la, 3, 2, 2, 3 and 2;
   C minor pentatonic spells C, E♭, F, G, B♭, C; from D the five are D, E, F♯, A, B (FACTS 22 to 25).
2. **The runs against the presets**: D3 to B3 and D4 to B4 against `VOCAL_RANGES`, every note at
   least 2 semitones inside every preset of its voice; every Move do position the reach allows
   passes, for the run and for the smaller run, D3 to A3 and D4 to A4, and every one beyond it fails
   for the run; the octave below fails (FACTS 51, 52, 55).
3. **The reader's options**: with `attackSec` 0.15 and `steadySec` 0.45, a steady note filling a
   0.75 s slot reads and lands; one 0.4 s long reads "not steady"; a note an octave down folds and
   says so within 50 cents; with no options, `readLadder` reads Lesson 9's fixtures and `readTake`
   Lesson 3's exactly as today (FACTS 56).
4. **The count**: nine slots, seven landed of nine heard, gives "This time, 7 of your 9 notes landed
   in the band." and the tricky line; seven slots, the smaller run's, read with the labels Do, Re,
   Mi, So, Mi again, Re again and Do again and count "of your 7"; a slot with no steady voice is
   left out (FACTS 58, 61).
5. **Sounds**: every fixed note's frequency equals `hz(m)` for FACTS 79; the runs last 6.75, 5.40,
   4.05, 2.70 and 1.80 s and the smaller run 5.25 s, the staircase's scale 4.05 s and its five
   3.15 s, Step 1's play 7.7 s, Play both 6.8 s, the staccato run 3.75 s, the faster pass 9.1 s
   (7.3 s for the smaller), quick check 4 E4 to E5 in 3.15 s (FACTS 80). Play it smudged is the soft
   tone, never Merc's voice, 1.80 s: nine notes, each gliding 0.12 s and landing at FACTS 82a's
   offsets, five of them more than 35 cents off.
6. **The predict**: no play inside it; the reveal shows on the choice, with either choice, opening
   on the answer; the lock hint hides; the hero's two plays work before and after the choice and
   never reveal; nothing on the page says "Now play the other one." (FACTS 15).
7. **The recall**: the questions are `l09-q2` and `l10-q4`, imported, not copied; their links open
   `/learn/09#step-3` and `/learn/10#step-5`; no text in either names the study, a practice method,
   "slow" or "accurate" (FACTS 1a, 7).
8. **The quick check**: ids `l20-q1` to `l20-q4`, three answers each, one right, LESSON.md's words;
   question 4's notes are E4, G4, A4, B4, D5 and E5, not the Minor pentatonic word's; no feedback
   line starts with "Right", "Yes" or "Correct" (FACTS 73 to 77).
9. **Sing it's flow**, in Lesson 9's tests' form (`ladder-flow.test.ts` and its siblings): the voice
   before anything plays; Again (or Again, smaller after the full run, either using it) and Again,
   faster each once a visit, only after Easy or Workable; after a sung smaller run the full run is
   offered no more; at most three takes; the faster pass plays the run last sung, never opens the
   microphone, never counts and never moves the lit edges; Effortful, Uncomfortable and Just listen
   today give the rest card, naming Scale Runner and not Staccato Precision; no microphone gives
   the practice card (FACTS 57, 59, 60, 63, 72).

Page tests, against a local or dev build, never production:

10. The head test (`src/tests/lesson-pages.test.ts`): the title within 60 characters, the
    description 80 to 160 with "A fifteen-minute lesson", the chip "15 minutes" and `timeRequired`
    `PT15M`.
11. No planning text on the page: no topic code such as "S18", no "planned" or "for the team"
    (`src/e2e/learn-no-planning-text.spec.ts:22-41`).
12. The stage-fit test at the four short landscape sizes, every step's controls on screen with the
    stage stuck, Tempo's notches, Play it smudged and the staff switch among them
    (`src/e2e/learn-stage-fit.spec.ts:33-54`).
13. The first-paint budgets for `learn/20.html`.
14. The claims validator over LESSON.md and WEB-SPEC.md (`validateGuidedDynamicClaim`), 0 flagged
    lines, as Lessons 12 and 14 ran it (FACTS 85).
15. **One sound at a time**: a hero play stops the other, a word's play stops a toy's, and the take
    holds every sound off (Audio).
16. **No background staff**: the page has no `.mv-staff` and no repeating gradient behind it (Look).
17. **The tour's hold**: on a first visit the welcome tour does not open before the predict's choice
    and opens after it; "Tour this page" opens it at once (Toys 3).
18. **Nothing answers the predict before the choice**: at first paint, with no choice made, the
    visible text of the head, the hero, the recall, the four words and the step headings holds no
    "share", "correct", "accurate" or "how long" beyond the predict's own choices, and no "slow"
    beyond the two play labels, "Play it slowly" and the Run word's "the run, slowly", which name a
    tempo to hear (FACTS 1a); the recall's feedback lines, hidden until an answer, are not
    first-paint text; and the reveal is hidden.

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=20` before any hash. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px with no two tap zones overlapping (the beads and stairs are
real buttons over their drawings, and Tempo's notches a segmented control), visible focus, a single
dark theme with every colour a token and an explicit body background, sound only after a tap,
localStorage only for per-viewer conveniences inside try/catch, and the whole page usable with no
sound, no microphone, no WebGL and no storage (the toys and Sing it then say why they wait). Every ♯
and ♭ the page prints in text (F♯ in Step 1's Notice; E♭ and B♭ in Step 2's text; every letter the
stairs print, F♯ and C♯ from D, the sharps and flats of the Slide's other starts, and E♭ and B♭
during Play it on C (Toys 1); the sharp on the staff; and the next-lesson card's tease, F♯ and C♯)
has a spoken name, the sign `aria-hidden` and a visually hidden word after it (`signsHtml`,
`src/features/lessons/kit/notes.ts:221`); the figures' accessible names and every live region use
words only, and every note is spoken with its letter and octave. The page stores the quiz seeds and
records (Toys 8), `fyp-done` (`src/features/lessons/kit/progress.ts:12-15`), `fyp-voice`
(`src/features/lessons/kit/voice-choice.ts:20`), the warm-up's Skip as `fyp-l20-warmup`, the
masthead's Pause animations choice, `fyp-motion` (`src/features/lessons/kit/motion-switch.ts:12`),
the steps the viewer reached, `fyp-pos` (`src/features/lessons/kit/position.ts:20`), and its record
of the welcome tour, `fyp-tour` (`src/features/lessons/kit/tour-gate.ts:29`); nothing from the toys
or the take but the voice and the Skip. The predict's choice, the toys' switches, the run choice,
Move do and the visit's Again and faster pass hold for the visit, in memory. The take's audio is
analysed on the device and never recorded, kept or sent, and no analytics carry its notes, readings
or feelings.

The departures from ARTICLE-PLAN.md, each argued in FACTS and all listed in FACTS 4, with the main
ones named in LESSON.md's preamble: Lesson 5's chip (FACTS 2); the sound gate in Lesson 9's form,
naming the voice and the microphone (1a); Tavi voicing the first choice's guess, "practise it a
lot", and Merc's shorter line (13); the predict asking what "went with" better playing, its second
choice "What share of their tries came out right" (14); Merc's fast run drawn as sung, each bead in
its band, with the smudging shown in Step 3 as an illustrated singer's run, Play it smudged (38,
82a); the recall asking Lesson 9's question 2 in place of Lesson 4's (7); the Run definition
without "sung on one breath", and with "by step or by leap" (28); Step 1's Slide, its riser counts,
"Leave out fa and ti" and both names on every stair (26); Step 3's Try for listening, with Lesson
9's study beside the pianists', the plan called an inference, and the mix-up card's better idea the
Wrap's (18 to 20); Step 4 saying what Arneson says, its line on the staccato dot cut (29, 30); the
smaller run beside the full one, with a line for a top that feels high (50, 51); Move do higher
only (52); the band at 35 cents, not 60 (54); the reader's two options (56); the count and "That's
the run, faster." in place of the plan's Easy and Workable line, and a faster pass that listens to
nothing (61, 63); the practice card's account of both drills (64 to 67); the quick check's lines
reworded where they used "so" as a conjunction, repeated the right answer or said "predict", and
question 4 on E minor pentatonic (73 to 76); the Wrap's third line reworded (78); Go deeper with two
items (32 to 36); and the next-lesson tease, Lesson 21's settled line (5).

Page QA before publishing adds, for this page, every check against a local or dev build, never
production:

- Every play, switch and button works by keyboard alone and announces what LESSON.md shows; a screen
  reader hears every bead and stair with its syllable, letter and octave, and each reading line in
  words.
- At 390 x 844 every target is at least 44 px square and nothing scrolls sideways at 344, 360 and
  375 px; the beads, their names, the stairs' two names and the staff fit the stage without
  overlap, in both clefs.
- On a real phone, by ear and by eye (`docs/agent/DEVICE-DEBUGGING.md`): D3 and A2 audible on the
  speaker; the fast run's nine notes each heard, with no smear, and Play it smudged heard as
  smudged beside it; the staccato notes separate, with no click; each bead lighting as its note
  starts; a real run, and a real smaller run, read note by note, with the attack and steady options
  set from the lab's runs.
- The network panel stays quiet through Sing it: no request carries the take; the browser's
  microphone indicator shows only between Start and the take's end, and never in Again, faster.
- The Wrap's practice card shows the rest card after "Effortful", "Uncomfortable" and "Just listen
  today", naming Scale Runner, and the practice card after every other ending; every link opens in a
  new tab.
- The app-check sweep at phone and desktop width, with Sing it open in each state and with each
  run, the staircase in each state with its printed names, the run toy at every notch with the
  staff on and after Play it smudged, and the cold open before and after its reveal.
