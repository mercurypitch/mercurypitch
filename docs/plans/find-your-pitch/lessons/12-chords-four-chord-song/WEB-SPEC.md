# Lesson 12 web page: spec

The Lesson 12 page is the web lesson for "Chords and the four-chord song": written steps, one main
toy in five step states with a compact layout and free play, a cold open on the hero's spiral, one
predict, a tune toy, an unscored sing-along, two quizzes (the recall and the quick check) and the
lesson explorer. Copy is in [LESSON.md](LESSON.md); every claim is in [FACTS.md](FACTS.md). It is a
text-only package: no film exists for Lesson 12, so the page has no Watch section and the masthead's
anchors are Lesson, Sing and Explorer. It is built on the kit (`src/features/lessons/kit/`) as it
stands on main at `75eeddc40`, and like Lessons 2 to 10 it reuses and never copies: a part that
still lives in an earlier lesson's module moves into the kit first. Five parts this page needs are
ones earlier pages and specs add to the kit:

- from Lesson 6's page, PR #1149, on main since 21 October 2026: the guide's breath mark
  (`slide-guide.ts`, `breaths`), the page-wide "now playing" owner (`kit/now-playing.ts`) and a
  play that can report "not heard" to the predict (`kit/predict.ts`);
- from Lesson 10's spec (`lessons/10-major-minor/WEB-SPEC.md`, What the kit and the app still need,
  items 5 and 7), not on main yet: the names switch with a choice of modes, and Move do with its
  count-in note, both moved into the kit from Lesson 4's page.

Where one of Lesson 10's two is not in the kit when this page is built, this page adds it in the
form that spec gives, and the later page reuses it (What the kit and the app still need, items 5
and 7). Where
this page shares a behaviour with Lesson 3's checkpoint (the comfort check, the voice choice, "How
did that feel?" and the rest card), it is Lesson 3's, unchanged unless this spec says otherwise, and
after "Effortful" it follows Lessons 6 and 10: no further guide, and the rest card in the Wrap.

One object carries the lesson across its steps: the ring of rooms (Toys 1), the kit's spiral seen
from above, where one turn is a ring of twelve, with a chord drawn as a room, the triangle joining
its three notes. In Step 1 it builds the seven rooms of C major, one chip at a time; in Step 2 the
rooms take their numerals and turn round the ring together into G major; in Step 3 one corner of
the room on do slides from G to A and the room on la appears, its mirror image; in Step 4 four rooms
light in turn as the loop goes round; in Step 5 a tune walks through them, and each note that lands
on a corner of its chord's room glows gold. The CURRICULUM's signature is that last state: "four
chords as four rooms on the spiral; a melody walking through them" (FACTS 4). The hero's cold open
uses the same ring and the same two tunes (Toys 2). Motion principle 2, "One object carries the
story across shots and keeps its identity" (`research/brand-motion.md` § 3.3), and playbook rule 6
ask for it. Lesson 10's chord beads stay on Lesson 10's page: this lesson's chords are drawn as
rooms, and nothing here needs a chord's notes by height.

Its public home is `mercurypitch.com/learn/12` (MASTER-PLAN § 12 item 9): a hand-written document
`learn/12.html` with its module in `src/features/lessons/lesson-12/`, wired as Lesson 4's page is
(`src/features/lessons/lesson-04/main.ts`), the nearest page on main: a written lesson with no film,
its cold open before its recall, a recall shown to everyone, a names switch, a slide guide with Move
do, and free play in the Wrap. It is published only after Lesson 10's page, `/learn/10`, is, because
its recall check asks Lesson 10's questions and its prerequisite chip names Lesson 10 (FACTS 2, 7),
and after the vocal coach has looked at its voice lines (LESSON.md, For the vocal coach). Until both
are done it is a draft (`src/features/lessons/kit/drafts.ts:5-24`, `:30-38`). Every build carries
`learn/12.html`, as it carries every lesson page (`tools/draft-lessons.ts:8-14`), and its line in
`drafts.ts` holds it back on mercurypitch.com: the site worker answers `/learn/12` with the 404
page, and every page's explorer shows Lesson 12 with no link, as a lesson not written yet
(`src/lesson-gate.ts:10-12`; `src/features/lessons/kit/publish.ts:16-25`). The dev site and every PR
preview serve it. Publishing it from the admin console puts it live on mercurypitch.com with no
release (`src/features/lessons/kit/drafts.ts:13`); the console asks first while its `drafts.ts` line
stands, naming what it waits on (`src/features/admin/AdminLessonsPage.tsx:186-207`), but it checks
nothing, and "publish after Lesson 10" is a rule for whoever uses it: nothing enforces it (Decisions
for the owner). Releasing it is deleting its `drafts.ts` line (What the kit and the app still need,
items 2 and 15). The curiosity plan's kit work is on main: Lesson 12's hook is the season's
(`src/features/lessons/kit/season.ts:366`), its tease is in the kit's lesson copy
(`src/features/lessons/kit/lesson-copy.ts:117`), as its alternative was until #1186 (`:133-141` at
`b7093a0a4`), Lesson 13's tease is there too (`:118`), and the next-lesson card draws a tease above
the next hook (`src/features/lessons/kit/next-card.ts:142-143`). So the page writes only its own
title into its markup, and nothing of Lesson 13's (FACTS 1, 5).

## Look

Lessons 1 to 10's look, unchanged: the dark listening room, the series colour code, Lesson 1's type
and wordmark, and the motion rules. On this page:

- Every room is drawn in the same chrome, whatever its quality. No hue is given to major, minor or
  diminished, and the minor rooms are never drawn darker, duller or bluer than the major ones: in
  one study, slower music in a minor key drew darker, bluer colour choices, which its authors put
  down to shared emotional associations, the kind of link Lesson 10 questions (FACTS 41). A room's
  quality shows in its shape and its name: the chip's numeral and the quality word in the room's
  label.
- Gold `#ffd84d` marks only the fit: a tune's note on a corner of its chord's room. It appears only
  while a tune plays, after the cold open's choice or in Step 5 and free play; nothing else on the
  page is gold, so before the choice the hero cannot answer the predict (FACTS, Illustrations
  without claims).
- Chrome `#c3ccd6` is every room and every scale note; the bead that is sounding is ink `#e6edf3`,
  lit. The black keys' beads are lit and named, and drawn fainter than the scale's own notes.
- Blue `#58a6ff` and orange `#ff7448` are Merc and Tavi's own: their bubbles, Merc's walk through
  the rooms as it sings a tune (the tune's line, bead to bead, in blue, as Lesson 6 lights the notes
  Merc sings), and in Sing it the still of the Merc who sings. The guide takes the app's canvas
  colours, target amber `#f59e0b` for Merc's path while Merc sings; on the viewer's turn it turns
  plain chrome, as Lessons 2, 4, 6 and 10's guides do (Lesson 2 DECISIONS 68).
- Quality is a word and a shape on the toy, "major", "minor", "diminished" and the chord's numeral,
  and every count is a number. No meaning rests on colour alone, and the page passes MASTER-PLAN §
  5's colour-blindness gate (`docs/plans/find-your-pitch/MASTER-PLAN.md:214-216`): a note on a
  corner is gold and also grows a ring round its bead, so it reads apart from a note between
  corners without the colour.

Four things move: the Merc idle loops; a room's corner while it slides (Step 3); every room while
the key switch turns them round the ring (Step 2); and a tune's walk as it is drawn, bead to bead.
Only Merc and Tavi move on their own. Under `prefers-reduced-motion` Merc and Tavi stop, and every
slide and turn lands in its end state with no travel; the walk is drawn a segment at a time as each
note sounds, with no travel along it. What the viewer starts still sounds, and the beads still light
as they sound. For everyone else the masthead's Pause animations toggle stops the same things (WCAG
2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) with Lessons 2 to 10's departures kept: the step toys double
as the Playground, unlocked in the Wrap; the mix-up card sits in the step whose toy refutes it; the
practice card sits in the Wrap. No Watch section (§ 4.2 item 10). The page opens in Lesson 2's
order: the hook, the stage, the sound gate and the cold open's predict, then the recall
(CURIOSITY-MOMENTS § 3.1 and § 5 item 1; MASTER-PLAN § 4.2 items 3 and 4, as § 12 item 13 decided;
FACTS 5a). Each section's heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 4's (wordmark, "Season 1 · Lesson 12", anchors Lesson, Sing and Explorer,
   the Sound toggle off by default, Pause animations with its reduced-motion lock), through
   `initMasthead` (`src/features/lessons/kit/page-chrome.ts:119-150`) with Lesson 4's map of
   sections and `{ lesson: 12, deck }` (`lesson-04/main.ts:99-110`), which draws the lesson menu,
   remembers the steps the viewer reaches and first settles the page's links to other lessons for
   the state it was served with (`followPageState`, `src/features/lessons/kit/page-chrome.ts:123`).
2. **Hero, with the cold open**, laid out as Lesson 2's (`learn/02.html:329-502`). Its copy holds
   the kicker, the hook question as the title (the `<h1 class="hook" id="hook">` every lesson page
   has, `learn/04.html:328`), the meta as three chips, the promise and the sound gate from
   LESSON.md. The chips are "15 minutes" (FACTS 3), "After Lesson 10: Major and minor", a link to
   `/learn/10` as Lesson 4's prerequisite chip links Lesson 2 (`learn/04.html:335-339`; FACTS 2),
   which stays a plain chip wherever Lesson 10 is not live
   (`src/features/lessons/kit/page-state.ts:16-17`), and "Sound on". Its stage holds Tavi's and
   Merc's bubbles (`learn/02.html:383`) over Merc and Tavi on the floor line, the hero's own copy of
   the spiral between them (`:404`; Toys 2), and under the spiral the cold open's three plays: "Play
   the four chords", which works from the start, and "Play tune 1" and "Play tune 2", locked until a
   choice. The predict card sits under the stage, as Lesson 2's does (`:448`): LESSON.md's predict,
   its two choices, the lock hint and the reveal (Toys 3). On a phone the hero's parts run kicker,
   title, meta, the stage, the gate, the predict, then the promise
   (`src/features/lessons/kit/lesson-stage.css:365-408`), so the title and the first Play come
   before anything asks for an answer (CURIOSITY-MOMENTS § 3.1, "Above the fold"; FACTS 5a).
3. **Recall from Lesson 10**, straight after the hero (`learn/02.html:505`): Lesson 10's questions
   1 and 2, shown to everyone, since Lesson 10 is a prerequisite (Toys 8; FACTS 7).
4. **Four words you'll meet**: diatonic, Roman numeral, diminished and augmented, each with its
   definition, a small figure and a play button (Toys 4).
5. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next), every step on
   the one ring-of-rooms toy (`toyFor: () => 1`, as Lesson 4's deck, `lesson-04/main.ts:72-76`), in
   five states (Toys 1):
   1. Where do a key's chords come from? The seven chips of C major.
   2. How do Roman numerals name them? The chips with their numerals, and the key switch C · G; the
      Go deeper drawer.
   3. Why is the chord on la minor? Play I, then vi, Slow, and the names switch.
   4. Which four chords go round and round? Play the loop, Play the roots and Slow; the Go deeper
      drawer.
   5. If the chords match, is it the same song? The tune toy, Tune 1 · Tune 2 · Even notes, with
      Slow; the mix-up card.
6. **Sing it**: the comfort check, the voice choice, Merc's notes, the guide, Move do and the
   feeling question (Toys 6); nothing listens.
7. **Quick check**: LESSON.md's four questions (Toys 8).
8. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's ending
   picks, the next lesson's card, and free play. The practice card is the app card Lessons 4, 5 and
   10 use, with LESSON.md's eyebrow, title, text, address and second drill: Arpeggio Jumper, linked
   `/pitch-training?lesson=12`, and Ear Lab's Cadence, linked `/ear-lab?lesson=12` (Practice
   links). It has no first-visit line, since the marker steps First Light aside (FACTS 43). After
   "Effortful", "Uncomfortable" or "Just listen today" it is the rest card instead, with Arpeggio
   Jumper named and Cadence still offered, since Cadence needs no voice (Toys 6; FACTS 63). Both
   links open in a new tab. The two versions sit in one `#practiseCard`, shown by the visit's
   ending, as Lesson 5's are (`lesson-05/wrap.ts:23-25`; `comfort.ts:126-149`). The next lesson's
   card is the kit's, drawn from the season by `createNextCard(12)` before
   `createExplorer({ current: 12 })`, as Lesson 4's page draws its own (`lesson-04/main.ts:94-96`;
   `kit/next-card.ts:181-209`, from the season as the page's state shows it). Its eyebrow reads
   "Next lesson 13 · Resonance and vowels" with "Coming later"; then Lesson 13's tease, "Same note,
   two vowels: ‘ee’, then ‘ah’.", above Lesson 13's hook, and "See it on the map" while Lesson 13
   is not live; once it is, "Start lesson" to `/learn/13` (FACTS 5). Its slot, the page's
   `[data-next-card]` mark, holds the tease still (Toys 9). Free play follows the card: every
   ring-of-rooms control on one card (Toys 1; playbook rule 17), keeping the card's place after the
   challenge and the practice card (CURIOSITY-MOMENTS § 3.1).
9. **Lesson explorer**: the kit's, `createExplorer({ current: 12 })`
   (`src/features/lessons/kit/explorer.ts:256`), with Lesson 12 as the current node. Under its
   heading is Lesson 1's line, which names no lesson's state: the legend and the cards say it, from
   the season data. Its cards show only learner information: "Ready", "Coming later" or "Done", and
   "Ready · read" for a lesson with no film, with no signature, no backlog and no topic codes
   (`explorer.ts:135-160`; FACTS 6; Explorer and season data).
