# Lesson 15 hand-back: The staff: where notes sit

For the lead. The package is in the worktree at
`/dev/shm/s2plan/docs/plans/find-your-pitch/lessons/15-staff/`, and the three files are copied to
`/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/15/`.
This is the version after the fix pass. The copies match the worktree byte for byte. The fix pass
itself is set out under "Review response" at the end.

## Files and checks

- `FACTS.md` (facts 1 to 73, plus 1a, 5a, 5b, 59a and 60a), `LESSON.md` and `WEB-SPEC.md`, all new.
  RESEARCH.md and ARTICLE-PLAN.md are untouched. No shared file and no code was edited, and no git
  command was run.
- Word count (`node scripts/lesson-words.mjs`): **2,337 words, 42 under the cap of 2,379.** Each
  step's own text: 118, 118, 103, 119 and 118 words. The chip reads 15 minutes: 9.82 minutes of
  reading at 238 words a minute, plus about 5.5 minutes of sound, toys and tasks, gives 15.32
  (FACTS 3). It stays an estimate until the staff toy is timed in its lab (SEASON-2 § 1.3), and
  WEB-SPEC Length says so until then.
- **The built page would pass the cap.** A built page writes the hints and status lines in the open,
  about 150 words more (Lesson 8 FACTS 4, as Lesson 17's writer reckons). That makes about 2,490
  words, some 110 over. WEB-SPEC Length names the 126 words the build cuts first, and each fact they
  carry stays in FACTS:
  - Step 1's Go deeper drawer (43 words);
  - Step 5's Go deeper drawer (41);
  - the alto-clef item in Step 4's drawer (20);
  - the practice card's first-visit line (22), which goes anyway once SEASON-2 § 5.2 item 21 ships.

  The octave treble clef stays, because SEASON-2 § 7 item 2 names it for Go deeper.
- `node scripts/plan-cites.mjs check docs/plans/find-your-pitch/lessons/15-staff`: **346 citations
  read, 0 findings.**
- App claims were checked at `c60f0fdcb`:
  - Compose: its views and tabs, the narrow-screen toast, the Place tool, the seeded "C Major Scale"
    and Clear all notes.
  - The sheet-music clef rule.
  - The lesson marker, First Light's "Skip the intro?" step, the opening takeover, and the bounce
    to Home in simple mode or with guitar set.
  - The worker's lesson-answer bounds and `VOCAL_RANGES`.
  - In the kit: the quiz, predict, next card, lesson copy, voice choice, comfort, count-in, key strip
    and glyphs.
  - Lesson 12's sing flow, and the stats snippets' engraving.
  - Added in the fix pass:
    - the step deck's titles, the masthead lesson menu and its card;
    - the welcome tour and its hold;
    - the body's background layer;
    - the words strip's sound owner and Lesson 2's quiz pair;
    - Lesson 8's rest line and its wrap;
    - `.viz`'s `touch-action` and `contourOf`.
- Leak check (FACTS 1a). Checked first: the title, both head-title options, the description, the og
  and twitter lines, the share card's alt, the promise, the sound gate, the Four words (after the
  reveal), and the tease with its still. The fix pass added:
  - the five step headings;
  - the masthead lesson menu, with its "Lesson 15 · <step>" card;
  - the section headings;
  - the welcome tour's scroll to the steps, which now waits for the predict's choice.
- Two scripts did the arithmetic: ranges and margins, frequencies, durations, the run time, the
  head's lengths, line contrast and the staff's size on a phone. They are
  `/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad/s2pkg/15-tools/verify15.py`
  and `verify15b.py` beside it, and both run with `python3 -I`.
  - The fix pass added the octave-lower table, Step 4's new play, the sweep's timing and the new
    run time.
  - verify15b.py's head lengths replace verify15.py's section 8, which still holds an earlier
    draft's.
  - The lesson files name the scripts but give no path.

## Voice buttons (to agree with Lesson 17)

**A3 and A4**, the same notes as Lesson 17.

- The package keeps Season 1's two buttons word for word: "Lower: sing with Merc, around A3" and
  "Higher: sing with Tavi, around A4". Both are true in G, because A is re, the line's second note.