10. **Footer**: Lesson 1's, with "Season 1 · Lesson 12 · Chords and the four-chord song"; the two
    practice links, printed `mercurypitch.com/pitch-training` and `mercurypitch.com/ear-lab`, with
    "Arpeggio Jumper and Cadence are free." and no first-visit line (FACTS 42, 43, 44); Lesson 1's
    fonts line and "Every sound on this page is synthesised in your browser" (FACTS 6, Labels); the
    legal links, as every lesson document closes (`src/tests/lesson-pages.test.ts:265-274`). With
    no film there are no voices to credit.

## Length

The learner copy is 2,336 words on `pnpm lesson:words` (FACTS 3; the review's 2,341), under the
series' cap of 2,379, Lesson 3's page on the same counter less the editorial note under its title.
The page runs about 15 minutes: 9.82 of reading at 238 words a minute and 5.25 of sound, toys and
tasks, 15.07 in all. That is past MASTER-PLAN § 4.2's 8 to 12 minutes of active time, as Lessons 3,
5, 6, 7 and 10 are (16, 18, 17, 16 and 17 minutes: Lesson 3 FACTS 61, Lesson 5 FACTS 2, Lesson 6
FACTS 3, Lesson 7 FACTS 4, Lesson 10 FACTS 3). Each step's text, with its Try, its Notice and any
Tavi line, runs 96 to 118 words (Steps 1 to 5: 115, 118, 118, 111 and 96), inside § 4.2's 50 to 120
a step. Six parts carry more, by the same counter with their headings left out, for these reasons:

- **Steps 2 and 4, 153 and 180 words with their drawers.** Each Go deeper drawer (35 and 69 words)
  is closed by default: Step 2's says that some texts write numerals without case, and Step 4's
  gives the loop's turn that starts on vi and the doo-wop loop.
- **Step 5, 220 words with its mix-up card.** The card (123 words) sits in the step whose toy
  refutes it, as in Lessons 2 to 10, and quotes the two sources the misconception needs.
- **Sing it, 304 words.** It holds the series' singing lines, which are Lesson 3's word for word and
  are not cut (LESSON.md's intro).
- **The quick check, 356 words.** Four questions with three answers each and a line of feedback for
  every answer, as MASTER-PLAN § 4.2 item 8 asks.
- **The Wrap, 366 words.** The practice card names two drills and says how Arpeggio Jumper climbs
  and scores, which the learner needs before opening it (FACTS 45 to 47).

The activities are timed from the spec's own lengths (FACTS 3): the cold open's three plays, 8 s
each, and the four words' sounds, 12.9 s, about three quarters of a minute with a replay; Step 1's
seven chips, 1.4 s each, about half a minute with the looking; Step 2's key switch and three chords
in G, about half a minute; Step 3's two chords, a quarter of a minute; Step 4's loop and its roots,
8 s each, about half a minute; Step 5's three tune plays, 8 s each, about three quarters of a
minute; Sing it, the comfort check, the voice choice, Merc's 10-second notes, an 11-second guide and
the feeling question, about a minute; the two recall and four quick-check questions, about a
minute. Free play in the Wrap is not counted.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                                                                                                                                          | New in Lesson 12                                                                                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The ring of rooms      | The kit's spiral seen from above (`kit/spiral.ts`: `setView('top')`, `ring`, `range`, `overlay`, `light`, `setTurning`), sound (`kit/sound.ts`), notes (`kit/notes.ts`: `hz`, `spellScale`), mode store (`kit/names.ts`), frame loop, step deck and stage fit; the names switch, Lesson 4's, which Lesson 10's spec moves into the kit with a choice of modes                   | Rooms, drawn in the spiral's overlay; the chord strip of seven chips; the key switch C · G; the corner slide; Play the loop and Play the roots; the tune toy, its walk and the count of notes on a corner; the compact layout |
| 2. The hero's ring        | The kit's spiral, the hero's own copy seen from above, as Lesson 2's copy looks down (`lesson-02/spiral-copy.ts:13-14`) and as Lesson 10's hero takes it                                                                                                                                                                                                                        | The four rooms, faint, and the tunes' walk, drawn in its overlay                                                                                                                                                              |
| 3. Predict widget         | The kit's predict (`kit/predict.ts`), with a free play before the choice and a reveal after both of two plays                                                                                                                                                                                                                                                                   | Nothing                                                                                                                                                                                                                       |
| 4. Four words             | The words strip of Lessons 1 to 10, a ticket per word with its figure and play button, each page keeping its own figures (`lesson-04/words.ts`)                                                                                                                                                                                                                                 | Four new figures                                                                                                                                                                                                              |
| 5. The tune toy           | Toys 1's ring; the kit's Merc voice (`kind: 'merc'`, `kit/sound.ts:29-43`)                                                                                                                                                                                                                                                                                                      | Two tunes over the loop, and tune 2 with even notes                                                                                                                                                                           |
| 6. Sing it                | Lesson 3's comfort check, voice choice and feeling question (`kit/comfort.ts`, `kit/voice-choice.ts`, `fyp-voice`); the kit's slide guide and breathing ring (`kit/slide-guide.ts`, `kit/sing.ts`); Move do and its count-in note, Lesson 4's, which Lesson 10's spec moves into the kit; the guide's breath mark, from Lesson 6's page; Lesson 6's rest card after "Effortful" | A path of five roots with the chords under it; Move do stopping at three higher; the Easy and Workable line                                                                                                                   |
| 7. Go deeper drawers      | Lesson 2's `details` drawer                                                                                                                                                                                                                                                                                                                                                     | Three items in two drawers                                                                                                                                                                                                    |
| 8. Recall and quick check | The kit's quiz (`kit/quiz.ts`), with its prefix, slot and away links; Lesson 4's recall, shown to everyone (`lesson-04/main.ts:58-65`); Lesson 10's questions                                                                                                                                                                                                                   | Ids and keys; spoken numerals                                                                                                                                                                                                 |
| 9. Tease still            | The kit's next-lesson card and its slot (`kit/next-card.ts`), as Lesson 2's figures sit in it                                                                                                                                                                                                                                                                                   | One still: a level pitch line over a strip of bars whose peaks carry only "?"                                                                                                                                                 |

### 1. The ring of rooms

One component, `lesson-12/rooms.ts`, new, in the states build (Step 1), numerals (Step 2), slide
(Step 3), loop (Step 4), tunes (Step 5) and free play, with a compact layout for short screens. It
is the kit's spiral (`src/features/lessons/kit/spiral.ts`), mounted on the stage and taken further
without forking it (`spiral.ts:28-32`), with a strip of DOM buttons under it, so the keyboard and
the stage-fit test reach every action.

- **Seen from above.** `setView('top')` at mount looks straight down the axis, so one turn is a ring
  of twelve (`spiral.ts:141-142`; `src/features/lessons/kit/spiral-draw.ts:17-21`), and `ring: 60`
  keeps the turn from C4 lit from above (`spiral.ts:105-106`), so C4 to B4 sit on it and the other
  turns fade (`ringFade`, `spiral-draw.ts:103-113`). `setTurning(false)` holds it still
  (`spiral.ts:139-140`), and `range: () => [60, 71]` keeps the slider on the lit turn
  (`spiral.ts:103-104`). The notes sit at 30 degrees a semitone, A at the front
  (`spiral-draw.ts:127-128`), and the ring's radius is the smaller of 0.27 of the figure's width and
  0.29 of its height (`spiral-draw.ts:133`). Every name follows the page's sharps-or-flats choice
  (`spiral.ts:25-26`), which the page leaves at its default, Sharps (`Names`, `kit/names.ts:84-88`),
  so the black keys read C♯, D♯, F♯, G♯ and A♯, and G major's F♯ is spelled as its key spells it
  (FACTS 10). The page shows no switch for it. A black key's bead is a "?" until it is lit on that
  copy (`spiral.ts:18-20`; `spiral-draw.ts:12-14`), so the page lights the turn's five with `light`
  at mount (`spiral.ts:131-132`): Step 1's Notice is about the black keys, and they carry names
  from the start.
- **A room** is drawn each frame in the spiral's `overlay` (`spiral.ts:99-100`) from where the beads
  landed (`BeadHit`, `spiral-draw.ts:31-37`), as Lesson 2's trail is
  (`lesson-02/spiral-copy.ts:38-40`): a thin chrome triangle joining a chord's three notes, at the
  beads of their names on the lit turn whatever octave sounds, with a chrome halo round each corner.
  A room that is lit, the chip's chord or the loop's chord of the moment, has a brighter line and a
  faint fill; the others in the state are drawn faint. In the ring's centre the lit room's label
  reads its name and quality, "C major" or "A minor", and from Step 2 on its numeral first, "I · C
  major". No room is drawn in a colour of its own (Look).
- **The chord strip**: seven buttons under the figure, one per degree, in scale order, each a chip
  of two lines. Its top line is the chord's root in Step 1, "on do" to "on ti", and from Step 2 on
  its numeral, I, ii, iii, IV, V, vi and vii°; its second line is the chord's notes, "C E G", or
  under Do-re-mi their syllables, "do mi so". A chip plays its chord, its three notes together for
  1.4 s (FACTS 69), and lights its room while it sounds; it stays the lit room until another plays.
  Every chip is a `button` at least 44 px tall; the strip is one row of seven where the figure is
  at least 440 px wide, the chips then 56.7 to 86.1 px wide, and two rows, four and three, below
  that, 71.5 to 83.0 px wide on phones (FACTS 75). The chips spell through `spellScale`
  (`src/features/lessons/kit/notes.ts:165-177`), one letter per degree, so G major's vii° reads "F♯
  A C" (FACTS 10, 19).
- **Build** (Step 1): the ring holds C major's seven scale notes in chrome and the five black keys
  fainter; no room is drawn until a chip is tapped. Each chip played leaves its room drawn faint
  once another is lit, so after all seven the ring holds C major's seven rooms, the newest lit. No
  room ever touches a black key (FACTS 14).
- **Numerals** (Step 2): it opens on the seven rooms, faint, with the chips' numerals in place of
  "on do" to "on ti". **The key switch C · G** is a segmented switch (`aria-pressed`, at least 44 px
  each), from C. G turns every room round the ring together by seven semitones, 210 degrees, in 0.6
  s on the kit's `expoOut` curve (`src/features/lessons/kit/reveal.ts:17-18`), while the chips
  relabel to G major's notes: I is G B D, V is D F♯ A, vii° is F♯ A C (FACTS 19). C turns them
  back. Each room keeps its shape and its numeral. The switch is silent; a chip then plays its
  chord in the key that shows, from the key's own octave: in C from C4, in G from G3 (FACTS 69).
- **Slide** (Step 3): it opens on C major with no room lit. **Play I, then vi** plays C4, E4, G4 for
  1.4 s, then, 0.3 s later, A3, C4, E4 for 1.4 s (FACTS 69). As I sounds, its room lights; in the
  0.3 s between them the corner on G slides along the ring to A, two beads round, while the corners
  on C and E hold, and the room it lands is vi's, the mirror image of I's (FACTS 21, 22). The
  centre's label changes from "I · C major" to "vi · A minor". Under reduced motion the corner lands
  at once. **Slow** (`aria-pressed`) doubles the play's lengths, as Lesson 10's Slow does (MASTER-
  PLAN § 4.2 item 5, "play / pause / scrub / slow on every animation"). **The names switch**,
  Letters · Do-re-mi, is Lesson 4's (`lesson-04/stairs-words.ts:17-23`), which Lesson 10's spec
  moves into the kit with a choice of modes (What the kit and the app still need, item 5), on a
  page-wide `createModeStore` (`kit/names.ts:27`), as Lesson 4's page keeps its own
  (`lesson-04/main.ts:69-70`). Under Do-re-mi the seven scale notes carry their syllables beside
  their beads, do on C in C major and on G in G major, and the chips' second lines change with them;
  the black keys carry no syllable. The syllables are the major scale's, Lesson 4's (`SOLFEGE`,
  `stairs-words.ts:25-35`), with do on the key's tonic: the chord on la reads "la do mi", and no
  state sings or labels from la as home (FACTS 8).
- **Loop** (Step 4): it opens with the loop's four rooms drawn faint, I, V, vi and IV. **Play the
  loop** plays I, V, vi and IV, 2.0 s each, 8.0 s (FACTS 68), each room lighting while its chord
  sounds and its chip lighting with it. **Play the roots** plays C4, G3, A3 and F3 in the soft tone,
  2.0 s each, 8.0 s (FACTS 71), each root's bead pulsing in ink and a chrome line joining it to the
  root before; a readout inside the figure names each move as it sounds, "do", "down to so", "up to
  la", "down to fa" (FACTS 26). Slow, as in Step 3. The loop never stops on its own between rounds:
  each play is one round, and Play again is the same button.
- **Tunes** (Step 5): the tune toy (Toys 5) on this ring.
- **Free play** (Wrap): its own copy of the toy in a card, as Lesson 4's is
  (`lesson-04/main.ts:90-92`), with every control: the seven chips, the key switch, the names
  switch, Play I, then vi, Play the loop, Play the roots, Tune 1, Tune 2, Even notes and Slow. In G
  the loop, the roots and the tunes play a fourth lower than in C, all by the same five semitones,
  so every chord and every sung note keeps its place against the others: the loop is G3 B3 D4, D3
  F♯3 A3, E3 G3 B3 and C3 E3 G3, its roots G3, D3, E3 and C3 (do, down to so, up to la, down to fa,
  as in C), and the tunes run C4 to C5 where in C they run F4 to F5. Play I, then vi plays G3 B3 D4,
  then E3 G3 B3, and the corner slide shows D going to E (FACTS 69a). Nothing locks: the guided
  steps come first on the page (playbook rule 17).
- **Readouts** sit inside the figure, as Lesson 1's do (`learn/01.html:610-632`, `.readout`): the
  centre's label, Step 4's moves and Step 5's count, so no status line takes height.
- **Layout and targets** (FACTS 75). The steps figure is the kit's tall figure, `.viz.tall`: 380 px
  tall on a desktop, 340 px in the deck and 310 px up to 420 px wide
  (`src/features/lessons/kit/lesson-stage.css:780-798`, `:1084-1089`, `:1094-1100`), as wide as the
  stage card's inner width on phones (`.viz.wide`, `lesson-stage.css:1282-1293`). At 344, 360, 375
  and 390 px the figure is 310, 326, 341 and 356 px wide, the ring's radius 83.7, 88.0, 89.9 and
  89.9 px, and neighbouring beads sit 43.3, 45.6, 46.5 and 46.5 px apart. A bead tap snaps to the
  nearest bead within 22 px (`spiral.ts:8-10`), so every point of the ring belongs to one bead, but
  at 344 px two neighbours' 44 px squares would overlap by 0.7 px: the beads are a second way in,
  and every action has its own button of at least 44 px, the chips first. A bead's tap plays its
  note in the soft tone, as on Lesson 2's spiral. On a desktop the figure is 445, 480 and 651 px
  wide at 961, 1024 and 1440 px, the ring 110.2 px in radius. On touch the figure keeps the kit's
  `touch-action: pan-y` (`lesson-stage.css:780-788`), so a swipe still scrolls the page.
- **The stuck stage.** Beside the text, the stage has the room the window leaves under the masthead,
  its height less the 58 px masthead and 18 px (`lesson-stage.css:662-683`; `--mast`,
  `src/features/lessons/kit/lesson-base.css:94`): 564, 555, 604 and 581 px at the kit's four short
  landscape sizes (`src/e2e/learn-stage-fit.spec.ts:35-55`). The kit shrinks a figure to fit, never
  below its `--viz-min`, 180 px unless a lesson's stylesheet sets more (`lesson-stage.css:687-704`).
  The page sets `--viz-min: 300px` on the stuck stage only, under
  `@media (min-width: 961px) and (min-height: 561px)`, outside the deck's query,
  `(max-width: 960px), (max-height: 560px)` (`lesson-stage.css:1037-1038`): at 300 px the ring's
  radius is at least 87 px and its beads at least 45 px apart. The stage, with its head, the figure,
  one row of chips, one row of the step's own buttons and the card's padding, is about 580 px with
  the 380 px figure, so in the smallest room, 555 px, the kit shrinks the figure to about 355 px,
  its ring 103 px in radius. No step shows a status line under its figure, which is what keeps every
  step to two rows of controls there.
- **The compact layout** (FACTS 75). On a phone held sideways the kit caps the deck's figure so that
  it and its toy's first row of controls share the screen, down to its `--viz-min`, 150 px unless a
  lesson's stylesheet sets more (`lesson-stage.css:1111-1128`): 162 px at 844 x 390, and 150 px on
  the shortest phones. The page leaves that floor alone. Below 240 px of height the toy draws its
  compact layout: the ring's beads carry letters only (`setLabels('letter')`, `spiral.ts:138`), the
  centre's label moves into the figure's top-left corner, and the syllables under Do-re-mi move onto
  the chips alone; the ring's radius is 47 px at 162 px, too tight for bead taps, so the chips carry
  every chord. At 844 x 390 the chord strip is one row of seven, each chip 44 px tall and wider than
  44 px, beside the step's buttons, so each step's figure and its first control share the screen,
  as the kit's stage-fit test asks of every lesson (`learn-stage-fit.spec.ts:162-213`, `:259-288`).
- **Keyboard and screen readers.** The drawing is the kit's slider over the lit turn, its values set
  by the kit, with a summary that changes with the state: "C major's seven chords, three lit: one,
  two and three." Each chip is a button named in words by its chord: in Step 1 "The chord on do: C,
  E, G", from Step 2 on "Chord one, C major: C, E, G", "Chord six, A minor: A, C, E" and "Chord
  seven, B diminished: B, D, F", in G "Chord seven, F sharp diminished: F sharp, A, C", and under
  Do-re-mi with the syllables in place of the letters. A polite live region says what each action
  changed, once: "G major: every chord turned round the ring." or "One, C major, then six, A minor:
  C and E stay, and G becomes A." Every accessible name and live text uses words, never a ♯ or ♭
  sign and never a bare numeral (`wordName`, `notes.ts:193`; Toys 8, spoken numerals). Tab order:
  the step's own buttons in reading order, the switches, then the chips from I to vii°, then the
  ring's slider.
- **States**: build; numerals; slide; loop; tunes; free play, every control together; each in its
  full or compact layout, in C or in G, under Letters or Do-re-mi. Any state can be playing or
  still. Leaving a step by any route (Next or Back, a swipe, the lesson menu's jump, `#step-N` or a
  quiz link) stops its sound and any queued play, as `lesson-03/main.ts:80-87` stops its toys when
  the step changes. A new play anywhere on the page stops the last, so one sound plays at a time.
  The kit's page-wide "now playing" owner does this (`kit/now-playing.ts:17-39`, from Lesson 6's
  page), and every source of sound on this page goes through it (Audio).

### 2. The hero's ring

The hero's stage holds a spiral of its own, the kit's, mounted as Lesson 2's hero copy is
(`lesson-02/spiral-copy.ts`; `lesson-02/cold-open.ts:39-58`) and as Lesson 10's hero takes it
further:

- **Seen from above**, as Toys 1: `setView('top')`, `ring: 60`, `range: () => [60, 71]`,
  `setTurning(false)`, the five black keys lit at mount and named in Sharps. Its beads carry their
  letters and no syllables, since the predict is about corners, not names.
- **Four rooms**, drawn faint in its overlay from the start: the loop's four chords, C major, G
  major, A minor and F major, each a thin chrome triangle, with no label and no numeral, since the
  numerals come in Step 2. Nothing on the figure marks a tune before the choice: no walk, no gold,
  no count (FACTS, Illustrations without claims).
- **Play the four chords** (`loop-c`, free) lights each room while its chord sounds, 2.0 s each
  (FACTS 68).
- **Play tune 1** (`tune-1`) and **Play tune 2** (`tune-2`), after the choice, play the loop with
  Merc singing the tune over it (Toys 5): each room lights with its chord, each sung note
  pulses its bead and a blue line joins it to the note before, and a note that lands on a corner of
  the lit room glows gold and grows a ring. The count under the ring, "On a corner: 1 of 1", rises
  as each note lands and ends on "On a corner: 11 of 15" for tune 1 and "On a corner: 10 of 12" for
  tune 2 (FACTS 35, 36). The walk stays drawn, faint, until the next play.
- **Taps.** A tap on a bead plays its note on the lit turn, C4 to B4 (FACTS 66a), as on Lesson 2's
  hero spiral; the slider keeps to the same turn. The three plays are buttons under the spiral, at
  least 44 px tall. The hero's spiral is Lesson 2's size, 270 to 340 px tall on a desktop and 264 px
  on a phone up to 560 px wide, where it takes the stage's width (`lesson-02/lesson-02.css:14-82`):
  on a phone its ring is 76.6 px in radius and its beads 39.6 px apart (FACTS 75), so its beads are
  a second way in, as Toys 1's are, and nothing in the cold open needs a bead tapped.
- **Speaking for it.** The drawing is a slider for the notes, as Lesson 2's hero copy is
  (`role="slider"`, `learn/02.html:404-409`), its values set by the kit, and a polite live region
  beside it speaks for the plays: "Four chords: C major, G major, A minor, F major." as the loop
  plays; "Tune 1, over the four chords." as a tune starts, and the count once it ends, "On a corner:
  11 of 15." It names no note as it lands, so it never chatters.

### 3. Predict widget

- The kit's predict (`src/features/lessons/kit/predict.ts:30-72`, `mountPredict` at `:80`): the
  choice locks, the play buttons unlock, the reveal appears after the sound and never calls a choice
  wrong; two choices, each button at least 44 px tall. The plays start disabled in the markup, all
  but the free one, and the choice enables them and moves the focus to the first that is not free
  (`:113-131`).
- **Cold open.** The choices are [ Most of them ] [ Hardly any ] (FACTS 39). Its three plays sit
  under the spiral on the hero's stage, outside the predict card, and are handed to the predict as
  its `plays` (`kit/predict.ts:68-69`). "Play the four chords" (`loop-c`) is a free play
  (`data-free`, `:14-16`): it sets up the question and answers nothing, since it plays no tune.
  "Play tune 1" (`tune-1`) and "Play tune 2" (`tune-2`) wait for the choice, and the reveal waits
  until both have been heard, since its counts are both tunes': `revealOn: ['tune-1', 'tune-2']`
  with `revealAfter: 'all'` (`:53-59`). The two must be passed together: without `revealOn`, `'all'`
  waits on nothing (`:98-102`). Until a choice the lock hint, in the markup, reads LESSON.md's
  "Choose an answer to unlock the two tunes."; once a choice is in (`:127`), `hints.chosen` reads
  "Locked in. Play tune 1, then tune 2, and watch where the notes land." `hints.next` reads "Now
  hear both tunes, 1 and 2, for the answer.": the kit shows it after a heard play that does not
  reveal, and only once a choice is in (`:167-173`), so it follows the four chords as well as one
  tune, and the line is true either way. Before a choice, the four chords heard with sound on put
  back the markup's own lock hint (`:85`, `:167-170`). `hints.silent` reads "Sound is off: nothing
  played. Turn sound on, then play it again.": the kit shows it after any play that sound off kept
  silent, before a choice too (`:162-165`), so it names no tune, and "it" is whichever play was just
  tapped. After the reveal (`:137`), `hints.again` reads "Play either tune again, or just the four
  chords.", and neither of the others replaces it (`:161`). The same strings are LESSON.md's. The
  reveal's "You said" line is the kit's `guess` (`:60-61`): "You said: most of them" or "You said:
  hardly any", never "right" or "wrong". As it shows, Tavi celebrates (Merc and Tavi). The reveal's
  last line makes the other choice a fair guess (CURIOSITY-MOMENTS § 1, rule 2; FACTS 39).
- With sound off the reveal waits: the reveal only ever describes a sound that was heard
  (`kit/predict.ts:5-10`). The plays' visuals still run, the walk and the gold included, as every
  play's do with sound off.
- A play that is cut short is not heard, and the reveal waits for plays that run to their end. On
  main the kit's predict ignores its own play buttons while one of them plays (`busy`,
  `kit/predict.ts:179`): a tap on another of the hero's three does nothing until the first ends, so
  the predict's own plays never cut each other short, and they carry no Stop, unlike the steps' tune
  toy (Toys 5). Only a stop (the page hidden, or sound turned off: the kit then stops every voice,
  `sound.ts:475-477`, `:507`), a bead tap on the hero's ring or leaving the hero for a step ends a
  tune early. Two more kit parts, from Lesson 6's page (PR #1149), make that safe, and this page
  uses both. A page's `play` may resolve `false` for a play cut short, and the predict then skips
  its hint and its reveal, so that play reveals nothing and the hint stays as it was
  (`predict.ts:31-41`, `:187-188`); `true` or nothing is a play heard to its end. And a page-wide
  sound owner, `NowPlaying` (`kit/now-playing.ts:17-39`), stops a source's sound through that
  source's own stop when another source claims it, so a tune also ends early when any other sound on
  the page starts, a word's play or a step's. A tune cut short either way reveals nothing, and its
  hint stays.