- One new line goes under the buttons: "Your staff follows your choice: the bass clef for the lower
  voice, the treble clef for the higher." (Lesson 15 FACTS 51).
- **The fix pass did not change that line**, so Lesson 17 can carry it word for word.
- Nothing changes in `kit/voice-choice.ts`.
- Item 10 in Lesson 17's list, "Voice-button wording, if Lesson 15 changes it", can close for the
  buttons. Two things are yours (review finding 11): whether Lesson 17 carries the clef line, and
  pointing Lesson 17 FACTS 29 and 52 at this package.

## The tease (proposed, with the plan's line as the alternative)

You settle the tease at lead review, so both lines stay here.

- **Proposed**, for Lesson 16's card on this page: "Five notes on the staff. Tavi has never heard
  them." (51 characters).
  - It is Lesson 16's cold open in miniature, which is what CURIOSITY-MOMENTS § 1 rule 6 asks of a
    tease. That cold open shows a five-note phrase on the staff (C4 D4 E4 D4 C4), nothing plays it,
    and Tavi says "I've never heard this tune."
  - The still shows a treble staff with five plain noteheads stepping up two places and back down,
    and a "?". It has no syllables, no house and nothing lit. It plays no sound, because a phrase
    played here would undo "Tavi has never heard them".
- **Alternative**, `teaseAlts` id `any-note`: the plan's "Now you can see where any note sits." (36
  characters). It is true, but it sums up Lesson 15 rather than setting up Lesson 16.
- Neither line names a starting note, which is the answer to Lesson 16's predict ("Just its first
  note"). If Lesson 16's writer changes the length of the phrase, "Five" changes with it.
- Lesson 15 gets no tease of its own, because Lesson 14 teases nothing (`SEASON_END`; SEASON-2
  § 1.4 item 3 and § 7 item 8).

## Entries for the shared files

### MASTER-PLAN § 11

- Lesson 15: a written lesson, text only, for review, in [`lessons/15-staff/`](lessons/15-staff/)
  (research, article plan, facts, copy and page spec). Its unscored sing-along waits on the vocal
  coach's look (§ 12 item 8). No page is built yet. It waits on two parts of Season 2's kit: seasons,
  with a season's end for each season, and the staff toy with the F clef, ledger lines and the grand
  staff (SEASON-2 § 6.2 items 1 and 2). It also waits on the app's lesson plumbing for 15 to 28
  (SEASON-2 § 5.2 item 21). It goes live when the console publishes it, after the coach's look and
  once `/learn/02`, the page its chip and its recall link to, is live. Its release date follows
  Lesson 16's (SEASON-2 § 7 item 6).

### CURIOSITY-MOMENTS

```markdown
### Lesson 15 · The staff: where notes sit · theory; written; no page yet · hook kept

- **Opening:** the pitch line between Merc and Tavi, a lane for every semitone; the climb plays nine
  white keys, E4 up to F5, each lighting its lane. Tavi "Eighty-eight keys. Wouldn't you need 88
  lines?" Merc "Let's see what five can hold." Predict: "Merc will draw five lines. From the bottom
  line to the top line, how many places will there be for a note?" [Five] [Nine]. No line is drawn
  before the choice. The answering play folds the black-key lanes away and closes the white-key lanes
  into the five lines. The plan's wording, "one on each line and in each space", turned the guess
  into a sum, and its "Play nine notes" named the answer (Lesson 15 FACTS 39).
- **Visual:** the pitch line (exists) folding into a staff, and the staff toy: both clefs, ledger
  lines, the grand staff over Lesson 1's keyboard and a "See it on the pitch line" switch (new,
  SEASON-2 § 6.2 item 2). **Payoff:** Step 5, where the grand staff joins the two staves at middle C
  over the keyboard, and a piano's 88 keys go on two staves of five lines; the checkpoint, do re mi
  fa so in G sung along a guide on the learner's own staff, unscored.
- **Tease:** a treble staff with five plain noteheads, up two places and back down, and a "?" (new
  still, silent): "Five notes on the staff. Tavi has never heard them." It names no starting note,
  the answer to Lesson 16's predict. The plan's line, "Now you can see where any note sits.", stays
  as the alternative `any-note` (Lesson 15 FACTS 5).
- **Facts:** sourced in Lesson 15's FACTS: lines, spaces, clefs, ledger lines and the grand staff
  (Open Music Theory 2e, 1.2 to 1.6; Ewell and Schmidt-Jones; ABRSM 2023), the octave treble clef
  (Ewell and Schmidt-Jones; Wikipedia, Clef, at a named revision), 88 keys and Cristofori's 54
  (Yamaha 2017); the app at `c60f0fdcb`. The first four-line staves are left out until Haines 2008
  is read.
```

### `kit/season.ts` (Season 2's module, once SEASON-2 § 6.2 item 1 makes one)

```ts
{
  n: 15,
  lane: 'theory',
  title: 'The staff: where notes sit',
  short: 'The staff',
  topics: ['T30'],
  // A draft until the vocal coach's look at Sing it (drafts.ts).
  minutes: 15, // once the page is built
  page: '/learn/15', // once the page is built
  hook: 'A piano has 88 keys. How can five lines write down every one of them?',
  pr: {
    needs:
      'A note-reading drill: a note on the treble or bass staff, up to two ledger lines, answered on a keyboard or by letter',
    link: {
      href: '/?lesson=15#/compose',
      addr: 'mercurypitch.com/#/compose',
      label: 'Compose',
      note: 'then choose Sheet Music',
    },
  },
},
```

- `TOPICS` gains `T30: 'Staff notation: staff, clefs, ledger lines, grand staff'` (SEASON-2 § 4.1).
- `EDGES` gains `[2, 15]`, a cross-season edge (SEASON-2 § 4.3), so `PREREQ[15]` is `[2]`. Lesson 1
  comes in through Lesson 2.
- No `fig`, as most Season 1 entries have none. The explorer card prints "Compose, then choose Sheet
  Music".
- The explorer's line above its heading reads "Season 2 · Lesson 15", as you set it, matching
  Lesson 17's "Season 2 · Lesson 17" (LESSON.md, Section headings; FACTS 6).

### `kit/lesson-copy.ts`

```ts
  16: {
    tease: 'Five notes on the staff. Tavi has never heard them.',
    teaseAlts: [
      {
        id: 'any-note',
        text: 'Now you can see where any note sits.',
      },
    ],
  },
```

Both lines are within `TEASE_MAX` (70), and `any-note` matches `VARIANT_ID`. Nothing goes in for 15.
No hook alternatives: the hook stays the season table's.

### `kit/team-notes.ts`

- `SIGNATURES` gains:
  `15: "The pitch line's black-key lanes fold away and its white-key lanes close into five lines; Lesson 1's keyboard slides under the grand staff, and the two staves meet at middle C."`
- `TEASE_NOTES` gains:
  `16: { 'any-note': "The planned tease, Lesson 15's closing line. It is true of Lesson 15, but it sums that lesson up instead of setting up Lesson 16's opening." }`

### `kit/drafts.ts`

- `15: "the vocal coach's look at Sing it (MASTER-PLAN § 12 item 8)"`, once `learn/15.html` exists.
  Nothing goes in now.

## Kit and app work the page waits for

The full list is WEB-SPEC, "What the kit and the app still need", items 1 to 11. The main ones:

1. **Seasons in the kit, with a season's end for each season.** This matters on day one. Once
   Lesson 15 is in the data, `nextCard` would draw Lesson 15's card on Lesson 14's page in place of
   `SEASON_END`, which SEASON-2 § 1.4 item 3 and § 7 item 8 keep (FACTS 5b).
2. **The staff toy**, `kit/staff.ts`, with these parts:
   - pure helpers and unit tests;
   - the F clef, filled notehead, sharp and flat glyphs, taken from the snippet's Noto Music paths,
     with their licence line;
   - a line-weight token. The snippet's line alpha of .26 gives about 1.8:1 against the figure's
     background, so the teaching staff needs .5 or more to reach 3:1 (WEB-SPEC Look; FACTS 72). It
     also needs your check of the line weight at 390 px on a real phone (Tests 13).
3. **The sing flow moves into the kit.** Lesson 12's flow goes in with Move do and the guide's
   drawing as options and its endings unchanged, so Lessons 15 and 17 reuse it rather than copy it
   (item 6).