- States: waiting for a choice; a sound playing; a play kept silent by sound off, before a choice or
  after; choice made, no tune heard yet; choice made and one tune heard; both heard, reveal shown.
- Under reduced motion the reveal appears at once, with no slide-in.

### 4. Four words

The strip of Lessons 1 to 10: a ticket per word with its small figure, its definition and a play
button, in the page's own `lesson-12/words.ts`, as each earlier lesson keeps its own figures
(`lesson-04/words.ts`). Each button is named for what it plays, LESSON.md's labels after "Play":
"C major's seven chords", "I, then V" (spoken "chord one, then chord five"), "B, D and F" and "C, E
and G sharp" (FACTS 70). The figures are small rings of twelve, drawn in SVG, `aria-hidden`: for
diatonic, the seven white-key notes lit and the five black keys faint; for Roman numeral, two rings
side by side under "I" and "V", each with its chord's room; for diminished, B, D and F's room; for
augmented, C, E and G♯'s. They mark no tune, so they cannot answer the predict (FACTS,
Illustrations without claims). Diatonic plays the seven chords of C major as the chips voice them,
0.6 s each with 0.1 s between, 4.8 s; Roman numeral plays I, then V, as the loop voices them, 1.2 s
each, 0.3 s apart; Diminished and Augmented play their three notes at 0.5 s each, then together
for 1.2 s (FACTS 70). Under reduced motion the corners light in turn, with no other motion.

### 5. The tune toy

Two tunes over the loop, on Toys 1's ring in Step 5 and free play, and on the hero's ring in the
cold open (Toys 2): Merc sings each in Merc's "ooh" while the loop plays under it, one chord a
bar of four crotchets, 0.5 s a crotchet, 8.0 s a play (FACTS 35 to 37, 68).

- **Tune 1** plays E5 D5 C5 E5 | D5 C5 B4 D5 | C5 B4 A4 C5 | A4 G4 F4, crotchets, the last note a
  minim. **Tune 2** plays G4 (0.75 s) C5 (0.25 s) E5 (1.0 s) | C5 B4 G4 | A4 C5 E5 | F5 D5 C5, the
  same long-short-long in every bar. **Even notes** plays tune 2's twelve notes at 0.667 s each over
  the same chords (FACTS 37). The three are buttons in Step 5 and free play, at least 44 px tall,
  and a play's button reads "Stop" while it plays.