4. **No decorative staff** (item 7):
   - the page's section heads have no `.mv-staff`, and its module does not call `engraveClefs`;
   - a Season 2 page drops the body's background staff, five 1 px lines every 168 px
     (`lesson-base.css:128-157`), by a class on `body` or in the season's own stylesheet;
   - Season 1 pages keep both.
5. **The recall pair's sound owner** (item 11). Lesson 2's `bindQuizPair` takes no sound owner, so
   it becomes `bindQuizPair(host, owner?)`. Lesson 2's page passes none and keeps its behaviour.
6. **SEASON-2 § 5.2 item 21.**
   - The marker range: today `?lesson=15` is an ordinary visit, so First Light opens, and the card
     keeps a first-visit line ending "then tap "Yes, skip"".
   - The worker's lesson-answer bounds, [1, 14], which drop every Lesson 15 answer.
   - The admin console's rows and `RELEASED_LESSONS`.
7. **Hosting.** `learn/15.html`, the entries in `STANDALONE_DOCUMENT_PATHS` and the first-paint
   budgets. Also the head, the share card `learn/lesson-15-og.jpg` and `timeRequired` `PT15M`.
8. **The note-reading drill** (SEASON-2 § 5.2 item 9), which is what `pr.needs` describes. Until it
   ships, the card links to Compose.
9. **This page's own code.**
   - The hero's fold goes in `lesson-15/cold-open.ts`.
   - The tour's hold uses the kit's existing `holdTour`. It is the first page to hold the tour for
     a predict, and it sets no time cap (WEB-SPEC Toys 3).

## Corrections to the planning record (not edited)

- SEASON-2 cites `src/lesson-gate.ts:128` (its lines 890 and 1025). `LESSON_PAGE` is now at line 134.
- SEASON-2 cites `learn/index.html:264` (its line 949). The hub's "Season 1" is now at line 272, and
  also at 299 and 310.
- SEASON-2's Lesson 15 card (line 203), ARTICLE-PLAN (line 224) and RESEARCH (line 156) cite
  `src/App.tsx:2321-2345` for Compose's views. `COMPOSE_VIEWS` now closes at line 2346.

## Departures from ARTICLE-PLAN.md, and why

LESSON.md's preamble lists items 1 to 15. Items 16 and 17, and the drawer placement in item 11, are
listed only here. "No rest card" is no longer a departure. The rest card is back, in Lesson 8's form,
and the plan asked for Season 1's endings and rest card.

1. **The key is G, not C.**
   - In C, the line starts on the floor of the tenor and soprano presets (C3 and C4). In G, every
     note is at least 2 semitones inside every preset of its voice, with no sharp (FACTS 55).
   - The cost: the lower line climbs past the top of the bass staff. So Step 4's play runs on to D4,
     and Sing it says where the notes sit.
2. **Season 1's voice buttons, A3 and A4**, plus a line naming each voice's clef. The plan had
   renamed the buttons (FACTS 51).
3. **The predict asks how many places five lines will give a note**, from the bottom line to the
   top, in the future tense, since no line is drawn yet. The free play is "Play the climb", not
   "Play nine notes" (FACTS 1a, 39).
4. **The fold happens in the cold open's answering play**, not in Step 2 (FACTS 37).
5. **Recall 2 is Lesson 2's question 3**, as you decided (FACTS 7).
6. **The practice card does more.**
   - It says Compose is built for a bigger screen.
   - It tells a first visit to clear the seeded C major scale.
   - It keeps a first-visit line ending "then tap "Yes, skip"" (FACTS 41 to 43).
7. **Your turn drops the plan's "Any octave counts."** It offers "If the top note feels high, leave
   it out and stop at fa." in its place (FACTS 56).
8. **Quick check 2's third feedback** reads "Whatever the clef, E to F is a semitone and F to G a
   tone." The plan's "Any clef names E and F the same way" could be read as putting E and F on the
   same lines in every clef.
9. **Fewer fixed plays.**
   - Step 1's two runs are not fixed plays: Step up and Step down play them.
   - Step 4's two plays after Merc's F become one, G2 up to D4, which also shows B3 and D4
     (FACTS 3, 55, 64, 67).