- **The walk.** Each sung note pulses its bead on the lit turn, whatever its octave, and a blue line
  joins it to the note before; the line stays drawn, faint, until the next play. A note that is a
  note of the chord sounding under it lands on a corner of the lit room: its bead glows gold and
  grows a ring (Look). A note between corners pulses ink with no gold. The page decides which by the
  note's name against the chord's three, never by measuring anything, and the counts are FACTS 35
  and 36's, which the unit tests hold.
- **The count**, a readout inside the figure, rises as the notes land, "On a corner: 4 of 5", and
  stays at its end, "11 of 15", "10 of 12" or, for Even notes, "10 of 12", until the next play.
- **Slow** (`aria-pressed`) doubles every length, the loop's with the tune's, 16.0 s.
- Under the tune the chord's voices sound at 0.05 each, so the tune stands clear of them (FACTS 74).
- Merc sings in the hero (`mercSing('blue', midi, true)` as each note starts and `false` as it
  ends, `src/features/lessons/kit/merc-duo.ts:164`) while Tavi listens (`mercListen`, `:206`); on
  the steps' ring no Merc is on screen, and the walk alone carries it.
- Its accessible names are "Play tune 1", "Play tune 2" and "Play tune 2 with even notes"; the live
  region speaks the start and the count, as in Toys 2.
- States: still, with no walk; playing; ended, its walk and its count kept.

### 6. Sing it

The guide is the kit's slide guide (`src/features/lessons/kit/slide-guide.ts`, `mountGuide` at
`:381`), as Lesson 4's page uses it (`lesson-04/sing.ts`), on eight rows from fa up to do, a
semitone apart: the four the line uses named fa, so, la and do, and the other four faint
(`GuideRow`, `slide-guide.ts:38-45`). The rows show syllables only, no letters, so no spelling can
go wrong wherever Move do puts do; a readout names do and the line in Lesson 4's names for the key,
"do is C4: C4, G3, A3, F3, C4", spoken "do is C 4" (FACTS 60). Merc's path is do, so, la, fa, do,
each root 1.6 s with 0.4 s of silence after it and the last do 2.0 s, every note after a silence
marked `gap` (`slide-guide.ts:16-17`, `:51-52`), so nothing is drawn across a silence: 10.0 s in
all (FACTS 61). The path carries the kit's breath mark, from Lesson 6's page (`breaths`,
`slide-guide.ts:62-63`), in the gap after la, 5.6 s in: a small tick in the
path's own colour with the word "breathe" (FACTS 62). Under Merc's notes and under the guide the
chords play, I, V, vi, IV and I, 2.0 s each, so each chord starts with its root (FACTS 73). Beside
the guide, the kit's breathing ring (`mountRing`, `src/features/lessons/kit/sing.ts:135`) shows the
still of the Merc singing, Merc for the lower voice and Tavi for the higher, never a microphone
icon. Every state has a visible status line that is also announced (`aria-live="polite"`). Lesson
3's rule for leaving holds, for what plays here: if the section stays off screen for 600 ms, or the
page is hidden, whatever is playing stops (`src/features/lessons/lesson-03/sing.ts:388-412`).

The notes for every preset of the app (`VOCAL_RANGES`, `src/stores/settings-store.ts:91-152`;
FACTS 59, 60; `verify12.py`, sections 8 and 12), first at Move do's middle position, with each
preset's spare semitones and the line's middle against the preset's, the middle of its range:

| Voice choice | Preset        | Range | Sung at Move do 0                                        | Spare below, above | The line's middle  |
| ------------ | ------------- | ----- | -------------------------------------------------------- | ------------------ | ------------------ |
| Lower        | Bass          | E2–E4 | C4 261.63, G3 196.00, A3 220.00, F3 174.61, C4 261.63 Hz | 13, 4              | 4.5 semitones high |
| Lower        | Baritone      | G2–G4 | the same                                                 | 10, 7              | 1.5 semitones high |
| Lower        | Tenor         | C3–C5 | the same                                                 | 5, 12              | 3.5 semitones low  |
| Higher       | Alto          | F3–F5 | C5 523.25, G4 392.00, A4 440.00, F4 349.23, C5 523.25 Hz | 12, 5              | 3.5 semitones high |
| Higher       | Mezzo-soprano | A3–A5 | the same                                                 | 8, 9               | 0.5 semitones low  |
| Higher       | Soprano       | C4–C6 | the same                                                 | 5, 12              | 3.5 semitones low  |

Then at the Move do that brings the line's middle within half a semitone of each preset's, where
two positions are as near, both, spelled as the readout spells them, in Lesson 4's names for the
key:

| Preset        | Move do  | The line                                                      | Spare below, above |
| ------------- | -------- | ------------------------------------------------------------- | ------------------ |
| Bass          | 4 lower  | A♭3 207.65, E♭3 155.56, F3 174.61, D♭3 138.59, A♭3 207.65 Hz  | 9, 8               |
| Baritone      | 1 lower  | B3 246.94, F♯3 185.00, G♯3 207.65, E3 164.81, B3 246.94 Hz    | 9, 8               |
| Baritone      | 2 lower  | B♭3 233.08, F3 174.61, G3 196.00, E♭3 155.56, B♭3 233.08 Hz   | 8, 9               |
| Tenor         | 3 higher | E♭4 311.13, B♭3 233.08, C4 261.63, A♭3 207.65, E♭4 311.13 Hz  | 8, 9               |
| Alto          | 3 lower  | A4 440.00, E4 329.63, F♯4 369.99, D4 293.66, A4 440.00 Hz     | 9, 8               |
| Alto          | 4 lower  | A♭4 415.30, E♭4 311.13, F4 349.23, D♭4 277.18, A♭4 415.30 Hz  | 8, 9               |
| Mezzo-soprano | none     | C5 523.25, G4 392.00, A4 440.00, F4 349.23, C5 523.25 Hz      | 8, 9               |
| Mezzo-soprano | 1 higher | D♭5 554.37, A♭4 415.30, B♭4 466.16, G♭4 369.99, D♭5 554.37 Hz | 9, 8               |
| Soprano       | 3 higher | E♭5 622.25, B♭4 466.16, C5 523.25, A♭4 415.30, E♭5 622.25 Hz  | 8, 9               |

The page cannot know a viewer's preset: it knows only the voice they chose, lower or higher
(`fyp-voice`). So it sings the middle position and offers Move do, and the tables are for the coach
and the tests. The bass preset has the least room above, 4 semitones, which is why Your turn says
to move do lower if the top feels high, and why Move do stops at three higher (FACTS 60).

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 3's line, its list
   naming all six of REQ-GVC-020's conditions, and its two buttons, through `mountComfort`
   (`src/features/lessons/kit/comfort.ts:158-166`; FACTS 53).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with Merc and Tavi's stills
   (`aria-pressed`, at least 44 px), read from and stored in `fyp-voice` through `VoiceChoice` and
   `bindVoiceButtons` (`src/features/lessons/kit/voice-choice.ts:30-47`, `:60-77`; FACTS 55). Its
   line has the two forms Lessons 5, 6, 7 and 10 write: with none stored, "Choose a voice to sing
   with. If you chose one in an earlier lesson, pick it again:", neither button pressed, and the
   next state waits for a choice, before "Just listen today" plays anything too, because the voice
   picks the Merc who sings; with one stored, "Keep the voice you chose before, or change it:", that
   button pressed, and nothing waits on it.
3. **Just listen today** (listen-only mode): LESSON.md's line with the doctor lines (FACTS 54, 58).
   **Play Merc's notes** sings the five roots over the chords on a tap in the chosen voice, the path
   lighting as they play; Start the guide and Move do are not shown, and nothing asks the viewer to
   sing (REQ-GVC-021). The answer holds for the visit, and the Wrap shows the rest card
   (`VisitEnding`, `comfort.ts:95-114`).
4. **Ready**: the controls in LESSON.md's order, under the Your turn text and the stop line, which
   sits in one place, on its own line above the buttons. **Play Merc's notes** sings do, so, la, fa
   and do over the chords, on do = C4 (lower) or C5 (higher), in Merc's "ooh", 10.0 s (FACTS 59,
   61, 73), the path lighting in amber in step while the ring shows the singing Merc's still. **Move
   do** is Lesson 4's group, "Move do:" with lower and higher (`learn/04.html:1250-1259`), moved
   into the kit (What the kit and the app still need, item 7): a semitone each, up to four lower
   and three higher, moving Merc's notes, the chords, the guide's count-in and its readout together,
   from "do is A♭3" to "do is E♭4" for the lower voice (spoken "do is A flat 3"), or A♭4 to E♭5 for
   the higher (FACTS 60). Lesson 4's Move do goes four either way (`MOVE_MAX`,
   `kit/move-do.ts:20-21`, `:23-29`), so the kit's takes a limit for each side, and this page
   passes four and three. At its limit a button is `aria-disabled`.
5. **Guide**: **Start the guide** is enabled once Merc's notes have played with sound on (hear it
   first: playbook rule 16); until then it is `aria-disabled`, with the hint "Play Merc's notes
   first". With sound off, Play Merc's notes runs its lights silently and the hint says why, in this
   page's form: "Sound is off: nothing played. Turn sound on to hear Merc's notes, then start the
   guide." It is the viewer's turn, so the amber goes, the rows turn plain chrome and Merc's path is
   drawn dashed in chrome. The count-in is Lesson 4's: do, once, softly, at half a tapped note's
   level, for 0.8 s, then 0.2 s of quiet (`kit/move-do.ts:42-44`; FACTS 73). Then a
   vertical chrome line sweeps the path for 10.0 s while the chords play under it, past each gap,
   with nothing riding the path itself, while the ring breathes through the gaps with the still of
   the Merc last heard at its centre. Merc does not sing in the guide: it is the viewer's turn.
   Space never starts the guide, and focus never moves to a button when a state changes, only to its
   text (REQ-GVC-080, as `lesson-03/sing-view.ts:1-9` does). When the sweep ends, the feeling
   question follows.
6. **How did that feel?** appears under the guide each time a sweep ends, asked afresh with no
   answer pressed: Lesson 3's four answers through `mountFeelings` (`comfort.ts:168-199`; FACTS 63).
   The kit locks the answer once given, until the next sweep resets it; Lesson 6's page passes the
   kit's `changeable`, so its answer can change until then (`mountFeelings`,
   `comfort.ts:168-178`). This page keeps the lock until the coach settles
   it for the series, as Lesson 10's does (Decisions for the owner).
   - Easy or Workable shows LESSON.md's line, "Do, so, la, fa, do: you just sang the loop's roots.",
     which names the task, never the voice or how the notes went, since nothing listened, and leaves
     the guide as it was.
   - Effortful shows Lesson 3's gentle line, "Keep it gentle: rest before you sing again.", and puts
     the guide and Move do away for the visit (REQ-GVC-021: a report of effort suppresses
     immediate-repeat encouragement). Play Merc's notes still plays, at the do Move do last set. The
     Wrap shows the rest card (REQ-GVC-055; FACTS 63), which this page asks the kit for, as Lesson
     6's does since #1192 and Lesson 10's will (`restAfterEffort`); `afterFeeling` leaves that to
     the coach to decide (`comfort.ts:69-78`); LESSON.md's coach list asks the coach to confirm it.
   - Uncomfortable shows Lesson 3's enough-for-today line, "Thanks for saying so. That's enough
     singing for today: rest your voice.", and the doctor lines, puts the guide and Move do away for
     the visit, and the Wrap shows the rest card (REQ-GVC-023, REQ-GVC-055).
   - A guide put away and a rest card picked stay that way for the visit. The page keeps the ending
     in memory for the visit, never in storage.

The flow is a pure rule (`lesson-12/sing-flow.ts`), as Lesson 6's page makes its own
(`lesson-06/sing-flow.ts`, the shape to follow): from the comfort answer,
the voice, whether Merc's notes have been heard, how many sweeps have run and the latest answer, it
gives the state, the controls shown, the line and the Wrap's card, so every branch above is
unit-tested (Tests, unit 8).

Nothing listens and nothing is scored: the page has no microphone and never calls `getUserMedia`, so
it produces no reading to get wrong (REQ-GVC-031), and its lines describe the chords and the task,
never the body (REQ-GVC-045; FACTS 64). The doctor lines appear only after "Just listen today" and
"Uncomfortable", as on Lesson 3's page. Keyboard order follows the flow: the comfort buttons, the
voice buttons, Play Merc's notes, Start the guide, Move do, then the four feelings. Under reduced
motion the path's notes light one after another instead of the travelling line, and the ring keeps
the kit's reduced-motion form.

### 7. Go deeper drawers

`details` disclosures, closed by default, as Lesson 2's are: under Step 2's text, "Plain numbers";
under Step 4's, "Start on vi" and "Another loop" (LESSON.md). Neither plays a sound.

### 8. Recall and quick check

Two quizzes share this page through the kit's quiz (`src/features/lessons/kit/quiz.ts`, `createQuiz`
at `:218`), with the options it already has (`:80-104`): an id prefix for each quiz's elements;
`lesson` optional; a question `id`, the event's `qLesson` and `q`; a slot for a question's own
controls (`:52-58`); and, for a question from another lesson, a step link that reads "Try Lesson 10,
Step 1 again" and opens in a new tab, through `away` (`:94-101`, `linkAway` at `:186-216`), which
keeps a link's words and drops the link wherever that lesson is not live.