10. **The Easy and Workable line** reads "five notes, one step up the staff each time", not "you
    just read do to so", because nothing listens (FACTS 58).
11. **Go deeper.**
    - The octave treble clef is worded from two sources read here (FACTS 26).
    - The four-line staves stay out, because Haines 2008 was not read.
    - Each item sits in the drawer of the step it extends.
12. **A new tease**, with the plan's line kept as its alternative (FACTS 5).
13. **Length.** The page is 2,337 words, not about 1,750, and the chip reads 15 minutes, not 14. The
    built page's 126-word cuts are named in WEB-SPEC Length (FACTS 3).
14. **The printed address leaves out `?lesson=15`**, as Season 1's cards do. The card names the
    app's own tab, "Split" (FACTS 41, 45).
15. **Step 3's Try says "move the note"**, not "drag", because a swipe on a phone scrolls the page
    (FACTS 66).
16. **Smaller changes to the plan's copy.**
    - The lock hint names the five lines it unlocks.
    - Step 4 says why low voices need another clef: on the treble staff Merc's F3 would need three
      ledger lines (FACTS 16, 30).
    - Step 5's Notice says a black key takes "a letter's line or space".
    - Step 5's Try drops the tap from staff to key, which the toy still does.
    - Every play marker now comes before what it shows.
    - The climb plays in the soft tone, not as Merc's demonstration.
17. **Plain-English rewordings that change no claim.** They are in the Four words, the reveal,
    Step 2, Step 4's clef sentence, the quick check's feedback ("sit either side of" for "bracket")
    and the one-sentence challenge.

## Open questions

- **Owner:**
  - The page's title. Recommended: "How to read the staff: clefs and middle C | MercuryPitch" (56
    characters). Alternative: "Treble and bass clef notes: reading the staff | MercuryPitch" (60)
    (WEB-SPEC, Decisions 1).
  - Release order. Recommended: SEASON-2 § 5.2 item 21 ships first or with this page. Before it,
    the worker drops every quiz answer on the page, and the practice link meets First Light or the
    takeover. Item 21 can ride with Lesson 16, whose release this one follows (WEB-SPEC, Decisions
    2).
- **Vocal coach:**
  - The key of G, and what it costs. The lower line, G3 to D4, ends above the bass staff, with C4 on
    middle C's ledger line. The higher line, G4 to D5, stays on the treble staff.
  - The line for a top note that feels high, "leave it out and stop at fa". The coach's list gives
    the six-preset table showing why the octave below was dropped.
  - The rest card's wording, Lesson 8's.
  - The new Easy and Workable line.
  - No warm-up: the coach may add Lesson 3's.
  - The plain-language labels for the four feelings: proposed and not applied, as in Season 1.
- **Lead:**
  - Lesson 16's tease, at lead review: the proposal or `any-note`.
  - The trade-off of G, kept as you decided. Please confirm the teaching it adds:
    - Step 4's play runs to D4;
    - Step 4 has a sentence on B, C and D above the bass staff;
    - Your turn has its line on where the lower voice's notes sit.
  - The tour's hold. This page is the first to hold the welcome tour for a predict, using the
    kit's existing `holdTour`, with no time cap.
  - The chip stays an estimate until the lab times the staff toy.
  - Lesson 17's clef line and citations (review finding 11).
  - The head title against SEARCH § 4.
  - Notes for Lesson 16's writer:
    - Lesson 16's plan sings in C, whose C3 and C4 sit on the tenor and soprano presets' floors,
      so the same range check applies there (FACTS 55).
    - Quick check 1 should stay word for word, because Lesson 16 plans to ask it as its recall.
    - The tease's "Five" depends on Lesson 16's phrase.

## Review response

The review raised 1 blocking finding, 11 to fix and 15 nits. Every one is fixed except finding 11,
which is yours, and part of nit 5. After the fix pass: 2,337 words, 42 under the cap; plan-cites
reads 346 citations with 0 findings.

**Blocking**

1. **Step 1's heading named the answer.** Fixed.
   - The heading now reads "Which notes does a staff hold?", still Tavi's question.
   - FACTS 1a now lists and checks the five step headings, and the masthead lesson menu. The menu
     lists every step from the start, and on a phone it is the only menu. At load its card reads
     "Lesson 15 · Which notes does a staff hold?".
   - FACTS 1a also checks the section headings, the lines above them, and the welcome tour's scroll
     to the steps.
   - Every heading was re-checked against the predict. None names a number or says that a space
     holds a note.
   - The tour could not pass the check as built. Its "One step at a time" stop scrolls to the stage,
     where Step 1 counts the places.
   - So the page now holds the tour until the predict's choice. It uses the kit's `holdTour`, as
     Lessons 1 and 2 do for their opening shot, but with no time cap. A choice locks the guess.
   - A visit that never chooses is offered the tour on its next lesson page.
   - In WEB-SPEC: Toys 3, Sections 1, Edge cases and Tests 17.

**Should fix**

2. **Hero lines.** Fixed.
   - Only the share card draws five empty lines (FACTS 1a and Illustrations). The hero draws none
     before the choice.
   - The predict now reads "Merc will draw five lines. From the bottom line to the top line, how many
     places will there be for a note?"
   - Changed in LESSON.md, FACTS 39 and the CURIOSITY-MOMENTS entry above.
3. **Steps.** Fixed.
   - The line is now "Do, re, mi, fa, so: five notes, one step up the staff each time."
   - FACTS 58 counts four steps, as Step 1 and Quick check 2 count them.
   - The preamble, the coach's list and WEB-SPEC Toys 5 match.
4. **Rest card.** Fixed: it is back in Lesson 8's form.
   - The wording was checked word for word against Lesson 8's LESSON.md:324-326. After "Effortful",
     "Uncomfortable" or "Just listen today": "Rest today. This page's sung line will be here when
     your voice feels comfortable." Then Compose, as above, since it asks for no voice.
   - FACTS 59 now cites SEASON-2 § 1.4 item 4 and HANDOFF § 5.
   - FACTS 59 now reads Lesson 12 correctly: its rest card names Arpeggio Jumper, then offers the
     listening drill.
   - The build follows Lesson 8's wrap: a rest line in the card, shown for the rest ending through
     `VisitEnding`. It does not use `mountPractiseCard`, which unlinks a card that sends the learner
     to sing.
   - It leaves the departures list, and the coach confirms the wording.
5. **Octave lower.** Fixed.
   - The line for everyone is gone. Your turn now says "If the top note feels high, leave it out and
     stop at fa.", which takes nobody below the line's first note.
   - The full table is in FACTS 56 and on the coach's list, and verify15.py prints it. Where the
     octave-lower line would start against each preset's floor:
     - lower voice: bass 3 above, baritone on the floor, tenor 5 below;
     - higher voice: alto 2 above, mezzo-soprano 2 below, soprano 5 below.
   - Your turn also drops the plan's "Any octave counts.". The line above Sing it's heading keeps
     Season 1's wording.
6. **The key's trade-off.** Fixed, keeping G.
   - FACTS 55 states the trade-off, and the coach's list and the lead's list above carry it.
   - Step 4's play is now "Play G2 up to D4": the bass staff, then past its top line to B3, C4 on
     middle C's ledger line, and D4 just over it.
   - Step 4 says so in one sentence, and its own text is 119 words.
   - Your turn says "For the lower voice, the last three sit above the bass staff, around middle C's
     ledger line."
7. **Background staves.** Fixed.
   - Kit item 7 now has a Season 2 page drop the body's repeating five-line gradient
     (`lesson-base.css:128-157`) and keep the three glows.
   - Also in WEB-SPEC Look, FACTS Illustrations and Tests 16 (the computed `background-image` has no
     repeating gradient), plus a Contract QA line.
8. **Dragging on a phone.** Fixed.
   - Step 3's Try now reads "move the note above the staff, then below it."
   - Its toy line names Step up, Step down, a tap, and a mouse or pen drag.
   - WEB-SPEC state 3: on touch the figure keeps `pan-y`, citing Lessons 6 and 4, and a tap jumps the
     note to the place.
   - Also in Edge cases and FACTS 66.