- **Recall**: Lesson 10's questions 1 and 2, word for word with their feedback (LESSON.md; FACTS 7),
  under Lesson 10's ids, `l10-q1` and `l10-q2` (`lessons/10-major-minor/WEB-SPEC.md:605-606`). If
  Lesson 10's page lands first, they are imported from its `lesson-10/quiz-questions.ts` and
  filtered by id, as Lesson 4's page takes Lesson 2's (`lesson-04/quiz-questions.ts:28-29`);
  otherwise they are written into this page's `lesson-12/quiz-questions.ts` as Lesson 3 writes
  Lesson 2's (`lesson-03/quiz-questions.ts:116`), and give way to the import when Lesson 10's lands.
  Shown to everyone, as Lesson 4's recall is (`lesson-04/main.ts:58-65`), since Lesson 10 is a
  prerequisite (CURRICULUM § 3.3). Prefix `recall-`, keys `fyp-l12-recall-seed` and
  `fyp-l12-recall-v1`; earlier answers are never shown, so the answers measure delayed retrieval
  (MASTER-PLAN § 9). It takes no `lesson`, so it marks nothing done. Its links open Lesson 10's page
  at the step, `/learn/10#step-1` and `/learn/10#step-3`, in a new tab, through
  `away: { href: recallStepHref }`; the kit's step deck opens a page at the step its address names
  (`src/features/lessons/kit/step-deck.ts:19-23`). Its second question's slot holds its play
  button, Lesson 10's D4, F4 and A4 together for 1.4 s (FACTS 67), named "Play the question's
  chord", so it never shares a name with the cold open's Play the four chords.
- **Quick check**: LESSON.md's four questions, ids `l12-q1` to `l12-q4`, keys `fyp-l12-seed` and
  `fyp-l12-quiz-v1`, and `lesson: 12`, so answering all four marks Lesson 12 done in the explorer.
  Three answers each, shuffled per question from the stored seed, one-line feedback for every
  answer, and a check icon and ink (not gold) on the right one. The kit prints "Right." or "Not
  quite." before each line (`quiz.ts:315`), so no feedback line starts with "Right", "Yes" or
  "Correct". None of the four plays a sound. "Try Step 1 again" to "Try Step 5 again" use the kit's
  `data-goto-step`. Answers stay in the viewer's browser; since #1193 each question's first answer
  in a visit also goes out, anonymously.