9. **One sound at a time.** Fixed.
   - Toys 4 now cites the kit's words strip, with the page's sound owner.
   - Kit item 11 is new: `bindQuizPair(host, owner?)`.
   - Tests 15: the recall pair and the climb stop each other.
   - FACTS 61 says Lesson 2's handler has no owner today.
10. **The sweep.** Fixed.
    - It is now "Play the white keys from G2 to F5", in LESSON.md, WEB-SPEC (state 5 and Tests) and
      FACTS 21 and 68.
    - FACTS 68 adds that the 14 black keys play on a tap.
11. **Lesson 17's citations.** Left to you, as you asked. The clef line is unchanged, so Lesson 17 can
    carry it word for word. The earlier "item 10 can close" holds for the buttons only, and this note
    now says so.

**Nits**

1. Fixed. FACTS 39 now says E4 and E5 share a letter, and so do F4 and F5.
2. Fixed. Both runs now use one rule, the last onset plus its length: the sweep is 5.22 s (FACTS 68,
   Tests 4, verify15.py).
3. Fixed. The wording is now "a 1.15 s hold and a 0.05 s glide, 1.2 s a note" in FACTS 57, WEB-SPEC
   Toys 5 and the coach's list, and FACTS 57 cites `contourOf`.
4. Fixed.
   - FACTS 1 and 5 now say "proposed for the lead".
   - FACTS 39 now cites "the lead's answer to the plan's open question 3".
   - No other workflow words remain.
5. Fixed for the practice card, which now reads "Compose is built for a bigger screen: on a phone,
   turn it sideways." The other uses of "so" were left:
   - none sits beside the syllable (the reveal, the four words' Clef, Steps 1, 4 and 5);
   - two are carried lines that stay word for word: Lesson 2's recall feedback and Lesson 3's
     "Thanks for saying so".
6. Fixed. The still's silence now has its reason, in LESSON.md's stage direction, WEB-SPEC Toys 8 and
   FACTS Illustrations.
7. Fixed.
   - Step 2 now plays [Play F, then F♯] and [Play B, then B♭] before its sharp and flat sentence.
     Its own text stays at 118, by cutting "as Lesson 2 found" and writing "Lesson 4's two short
     steps".
   - Step 5's play now comes before "Middle C sits on the one ledger line".
   - Step 3's [Play D, C, A below] is now in the text, before the notes below the staff.
8. Fixed. Step 4 now reads "The bass clef names the second line from the top: F3, the F below middle
   C that Merc sang. Its two dots sit either side of that line."
9. Fixed.
   - WEB-SPEC Toys 1 puts the switch on every staff toy: the five steps, free play and Sing it's
     staff.
   - It also says why three drawings go without it. The four words' figures are too small, and the
     steps play their notes again beside the switch. On quick check 2's staff the lanes would answer
     the question. The tease still plays nothing.
10. Fixed. The pitch line is now "beside" the staff throughout (Step 2's toy line, FACTS
    Illustrations).
11. Fixed. FACTS 55 now reads "Lesson 14's phrase, which left 2 semitones at the least".
12. Fixed. Kit item 6 now moves Lesson 12's sing flow into the kit, with Move do and the guide's
    drawing as options, so "reuses and never copies" holds.
13. Fixed. Toys 7 now cites Lesson 16's `ARTICLE-PLAN.md:50` for the recall.
14. Fixed.
    - FACTS 5b now cites § 7 item 8, and item 9's reason, "Lesson 14 teases nothing", beside § 1.4
      item 3 and CURIOSITY-MOMENTS' Lesson 14 entry.
    - Kit item 3 now cites § 1.4 item 3 and § 7 item 8.
15. Fixed.
    - The cold open's stage direction now says "The climb plays nine white keys … in the soft tone".
    - WEB-SPEC Look now says why the clef's named line is gold. It is the series' "fit", "things
      that line up" (MASTER-PLAN.md:196): the clef's mark, the line and the note's letter line up
      there.

**Your other notes, carried out**

- The explorer line now reads "Season 2 · Lesson 15".
- The chip stays an estimate, and WEB-SPEC Length says so.
- The tease and its alternative stay in this note for lead review.
- The clef line under the voice buttons is unchanged.
- The hints-in-the-open check is done, and its cuts are named above.