- **Spoken numerals.** Wherever the page prints Roman numerals in text (the steps, the Wrap, the
  quiz, the practice card's I–V–vi–IV), they are `aria-hidden` and a visually hidden spoken form
  follows them, as Lesson 2's contract does for a ♯ (`signsHtml`, `notes.ts:221`): a numeral is its
  number, with "minor" after a lower-case one and "diminished" after vii°, so "I–V–vi–IV" is spoken
  "one, five, six minor, four" and "vii°" "seven diminished". The helper is the page's own,
  `lesson-12/numerals.ts`, with its unit test; it moves into the kit when a second page needs it.

### 9. Tease still

The drawing in the next-lesson card's slot, the page's `[data-next-card]` mark, which the kit keeps
in the card after its words (`kit/next-card.ts:27-30`, as Lesson 2's figures sit there): an SVG,
`aria-hidden`, of one level pitch line over a strip of bars whose peaks carry only "?", with no
words or notes on it (CURIOSITY-MOMENTS § 2, Lesson 12, Tease; FACTS, Illustrations without claims).
The bars are drawn, not measured, and name no frequency. The pitch line is drawn level, never
labelled "flat", since the series keeps "flat" for too low (HUMANIZE pattern 6). It holds no button,
since the card is a link, and it plays no sound. Its styles go under a class of its own: not Lesson
2's `.tease` (`src/features/lessons/lesson-02/lesson-02.css:510`), which `learn-next-card.spec.ts`
tests, and not the tease line's `.next-tease`
(`src/features/lessons/kit/lesson-sections.css:226-228`); in the kit's shared still styles, if the
page that first adds them (CURIOSITY-MOMENTS § 3.1, "one still per card") lands first, else in this
page's stylesheet. It does not move.

## Audio

Every sound is synthesised in the page with Web Audio, through the kit's sound module, its master
bus and its house envelopes (`.claude/memory/audio-pop-free-playback.md`), and started only by a
tap: a tapped note, a chord and the toys' plays in the soft tone; Merc's singing in Merc's "ooh",
each note its own voice; the guide's count-in in the soft tone at half a tapped note's level (FACTS
66 to 74). Nothing autoplays, and the page has no music bed.

- **The sound rules**, for every source of sound on the page: the hero's plays and bead taps, the
  four words, the recall's chord, every play and chip and bead of the ring of rooms in the steps and
  in free play, and Sing it.
  1. One sound plays at a time, across the whole page: a new play stops the one before, whichever
     toy started it.
  2. Leaving a step, by any route (Next, Back, a swipe, the lesson menu, `#step-N`, a quiz link),
     stops its sound and any queued play; scrolling Sing it off screen for 600 ms, or hiding the
     page, stops what plays there.
  3. A play that is cut short never counts as heard by the predict.

  The kit has the helpers for these, from Lesson 6's page: a page-wide "now playing" owner
  (`kit/now-playing.ts:17-39`), which every source here registers with, and a `play` that can
  report "not heard" to the predict (`kit/predict.ts:31-41`, `:187-188`).

- **A chord** is three voices started in one task, so they share one start on the audio clock, each
  at 0.075 alone or at 0.05 under a tune or a voice (FACTS 74), through `playTone`
  (`src/features/lessons/kit/sound.ts:560-569`), whose visuals run even when sound is off.
- **A loop or a tune** is timed from one start, as Lessons 2 and 4 time their examples (`schedule`,
  `src/features/lessons/lesson-02/examples.ts:124-134`, `lesson-04/examples.ts:81-92`): every chord
  and every sung note starts on its own timer, counted from the play's start, and a chord and the
  tune's note that begins with it start in the same callback, so they share one start on the audio
  clock and never drift apart, and the drawing hears the same callback. A voice's `dur` counts from
  the moment it starts (`sound.ts:262-267`). The play decides once, at its press, whether it sounds
  (`audible`, `ToneOptions`, `sound.ts:555-558`), so it is all sound or all silent. Those two
  pages' `schedule` keeps no handle on its timers; this page's must, so that stopping a play clears
  every timer not yet fired and stops every voice still sounding (What the kit and the app still
  need, item 8).
- **Levels**: a tapped note and Step 4's roots at the soft tone's 0.13; a chord's voices at 0.075
  each, or 0.05 under Merc; Merc's "ooh" at the kit's 0.2 (`sound.ts:181`); the count-in at 0.065
  (FACTS 73, 74).
- **Sound off or none.** Every play asks the kit's `Sound.canPlay` (`sound.ts:510-522`): the first
  tap turns sound on; with sound off the kit's toast says so and the visuals play silently; with no
  Web Audio nothing sounds and the visuals still play. The kit stops every sound when the page is
  hidden (`sound.ts:475-477`).

## Merc and Tavi

Lesson 1's setup through the kit (`src/features/lessons/kit/merc-duo.ts`,
`src/features/lessons/kit/merc-warm.ts`): the app's renderer loaded after first paint, one WebGL
context per Merc, medium quality on phones, turned towards each other, paused off screen, and the
still images when WebGL fails or would run on the CPU.

- They live in the hero, on either side of the spiral, and are on screen while the cold open plays.
  Tavi asks and Merc answers in the bubbles (LESSON.md). While the four chords sound, both listen
  (`mercListen`, `merc-duo.ts:206`). While a tune plays, Merc sings it (`mercSing`, `:164`), note by
  note, and Tavi listens: Merc said "Listen to both", and sings them. Tavi celebrates once as
  the reveal shows, the puzzled guesser who then gets it (`mercCelebrate('orange', 1600)`, `:216`,
  as Lesson 2's cold open does, `lesson-02/cold-open.ts:56`; playbook rule 15), a quiet one, since
  the reveal calls no choice right: the page mounts the pair with `{ sparkles: 'none' }`
  (`MercDuoOptions`, `merc-duo.ts:120-126`). The page asks for no other state.
- In Sing it Merc and Tavi appear as stills, in the ring (Toys 6).
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Arpeggio Jumper.** `mercurypitch.com/pitch-training` opens the Exercises tab (FACTS 43);
  the viewer taps Arpeggio Jumper, which plays a chord's four notes, root, third, fifth and octave,
  one at a time and has the singer sing each back. By default it climbs, note by note: 700 ms a
  note, then 250 ms, then 2,000 ms to sing, from the voice preset's anchor, low in the saved range,
  up an octave. The drill's stored difficulty scales the note and the time to sing, 8 % a level from
  the default, 5: 924 and 2,640 ms at level 1, 420 and 1,200 ms at level 10; its setup can also play
  the arpeggio downwards or ask for it back whole, from memory ("Echo the phrase") (FACTS 45). Its
  Chord menu holds Major, Minor, Diminished and Augmented, so it is the app's one drill with this
  lesson's triads today. It scores each note against the octave it plays (FACTS 46), so the card
  sends the viewer to Settings, Singing Voice Range, first (CURRICULUM § 4 item 7). The link is
  `/pitch-training?lesson=12`, and the marker lets First Light, the main app's intro, step aside on
  a first visit (FACTS 43), so the card, the rest card and the footer carry no first-visit line.
- **Today, Ear Lab's Cadence.** `mercurypitch.com/ear-lab`, then tap Cadence (FACTS 44, 47): twelve
  rounds, each a progression of three or four chords strummed on a guitar in a roved key, named in
  numerals from four pads; I–V–vi–IV is one of its eight. On the public host `/ear-lab?lesson=12`,
  the marker before the hash the entry document adds (`src/seo/entry-pages.ts:439-444`). Cadence
  needs no voice, so it stays on the rest card (FACTS 63).
- **The CURRICULUM's two, not linked.** Chord Stacker drills four-note chords only, Major 7th,
  Minor 7th, Dominant 7th, Diminished 7th and Major 6th
  (`src/features/exercises/chord-stacker/use-chord-stacker-controller.ts:11-27`), none of this
  lesson's triads, so the page names it nowhere a learner reads (FACTS 48). Play Along is a menu,
  "Play along…", that appears only on a song the viewer has had separated into its parts, in the
  vocal remover's results and the stem mixer's playlist, and server separation needs a signed-in
  account and credits; no address opens it, and it plays the viewer's own song, not a chord
  progression (FACTS 49). On the web it does not open from a lesson link today, and the page does
  not link it.
- **Needed, proposed: Chord Stacker's major and minor triads** (CURRICULUM § 4 item 4): two chord
  types beside its five, `maj` and `min`, at 0, 4, 7 and 0, 3, 7 semitones, with their labels in
  the setup's Chord Type menu. When they ship, LESSON.md's editorial note says the card may name
  Chord Stacker on major and minor; until then the card names Arpeggio Jumper. A data-only slug
  that opens Chord Stacker on a triad (`EXERCISE_SLUGS`, `src/features/exercises/slug-map.ts:47-65`)
  would need the chord type in the launch, which a slug cannot carry today (FACTS 51): proposed
  with it, not before.
- **Needed, proposed: an `ear-drill` launch for Cadence** (CURRICULUM § 4 item 5, the planned
  `ear-drill` launch kind): Cadence opened on its own, with the page's "then tap Cadence" dropped
  when it ships, as Lesson 10's spec proposes for Stack.
- **Proposed, App content** (FACTS 46), for the App content track and, for Arpeggio Jumper's score,
  the coach: its grade folds in a "richness" reading that is only the run's average pitch clarity,
  as Lesson 9's spec lists it. And `/ear-lab`'s entry document should link back to Lesson 12 once it
  is out, as SEARCH.md § 8 asks of the rooms a lesson practises in.
- Not linked: none of the premium exercises (`src/lib/native-build.ts:57-68`; FACTS 50).

## Explorer and season data

Lesson 12's entry (`src/features/lessons/kit/season.ts:361-371`), proposed for when this page is
built:

- `minutes: 15` and `page: '/learn/12'`, written plainly, as Lesson 3's entry is
  (`season.ts:204-223`, its comment `:210-211`) and Lesson 5's after it, whose comment this copies
  (`:250`):

  ```ts
  // A draft until its sign-off (drafts.ts), as Lesson 3 is.
  minutes: 15,
  page: '/learn/12',
  ```

  The entry decides nothing about being live. Its line in `drafts.ts` holds the lesson back on
  mercurypitch.com until the console publishes it, and `seasonFor` then gives every list Lesson 12
  with no page and no reading time, so it reads as coming later
  (`src/features/lessons/kit/publish.ts:102-124`; the season's own rule,
  `src/features/lessons/kit/season.ts:15-25`). No lessons module but `publish.ts` may read the draft
  list, and none but `page-state.ts` the build's default
  (`src/features/lessons/kit/drafts.test.ts:57-68`), so the entry folds nothing away.

- `pr.link`, proposed: `href` `/ear-lab?lesson=12`, `addr` `mercurypitch.com/ear-lab`, `label` "Ear
  Lab" and `note` "then tap Cadence", which `practiseMarkup` prints after the address as "Ear Lab,
  then tap Cadence" (`kit/explorer.ts:177-182`), as Lesson 2's card links Leap
  (`season.ts:193-198`). Cadence is the lesson's ear drill and needs no voice, so the card stays
  right whatever Sing it's ending. For the owner (Decisions for the owner), the other choice:
  Arpeggio Jumper, `href` `/pitch-training?lesson=12`, `label` "Exercises" and `note` "then tap
  Arpeggio Jumper", as Lesson 9's card now reads (`season.ts:332-339`). `pr.needs`, "Chord Stacker
  with major and minor triads (today it has only maj7, min7, dom7, dim7 and maj6)", stays until the
  triads ship: it is "Admin only, never drawn on a lesson page" (`season.ts:102-103`, and the fields
  the team keeps, `:27-31`).
- The signature stays as it is (`kit/team-notes.ts:44`). The entry has no `fig`, so the card draws no figure.
- The hook stays word for word (`season.ts:366`; FACTS 1). The tease Lesson 11's card shows for this
  lesson, and Lesson 13's tease on this page's card, are the kit's lesson copy
  (`kit/lesson-copy.ts:117`, `:118`; FACTS 5, 5b).
- The card reads "Ready · read", with "15 min", once the page is live (`explorer.ts:153-160`).

## What the kit and the app still need

Found in the kit and the app as they stand on main at `75eeddc40` (21 October 2026), beyond the
parts Lessons 2 to 10 promote into the kit (Toys table). Every item is proposed. From `6f8081804`,
where this package was first written, to `9fcc96a01`, where it was reviewed, the code this spec
cites is unchanged but for Lesson 9's practise link in `season.ts` (`:332-339`, the same lines) and
a comment in `src/lib/lesson-marker.ts`. From `9fcc96a01` to `02682a122`, PR #1156 put Lesson 4 back
on the draft list, which moved two citations here, to the draft list (item 2) and to llms.txt's
Lessons list (item 15). From `02682a122` to `75eeddc40`, three PRs changed code this spec cites, and
every citation here was compared line for line between the two and moved to the line it meant:
PR #1149, Lesson 6's page, brought the breath mark, the sound owner and a play that reports "not
heard" into the kit (items 6 and 8), with Lesson 6's line in `drafts.ts` and three lines in
`season.ts`; PR #1159 holds every lesson document to the head checks, a draft's included, and
checks its share card (items 12, 13 and 15); PR #1160 changed what the predict's hint shows after a
heard play (Toys 3; Edge cases) (`git diff --stat`).

1. The lesson host: `learn/12.html` at `/learn/12`. The dev and preview servers and every build take
   every `learn/NN.html` as a lesson page, a draft's included, with no entry of its own
   (`vite.config.ts:78-87`, `:147-149`, `:489`; `lessonPages` and `lessonInputs`,
   `tools/draft-lessons.ts:77-86`, `:109-117`). Still needed: `/learn/12` and `/learn/12.html` in
   `STANDALONE_DOCUMENT_PATHS` (`src/lib/sw-runtime.ts:93`), beside the drafts' entries, whose
   comment gives the reason: where a draft is not published, its address must reach the site
   worker's 404 page, never the app shell (`:138-157`).
2. `src/features/lessons/kit/drafts.ts:30-38`: Lesson 12's line, after Lesson 8's and in the form of
   Lessons 3, 5 and 6's:
   `12: "Lesson 10's page at /learn/10, and the vocal coach's look at the sung checkpoint"`. While
   it stands, the page is held back on mercurypitch.com and served on the dev site and every PR
   preview, and the console can publish it there before both are done, with no release
   (`src/features/lessons/kit/drafts.ts:5-13`), once it has asked "Publish ${name} before its
   sign-off?" and named what the line says the page waits on
   (`src/features/admin/AdminLessonsPage.tsx:186-207`; `waitingOn`,
   `src/features/admin/lessons/lesson-admin.ts:96-98`). Releasing it is deleting that line once both
   are done, then listing it as item 15 says (`src/features/lessons/kit/drafts.ts:18-21`; SEARCH.md
   § 12 item 3).
3. `lesson-12/rooms.ts`, new (Toys 1 and 5): the ring of rooms, its chord strip, the key switch,
   the corner slide, the loop, the roots and the tune toy, with its pure helpers: the chords of a
   major key from its tonic (their notes, gaps, quality and numeral), each room's sides round the
   ring, a tune's notes against its chords (on a corner or between), and the strip's layout. The
   kit's spiral needs nothing: `setView('top')`, `ring`, `range`, `overlay`, `light`, `setLabels`
   and `setTurning` are on main (`kit/spiral.ts:82-107`, `:120-149`).
4. `lesson-12/cold-open.ts`, new (Toys 2): the hero's ring, its rooms and the tunes' walk.
5. The names switch (Toys 1): Lesson 4's (`lesson-04/stairs-words.ts`), with a choice of modes, as
   Lesson 10's spec moves it into the kit (its What the kit and the app still need, item 5). If
   Lesson 10's page lands first, this page takes the kit's; if this page lands first, it moves the
   switch into the kit in that form, with Lesson 6's modes, and Lesson 10's page takes it. This page
   shows Letters · Do-re-mi, with the major scale's syllables on the key's tonic. The page-wide
   store is the kit's already (`createModeStore`, `kit/names.ts:27`).
6. The breath mark on the slide guide (Toys 6): on main, from Lesson 6's page (`breaths`,
   `slide-guide.ts:62-63`). Nothing to add.
7. Move do and the count-in's note (Toys 6): Lesson 4's, in the kit since #1192 moved it there
   (`kit/move-do.ts:20-29`; `:42-51`), as Lesson 10's spec planned (its item 7). It sets `disabled`
   at its limits; this page needs `aria-disabled`, never `disabled`, so a keyboard user's focus
   stays put, and one thing more: a limit for each side, four lower and three higher, where Lessons
   4, 6, 8 and 10 take four either way (FACTS 60). If this page lands first, it adds both to the
   kit's part, and Lessons 4, 6 and 8 keep four either way.
8. The sound rules' helpers (Audio; Toys 3). On main, from Lesson 6's page: the page-wide "now
   playing" owner, `NowPlaying` (`kit/now-playing.ts:17-39`), and a `play` that may resolve `false`
   for a play cut short (`kit/predict.ts:31-41`, `:187-188`). Still needed: a `schedule` that can be
   stopped: Lessons 2 and 4 each keep
   their own, which cannot (`lesson-02/examples.ts:124-134`, `lesson-04/examples.ts:81-92`), so this
   page moves it into the kit with a stop that clears its timers, for the owner to call, and Lessons
   2 and 4 may take it later.
9. `kit/quiz.ts`: `recallStepHref`, built: Lesson 8's page moved it into the kit beside
   `lessonPageHref` (`:141-143`, `:137-139`), as Lesson 10's spec proposed (its item 9), and Lessons
   3, 4 and 5 take it from there (`lesson-03/quiz-questions.ts:24`,
   `lesson-04/quiz-questions.ts:32`, `lesson-05/quiz-questions.ts:20`), as this page and Lesson 10's
   will. The quiz needs nothing else: its prefix, slot and away links are on main (`quiz.ts:52-58`,
   `:80-104`, `:186-216`).
10. `kit/comfort.ts` needs nothing: this page's `sing-flow.ts` picks the rest card after "Effortful"
    with `restAfterEffort`, built by #1192, as Lesson 6's does now (by hand before) and Lesson
    10's will, leaving the kit's default for the coach (`comfort.ts:69-78`), and it keeps the kit's
    lock on the feeling answer (Toys 6; Decisions for the owner).
11. `kit/season.ts`, Lesson 12's entry (Explorer and season data).
12. The head, from SEARCH.md § 3 and Lesson 4's document (`learn/04.html:9-145`), held by
    `src/features/lessons/kit/lesson-copy.test.ts:323-358` and `lesson-pages.test.ts:139-275`
    on every page, a draft's included, from its first commit:
    - title, at most 60 characters, ending " | MercuryPitch" (`lesson-pages.test.ts:154-155`):
      SEARCH.md § 4's draft, "The four-chord song: how chords work | MercuryPitch" (51 characters,
      `SEARCH.md:230`), in the query-led form the owner chose for Lessons 1 to 8, on 22
      October 2026. Until #1187 the title had to hold the Article's headline, so this spec
      recommended "Chords and the four-chord song: Lesson 12 | MercuryPitch" (56): the series' form,
      "Chords and the four-chord song: Find Your Pitch, Lesson 12 | MercuryPitch", ran to 73, over
      the cap, and Lesson 4's then, "· Find Your Pitch | MercuryPitch", to 63. `og:title` holds the
      headline now (`lesson-pages.test.ts:184`), so it stays "Chords and the four-chord song", and
      this spec's query-led option, "Chords and the four-chord song: I-V-vi-IV | MercuryPitch" (56),
      is not used (Decisions 2). The worker never rewrites the title, whichever hook is picked;
    - description, 80 to 160 characters: "How can two songs share the same four chords and still
      sound different? A fifteen-minute lesson with sound toys: chords, Roman numerals and
      I-V-vi-IV." (150 characters; 158 with the alternative hook, Edge cases). The numerals take
      hyphens here, as searchers type them and as Ableton writes 1-5-6-4;
    - `og:title` and `twitter:title` "Chords and the four-chord song: Find Your Pitch, Lesson 12"
      (58), the lesson's name and the series', as on Lessons 1, 2, 3 and 5 (`learn/02.html:26-29`,
      `:45-48`); `og:description` the hook, then "Build a key's chords, read Roman numerals and hear
      I-V-vi-IV." (133 characters; 141 with the alternative), and `twitter:description` the hook
      exactly;
    - `og:image` and `twitter:image` the share card (item 13), with `og:image:width` 1200,
      `og:image:height` 630, and `og:image:alt` and `twitter:image:alt` "Four chord shapes on a ring
      of twelve notes, between Merc and Tavi", as on Lesson 2 (`learn/02.html:34-60`);
    - canonical and `og:url` `https://mercurypitch.com/learn/12`;
    - robots `index, follow, max-image-preview:large` and `twitter:card` `summary_large_image`;
    - the Article block, the head's first `application/ld+json` script and one object, since the
      test reads `alternativeHeadline` from the first script only and skips the check when it is
      absent (`lesson-copy.test.ts:338-346`, `:356`): `@id`
      `https://mercurypitch.com/learn/12#lesson`, `url` the canonical, `image` the same URL as
      `og:image` (`lesson-pages.test.ts:173-174`, `:183`), headline "Chords and the four-chord
      song", `alternativeHeadline` the hook, the same description, `inLanguage` `en-GB`,
      `learningResourceType` "Lesson", `educationalLevel` "Beginner", `timeRequired` `PT15M`,
      `teaches` ["Building a key's chords from its scale", "Reading Roman numerals", "Hearing the
      I-V-vi-IV progression", "Singing the roots of a chord progression"], `isAccessibleForFree`,
      `position` 12, `isPartOf` the series, and author and publisher the site's `Organization`
      (`https://mercurypitch.com/#organization`). `datePublished` is left out of the built page, as
      `learn/04.html:61-68` leaves it out. Nothing writes it at run time: the site worker changes
      the page's state, the hook's copies and its links (`src/lesson-gate.ts:10-21`), never a
      date, so a published draft is served without one. It is set either in the commit that
      deletes the page's `drafts.ts` line or in a commit straight after the console publishes it,
      and the owner picks which (SEARCH.md § 3.2). Last, the BreadcrumbList, ending on the
      headline (`lesson-pages.test.ts:212-225`).
13. `public/learn/lesson-12-og.jpg`: the share card, 1200 x 630, in the page's first commit, since
    `lesson-pages.test.ts:227-246` fails a lesson document whose card is not in `public/` at the size
    its head gives, a draft's included. It is a still of the hero: the title over
    the ring of twelve seen from above, the loop's four rooms drawn in chrome, between Merc and
    Tavi, with the alt text above. It draws no tune, no walk, no gold and no count, so the
    card does not answer the cold open's predict (FACTS 1a).
14. The first-paint budget, in the change that adds the page: `learn/12.html` in both of
    `scripts/assert-first-paint-budgets.mjs`'s tables, its JavaScript (`FIRST_PAINT_BUDGETS_KB`,
    `:59`) and its render-blocking CSS (`FIRST_PAINT_CSS_BUDGETS_KB`, `:213`), measured, with the
    lessons' headroom, a quarter over. Every build emits every lesson page, a draft's included
    (`scripts/assert-first-paint-budgets.mjs:103-105`), and a document it emits with no budget
    fails the check (`assert-first-paint-budgets.mjs:541-545`, and for CSS `:571-577`; FACTS 76),
    which `build:e2e` runs (`package.json:20`). The page's WebGL renderer, as on every lesson page,
    arrives after first paint (Merc and Tavi).
15. On release (SEARCH.md § 12), once its `drafts.ts` line is deleted: `public/sitemap.xml` and
    `public/llms.txt` (its Lessons list, `:66-80`), one entry each. Until then the draft's rules
    hold on the repository: in neither file, linked from no entry document, its service-worker rule
    kept (`src/tests/lesson-pages.test.ts:307-344`). While the console has it published, the site
    worker adds it to the sitemap and llms.txt it serves, and takes it out again if it is held back
    (`src/lesson-gate.ts:22-24`; `src/features/lessons/kit/drafts.ts:18-21`). So indexing is
    requested when the console publishes the page, not at the release.
16. Lessons 1 to 11's pages, when this one goes live: nothing to edit. Their explorers and their
    Wraps' next-lesson cards read the season as their page state shows it (`pageLessons`,
    `src/features/lessons/kit/page-state.ts:54-57`), so Lesson 11's card, once Lesson 11 is live,
    turns from "Coming later" to "Start lesson" and links this page.
17. The App content items under Practice links.

## Decisions for the owner

Each with the package's recommendation and the review's judgement (Lesson 12's review, 21 October
2026); where this pass's view differs from the review's, it says so.

1. **The alternative hook, `hundreds`.** Decided: the owner dropped it on 22 October 2026 (#1186).
   The rules kept it unpicked: a variant's text is lesson copy held to "every claim in that lesson's
   FACTS.md" (`kit/lesson-copy.ts:31-34`); its own note asks for a counted source first
   (`kit/team-notes.ts:77-78` at `b7093a0a4`); the owner's answer to CURIOSITY-MOMENTS § 5 item 2
   holds back a hook that needs a source until FACTS.md has one; and Ableton says "hundreds" and
   counts none, as Hooktheory's analysis of 1,300 songs gives no count for this loop (FACTS 1;
   FACTS, Unsupported, not used). What the console shows: under "Hook", with the line "The question
   Lesson 12 opens with.", a second button holding its wording, its team note printed below it, and
   the tags "Default" and "Chosen"; one click saves it, with no confirmation
   (`src/features/admin/lessons/LessonControls.tsx:333-463`, the Hook picker `:496-500`; `saveCopy`,
   `src/features/admin/AdminLessonsPage.tsx:214-222`). Picked, it would reach the h1; the
   description (158 characters) and og:description (141); twitter:description; the Article's
   `alternativeHeadline` and description; Lesson 12's card in every lesson page's explorer, today
   included, while Lesson 12 is coming later; and Lesson 11's next-lesson card (Edge cases, "The
   admin console's hook"). The lesson menu prints no hooks (`kit/lesson-menu.ts`), so that list is
   complete. Neither wording answers the predict (FACTS 1a). The review agreed, and added: if the
   owner wants a hard guard, retire it.
2. **The page's title.** SEARCH.md § 4's draft, "The four-chord song: how chords work |
   MercuryPitch" (51), in the query-led form the owner chose for Lessons 1 to 8, on 22
   October 2026. Until #1187 the title had to hold the headline, and the series' form ran to 73,
   so this spec recommended "Chords and the four-chord song: Lesson 12 | MercuryPitch" (56; What the
   kit and the app still need, item 12). The review found that one acceptable; the site worker
   never rewrites the title, whichever hook the console picks.
3. **The publish order.** Lesson 12 is published only after Lesson 10 is, because its recall asks
   Lesson 10's questions and its chip names Lesson 10 (Edge cases, "Lesson 10 not yet live").
   Nothing enforces it. The console asks before it publishes Lesson 12 while its draft line stands,
   and the line names Lesson 10's page, so its question reads "Lesson 12 waits on Lesson 10's page
   at /learn/10, and the vocal coach's look at the sung checkpoint. Publish it anyway?"
   (`AdminLessonsPage.tsx:186-207`); but it never checks that Lesson 10 is live, and it asks nothing
   once the line is deleted, so the owner keeps the order. Proposed: a console warning when a lesson
   is published before the lesson it recalls, as Lesson 10's spec proposes. The review: stated
   correctly, and the warning is sensible.
4. **The two tunes.** Both are written for this lesson, and neither quotes a song the writer knows
   (FACTS 33). No melody database was searched. The review, which found no close match to any melody
   it knows, wrote both out in solfa and heard these likenesses, for the owner to hear too: tune 1,
   mi re do mi | re do ti re | do ti la do | la so fa, shares its first six pitches with "Hot Cross
   Buns" and "Three Blind Mice", in another rhythm, and its downbeats echo Pachelbel's Canon; tune
   2, so do mi | do ti so | la do mi | fa re do, shares so-do-mi with "Amazing Grace" and "Taps",
   and the likeness ends after three notes. It names all five as public domain and the figures as
   generic. Recommended: the owner listens to both, with those five in mind, before the page
   publishes. This pass adds one thing to the writer's remedy: if a tune recalls a song, the writer
   rewrites the bars that carry the likeness, the first two for tune 1's six pitches, and recounts
   those bars; the other bars keep their counts (FACTS 35, 36).
5. **The explorer card's practice link: Cadence**, `/ear-lab?lesson=12` and "then tap Cadence"
   (Explorer and season data). It needs no microphone, Ear Lab locks nothing, Lesson 2's card links
   Leap the same way, and it is right whatever Sing it's ending. The other choice: Arpeggio Jumper,
   as Lesson 9's card now links it. The review: right, since the card cannot know how Sing it ended,
   so a drill that needs no voice is the safe choice (REQ-GVC-021, REQ-GVC-055).
6. **The rest card after "Effortful".** Shown, as on Lessons 6, 7 and 10 (Toys 6; FACTS 63). The
   review: the rules favour it. REQ-GVC-021 covers "effort", and for it the app "shall suppress
   demanding capture and immediate-repeat encouragement"; REQ-GVC-055 says that after a report that
   an exercise "felt worse or uncomfortable" the app "shall not recommend an increased dose"
   (`docs/specs/guided-voice-check.ears.md:96-101`, `:238-242`); and Arpeggio Jumper's octave climb
   is a bigger dose than the 10-second checkpoint. The kit's default, `afterFeeling`, which keeps
   the practice card after "Effortful" (`comfort.ts:69-78`), is the outlier. Which of the two every
   lesson follows is a question for the vocal coach across the series; this page shows the rest card
   until it is answered.
7. **Locking the feeling answer.** The kit locks it once given; Lesson 6's page lets it change until
   the next sweep (`mountFeelings`, `changeable`, `comfort.ts:168-178`).
   The vocal coach's call, for the whole series; this page keeps the lock until then, as Lesson 10's
   does (Toys 6). The review: with the lock, a mis-tapped "Easy" can become "Uncomfortable", and
   bring up the doctor lines, only after another sung run, so Lesson 6's changeable answer serves
   REQ-GVC-021 better. This pass agrees, and recommends putting that to the coach with the question:
   if the coach picks the changeable answer, this page passes `changeable`, and its
   sing flow puts the guide and Move do away when the answer changes to "Effortful" or
   "Uncomfortable", and no later change brings them back, as Lesson 6's does
   (`lesson-06/sing-flow.ts`).
8. **Move do's top.** Three semitones higher, not four, since four would put the lower line's top do
   on E4, the bass preset's very top (FACTS 60). Recommended: keep three; the coach may confirm it
   (LESSON.md, For the vocal coach). The review: right. At three higher the bass preset keeps one
   semitone at the top (E♭4 against its E4), and at four it would keep none; at four lower the tenor
   and soprano presets keep one at the bottom.
9. **The chords under the voice.** At 0.05 a voice under Merc's "ooh" and under the guide (FACTS
   74), the page's own choice, for the owner's ear on a real phone (Contract). The review: fine,
   since the chord's three voices sum to 0.15, less than Merc's 0.2 (`sound.ts:181`). Listen for
   testers singing louder over them.
10. **The coach's volume line.** "Sing at about speaking volume." stays, the series' line; "or a
    little softer, never a whisper" is a safe addition for the coach to make (LESSON.md, For the
    vocal coach; FACTS 56).
11. **The recall's step links**, `/learn/10#step-1` and `/learn/10#step-3`: the `#step-N` form the
    built Lessons 3 to 5 use, which the kit's step deck opens at, from `recallStepHref`, which
    Lesson 8's page moved into the kit (What the kit and the app still need, item 9).
12. **`datePublished`**: set in the commit that deletes the page's `drafts.ts` line, or in a commit
    straight after the console publishes it (SEARCH.md § 3.2). Recommended: straight after the
    console publishes it, since that is the day the page goes live and indexing is requested. The
    review found items 10 to 12 fine as recommended.
13. **Lesson 11's next-card still.** Lesson 11's next-lesson card previews this lesson with a still,
    "four chords as four rooms on the spiral, one tune passing through" (CURIOSITY-MOMENTS § 2,
    Lesson 11, Tease; FACTS 5b). It sits on Lesson 11's page, which this package does not touch, but
    it must not answer this page's predict, which asks how many of a tune's notes land on a corner
    of the lit room. The rule, the stricter one the review asks for: the still puts no tune note on
    the ring at all. It lights no corner, draws no bead on a room and draws no path from bead to
    bead, since a tune drawn bead to bead shows which of its notes sit on corners even without gold.
    It may show the four rooms; any tune it shows stays off the ring. Recommended: Lesson 11's
    package and CURIOSITY-MOMENTS' Lesson 11 entry take this rule; the lead passes it to Lesson 11's
    writer.

## Edge cases

- **Sound off, unset or missing.** Every play obeys the kit's `canPlay` (Audio). The predict's
  reveal and Start the guide wait for heard sound (Toys 3, 6). With no Web Audio the page stays
  readable, every play runs its visuals in silence with its hint, and Sing it offers the listen-only
  path.
- **A hidden page or a section off screen** stops what is playing (Audio; Toys 6).
- **Leaving a step** stops the stage's sound; starting any play stops every other.
- **Before a choice**, Play tune 1 and Play tune 2 are disabled, and the reveal stays hidden; Play
  the four chords and a tap on any bead still sound, and draw no walk.
- **The four chords after a choice, before either tune**: the kit shows `hints.next`
  (`kit/predict.ts:167-173`), "Now hear both tunes, 1 and 2, for the answer.", which holds with no
  tune heard yet: it asks for both and says nothing of what was heard.
- **Sound off before a choice**: Play the four chords runs its lights silently, and `hints.silent`,
  "Sound is off: nothing played. Turn sound on, then play it again.", replaces the lock hint
  (`kit/predict.ts:162-165`). Both tunes stay locked; "it" is the four chords, the one play open.
- **Sound on again, still before a choice**: once the four chords are heard with sound on, the kit
  puts the markup's lock hint back, "Choose an answer to unlock the two tunes.", since the tunes
  are still locked: a heard play with no choice in restores the hint the page wrote
  (`kit/predict.ts:85`, `:167-170`), as it does on Lessons 4 and 5 (PR #1160).
- **One tune heard, then a wait**: the reveal stays hidden, with `hints.next` showing, until the
  other tune has been heard with sound on.
- **A cold-open tune cut short**, by a stop, a bead tap on the hero's ring, leaving the hero for a
  step or, through the kit's sound owner, any other sound on the page (Toys 3): not heard, so it does
  not count towards the reveal, and its hint stays (`kit/predict.ts:187-188`); its walk and count
  stay where they reached. A
  tap on another of the hero's plays while one plays does nothing (`predict.ts:179`).
- **Step 5 before the cold open's choice**: the steps' tune toy locks nothing, as Lesson 10's steps
  lock nothing; a viewer who scrolls past the predict meets the tunes there, after the predict.
- **The key switch mid-play**: switching key stops the play first, then turns the rooms; a chip
  played after it sounds in the new key.
- **G major under Do-re-mi**: do sits on G, F♯ is ti, and the five beads left without a syllable are
  C♯, D♯, F, G♯ and A♯.
- **Storage blocked** (`src/features/lessons/kit/dom.ts:68-88` never throws): the quizzes run
  without their seed and record, the voice choice is asked each time, the done list is empty;
  nothing breaks.
- **A stored voice** is used at once; changing it takes effect at the next play.
- **Move do at its ends**: four semitones lower and three higher, then its button is
  `aria-disabled` (FACTS 60).
- **The steps' figure too short for its labels** (below 240 px): the compact layout (Toys 1).
- **Held back** (mercurypitch.com, until the console or a release publishes it): the site worker
  answers `/learn/12` with the 404 page, and the page state gives every list Lesson 12 with no page
  and no reading time (`src/features/lessons/kit/publish.ts:102-124`), so every explorer shows it as
  coming later with no link, and Lesson 11's card, once it exists, reads "Coming later". A page no
  worker served takes its build's default instead: shown in `pnpm dev` and the e2e bundle, held back
  in a production bundle (`src/features/lessons/kit/page-state.ts:5-10`;
  `src/features/lessons/kit/draft-switch.ts:5-6`, `:21`).
- **Lesson 10 not yet live**: this page stays held back until it is, by the owner's hand: the
  console's question before it publishes a draft names Lesson 10's page, but nothing checks it
  (Decisions for the owner, item 3). Published first, it would break nothing: its chip would stay as
  a plain chip, and its recall's step links would keep their words with no link
  (`src/features/lessons/kit/page-state.ts:84-108`; `src/features/lessons/kit/quiz.ts:186-216`). But
  the recall would ask about a lesson the learner cannot open.
- **Lesson 13 not yet live**: the next card reads "Coming later" and "See it on the map", to
  `#explorer` (`kit/next-card.ts:108-110`).
- **The admin console's hook.** The console could switch Lesson 12's hook to its alternative,
  `hundreds`, "How can hundreds of songs share the same four chords and still sound different?"
  (`kit/lesson-copy.ts:133-141` at `b7093a0a4`): the pick is the `hook` field of the lesson's
  override, set through PUT `/api/admin/lessons/:n` (`src/lib/lesson-state.ts:41`, `:49-50`,
  `:182-189`) from the Content Studio's hook picker, which prints the variant's note under it
  (`src/features/admin/lessons/LessonControls.tsx:447-451`). The page's markup keeps the default;
  picked, the alternative goes wherever the hook goes. The site worker writes it into the page's h1,
  into every head copy that quotes the hook, the description and the og and twitter descriptions,
  and into the structured data (`src/lesson-gate.ts:14-21`, `:452-468`, `:484-495`, `:569-602`). Its
  list takes in the og and twitter titles too, but they carry the lesson's name, not the hook (What
  the kit and the app still need, item 12), and it never touches `<title>`. The page state gives it
  to every list (`src/features/lessons/kit/publish.ts:22-25`; `seasonFor`,
  `src/features/lessons/kit/publish.ts:108-124`): Lesson 12's card in every lesson page's explorer
  prints it (`src/features/lessons/kit/explorer.ts:247`), even while Lesson 12 is coming later, and
  so does Lesson 11's next-lesson card (`src/features/lessons/kit/next-card.ts:114-115`). So
  "hundreds", a count FACTS.md does not hold, would stand on every surface the hook reaches (FACTS
  1). The description would run to 158 characters and og:description to 141, inside their caps,
  which `src/tests/lesson-pages.test.ts:156-159` checks only on the page as written. Neither hook
  says where a tune's notes fall, so the title never answers the predict (FACTS 1a). The owner
  dropped it on 22 October 2026 (#1186; Decisions for the owner, item 1).

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-12/`, and on the kit
parts it adds:

1. The chords: C major's seven from its scale, C E G, D F A, E G B, F A C, G B D, A C E and B D F,
   with their gaps, 4 and 3 or 3 and 4 with a fifth of 7, and 3 and 3 with a fifth of 6; three
   major, three minor and one diminished, none augmented; their numerals I, ii, iii, IV, V, vi and
   vii°, the app's `ROMAN` (`src/lib/ear/progressions.ts:28`); the same numerals and qualities in G
   major, spelled G B D to F♯ A C, with no flat (FACTS 13 to 19).
2. The rooms: each room's sides round the ring, major 4, 3 and 5, minor 3, 4 and 5, diminished 3, 3
   and 6; G major's rooms are C major's turned seven semitones; I and vi share C and E (FACTS 21,
   22).
3. The loop: I, V, vi and IV in C are C, G, A minor and F, on do, so, la and fa; its chords hold all
   seven notes; V to vi moves every note up one or two semitones in the voicing of FACTS 34; the
   roots alone are C4, G3, A3 and F3 (FACTS 26, 27).
4. The tunes, against the loop: tune 1 has 15 notes, 11 on a corner and 4 between (D5 over I, C5
   over V, B4 over vi, G4 over IV); tune 2 has 12, 10 on a corner and 2 between (C5 over V, D5 over
   IV); each lasts 8.0 s, Even notes too, at 0.667 s a note; tune 1 runs F4 to E5 and tune 2 G4 to
   F5, every note above the chord under it but tune 2's first, G4, in unison with I's top; in G
   every note of the loop, its roots and the tunes sits five semitones lower (FACTS 34 to 37,
   69a).
5. Sounds: every fixed sound's frequency equals `hz(m)` for the notes of FACTS 66; the loop and a
   tune play last 8.0 s and 16.0 s under Slow; a chip's chord 1.4 s; Play I, then vi 3.1 s, its
   corner slide over the 0.3 s between; the four words 4.8, 2.7, 2.7 and 2.7 s; a chord's voices at
   0.075 each alone and 0.05 under Merc (FACTS 68 to 74).
6. The cold open's predict: "Play the four chords" plays before a choice, draws no walk and never
   reveals; the reveal waits for both tunes heard with sound on; `revealOn` and `revealAfter: 'all'`
   are passed together; a tune stopped before its end, by a bead tap, another sound on the page or
   leaving the hero for a step, counts as not heard, reveals nothing and leaves the hint as it was;
   the guess lines and the four hints are LESSON.md's; after a choice, the four chords heard show
   `hints.next`; with sound off before a choice, the four chords show `hints.silent` in place of the
   lock hint, and heard again with sound on they bring the lock hint back (Edge cases).
7. Layout, the pure helper behind Toys 1's strip: at every width from 344 to 1440 px every chip and
   control is at least 44 px each way and none overlaps another; the strip is one row at 440 px of
   figure width and above, two below; the compact layout is drawn below 240 px of height (FACTS 75).
8. The Sing it flow (`lesson-12/sing-flow.ts`, Toys 6): with no stored voice the voice choice comes
   before either path, under its first line, and a stored voice starts pressed, under its second
   line, and can be changed; "Just listen today" hides Start the guide and Move do and picks the
   rest card; Start the guide waits for Merc's notes heard with sound on; the feeling question
   follows every sweep, asked afresh; "Easy" and "Workable" give "Do, so, la, fa, do: you just sang
   the loop's roots." and keep the guide; "Effortful" and "Uncomfortable" put the guide and Move do
   away for the visit and pick the rest card, and no later answer brings them back; nothing is
   written to storage but `fyp-voice`.
9. Move do: clamps at four semitones lower and three higher; at every position every note lies at
   least a semitone inside every preset of the chosen voice, checked against `VOCAL_RANGES`
   imported from `src/stores/settings-store.ts` (FACTS 59, 60); a fourth step higher would leave
   the bass preset none, which is why it stops; the readouts, in Lesson 4's names, A♭3 to E♭4 and
   A♭4 to E♭5; the chords shift with do.
10. Copy: every line of LESSON.md's page copy and every template in Toys 2, 3, 5 and 6 passes
    `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts:116`, surface `finding`); no quiz
    feedback line starts with "Right", "Yes" or "Correct"; no accessible name or live text holds a
    ♯ or ♭ sign or a bare numeral; the spoken numerals: "I–V–vi–IV" is "one, five, six minor,
    four", and "vii°" "seven diminished".
11. The quizzes: the recall's two questions equal Lesson 10's `l10-q1` and `l10-q2`, imported or,
    until Lesson 10's page lands, held equal to Lesson 10's LESSON.md; the quick check's ids and
    keys; `recallStepHref(10, 1)` is `/learn/10#step-1`.
12. The season entry: `seasonFor` with a state that holds Lesson 12 back, by its draft default or by
    `{ 12: { published: false } }`, gives it no `page` and no `minutes`, as
    `src/features/lessons/kit/publish.test.ts:57-73` checks Lessons 2 and 3. On a page no worker
    served, with `VITE_DRAFT_LESSONS` stubbed to '0' and the modules reloaded (`vi.stubEnv`,
    `vi.resetModules`), Lesson 1's explorer shows Lesson 12 as "Coming later", with no link to
    `/learn/12` and its practice link kept, and with '1' links it to read, as
    `src/features/lessons/kit/explorer.test.ts:460-485` checks Lesson 5 (the block, `:417-486`). Its
    link's `note` matches none of the backlog words (`/needs|slug|deep link|for now/i`).
13. The names switch: under Do-re-mi in C the chord on la reads "la do mi" and the chord on do "do
    mi so"; in G, do is G and ti is F♯; no state names la as home (FACTS 8).

End to end (Playwright, `src/e2e/learn-lesson-12.spec.ts`, at 390 x 844 and 1440 x 900, on the e2e
bundle, which no site worker serves and which shows drafts: `build:e2e` sets `VITE_DRAFT_LESSONS=1`,
`package.json:20`):

1. A hard load of `/learn/12` answers 200 with the lesson; no AudioContext before the first tap;
   nothing plays before a play button.
2. The cold open: "Play the four chords" plays before any choice, lights the rooms and draws no walk
   and no gold; "Play tune 1" and "Play tune 2" are disabled until a choice and enabled after; the
   reveal stays hidden until both tunes have been heard, then reads "You said: most of them" or "You
   said: hardly any"; the counts read "On a corner: 11 of 15" and "On a corner: 10 of 12" when each
   tune ends; before the choice nothing on the hero is gold; with sound off the hint shows and the
   reveal waits; before a choice, with sound off, "Play the four chords" puts the sound-off line in
   place of the lock line, and the same play heard with sound on brings the lock line back (Edge
   cases); after a choice and before either tune, it leaves "Now hear both tunes, 1 and 2, for the
   answer."
3. The ring of rooms by keyboard alone: Tab reaches every chip, switch and button; the key switch,
   the names switch and Slow toggle `aria-pressed`; each announcement reaches the live region; at
   390 x 844 every chip and button measures at least 44 x 44 px with none overlapping.
4. Step 2: switching to G relabels the chips to G major's chords, vii° reading "F♯ A C", and back to
   C restores them; Step 3: Play I, then vi ends with the centre reading "vi · A minor".
5. The stage fits: the kit's `src/e2e/learn-stage-fit.spec.ts` takes every lesson page in the
   repository (`lessonPages(REPO)`, `:27-32`), so Lesson 12 joins it with its page: every control of
   every step in reach at the four short sizes with at most 60 px of the stage's own scroll
   (`:57-58`), and at 844 x 390 each step's figure and first control on screen together, every
   control at least 44 px (`:259-288`), which the compact layout is for.
6. The first screen: the kit's `src/e2e/learn-cold-open-fold.spec.ts` takes every lesson page too
   (`lessonPages(REPO)`, `:27-32`): it holds the title on the first screen at its seven sizes and
   reports where the first Play and the predict's choices sit (`:12-17`). At 390 x 844, "Play the
   four chords" should be on the first screen; the app-check sweep confirms it with screenshots.
7. Sing it: the comfort check shows first, every visit; with no stored voice the voice choice
   follows either answer, under "Choose a voice to sing with. If you chose one in an earlier lesson,
   pick it again:", and nothing plays until a voice is chosen; a stored `fyp-voice` shows pressed
   under "Keep the voice you chose before, or change it:", and a tap on the other voice changes it;
   "Just listen today" shows no guide and no Move do, shows the doctor lines and leaves the rest
   card in the Wrap; Start the guide stays `aria-disabled` until Merc's notes have played; Move do
   higher is `aria-disabled` after three taps and lower after four; the feeling question appears
   when each sweep ends; "Easy" shows "Do, so, la, fa, do: you just sang the loop's roots.";
   "Effortful" hides the guide and Move do and shows the gentle line; "Uncomfortable" does the same
   with the doctor lines; after either, the Wrap shows the rest card with Cadence still offered, and
   answering "Easy" later does not bring the practice card back on this visit.
8. No call to `navigator.mediaDevices.getUserMedia` at any point (a spy, as
   `src/e2e/learn-lesson-03.spec.ts:323-332` sets one).
9. The recall: shown open to everyone, with an empty `fyp-done` too; its answers mark nothing done;
   its step links are `<a href="/learn/10#step-1" target="_blank">` and `/learn/10#step-3`;
   answering all four quick-check questions marks Lesson 12 done in the explorer; each feedback line
   starts "Right." or "Not quite.".
10. Every practice link carries `?lesson=12` before any hash: `/pitch-training?lesson=12` and
    `/ear-lab?lesson=12`.
11. The next-lesson card: a row for `/learn/12` in `src/e2e/learn-next-card.spec.ts`'s cards
    (`:27-76`), with the eyebrow "Next lesson 13 · Resonance and vowels Coming later", the link
    `#explorer` and "See it on the map" while Lesson 13 has no page, as Lesson 7's row reads for
    Lesson 8; its `.next-tease` reads Lesson 13's tease, one line above its hook, as the spec checks
    Lesson 1's card (`:102-119`); its still inside the card holds no button.
12. No planning words: the kit's `src/e2e/learn-no-planning-text.spec.ts` reads every lesson page,
    this one included (`lessonPages`, `:45-47`), for the team's words (`:22-40`), and the
    alternative hook's note never reaches the page (`:77-79`).
13. With reduced motion emulated, no corner slides, the rooms turn at once, the walk draws a segment
    at a time with no travel, Merc and Tavi hold still, and nothing moves on its own.
14. A visitor with the studio installed still gets the lesson, not the shell (the service worker's
    document list), as Lesson 3's spec checks (`learn-lesson-03.spec.ts:154`).

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=12` before any hash. Then the layout, accessibility, sound,
motion and storage rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text
children, touch targets of at least 44 px with no two tap zones overlapping (the ring's beads are a
second way in, and every chord has its chip), visible focus, a single dark theme with every colour
a token and an explicit body background, sound only after a tap, localStorage only for per-viewer
conveniences inside try/catch, and the whole page usable with no sound, no WebGL and no storage (the
predict and the guide then say why they wait). Every ♯ and ♭ the page prints in text (G♯ in the
four words, F♯ in the steps, the readouts and Move do's A♭3 to E♭5) has a spoken name, as Lesson 2's
contract sets: the sign is `aria-hidden` and a visually hidden word follows it, so a screen reader
says "F sharp" (`signsHtml`, `src/features/lessons/kit/notes.ts:221`); every Roman numeral has its
spoken form the same way (Toys 8); the figures' accessible names and every live region use words
only. The page stores the quiz seeds and records (`fyp-l12-recall-seed`, `fyp-l12-recall-v1`,
`fyp-l12-seed`, `fyp-l12-quiz-v1`), `fyp-done` (`src/features/lessons/kit/progress.ts:12`),
`fyp-voice` (`voice-choice.ts:20`), the masthead's Pause animations choice, `fyp-motion`
(`src/features/lessons/kit/motion-switch.ts:12`), and the steps the viewer reached, the kit's
`fyp-pos` (`src/features/lessons/kit/position.ts:20`), which `initMasthead` keeps
(`page-chrome.ts:119-150`); nothing from the toys or Sing it but the voice. The key and the names
switch hold for the visit, in memory.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page, every check against a local
or dev build, never production:

- Every chip, switch and button works by keyboard alone and announces what LESSON.md shows; the
  whole of Sing it runs by keyboard, and a screen reader hears every state and every numeral spoken.
- At 390 x 844 every target is at least 44 px square and nothing scrolls sideways at 344, 360 and
  375 px; at the kit's four short landscape sizes, 1024 x 640 to 1366 x 657, every step's controls
  are on screen with the stage stuck, and at 844 x 390 the compact layout shows each step's figure
  with its first control, as the kit's stage-fit test checks (`learn-stage-fit.spec.ts:35-55`).
- On a real phone, by ear and by eye (`docs/agent/DEVICE-DEBUGGING.md`): the chord's three notes
  sound together and none drowns the others; the tune stands clear of the chords at 0.05 a voice,
  and the chords are still heard under it; the walk lands on each bead as its note starts, with no
  drift across the 8 seconds; no click where a chord ends and the next begins.
- With a colour-blindness simulation, a note on a corner still reads apart from a note between
  corners by its ring, and the rooms' qualities by their labels (MASTER-PLAN § 5).
- The network panel and the browser's microphone indicator stay quiet through Sing it: no request,
  no microphone.
- The Wrap shows the rest card after "Effortful", after "Uncomfortable" and after "Just listen
  today", and the Arpeggio Jumper card otherwise; every link opens in a new tab.
- The app-check sweep at phone and desktop width, with Sing it open in each state and the cold open
  before and after its reveal.
