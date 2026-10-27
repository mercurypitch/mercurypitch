# Lesson 14 web page: spec

The Lesson 14 page is the web lesson for "Phrasing: sing a whole song", the season's last: written
steps, one main toy in seven states, one predict, a sung checkpoint of one phrase sung twice that
draws each take over Merc's bands and records it on the device so the singer can play it back, with
nothing scored, two quizzes (the recall and the quick check), the lesson explorer, and the kit's
card that closes the season. Copy is in [LESSON.md](LESSON.md); every claim is in
[FACTS.md](FACTS.md). It is a text-only package: no film exists for Lesson 14, so the page has no
Watch section and the masthead's anchors are Lesson, Sing and Explorer. It is built on the kit
(`src/features/lessons/kit/`) and, like Lessons 2 to 9, it reuses and never copies: a part that
still lives in an earlier lesson's module moves into the kit first. Where this page shares a
behaviour with Lesson 3's checkpoint (the comfort check, the warm-up, the voice choice, "How did
that feel?" and the rest card), it is Lesson 3's, unchanged unless this spec says otherwise, and
after "Effortful" it follows Lessons 6, 7 and 9: no further take, and the rest card in the Wrap. The
take is Lesson 3's wiring (`kit/listen.ts`, `kit/take.ts`); what is new is that each take is also
recorded, in memory on the device, for the singer to play back, the series' first recording (S22,
50), with its own rules (Toys 4).

One object carries the lesson across its steps: the song line (Toys 1), the kit's band chart with
each note of "Twinkle, Twinkle, Little Star" as a band over its own time, the words under the notes,
breath marks, and a light in each band that follows the note's level. Merc's two takes play on it in
the cold open; the whole song, the takes and their breaths, the swell beside Lesson 5's push, the
two endings with their chords and the listening back are each a state of it; at the checkpoint the
viewer's own two takes are drawn on it; and in the Wrap its still, the whole song with its breath
marks and the swell drawn in light, closes the season. Motion principle 2, "One object carries the
story across shots and keeps its identity" (`research/brand-motion.md:667`), and playbook rule 6 ask
for it, and the CURRICULUM's signature is its moment: "a whole song's pitch line with breath marks
and a swell drawn in light" (5).

Its public home is `mercurypitch.com/learn/14` (MASTER-PLAN § 12 item 9): a hand-written document,
`learn/14.html`, with its module in `src/features/lessons/lesson-14/`, wired as Lesson 3's page is.
Every build carries it, as every build carries every lesson page, and it is a draft, with a line in
`kit/drafts.ts`: the dev site and every PR preview serve it, and on mercurypitch.com the site worker
answers its address with the 404 page until the admin console publishes it, at run time and with no
release (11, 12). Whoever publishes it waits for two things: the vocal coach's sign-off, the hard
gate, because it is a voice lesson (MASTER-PLAN § 7, days 1 and 6; § 12 item 8); and the pages of
Lessons 5, 8, 9 and 12 live at `/learn/05`, `/learn/08`, `/learn/09` and `/learn/12`, because its
prerequisite chips and its recall check link there (3, 7). Those are rules for whoever uses the
console, which asks before it breaks one but never stops it: it asks before it publishes a draft
that waits on a sign-off, and before it publishes a lesson while one it builds on is not
published, then publishes it if told to. A page published early still works, with plain chips and
unlinked step links where its links to those
lessons would be (Edge cases). It opens in Lesson 2's order, the cold open straight under the title
and the recall after it, as MASTER-PLAN § 4.2 now has every page open (§ 12 item 13; 6), and its
copy follows the plain-language review's patterns. "What the kit and the app still need", below,
lists the wiring and every kit change.

## Look

Lessons 1 to 9's look, unchanged: the dark listening room, the series colour code, Lesson 1's type
and wordmark, and the motion rules. On this page:

- The song line is a pitch canvas, so it takes the app's canvas set (MASTER-PLAN § 5): Merc's notes
  are amber bands `#f59e0b`, each with Merc's steady line at its centre; the viewer's line, and the
  drawn lines of Step 3, are singer violet `#a78bfa`, which means a singer only (93). Gold
  `#ffd84d`, which means "the fit", is not used, and nor is the mint lit edge with its "IN THE
  BAND": nothing on this page reads a note against its band.
- Loudness is light, never height (playbook rule 20, 16): a band brightens as its note grows louder,
  and the light stays where the note was sung, so a played take leaves its shape in light, even
  along the other notes and growing and fading along take 2's "star". The label under the stage says
  so from the start, "Brighter means louder." Step 3 adds Lesson 5's level strip under the plot,
  where level is height in a strip of its own, as Lesson 5 draws it.
- A breath mark is the kit's, the one Lesson 6's slide guide draws: a small tick over the line with
  the word "breathe", in the line's colour, lit once the voice reaches it (`kit/slide-guide.ts`: the
  header, `:20-23`; `breaths`, `:62-63`; `breathAt`, `:324-336`; `drawBreaths`, `:338-363`), the
  tick a score's comma (26).
- The words sit under the notes, each syllable under its note in the chart's mono at 11 px, ink-2,
  the sounding one ink (91).

Two things move on their own: the Merc idle loops. Under `prefers-reduced-motion` they stop, and
every transition this page adds lands in its end state with no travel: no playhead and no sweep; the
sounding note's band and syllable light in place; a take's light grows and fades in place, since it
follows the sound's level and moves nothing; a scrub still draws the moment it names. What the
viewer starts still sounds. For everyone else the masthead's Pause animations toggle stops the same
two (WCAG 2.2.2).

## Sections

The page anatomy (MASTER-PLAN § 4.2) in Lesson 2's order, with Lessons 2 to 9's departures kept: the
step toys double as the Playground (§ 4.2 item 9, `MASTER-PLAN.md:158`, as Lesson 1's do,
`:162-163`), so the Wrap has no free play of its own; the mix-up card sits in the step whose toy
refutes it; the practice card sits in the Wrap. No Watch section (§ 4.2 item 10). Each section's
heading, and the line above it, are in LESSON.md ("Section headings").

1. **Masthead**: Lesson 1's (wordmark, "Season 1 · Lesson 14", anchors Lesson, Sing and Explorer,
   the Sound toggle off by default, Pause animations with its reduced-motion lock), through
   `initMasthead(sections, { lesson: 14, deck })` (`kit/page-chrome.ts:110-126`): before anything
   else the page's links to other lessons follow the state it was served with (`followPageState`,
   `kit/page-state.ts:84-108`; Edge cases), then "Season 1 · Lesson 14" opens the lesson menu
   (`kit/lesson-menu.ts`), and the page's steps are remembered as the viewer moves through them
   (`kit/position.ts`).
2. **Hero**, laid out as Lesson 2's is (`learn/02.html:333-506`). The hero copy holds the kicker;
   the hook question as the title, `<h1 class="hook" id="hook">` in its default wording, the
   season's, which `src/features/lessons/kit/lesson-copy.test.ts` holds every page's title to
   (`:323-332`), with no variant's team note anywhere in the markup (`src/features/lessons/kit/team-notes.test.ts:85-101`; 1), and the element
   the site worker writes a picked hook into (`src/lesson-gate.ts:590-591`); the meta as seven chips
   ("18 minutes", 8; "After Lesson 5: Steady note", "After Lesson 8: Beat and tempo", "After Lesson
   9: Landing a leap" and "After Lesson 12: Chords", each a link to that lesson's page and wholly
   the link, as Lesson 2's `a.chip.chip-link` is, `learn/02.html:351-356`, so that it stays as a
   plain chip where its lesson is not live, 3; Sound on; Microphone optional); the promise; and the
   sound gate from LESSON.md. Beside it, the stage: the bubbles, Merc and Tavi on the floor line,
   and under them, across the stage's whole width, the song line in its compact state (Toys 1). It
   sits under Merc and Tavi, not between them as Lesson 5's single band does, because a phrase of
   seven notes with its words needs the width: between Merc and Tavi at 120 px on a 390 px phone it
   would have about 66 px of plot (`.duo`, `lesson-05/lesson-05.css:21-26`, `:74-76`). Under the
   chart, its two plays, then the label, "Both takes are Merc's, synthesised in your browser: a
   demonstration, not a recording. Brighter means louder." (16), then the cold open's predict card
   (Toys 2). On a phone (390 x 844) the title and the opening's first control, Play take 1, and the
   two choices belong on the first screen, and on a tablet in landscape (1024 x 640) the stage and
   the choices too (CURIOSITY-MOMENTS § 3.1, "Above the fold",
   `docs/plans/find-your-pitch/CURIOSITY-MOMENTS.md:300-302`). Of the plan's levers, the recall's
   place is already used, since it follows the predict; the others are Merc and Tavi's size
   (`--merc`, `kit/lesson-stage.css:204`) and the hook's length, 58 characters (1), since the owner
   dropped its alternative, `compelling`, on 22 October 2026. The seven chips take five rows on a
   360 px phone, one a row for each lesson chip (3), so this page's stage starts lower than Lesson
   9's; `src/e2e/learn-cold-open-fold.spec.ts` holds the title on the first screen at its seven
   sizes and reports where the first control and the choices sit (End to end 5).
3. **Recall from Lesson 5**: Lesson 5's questions 2 and 4, for everyone (Toys 5).
4. **Four words you'll meet**: phrase, legato, swell and cadence, each with its definition, a small
   figure and a play button (Toys 3).
5. **The steps**: Lesson 1's sticky stage and step deck ("N of 5", Previous and Next), every step on
   the one song line (`toyFor: () => 1`, `kit/step-deck.ts:49-54`), in five states (Toys 1):
   1. What's a phrase? The whole song, with a button for each line.
   2. Where do I breathe? Take 1 and take 2 with their breath marks; the mix-up card.
   3. How do I make a note grow and fade? The swell beside Lesson 5's push, each with its level
      strip.
   4. How does a phrase end? Lines 2 and 3, each with its chords as numerals.
   5. Why listen back? Both takes, back to back, and a scrub through take 2.
6. **Sing it**: the comfort check, the voice choice, the warm-up, Move do, Merc's phrase, the
   briefing, take 1 and take 2, the lines, the feeling question, and playing the takes back (Toys
   4). It is MASTER-PLAN § 4.2 item 7's checkpoint as a voice lesson about shape has it: the
   learner's line against Merc's target bands, octave-tolerant, and language about the sound; it
   reads no note in cents, since what it teaches is the phrase's breaths and swell, which nothing on
   the page rates (53).
7. **Quick check**: LESSON.md's four questions (Toys 5).
8. **Wrap**: the three recap lines, the challenge, the practice card in the version Sing it's ending
   picks, and the kit's card that closes the season (`createNextCard(14)`,
   `kit/next-card.ts:176-193`, drawn before `createExplorer`, `:27-30`). After the season's last
   lesson the kit draws the season's close in place of a next-lesson card: the eyebrow "End of
   Season 1", the line "You've seen every note you sing. Now sing a whole song.", Karaoke Night,
   which links `/karaoke-night?lesson=14` in a tab of its own, and "See the season map", which links
   `#explorer` (`seasonEnd`, `:77-89`; `endCard`, `:148-174`; 9). The card holds two links, so it is
   no link itself. Its figure, the song line's still (Toys 1, Still), sits in the page's
   `[data-next-card]` mark, whose children the kit keeps in the card after its words, in the form
   the kit's own test gives,
   `<div class="next-card card l14-next" data-next-card hidden><figure class="end-still">`
   (`src/features/lessons/kit/next-card.test.ts:348-379`). The kit draws the close once and never
   redraws it (`next-card.ts:190-193`), so today it says "Now sing a whole song." whatever Sing it's
   ending. This page needs a close that knows the ending, and is not built before it (What the kit
   and the app still need, 12; 78): after "Effortful", "Uncomfortable" or "Just listen today" the
   card keeps "You've seen every note you sing." and "See the season map", and shows neither "Now
   sing a whole song." nor its Karaoke Night button. The practice card is the Karaoke Night card,
   with "Ten minutes, gently, most days" under it; after "Effortful", "Uncomfortable" or "Just
   listen today" it is the rest card instead, without that line or a link (Toys 4). The practice
   card links `/karaoke-night?lesson=14` in a new tab (57).
9. **Lesson explorer**: the kit's, with Lesson 14 as the current node and the line under its heading
   from LESSON.md; its card shows what `kit/lesson-state.ts` says of a live lesson, and no Watch
   button, since Lesson 14 has no published film (`kit/season.ts:23-25`).
10. **Footer**: Lesson 1's, with "Season 1 · Lesson 14 · Phrasing: sing a whole song"; the practice
    link, printed `mercurypitch.com/karaoke-night` and linking `/karaoke-night?lesson=14`, with
    "Karaoke Night's example song is free." (54); Lesson 1's fonts line and "Every example on this
    page is synthesised in your browser. The only recording it plays is your own, on this device."
    (94); no first-visit line, because Karaoke Night shows no intro (56).

## Length

The learner copy is 2,368 words on `pnpm lesson:words` (8; the review's 2,372), 11 under the series'
cap of 2,379: Lesson 3's page on the same count is 2,454 words, 75 of them the note under its new
title, which is not in editorial form, so the counter reads it. The page runs about 18 minutes: 9.95
of reading at 238 words a minute and about 8.1 of sound, toys and tasks, 18.05 in all, of which Sing
it is about 3.3. That is past MASTER-PLAN § 4.2's 8 to 12 minutes of active time, as Lessons 3, 5,
6, 7 and 9 are (16, 18, 17, 16 and 16 minutes), and acceptable by their precedent for a lesson that
closes the season and carries both lanes. Each step's text, with its Try and its Notice, runs 109 to
116 words (Steps 1 to 5: 112, 109, 116, 111 and 115), inside § 4.2's 50 to 120 a step. One step
carries more beside it: Step 2, about 200 words with its mix-up card (90 words), which sits in the
step whose toy refutes it, as in Lessons 2 to 9. The season recap the owner may add to the closing
card is one line, not a step (LESSON.md, the Wrap's note). The page has no Go deeper drawer.

## Toys: what each reuses, and what is new

| Toy                       | Reuses                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | New in Lesson 14                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. The song line          | The kit's band chart (`kit/band-chart.ts`, `kit/band-chart-draw.ts`: the notes axis, Merc's band and steady line, its glow, the violet trace, its head, the playhead and edge pins) and Lesson 5's level strip (`kit/band-chart-hold.ts`); Lesson 9's rungs in sequence mode, a band over each note's own time, and its rung names (Lesson 9 WEB-SPEC, What the kit and the app still need, 5); the kit's breath marks (`kit/slide-guide.ts` `breaths`) and Lesson 6's "Twinkle" (`lesson-06/melody.ts` `TWINKLE`), both from Lesson 6's page; the kit's spelling (`kit/major-scale.ts`, `kit/notes.ts`); `kit/sound.ts` (`contourVoice`) | The words strip; breath marks on the band chart; light that follows a level and stays; the chord strip; the whole first verse as kit data (`kit/twinkle.ts`); seven states |
| 2. Predict widget         | The kit's predict as it is (`kit/predict.ts`), with two choices, a free first play and a reveal that waits for the second                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Merc's two takes, drawn as they sound                                                                                                                                      |
| 3. Four words             | Lesson 1's strip of figure, word, definition and button (`lesson-01/words.ts`), promoted into the kit if no earlier page has                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Four new figures                                                                                                                                                           |
| 4. Sing it                | Lesson 3's checkpoint (`kit/comfort.ts`, `kit/listen.ts`, `kit/take.ts`, `kit/voice-choice.ts` on `fyp-voice`, `kit/warm-up.ts`, the feeling question, the rest card); Lesson 4's Move do and count-in; Lessons 6, 7 and 9's rest card after "Effortful"; the app's take recorder (`src/lib/voice-capture.ts`)                                                                                                                                                                                                                                                                                                                            | Recording and playing back a take (`kit/record.ts`, proposed); the range reader; two takes and their lines; a flow rule                                                    |
| 5. Recall and quick check | The kit's quiz as it stands (`kit/quiz.ts`: an id `prefix`, question ids, an optional `lesson` and links away)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Ids and keys                                                                                                                                                               |
| The season's close        | The kit's next-lesson card as it stands (`kit/next-card.ts`, `SEASON_END` in `kit/lesson-copy.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | The figure in its mark; a rest-aware close, required before the build                                                                                                      |

### 1. The song line

One component, the kit's band chart (`kit/band-chart.ts`) on a notes axis, in seven states: compact,
song, takes, swell, endings, listen back and still, plus live mode at the checkpoint (Toys 4).

- **The song.** "Twinkle, Twinkle, Little Star", its whole first verse: six lines of seven notes,
  crotchets with a minim at each line's end, at 80 beats a minute, a crotchet 0.75 s, a line 6.0 s
  and the verse 36.0 s (17, 20). Its notes are scale degrees from do, do to la (18), spelled as
  Lesson 4 spells the key (`majorScale`, `kit/major-scale.ts:43-45`): from D3, D3 E3 F♯3 G3 A3 B3,
  an octave up for the higher voice. Its chords are the page's, one a minim (43). It lives in the
  kit as data (`kit/twinkle.ts`, proposed, What the kit and the app still need, 6), with the five
  breath marks at 5.7, 11.7, 17.7, 23.7 and 29.7 s (85).
- **Drawing.** Pitch is height (playbook rule 20): one faint row per semitone, bottom to top,
  through the kit's notes axis (`axis: { notes: [lo, hi] }`, `kit/band-chart.ts:54-68`), with its 40
  px gutter on the left. Only the song's six rows are named, by syllable alone, "do", "re", "mi",
  "fa", "so" and "la", through Lesson 9's rung-names option (two letters fit the gutter; the chart's
  summary gives the spelled note), since the kit's grid letters every natural row (`drawNotesGrid`,
  `kit/band-chart-draw.ts:113-141`). Time runs left to right. Each note is a band 35 cents either
  side, Voice Mirror's own (`HIT_TOLERANCE_CENTS`, `src/lib/mirror/match-bands.ts:22`, through
  `kit/band-words.ts:20-24`), over its own time, with Merc's steady line at its centre; the vibrato
  of his "ooh" is never drawn, as the kit's band rule says (`band-chart.ts:5-12`). Each of Merc's
  notes is synthesised at its exact pitch (92), so his line is the band's centre. A breath is a gap
  between two bands, with its breath mark over it. The chart's spoken summary (`describe`) names
  what it shows in words, never the sign: "Phrase 1, seven notes: do, D3, twice; so, A3, twice; la,
  B3, twice; then so, A3, held".
- **The light.** Each band brightens while its note sounds, by the note's level: Merc's lines are at
  level 1, take 2's "star" goes from 0.5 to 1 and back (83). Today a band's glow is one number, "0
  at rest, 1 while Merc's note sounds" (`kit/band-chart-draw.ts:149-150`), which brightens its fill
  and Merc's line and adds a halo (`drawBand`, `:156-191`). The song line needs it along a band's
  length: each moment of the band as bright as the note's level then, kept once it has sounded, so a
  still holds the take's shape in light. That is what "Brighter means louder." points at (16).
  Nothing else is drawn for loudness on the plot; level as height is only ever in Step 3's strip.
- **The words strip.** Under the plot, 18 px tall: each syllable centred under its note in the
  chart's mono at 11 px, its hyphen kept where the word goes on ("Twin-", "kle,"), as the score
  joins them (91). At 344 px the tightest pair, "Twin-" and "kle,", clears by 2.55 px; at the
  labels' 12 px it would overlap, hence 11 px. The first syllable reaches at most 0.4 px into the
  empty gutter. The sounding syllable is ink, the rest ink-2.
- **The chord strip** (Step 4 only): a second 18 px strip under the words, each chord's numeral,
  "I", "IV" or "V", in the chart's 12 px mono, centred under its minim (64.5 px at 344 px).
- **The voice.** `fyp-voice` if stored, else the lower: do is D3 for the lower voice and D4 for the
  higher (65, 71), and the chart follows a change made in Sing it (`VoiceChoice.subscribe`,
  `kit/voice-choice.ts:20-48`). The steps carry no voice switch.
- **Windows.** Every phrase view, the song view and live mode: do − 1 to la + 1, 11 semitones; the
  swell: fa to la, 4 semitones, its rows named fa, so and la. Every window holds every note its
  state plays (82).
- **Compact** (hero and cold open): line 1, its seven bands unlit, with their words, no breath mark
  and no controls on the chart. **Play take 1** (free before the choice) and **Play take 2**
  (unlocked by the choice) sit under it (Toys 2). A take plays Merc's line in the chosen voice (83):
  each band lights as its note sounds, its syllable with it, a playhead running along the plot, and
  its breath mark lights as the breath comes: take 1's at 4.2 s, over the gap between "lit-tle" and
  "star", take 2's at 5.7 s, after "star" (31). The chart shows one take at a time, the one playing
  or last played, named in its top left corner in the chart's mono, "take 1" or "take 2"; starting
  the other clears it and draws the new one as it sounds. After take 2, "star"'s band holds its
  swell in light, dim, bright at 5.1 s, dim again, while Merc's line stays at its centre. The
  drawing is `aria-hidden`, and a polite live region speaks for it: for take 1, "Take 1: phrase 1 on
  "ooh", with a breath between "little" and "star""; for take 2, "Take 2: the same seven notes, with
  the breath after "star". "Star" grows louder, then softer, its light growing and fading, and its
  line stays in its band." Take 2's words come only once take 2 has played to its end, when the
  reveal comes too (Toys 2).
- **Song** (Step 1): the whole verse, 36 s across the plot, its six lines in turn, the five breath
  marks as ticks with no word, since at 344 px they stand 43.0 px apart and "breathe" takes 46.2 px.
  The words strip holds each phrase's number, "1" to "6", centred under its 6 s, since "phrase 1" in
  the strip's mono (52.8 px) would overrun a phrase's 43.0 px at 344 px. **Play the song** plays the
  verse (85); six phrase buttons, **Phrase 1** to **Phrase 6**, in two rows of three, each play that
  phrase alone, 6.0 s. Under the figure, a caption gives the playing phrase's words, "Twinkle,
  twinkle, little star," and so on, `aria-live="polite"`. The status names the long note at each
  phrase's end as it comes: "Phrase 1 ends on its long note: "star"."
- **Takes** (Step 2): as compact, at the step's size, with **Play take 1** and **Play take 2**, here
  named "Play Merc's take 1" and "Play Merc's take 2". The status names each breath as it lights:
  "Take 1 breathes between "little" and "star": its time comes from "little"." and "Take 2 breathes
  after "star": its time comes from "star"."
- **Swell** (Step 3): the fa-to-la window, so's band twice, over two 4 s windows with 0.6 s between
  them, labelled over each in the chart's 12 px mono, "the swell" and "Lesson 5's push"; under the
  plot, Lesson 5's level strip (`drawLevelStrip`, `STRIP_GAP`, `stripHeight`,
  `kit/band-chart-hold.ts:29`, `:34-35`), each window's level drawn in it as height. **Play the
  swell** plays it (86): a violet line glides in from 40 cents low by 0.5 s and holds the band's
  centre while the strip rises from half height to full at 2.5 s and back at 4.0 s. **Play Lesson
  5's push** plays Lesson 5's pushed take as Lesson 5 plays it (`lesson-05/lines.ts:29-43`, 39): the
  line climbs 60 cents over its last 3 s, leaving the band at 2.75 s, as its strip rises the same 6
  dB. Both lines are violet and belong to no Merc, with "Both are drawings, not recordings." in the
  step's Notice (93). Both lines stay drawn once played, so they can be compared.
- **Endings** (Step 4): line 2 or line 3, the one playing or last played, with its words and its
  chord strip: line 2, "How I won-der what you are!", over IV I V I; line 3, "Up a-bove the world so
  high,", over I IV I V (43). **Play: what you are** and **Play: world so high** each play their
  line in Merc's "ooh" over its chords (87), named in full "Play phrase 2, How I wonder what you
  are, with its chords" and "Play phrase 3, Up above the world so high, with its chords". As its
  last note ends, the status names its ending: "Phrase 2 ends V to I, on do: a perfect cadence." and
  "Phrase 3 ends on V, on re: an imperfect cadence." (44).
- **Listen back** (Step 5): as compact. **Play both takes** plays take 1, then, 1 s after it, take
  2, each drawn as it sounds. A **scrub** bar on its own row, "Scrub through take 2", draws take 2
  up to the moment it names, without sound (MASTER-PLAN § 4.2 item 5): the bands lit to there, the
  breath mark once it is reached, "star"'s light at that moment's level.
- **Still** (the Wrap's closing card, and the share card's drawing, What the kit and the app still
  need, 3): the whole verse at the card's size, its five breath marks as ticks, and the swell drawn
  in light on each "star", in lines 1 and 5, with no controls, as an image with a text alternative:
  "The whole song as a line: six phrases, a breath mark after each of the first five, and the swell
  on each "star" drawn in light." Under reduced motion it is the same still.
- **No Slow.** The song is already at 80 beats a minute, and a slowed take would move the breaths
  the steps are about, so no state has a Slow; every play in the steps, the Four words and Sing it
  has a Stop, its button reading "Stop" while it sounds (MASTER-PLAN § 4.2 item 5's pause). The cold
  open's two plays are the exception: they are the kit predict's own buttons, which it ignores while
  one of them is sounding (`busy`, `kit/predict.ts:179`), so they keep their names and show only as
  playing (`is-on`, `:181`) until the take ends (Toys 2).
- **Layout and targets** (91). The stage fit is the kit's, so the page sets no figure height of its
  own: on every step the deck measures what the toy needs besides its figure
  (`kit/step-deck.ts:15-17`; `fitStage`, `kit/stage-fit.ts:38`), and the figure, the kit's `.viz`
  (330 px beside the text; 280 px in the deck, 250 px at 420 px wide and under), gives way to it
  down to `--viz-min`, which this page sets to 210 px on the song line, as Lesson 3's band chart
  does (`lesson-03/lesson-03.css:177-182`), because its words strip and row names collide any lower;
  a stage still over budget scrolls inside itself, by 60 px at most (PRODUCTION-PIPELINE § 5). Keep
  each step's chrome, its stage less the figure, under about 375 px at 1133 px wide: each step's
  controls are one row of `btn sm` buttons where they fit, wrapping on a phone as the kit's rows do;
  Step 1's six phrase buttons sit in two rows of three, 96.7 px wide and 44 px tall at 344 px; Step
  5's scrub bar takes a row of its own. Every target is at least 44 px square, with the kit's 10 px
  between neighbours, at every width from 344 px up, and no band, syllable or breath mark is a
  target. Across, the plot runs from 40 px to 12 px short of the right: 304 px at 390 x 844 and 258
  px at 344, so one line is 50.7 px a second at 390 (a crotchet 38.0 px, a breath 15.2) and 43.0 at
  344 (a crotchet 32.2), and the whole song 8.44 px a second at 390. Up, over the 11 semitones with
  the words strip: 25.8 px a semitone beside the text, 21.3 in the deck at 280 px, 18.5 at 250 px
  and 14.9 at the 210 px floor, so the 70-cent band stands 18.1, 14.9, 13.0 and 10.4 px; Step 4's
  chord strip takes 18 px more, leaving 24.2, 19.6, 16.9 and 13.3 px a semitone. Step 3's two
  windows are 120 px each at 344 px, and "Lesson 5's push" in 12 px mono takes 108 of them. A breath
  mark's word, "breathe", is 46.2 px in the 11 px mono: in a phrase view it is centred over its tick
  and moved left only as far as it must go to stay inside the plot, which take 2's mark at 5.7 s
  needs; in the song view the ticks carry no word.
- **Keyboard and screen readers.** The chart is a group with a live summary in spoken names, never
  the sign. Every control is a button. The scrub bar is a slider (`role="slider"`, 0 to 6 seconds,
  `aria-valuetext` such as "5.1 seconds of 6: "star", at its loudest"), moved by the arrow keys a
  tenth of a second at a time, Home and End for its ends. No two controls on the stage share a name:
  "Play Merc's take 1" in Steps 2 and 5's "Play both takes"; the phrase buttons "Play phrase 1:
  Twinkle, twinkle, little star" to "Play phrase 6: How I wonder what you are"; the swell's "Play
  the swell" and "Play Lesson 5's push". Tab order: the state's own controls in reading order, then
  the scrub bar.
- Under reduced motion no playhead runs: the sounding note's band and syllable light in place, a
  line draws whole with its sound, a breath mark lights at once, and a take's light grows and fades
  in place; a played sound still sounds.

### 2. Predict widget

- The kit's predict as it is (`mountPredict`, `kit/predict.ts:80`; 14), which takes two to four
  choices (`:12-14`): here two `.choice` buttons, `data-choice` "rises" and "level", labelled "It
  rises" and "It stays level", each at least 44 px tall. The choice locks (`:113-131`) and unlocks
  Play take 2, which starts disabled.
- The two plays are the compact chart's, under it, so they are given as `plays` (`:67-68`, as Lesson
  5's cold open gives its two, `lesson-05/hook.ts:147-154`): **Play take 1**, `data-play` "take1"
  with `data-free`, works before the choice, so the sound comes first (playbook rule 5), and never
  reveals, since take 1 has no swell and so says nothing of what one does to the line; **Play take
  2**, `data-play` "take2", is the play the question is about.
- `revealOn: ['take2']` (`kit/predict.ts:53-54`, `:94-97`): the reveal waits until take 2 has been
  heard with sound on (`heard`, `:158-174`), to its end: a take 2 cut short resolves `false`, which
  the kit never counts as heard (`:30-41`, `:187-188`), so the reveal waits for it to play through
  (Audio). While a take sounds the predict ignores its own two buttons (`:179`), so in the cold open
  a take is cut short only from outside it: another source taking the page's one "now playing" owner
  (a Four words play, say, on a screen tall enough to show both), the Sound toggle going off, or the
  tab going hidden, both of which stop every voice (`Sound.stopAll`, `kit/sound.ts:476`, `:507`)
  without telling the source. The page's `play` resolves `false` in each of the three cases, so it
  must notice the last two itself (Audio).
- The hints, each true in every state the kit shows it in (until the reveal, the kit shows `silent`
  after any play with sound off, the free one included, before a choice too,
  `kit/predict.ts:161-165`): the lock hint in the markup, "Choose an answer to unlock Play take 2.";
  `chosen`, "Locked in. Now play take 2, and watch "star"."; `silent`, "Sound is off, so nothing
  played. Turn sound on, then play it again.", which names no take, because before a choice take 2
  is still locked; `again`, "Play either take again." No `next` hint: the kit shows `next` after a
  heard play that does not reveal, once a choice is in, and `chosen` in its place where a page gives
  none (`kit/predict.ts:48-49`, `:173`); after take 1, `chosen` already says what to do, so `chosen`
  stays.
- `guess` gives "You said: it rises" or "You said: it stays level", in Lesson 2's form
  (`lesson-02/cold-open.ts:34-37`), never "right" or "wrong", and the reveal's text is LESSON.md's
  for both choices. It states the answer first, "It stays level.", then why, then the other choice's
  reason in brackets, "(In Lesson 5, a harder push made a note louder and higher too, so "it rises"
  was a fair guess.)" (15). `onReveal`: Tavi celebrates once (Merc and Tavi).
- Nothing before the reveal answers it (6): the title and the hook in either wording, the promise,
  the sound gate, the label, the head's descriptions and structured data (What the kit and the app
  still need, 2), the share card (3), and the previous card's tease in either wording (2).
- States: waiting for a choice, with Play take 1 working, before or after take 1 has been heard; the
  choice locked, take 2 open and not yet heard to its end, whether or not take 1 has played since;
  take 2 heard, and the reveal shown. With sound off a play draws its take and shows the `silent`
  hint, and the reveal does not come.
- How the hint moves, as the kit has it (`heard`, `kit/predict.ts:158-174`). The kit's tests hold
  the first two below (`src/features/lessons/kit/predict.test.ts:240-264`), the third (`:266-286`)
  and the fourth (`:198-221`); the fifth has no kit test, so this page's unit test 12 holds it, and
  End to end 2 holds the first two on the page:
  - before a choice, take 1 played with sound off shows `silent` in place of the lock hint
    (`kit/predict.ts:162-165`);
  - take 1 heard with sound on, still before a choice, puts back the lock hint exactly as the page
    wrote it, "Choose an answer to unlock Play take 2.": the kit keeps the markup's hint when it
    mounts (`kit/predict.ts:84-85`) and writes it back (`:166-170`);
  - after a choice, a heard play that does not reveal, take 1, shows `chosen`, since this page has
    no `next` (`kit/predict.ts:173`), so it replaces `silent` too;
  - a play cut short resolves `false`: it reveals nothing and leaves the hint as it was
    (`kit/predict.ts:187-188`);
  - once the reveal shows, no play changes the hint, a play with sound off included
    (`kit/predict.ts:161`).
- Under reduced motion the reveal appears without its rise (`kit/predict.ts:149`).

### 3. Four words

Lesson 1's strip (88): **Phrase** plays line 1 as take 2 sings it; **Legato** plays line 1 as one
voice, then again with a 0.3 s break before every note; **Swell** plays Step 3's swell; **Cadence**
plays "what you are", the end of line 2, over its last two chords, V to I. Each button names what it
does ("Play: the first phrase"; "Play: legato, then with breaks"; "Play: a swell"; "Play: "what you
are", with its chords"). Each figure is a small still of the song line in the strip's size: line 1's
bands; one unbroken line over a broken one; one band whose light grows and fades; "what you are"
over its numerals, V and I.

### 4. Sing it: one phrase, twice

The song line in live mode, inside Sing it's card, with line 1's bands as the target and the
viewer's line drawn against them. It is the kit's `.sing-chart` (240 px; 210 px at 420 px wide and
under), a band chart as on Lessons 3, 5 and 9 (`learn/03.html:1399`), so the 11-semitone window
gives 17.6 px a semitone (14.9 at 210 px), and its words strip fits as in the steps (91). Every
state has a visible status line that is also announced (`aria-live="polite"`).

States:

1. **Comfort check**, always first and asked every visit (never stored): Lesson 3's comfort line,
   its list naming all six of REQ-GVC-020's conditions, and its two buttons (61), through the kit's
   `mountComfort` (`kit/comfort.ts:158-166`).
2. **Voice choice**, after either comfort answer: Lesson 3's two buttons with Merc and Tavi's stills
   (`aria-pressed`, at least 44 px), under LESSON.md's line in its two forms, "Choose a voice to
   sing with. If you chose one in an earlier lesson, pick it again:" with none stored and "Keep the
   voice you chose before, or change it:" with one (65). It reads and writes `fyp-voice` through
   `VoiceChoice` (`kit/voice-choice.ts:20-48`). A stored choice shows pressed and can be changed;
   with none stored, neither is pressed and the next state waits for a choice, before "Just listen
   today" plays anything too, because the voice picks the Merc who sings.
3. **Just listen today** (listen-only mode): LESSON.md's line with the doctor lines (62, 64); Move
   do (state 5) and **Play Merc's phrase**, which sings take 2 on a tap in the chosen voice, the
   chart lighting each band; nothing listens or records, the warm-up and Start are not shown, and
   nothing asks the viewer to sing (REQ-GVC-021). The Wrap shows the rest card.
4. **Warm-up**, optional, with Skip: Lesson 3's words and its two plays, Play Merc's sigh and Play
   the slide, in the chosen voice (`warmUpContour`, `kit/warm-up.ts:24-36`), with "Copy the way
   Merc's voice slides, not the exact notes." and the stop line (66, 63). Nothing listens and
   nothing is scored (REQ-GVC-074, REQ-GVC-075). The Skip is stored as `fyp-l14-warmup`, as Lessons
   3 and 5 store theirs (`lesson-03/sing.ts:48`, `lesson-05/sing.ts:54`).
5. **Your turn and briefing**: LESSON.md's Your turn text with its control; the stop line on its own
   line; the "What this does" box (REQ-GVC-002, REQ-GVC-003, REQ-GVC-012, REQ-GVC-026; 79, 52);
   **Play Merc's phrase** and **Start take 1**, the only control that asks for the microphone
   (MASTER-PLAN § 4.2 item 2).
   - **Move do**: Lesson 4's control, word for word (`learn/04.html:1254-1263`): a group labelled
     "Move do:" with two buttons, "lower" and "higher", a semitone a tap, up to four each way from
     D3 (or D4), each disabled at its end, as Lesson 4's are (`kit/move-do.ts:26-27`, `:38-49`;
     70). The bands, the rows and the window move with it, and the chart's summary says where do is
     ("Do is D3"), in Lesson 4's spelling (18). Move do can change before Start and between takes,
     never during a take; a take made before a move is redrawn against the bands it was sung to,
     since the chart keeps each take's own do.
   - **Start take 1**: with sound on, it asks for the microphone
     (`listen('lesson-14', Sound.context())`, `kit/listen.ts:54-57`), then Merc sings the phrase,
     take 2 (90), the chart lighting each band as he sings it, then Lesson 4's count-in, do once and
     softly (89), then the take opens. **Start take 2**, and Again, give the count-in and the take,
     with Play Merc's phrase there before them for anyone who wants it again. With sound off, Start
     and Play Merc's phrase play nothing and ask for nothing, and the hint shows: "Sound is off, so
     nothing played. Turn sound on to hear Merc's phrase, then press Start." That is Lesson 1's
     rule, as Lessons 5 to 9 apply it: what waits on hearing a sound waits while the sound is off.
   - **A browser that can't record** (no `MediaRecorder`, or none of the app's formats,
     `pickRecorderMime`, `src/lib/voice-capture.ts:66-76`), known before the microphone is asked
     for: LESSON.md's "This browser can't record here: your takes are drawn, not recorded." shows
     under the "What this does" box, before Start (81), and the takes are drawn and not recorded.
6. **Take**: the status reads "Take 1: sing the phrase when you're ready, and follow the bands as
   they light." (take 2: "Take 2: breathe, then sing through to "star", and breathe after it."). The
   take waits up to 6 s for the first voiced frame, then runs until 1.2 s of quiet or 8 s from that
   frame (`takeFrames`, `kit/listen.ts:168-195`, with `wait: 6`, `run: 8` and `quiet: 1.2`,
   `:89-110`; 72), so the 0.3 s breath the phrase asks for never ends it. Before the voice starts,
   do's band glows; from the first voiced frame (`onFrame`'s `voicedAt`, `:106-107`), a playhead runs
   along the line at 80 beats a minute and each band lights as it passes: that is the guide, on the
   chart itself, so the page needs no ring or countdown beside it. The violet line draws live at the
   playhead, folded around the band under it (its cents from that band through `foldCents`,
   `src/lib/pitch-measurements/f0.ts:57-59`), with a small "octave lower" or "octave higher" tag
   while it sits within 50 cents of the band an octave away; a frame outside the window pins to the
   chart's edge with a small arrow and no number; where no voice is heard, the line has a gap. The
   singer's line carries no light and the chart draws no level for it, live or after: the page never
   measures or shows how loud the singer was, so whether "star" grew is the singer's to hear on
   playback (REQ-GVC-045; `src/lib/guided-voice/claims.ts`), and no level display is needed. For
   take 2 the chart shows the plan: the breath mark after "star", and "star"'s swell in faint light.
   Merc and Tavi both listen (`mercListen`, `kit/merc-duo.ts:206`). The recorder runs from the
   take's opening to its end. The microphone is released when the take ends, and nothing sounds
   while a take is open (`Sound.hush`, `kit/sound.ts`).
7. **The line**: one line under the chart, from the range reader (below), and the take's own line
   kept on the chart, take 1's faint once take 2 is drawn, each named at its end, "take 1" or "take
   2". If the take held under 1.5 s of voice, the line is "We didn't hear the phrase that time.",
   its recording is discarded at once, the same Start comes back while the visit has had fewer than
   three takes (this take counts), with **Done for today**, and no feeling question follows, since
   nothing was sung. Otherwise **How did that feel?** follows at once (REQ-GVC-022).
8. **How did that feel?**: Lesson 3's four answers (`aria-pressed`, at least 44 px, two a row on
   phones), through `mountFeelings` (`kit/comfort.ts:168-206`) with its default, an answer that
   locks, asked after each take with voice (73): a press disables all four, and `reset()` frees them
   for the next take. `mountFeelings` has a `changeable` option, for Lesson 6's sweeps (`:168-174`,
   `:178`), which this page leaves off.
   - Easy or Workable after take 1: LESSON.md's "Now take 2: breathe after "star", and let "star"
     swell." and **Start take 2**.
   - Easy or Workable after take 2: LESSON.md's playback prompt, "Two takes, one phrase. Play them
     back: where did each breathe? Did "star" grow and fade?", and the playback controls (below);
     then, if the visit's one Again is unused and fewer than three takes have been made, **Again**,
     which reads "Again: a new take 2", so it says what it does: it makes a new take 2, which takes
     the old take 2's place once it is heard (a take with no voice, or one abandoned, leaves the old
     take 2 as it was); and **Done for today**. The Wrap shows the practice card.
   - Effortful: no further take this visit; Lesson 3's "Keep it gentle: rest before you sing
     again."; the takes already made stay, with the playback controls (74), and **Done for today**.
     Move do and Start go. The Wrap shows the rest card, as Lessons 6, 7 and 9 specify: a report of
     effort suppresses immediate-repeat encouragement (REQ-GVC-021).
   - Uncomfortable: no further take; the line under the chart is taken away; then Lesson 3's "Thanks
     for saying so. That's enough singing for today: rest your voice." with the doctor lines; the
     takes stay, with the playback controls. The Wrap shows the rest card (REQ-GVC-023, REQ-GVC-024,
     REQ-GVC-055).
   - Once "Effortful" or "Uncomfortable" has been answered, no further take and the rest card stay
     so for the visit. The page keeps the ending in memory for the visit, never in storage
     (`VisitEnding`, `kit/comfort.ts:89-114`).
9. **Playback**: **Play your take 1** and **Play your take 2**, each reading "Stop your take 1"
   (or 2) while it plays; one seek bar for the take last played, a slider named "Position in take 1"
   (or 2), from 0 to its length, which moves the playhead along that take's line and never starts
   the sound (REQ-GVC-084, REQ-GVC-085); and **Delete your takes**, which discards both recordings
   and both lines (REQ-GVC-004), takes the playback controls away, and gives no new take. While a
   take plays, its line is drawn whole and a playhead runs along it, from 0.2 s before its first
   voiced frame. Merc celebrates nothing here: nothing is scored (75). After a browser that can't
   record, there is nothing to play: the prompt is LESSON.md's "Two takes, one phrase. Where did
   each breathe? Look for the gaps in your lines.", the two lines stay drawn, and **Delete your
   takes** clears them.
10. **No microphone** (refused, no device, or the listener failed to load): listen-only mode with
    LESSON.md's "No microphone?" line (80); Merc's phrase still plays, and the Wrap keeps the
    practice card, since singing along with nothing listening is no report of effort (Lesson 3's
    rule). Without Web Audio (no `AudioContext` in the browser), nothing can play and the listener
    cannot run, so Sing it offers this listen-only path at once, with no Start: Play Merc's phrase
    lights the bands in silence, with the hint "This browser can't play sound here."

The retry rules, all in the flow rule below (72):

- A visit allows at most three takes, every take counted: one with no voice, and one abandoned when
  the page was hidden.
- Take 2 follows take 1 only after "Easy" or "Workable"; Again, a second take 2, is offered at most
  once a visit, only after "Easy" or "Workable" on a take 2, and only while fewer than three takes
  have been made. So a visit sings at most three phrases.
- A take with no voice asks no feeling question; the same Start comes back while takes remain, and
  it leaves Again unused. A take abandoned when the page was hidden is discarded, asks no feeling
  question, and its Start comes back while takes remain.
- Never a take after "Effortful" or "Uncomfortable": once either has been answered, no Start and no
  Again appear for the rest of the visit, and the takes already made stay to be played back or
  deleted.
- No line invites another try, so no retry wording can show without a Start.

The flow is a pure rule (`lesson-14/phrase-flow.ts`), as Lessons 6, 7 and 9's are: from the comfort
answer, the voice, whether sound and Web Audio are on, whether the browser can record, Move do's
position, the takes so far (how many, and for each which take it was, whether it had voice and
whether it was abandoned), whether the visit's one Again has been used, whether the takes were
deleted, and the answers so far (the latest, and whether "Effortful" or "Uncomfortable" was ever
answered), it gives the state, the controls shown, the lines and the Wrap's card, so every branch
above is unit-tested without a microphone (Tests, 9).

Reading a take (`kit/take.ts`, extended with `readRange`, `rangeLine` and `NOT_HEARD_PHRASE_LINE`;
pure and unit-tested; 53):

- Input: the take's raw frames, the take's number, and Merc's do and la as MIDI notes (from do D3:
  50 and 59). A frame is voiced when Voice Mirror's `preprocess` keeps it, as `readTake` takes them
  (`kit/take.ts:125-147`).
- Under 1.5 s of voiced frames gives `{ heard: false }` and `NOT_HEARD_PHRASE_LINE`, "We didn't hear
  the phrase that time.", the kit's `NOT_STEADY_LINE` (`:64-65`) with "the phrase" for "a steady
  note" and without its "Try again at about speaking volume.", since the takes stop at three.
- Otherwise the 10th and the 90th percentiles of the voiced frames' pitch, each taken to its nearest
  note (`nearestNote`, `kit/band-words.ts:75`) and spelled in the app's sharps, give "Take 1, drawn
  over Merc's bands: your line ran from about D3 to B3.", or, when both are the same note, "Take 1,
  drawn over Merc's bands: your line stayed at about A3." The line names notes the recording held
  and nothing else (REQ-GVC-045): no count, no score, nothing about loudness, the breath or the
  swell.
- The octave line, as a second sentence, only when both notes, moved by the same whole number of
  octaves, are Merc's do and la: the kit's octave words in the plural, "You sang it an octave lower:
  same notes." (`octaveLine`, `kit/take.ts:107-113`, whose "two octaves" form carries over).
- Every template passes `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts`, surface
  `finding`) in a unit test, as Lesson 3's lines do (95).

Listening: Lesson 3's `kit/listen.ts`, with one addition: `micManager.acquire('lesson-14')` for the
take (`:59`), released when it ends, on leaving the section, on `pagehide` and when the tab is
hidden (`:18-22`); the YIN-only F0 stream (`src/lib/pitch-f0-stream.ts`); one AudioContext through
`Sound.context()`, so every note Merc sings and every frame the take hears share a clock; nothing
plays while a take is open. The addition is `Listener.media`, the stream the listener already holds
(`:58-59`), so the recorder can use it without asking for the microphone again (51).

Recording (`kit/record.ts`, proposed; 51, 52):

- Over the app's own recorder, `createTakeRecorder(listener.media)`
  (`src/lib/voice-capture.ts:78-82`), which never calls `getUserMedia` and never sends the audio
  away: `start()` when the take opens, `stop()` when it ends, giving the take's audio as a `Blob`,
  or null where nothing was captured (`:10-22`), and `discard()` for a take with no voice or one
  abandoned (`:164-170`).
- The `Blob` is decoded on the page's one AudioContext into an `AudioBuffer`, kept in memory beside
  the take's line and nowhere else: no storage, no IndexedDB, no `Cache`, no network, no analytics
  (REQ-GVC-003, REQ-GVC-090). It goes on Delete, when Again records a new take 2 in its place, and
  when the page is left, with the page.
- Playback plays that buffer once, from 0.2 s before the take's first voiced frame, through the
  page's one "now playing" owner (Audio), so any other sound stops it and it stops any other.
- Playback applies one gain to the whole take: the gain takes the take's peak to one set level, the
  same for every take, so a take sung quietly and one sung louder play back at the same peak, and it
  never changes during the take. Nothing compresses the take or sets its gain as it plays: it goes
  past the master bus's compressor (`kit/sound.ts:109-118`), and through no automatic gain, so a swell
  keeps its shape.
- The stream it records is the listener's, the mic manager's analysis stream, with the browser's
  echo cancellation, noise suppression and automatic gain control off (`ANALYSIS_CONSTRAINTS`,
  `src/lib/mic-manager.ts:48-57`; every stream opens with them, `:216-223`), so the swell recorded
  is the swell sung. That is why the page can ask "Did "star" grow and fade?" of a playback (51).
- A recording that cannot be decoded leaves its take drawn and not recorded: its Play is absent, and
  the can't-record line shows under the chart.
- The kit's listener says today that "Nothing is recorded or kept" (`listen.ts:18-22`); on this page
  that sentence is no longer true, so the record module carries its own header, and this page's
  "What this does" says what is kept and for how long (79).

Accessibility and motion: no state relies on colour alone (REQ-GVC-082): recording shows as the
status line's words and the take's name, the playback as its button's words. After a take the
chart's summary reads, for example, "Your take 1, drawn as a line over Merc's bands, from about D3
to B3. Gaps in the line are where we heard no voice." (REQ-GVC-085); the seek bar's `aria-valuetext`
names the second and the syllable under it, "2.4 seconds of 6.2: "lit-"". Start take 1, Start take
2, Again, Done for today, the comfort and voice buttons, Move do, the four feelings, the plays and
Delete are real buttons of at least 44 px in a keyboard order that follows the flow; a button the
flow does not offer is absent, not disabled, except Move do at its ends and the feelings once
answered, as the kit has them. Space never starts a take by itself (REQ-GVC-080). Space plays and
stops a take while its Play button or the seek bar has focus, and is not taken page-wide, where it
scrolls a long page: REQ-GVC-084 asks for Space outside editable controls on the app's Guided Check,
one screen, and this page keeps Space for scrolling (an owner's decision, in the report). Under
reduced motion the live line draws on a fixed frame that never scrolls, the guide's bands light
without a playhead, and Merc and Tavi skip their reactions (REQ-GVC-083).

### 5. Recall and quick check

The kit's quiz as it stands carries everything two quizzes on one page need (`kit/quiz.ts`): an id
`prefix` for each quiz's elements (`:88-93`), question ids, from which a question's lesson is read
(`:42-47`, `lessonOfQuestion` `:131-135`), an optional `lesson` (`:82-83`) and links that leave this
page for a question from another lesson (`linkAway`, `:186-216`), which keep their words and drop
the link where that lesson is not live (`:186-190`).

- **Recall**: Lesson 5's questions 2 and 4, word for word with their feedback (LESSON.md; 7), under
  their Lesson 5 ids, `l05-q2` and `l05-q4`, with the prefix `rc-`, as Lessons 3 and 5's recalls
  have (`lesson-05/recall.ts:17-22`), shown to everyone (Lesson 5 is a prerequisite). Reshuffled
  from a seed of its own (keys `fyp-l14-recall-seed` and `fyp-l14-recall-v1`, as Lessons 4 and 5's
  are, `lesson-04/main.ts:61`); earlier answers are never shown, so the answers measure delayed
  retrieval (MASTER-PLAN § 9). It takes no `lesson`, so it marks nothing done. Neither question
  plays a sound. The kit turns "Try Step 1 again" and "Try Step 5 again" into "Try Lesson 5, Step 1
  again" and "Try Lesson 5, Step 5 again", links that open Lesson 5's page at that step,
  `/learn/05#step-1` and `/learn/05#step-5` (its step ids, `learn/05.html:1052`, `:1269`), in a new
  tab so the viewer keeps their place here, never `data-goto-step`, which would move this page's own
  deck (`quiz.ts:186-216`); where Lesson 5 is not live, each keeps its words with no link
  (`:206-209`; Edge cases). The address is the quiz's `away.href` (`quiz.ts:94-101`), the kit's
  `recallStepHref` (`:141-143`) in place of the default `/learn/05#lesson`, and the kit's step deck
  opens at the step an address names (`kit/step-deck.ts:18-23`, `:292-300`).
- **Quick check**: LESSON.md's four questions, ids `l14-q1` to `l14-q4`, keys `fyp-l14-seed` and
  `fyp-l14-quiz-v1` (`lesson-04/main.ts:84`), and `lesson: 14`, so answering all four marks Lesson
  14 done in the explorer. Three answers each, shuffled per question from the stored seed, one-line
  feedback for every answer, and a check icon and ink (not gold) on the right one. The kit prints
  "Right." or "Not quite." before each line (`quiz.ts:315`), so no feedback line starts with
  "Right", "Yes" or "Correct". "Try Step 2 again", "Try Step 3 again" and "Try Step 4 again" use the
  kit's `data-goto-step`. LESSON.md's note on the shuffle is editorial and never printed. Answers
  stay local; #1193 sends each first answer in a visit, anonymously.

## Audio

Every tone is synthesised in the page with Web Audio at the frequencies in 82, through the kit's
sound module and its house envelopes (`.claude/memory/audio-pop-free-playback.md`), and started only
by a tap: Merc's takes, phrases and the song in Merc's "ooh"; the chords and the count-in in the
soft tone (83 to 90). A sung line is one voice from breath to breath, the kit's `contourVoice`
(`kit/sound.ts:314-347`), its level a share of Merc's 0.2 and its ramps exponential; a repeated note
dips to 0.6 of its level for about 0.06 s, never to silence, so two notes are heard as two within
one voice; a chord is three soft voices at 0.05 each, held for its minim (87). A breath is a 0.3 s
gap, not a sound, because the kit's noise cannot be stopped once started (84). The one recorded
sound is the singer's own take, played back (Toys 4). Nothing autoplays, nothing plays while a take
is open, and the page has no music bed.

One sound plays at a time, page-wide. Every source, the cold open, the Four words, the step toys,
Sing it's Merc, its warm-up, its count-in and the singer's own takes, takes the page's one "now
playing" owner before it sounds, and the owner stops whatever was sounding, so a new tap stops the
last, whichever control made it. Leaving a step stops its sound and anything it has queued, the rest
of the song, the second of two takes or a chord under a line, whatever the route: Previous or Next,
a swipe, the wide page's scroll, the lesson menu's jump, a `#step-N` address and a quick-check step
link all reach the deck's `show`, which calls each toy's `onStep(step, previous)`
(`kit/step-deck.ts:45-47`, `:140-181`), and the page stops the step's sound whenever `step` differs
from `previous`; a layout switch calls it with the same step (`:188-191`) and stops nothing. Leaving
Sing it's section, or the tab going hidden, stops a playing take as it releases the microphone. A
play cut short, by a new play, a stop, the Sound toggle or a hidden tab, never counts as heard: the
cold open's `play` resolves `false` for it, and the predict counts only a play that runs to its end
(Toys 2). Both rules' kit parts are on main, from Lesson 6's page (PR #1149): the owner is
`kit/now-playing.ts`'s `NowPlaying` (`:17-39`), which a source `claim`s with its own stop before it
sounds, so the owner stops the source before it, and `release`s when it ends, so a later claim never
stops it twice; and `kit/predict.ts`'s `play` may resolve `false` (`:30-41`), which the predict
takes as "not heard" (`:187-188`), while `true` or nothing means heard, as on the pages before
Lesson 6 (What the kit and the app still need, 10; unit tests 16 and 17). This page hands
`NowPlaying` to every source it mounts, as Lesson 6's page does: its cold open claims the owner
before it plays and resolves `false` when another sound cut it short
(`src/features/lessons/lesson-06/cold-open.ts:96-113`). The owner here covers a buffer as well as a
synthesised voice, since the singer's takes play through it.

## Merc and Tavi

Lesson 1's setup through the kit (`kit/merc-duo.ts`, `kit/merc-warm.ts`): the app's renderer loaded
after first paint, one WebGL context per Merc, medium quality on phones, turned towards each other,
paused off screen, and the still images when WebGL fails or would run on the CPU.

- They live in the hero, and their reactions are the hero pair's: the Merc of the chosen voice sings
  while Merc's notes sound (Merc for the lower voice, Tavi for the higher), and Tavi celebrates
  once at the cold open's reveal (no sparkles), the puzzled guesser who then gets it (playbook rule
  15). The same rule picks the singing Merc wherever Merc's notes sound.
- `kit/merc-duo.ts` has `mercSing`, `mercListen` and `mercCelebrate` (`:164`, `:206`, `:217`): Merc
  sings his phrase, and both listen during a take. Neither celebrates in Sing it, since nothing
  there is scored, and never after "Effortful" or "Uncomfortable" (75).
- Under reduced motion or Pause animations each Merc holds a still frame and skips the reactions.

## Practice links: what exists and what needs engineering

- **Today, Karaoke Night.** It is a document of its own on the web,
  `mercurypitch.com/karaoke-night`, free with its example songs, and outside what
  `PREMIUM_EXERCISES` gates (55). The card's link is `/karaoke-night?lesson=14`, the season entry's
  (57); Karaoke Night reads no marker and opens with no intro, so the card carries no first-visit
  line, and the marker rides along for the analytics of the lesson that sent the visit (56). It
  comes in two versions, picked by how Sing it ended (Toys 4); the rest card has no link (#1177).
  What the card says of the room is in 54, its own page's words: it draws every note against the
  note aimed at, plays the singer's own take back, scores the singing, which the card says, and its
  key chip and Find my key put a song in the comfortable middle. Its page boots Consent Mode and its
  cookie banner and counts one view a session (55): the owner's to accept for a link from a lesson
  (report).
- **Not linked**, with the reasons in FACTS: Dynamic Swell, whose card promised more of the breath
  than any fact here supports until #1192 and now says what it scores, whose score weighs the
  decibels sung, and which no address opens (58); the daily routines, whose copy promised breath
  support and range until #1192, and which live in the main app's sidebar (59); and Play Along,
  which opens on the songs a singer has brought and separated, nothing for most visitors (60). The
  CURRICULUM card's practise line named all three; it now says why only Karaoke Night is linked.
- **App content, small** (MASTER-PLAN § 7's App content track), proposed: Dynamic Swell's card copy,
  its tags and its score checked against the claims rules, as CURRICULUM § 4 item 8 does for the
  Ascent's weeks (`CURRICULUM.md:512-516`), so that a later lesson can link it: a swell scored by
  its width in decibels rewards a louder swell, which this lesson's "grow only to about speaking
  volume" would not, so its score would change or its result would say what it measures; and the two
  routines' descriptions, which promised gains in the breath and in range (59), the same way. Until
  then no lesson links them. The copy changed in #1192 (58, 59); the score did not.

## Explorer and season data

- **Season data**: Lesson 14's entry in `kit/season.ts` (`:396-410`) gains a plain `minutes: 18` and
  `page: '/learn/14'` after its topics, in every build, under the comment Lesson 5's entry carries,
  `// A draft until its sign-off (drafts.ts), as Lesson 3 is.` (`season.ts:250`), as Lesson 3's own
  are written (`season.ts:210-213`) and Lesson 6's (`:270-272`; 8, 12). Whether the page is live is
  `kit/publish.ts`'s to say: `seasonFor` draws a lesson held back as one coming later, with no page
  and no reading time (`:102-124`), so the entry reads neither `DRAFT_LESSONS` nor `DRAFTS_SHOWN`,
  which `kit/drafts.test.ts` keeps to the publishing rules alone (`:57-67`). Its link stays as it
  is, `href: '/karaoke-night?lesson=14'`, `addr: 'mercurypitch.com/karaoke-night'` and
  `label: 'Karaoke Night'` (`season.ts:403-409`), with no `needs`. Its topics stay; its hook is the
  entry's, the default (`:402`), and its tease, which Lesson 13's card draws, is
  `kit/lesson-copy.ts`'s (`:120`), with the old tease kept as `band` (`:121-126`) and the old hook,
  `compelling`, dropped by #1186, as 1 and 2 record. `EDGES` already holds [5, 14], [8, 14], [9,
  14] and [12, 14] (`season.ts:437-440`).
- **The explorer card**: what the kit draws for a lesson with a page and no published film: its
  state and main action from `kit/lesson-state.ts` ("Start lesson", "Continue: step N" or "Read
  again"), its hook, its topics, the lessons it builds on, its practise link and its minutes
  (`cardMarkup`, `kit/explorer.ts:208-251`), no Watch button (`kit/season.ts:23-25`), and the
  learner's fields only, which `src/e2e/learn-no-planning-text.spec.ts` holds every built lesson
  page to. One of its topics is S17, "Dynamics without pushing: messa di voce" (`season.ts:82`): it
  says a note can grow louder without a push, and not what its line does, so it hints at the reveal
  without answering it (6).

## What the kit and the app still need

Found in the kit and the app as they stand on main (22 October 2026, `32fd98c50`), Lesson 6's page
among them (PR #1149), and in Lesson 9's spec, beyond the parts Lessons 2 to 9 promote into the kit
(Toys table):

1. The lesson host: `learn/14.html` at `/learn/14`. Every build takes every `learn/NN.html` as an
   input and routes its clean path (`tools/draft-lessons.ts:1-18`; `lessonPages`, `:77-86`;
   `lessonInputs` and `lessonPaths`, `:109-122`; `vite.config.ts:319`, `:493`), so the page needs no
   build change. Its line in `kit/drafts.ts`,
   `14: "the vocal coach's sign-off (MASTER-PLAN § 12 item 8)"`, beside Lessons 3 to 8's
   (`:30-40`), makes it a draft: production's `LESSON_DRAFTS`, "0", holds it back, and the dev
   site's and the previews', "1", show it (`wrangler.jsonc:165-167`, `:188-190`, `:231-232`), until
   the console sets it either way, and the Content Studio's Lessons page names that reason when
   asked to publish it (11). `/learn/14` and `/learn/14.html` go in `STANDALONE_DOCUMENT_PATHS`
   (`src/lib/sw-runtime.ts:93`, the lessons `:131-157`), so the service worker never serves the app
   shell in the lesson's place. As a draft, `src/tests/lesson-pages.test.ts` holds the page to the
   draft checks (`:307-344`): in neither the sitemap nor llms.txt (`lesson-pages.test.ts:322-325`),
   linked from no entry document (`:327-337`), and its service-worker rule kept (`:339-343`). On
   release: delete the `drafts.ts` line, and add the page to `public/sitemap.xml` and to
   `public/llms.txt`'s Lessons list (`:66-80`), whose intro already allows a page with no episode
   (`:68-70`); until then the site worker adds the page to both only while it is published
   (`src/lesson-gate.ts:22-24`). Then `src/tests/lesson-pages.test.ts` holds the page to the release
   checks instead (`:277-305`): listed in the sitemap, llms.txt and the service worker
   (`lesson-pages.test.ts:282-290`), and linked from every generated entry document (`:292-304`) by
   its headline, which `tools/lesson-links.ts` writes and the test reads
   (`lesson-pages.test.ts:101-117`). Nothing writes `datePublished` at run time, so a published draft
   is served without one; it is set in the commit that deletes the page's `drafts.ts` line or in one
   straight after the console publishes it, whichever the owner picks, and indexing is asked for
   when the console publishes the page, not at a release (SEARCH.md § 3.2, 12).
2. The page's head, written in full from its first commit, since both tests read it while the page
   is a draft: `src/features/lessons/kit/lesson-copy.test.ts` reads every `learn/NN.html`, drafts
   included (`lesson-copy.test.ts:323-358`), and `src/tests/lesson-pages.test.ts` holds every lesson
   document, drafts included, to its head, its structured data, its breadcrumb, its share card and
   its legal links (`:139-275`). So Lesson 14 meets all of the checks below as a draft; its release
   adds only the listings and links of item 1 (`:277-305`). The hook's copies are the ones the site
   worker rewrites when the console picks another hook (`src/lesson-gate.ts:452-459`, `:573-602`);
   it never rewrites the title. Only the meta description and the Article's description, which
   repeat each other, may shorten the hook, and every other copy carries it whole. In Lesson 4's
   form (`learn/04.html:9-136`), with the default hook (13):
   - the title, "Phrasing in singing: breath, swell and shape | MercuryPitch" (59 characters, under
     the test's 60, `lesson-pages.test.ts:154-155`), SEARCH.md § 4's draft (`SEARCH.md:245`), and
     the h1, `h1.hook#hook`, the hook in its default wording (`lesson-copy.test.ts:323-332`; Hero);
   - the meta description, "If every note of a song is in tune, what is left to shape? Hear Merc
     sing one phrase twice, then sing it and listen back." (121 characters, inside the test's 81 to
     160, `lesson-pages.test.ts:156-159`, and 153 with `compelling`, since dropped);
   - `og:title` and `twitter:title`, "Phrasing: sing a whole song · Find Your Pitch, Lesson 14",
     hold the headline, as the title did until #1187 (`lesson-pages.test.ts:184-188`);
   - `og:description`, the full hook and one line, "If every note of a song is in tune, what is left
     to shape? Hear one phrase sung twice, then sing it yourself." (109 characters; 141 with
     `compelling`, since dropped; `lesson-copy.test.ts:349-352`), and `twitter:description`, the
     hook exactly (`:353-355`);
   - canonical and `og:url` `https://mercurypitch.com/learn/14`, `robots` "index, follow,
     max-image-preview:large" and `twitter:card` "summary_large_image"
     (`lesson-pages.test.ts:143-161`);
   - `og:image` and `twitter:image`, `https://mercurypitch.com/learn/lesson-14-og.jpg` (item 3),
     with `og:image:width` 1200 and `og:image:height` 630, and as `og:image:alt` and
     `twitter:image:alt` "The title card: Find Your Pitch, Lesson 14, Phrasing: sing a whole song,
     above the first line of "Twinkle, Twinkle, Little Star" as seven amber bands with its words,
     between Merc and Tavi." (`learn/04.html:34-43`, `:53-60`), which the test holds to
     the file (`lesson-pages.test.ts:227-246`; item 3);
   - the Article node, in the head's first `application/ld+json` script and as a single object,
     since the test reads `alternativeHeadline` there and checks it only when present
     (`lesson-copy.test.ts:338-346`, `:356`), and the other test asks for the Article first
     (`lesson-pages.test.ts:169-171`): `@id` `https://mercurypitch.com/learn/14#lesson` and `url`
     `https://mercurypitch.com/learn/14` (`:173-174`); the headline "Phrasing: sing a whole song";
     `alternativeHeadline`, the hook exactly; `description`, the meta description's words, and
     `image`, the `og:image` URL (`:182-183`); `position: 14`, `learningResourceType` "Lesson",
     free, the series as `isPartOf`, and the organization as author and publisher (`:175-180`), with
     `timeRequired` "PT18M" and `teaches` "Where to breathe in a song: at a phrase's end", "Legato:
     singing smoothly through a phrase", "The swell, or messa di voce: one note, louder, then
     softer", "How a phrase ends: perfect and imperfect cadences" and "Recording yourself and
     listening back", none of which says what a swell does to the line, as in Lesson 4's
     (`learn/04.html:69-111`). It has no `datePublished` (item 1);
   - a BreadcrumbList from the home page to the headline (`lesson-pages.test.ts:212-225`;
     `learn/04.html:112-136`); and the legal links, privacy, terms and imprint, in a `nav` labelled
     "Legal" (`lesson-pages.test.ts:263-274`).
   - Before #1186 dropped `compelling`, picking it wrote it into every copy of the hook: every
     description stayed between 80 and 160 characters with either hook (13).
3. The share image the head names, `public/learn/lesson-14-og.jpg`, which
   `src/tests/lesson-pages.test.ts` checks on every lesson document, drafts included, so from the
   page's first commit (`:227-246`): `og:image` is
   `https://mercurypitch.com/learn/lesson-14-og.jpg`, the file is in `public/`, its pixel size, read
   from the JPEG's frame header (`:41-56`), is what `og:image:width` and `og:image:height` say,
   `og:image:alt` is not empty, and `twitter:image` and `twitter:image:alt` repeat the two. It is
   1200 x 630, the size `og:image:width` and `og:image:height` give, a baseline JPEG as Lesson 4's
   card is (`public/learn/lesson-04-og.jpg`), drawn with the page's own kit so that it looks like
   the page it opens: the title, Lesson 14 and the wordmark over line 1 of the song line, seven
   amber bands with Merc's steady line through each and the words under them, between Merc and
   Tavi. It shows no swell, no light and no breath mark, so it does not answer the cold
   open's predict.
4. First-paint ceilings for `learn/14.html` in `scripts/assert-first-paint-budgets.mjs`, one in its
   JavaScript table and one in its stylesheet table, beside Lessons 3 and 6's (`:103-151`,
   `:189-197`; `:310-313`, `:323-327`). Every build emits every lesson page, and the check fails a
   document with no ceiling (`:580-584`), so without them the Browser jobs fail before any spec
   runs, as Lesson 6's did on PR #1149. Each is the page's measured first paint plus about a
   quarter, the tables' rule (`:47-58`, `:266-276`), measured in `build:e2e`, where the check runs
   (`package.json:20`), as Lesson 6's entry warns, since a build of one page alone weighs it lighter
   (`assert-first-paint-budgets.mjs:194-196`). As on Lesson 3, the listener, the pitch detector and
   Voice Mirror's scorer arrive through a dynamic import when Start is pressed
   (`scripts/assert-first-paint-budgets.mjs:107-111`), and the record module and the app's recorder
   with them, so the ceiling holds only while that boundary does.
5. `kit/band-chart.ts` and `kit/band-chart-draw.ts`, the song line's parts (Toys 1): Lesson 9's
   rungs over time slots and its rung names, which this page uses as sequence mode and names by
   syllable (Lesson 9 WEB-SPEC, What the kit and the app still need, 5; if Lesson 9's page has not
   brought them, this one does); the words strip, its syllables centred under their notes at 11 px;
   the chord strip; breath marks, the slide guide's tick and word (`kit/slide-guide.ts`: `breathAt`,
   `:324-336`; `drawBreaths`, `:338-363`), moved into a drawing both charts share; the light along a
   band, from a level curve, kept once sounded; and Step 3's two windows over one band. The existing
   single band is the case with none of these, so Lessons 3, 5 and 9's figures see no change; a unit
   test proves it.
6. `kit/twinkle.ts`, proposed: the whole first verse as data, six lines of `MelodyNote` (degree,
   beats, syllable) in the form Lesson 6's `lesson-06/melody.ts` keeps its first two lines
   (`MelodyNote`, `:21-29`; `TWINKLE`, `:37-61`), with each syllable's printed form ("Twin-",
   "kle,"), the page's chords and the five breath marks, so the tune is written once and Lesson 6's
   page reads its two lines from the kit.
7. `kit/record.ts` and `Listener.media` (Toys 4, Recording), proposed: the first kit module that
   keeps audio, in memory only. `kit/take.ts`: `readRange`, `rangeLine` and `NOT_HEARD_PHRASE_LINE`
   (Toys 4), beside `readTake`.
8. The singer's playback on the page-wide "now playing" owner (Audio, item 10): `NowPlaying` takes
   any source's own stop, so a decoded buffer claims it as a synthesised voice does, and stops and
   is stopped like any other sound. No kit change, only the wiring in `kit/record.ts`.
9. `kit/comfort.ts`: an option that sends "Effortful" to the rest card,
   `afterFeeling(f, { restAfterEffort: true })`, as Lesson 9's spec proposes (What the kit and the
   app still need, 8, there), since `afterFeeling` leaves it to the coach (`:69-78`) and Lessons 6,
   7, 9 and 14 all choose it. Built by #1192: Lesson 6's page, which sent effort there in its own
   flow, now passes it (`lesson-06/sing-flow.ts:18-20`, `:89-98`), and so will this page.
10. The two sound rules (Audio), wired through the kit parts on main since PR #1149:
    `kit/predict.ts`'s `play` may resolve `false` for a play cut short, which the predict then never
    counts as heard (`:30-41`, `:187-188`), while `true` or nothing means heard; and
    `kit/now-playing.ts`, the page-wide owner, `NowPlaying` (`:17-39`), which every source `claim`s
    with its own stop before it sounds and `release`s when it ends. No kit change: only this page's
    wiring.
11. Move do and the count-in as kit parts, built by #1192, which moved them from Lesson 4's page
    into `kit/move-do.ts` as Lesson 9's spec proposed (What the kit and the app still need, 10,
    there): Move do word for word (`kit/move-do.ts:26-27`, `:38-49`), and Lesson 4's count-in
    (`countIn`, `:65-67`, `:69-74`), which this page plays before every take.
12. `kit/next-card.ts`: a close that knows Sing it's ending, required before this page is built, the
    lead's decision (21 October 2026), so the page waits for it, as it did for item 11. After
    "Effortful", "Uncomfortable" or "Just listen today", the card keeps "You've seen every note you
    sing." and "See the season map", and drops "Now sing a whole song." and its Karaoke Night
    button, which the rules suppress after such an ending (REQ-GVC-021, REQ-GVC-023, REQ-GVC-055;
    78). The kit draws the close once (`next-card.ts:190-193`), so either `createNextCard` redraws
    it when the visit's ending changes, or the page draws it once Sing it has ended. `SEASON_END`
    would gain the shorter line beside its own (`lesson-copy.ts:135-141`), kept free of the team's
    words as the test asks (`lesson-copy.test.ts:249-257`). Its unit test and End to end 11 check it
    (Tests), and so does Page QA.
13. A stoppable noise (84), proposed: `playNoise` returns nothing to stop (`kit/sound.ts:439-473`),
    so a page cannot cut an in-breath when the viewer leaves a step. Until it returns a voice like
    every other sound, a breath is a gap, as here.
14. The four-words strip, built: promoted from Lesson 1's page (`lesson-01/words.ts`) into
    `kit/words-strip.ts` with Lesson 7's page. `recallStepHref`, built too: Lesson 8's page moved it
    into the kit's quiz (`kit/quiz.ts:141-143`), beside `lessonPageHref` (`:137-139`), so Lessons 9
    and 14 take it from there.
15. The hook and the tease: done in this package (1, 2).
16. `src/e2e/helpers/tone-wav.ts`: Lesson 9's `writeStepsWav(steps, leadSilence)`, built (`:156`),
    steady tones in sequence after a stretch of silence, beside `writeToneWav` (`:76`), a step of
    `hz` 0 a rest, here for the phrase with take 2's breath, D3 D3 A3 A3 B3 B3 at 0.75 s, A3 for
    1.2 s and 0.3 s of silence (Tests, end to end 6).
17. App: Dynamic Swell's score (Practice links); its copy and the routines' were done in #1192.

Lesson 6's page also brought kit parts this page does not use: the ear game (`kit/ear-game.ts`) and
the tune line (`kit/tune-line.ts`, with its layout, drawing and motion modules), whose beads draw a
tune's notes and the gaps between them, Lesson 6's subject; this page's subject is a phrase's
breaths and swell against Merc's bands, which the band chart already draws.

Already on main, so this page needs nothing more from them: run-time publishing (`kit/publish.ts`,
`kit/page-state.ts`, `src/lesson-gate.ts`), which settles the page's chips, its recall's step links
and its closing card for the state it is served with; the kit's stage fit (`kit/stage-fit.ts`), the
lesson menu and the remembered steps (`kit/lesson-menu.ts`, `kit/position.ts`), the generated card
that closes the season (`kit/next-card.ts`, its words from `kit/lesson-copy.ts`), the step deck that
opens at a step an address names (`kit/step-deck.ts`), Watch only with a published film
(`kit/season.ts:23-25`), learner-only explorer cards, the kit's spelling of a major key
(`majorScale`, `kit/major-scale.ts:43-45`), the warm-up (`kit/warm-up.ts`), Lesson 5's level strip
(`kit/band-chart-hold.ts`), the page-wide sound owner and the predict's `play` that may resolve
`false` (item 10), the slide guide's breath marks (`kit/slide-guide.ts`), and the app's take
recorder (`src/lib/voice-capture.ts`). Released lessons need no edit when this page goes live, since
every lesson page draws the season as its state shows it (`kit/page-state.ts:54-57`).

## Edge cases

What the page does where nothing above says:

- **No stored voice**: the steps' chart sings in the lower voice; Sing it asks after the comfort
  check, before anything plays. A `fyp-voice` holding anything but the two stored values counts as
  none and is overwritten only by a choice.
- **No storage** (blocked, private mode, or a read that throws): every read and write is inside
  try/catch; the page works, asking the voice each visit, reseeding the quizzes and forgetting the
  warm-up's Skip. Nothing of the takes was ever stored, so nothing changes for them.
- **Sound off**: each play button draws what it would play and shows the kit's hint; in the cold
  open, Play take 1 before a choice draws take 1 and shows `silent`, "Sound is off, so nothing
  played. Turn sound on, then play it again.", in place of the lock hint, while Play take 2 stays
  locked; the cold open's reveal waits for take 2 to be heard with sound on (Toys 2); Start and Play
  Merc's phrase show state 5's hint and ask for no microphone; a take's playback plays nothing and
  shows "Sound is off, so nothing played. Turn sound on to hear your take."
- **Sound off before a choice, then on again, still before a choice**: take 1 with sound off shows
  `silent`; take 1 again with sound on puts back the lock hint, "Choose an answer to unlock Play
  take 2.", exactly as the page wrote it, and take 2 stays locked (Toys 2; the kit's
  `predict.test.ts:240-264`; End to end 2).
- **Take 2 cut short**, by another source taking the page's "now playing" owner, by the Sound toggle
  going off or by the tab going hidden: the page's `play` resolves `false`, so nothing is revealed
  and the hint stays as it was: `chosen`, or `silent` if the play before it was silent, whose "play
  it again" still holds now that sound is on; take 2 played to its end afterwards reveals as usual
  (Toys
  2; unit test 17 covers all three causes, the kit's `predict.test.ts:198-221` the result; End to
  end 2 the first).
- **No Web Audio**: every play button draws in silence with the hint "This browser can't play sound
  here.", so the cold open's reveal cannot come, as on every page that uses the kit's predict; Sing
  it offers the listen-only path of state 10 at once, with no Start; the Wrap keeps the practice
  card.
- **No microphone, a refusal, or a listener that fails to load**: state 10 of Toys 4.
- **A browser that can't record, or a recording that will not decode**: the takes are drawn and not
  recorded (Toys 4, states 5 and 9); everything else is the same.
- **The tab hidden, or the section left, during a take**: the take is abandoned, its recording
  discarded and the microphone released; no line and no feeling question follow; the take counts
  towards the three (Toys 4, the retry rules).
- **The tab hidden, or the section left, during playback**: the playback stops; the takes stay until
  Delete or until the page is left.
- **Leaving the page** (`pagehide`), or reloading it: the microphone is released and the recordings
  go with the page; a return starts a new visit with no takes.
- **A singer who starts late, or sings a little fast or slow**: the guide starts at the first voiced
  frame, so the playhead follows the singer's start; a phrase sung faster or slower than the guide
  draws where it was sung, and the line reads only the range of notes, so no timing is judged.
- **A singer who keeps going past the phrase**: the take ends 8 s after the first voiced frame, and
  the range reads what was sung, which may run past la.
- **A breath longer than 1.2 s, or a stop mid-phrase**: the take ends there, and the line reads what
  was sung.
- **One note held for the whole take**: the line reads "your line stayed at about A3." (or that
  note), with no octave line unless the note is Merc's do and la an octave away, which one note
  cannot be.
- **A phrase sung an octave away**: the line names the notes as sung and adds the octave line where
  it applies (Toys 4); the live line shows it folded around each band with its tag.
- **A voice outside the window**: the line pins to the edge with an arrow; the range comes from the
  frames, and the window does not move.
- **Octave jumps from the detector**: Voice Mirror's `preprocess` and the percentiles keep a short
  jump from deciding the range.
- **Three takes used**: Start and Again are gone; the playback controls and Done for today remain.
- **Delete, then Again**: Delete adds no take; Again still shows while it is unused and fewer than
  three takes have been made, after "Easy" or "Workable" on a take 2; it then draws take 2 alone,
  since take 1 is gone.
- **Move do between takes**: each take is drawn against the bands it was sung to; the line names
  notes, which a move does not change.
- **Move do at an end**: that button is disabled, as Lesson 4's is, and the chart's summary says
  where do is.
- **No WebGL, or a slow device**: Merc and Tavi's stills (`kit/merc-warm.ts`).
- **Lesson 5 never marked done**: the recall still shows, as a prerequisite's does.
- **Lesson 14 published while Lesson 5, 8, 9 or 12 is held back**: nothing stops it. The console
  asks first, but the publish order is a rule for whoever uses it (the intro), so the page follows
  the state it is served with. The site worker, and then the masthead's `followPageState`, make
  every link to a
  lesson that is not live no link (`src/lesson-gate.ts:523-533`, `:547-567`;
  `kit/page-state.ts:64-108`, called by `initMasthead`, `kit/page-chrome.ts:126`): each "After
  Lesson N" chip for such a lesson stays as a plain chip, and any other link keeps its words. The
  kit's quiz does the same for the recall's step links, which keep their words, "Try Lesson 5, Step
  1 again", with no link (`kit/quiz.ts:186-216`). Step 4's "as in Lesson 12" names a lesson that may
  not be live, and is not a link. End to end 14 holds it.
- **The season's close after a rest ending**: after "Effortful", "Uncomfortable" or "Just listen
  today" it keeps "You've seen every note you sing." and "See the season map", and shows neither
  "Now sing a whole song." nor its Karaoke Night button (Sections, 8; What the kit and the app still
  need, 12; unit test 18; End to end 11).
- **Reduced motion**: Look, Toys 1 and Toys 4 give the end states; nothing moves on its own.

## Tests

Unit tests (vitest) on the page's pure helpers in `src/features/lessons/lesson-14/` and the new kit
parts:

1. The song (`kit/twinkle.ts`): 42 notes in six lines of seven, each line eight beats ending on its
   only minim (17, 25); the degrees do do so so la la so, fa fa mi mi re re do, so so fa fa mi mi re
   twice, then the first two lines again, never ti (18); the syllables in order, with "Twin-" and
   "kle," printed as the score joins them; the chords per line (43), every melody note a note of the
   chord under it; Lesson 6's first two lines read from it unchanged.
2. Spelling: at every Move do position, for both voices, the notes equal `majorScale(do)` at degrees
   1 to 6, with no double sign and no E♯, B♯, C♭ or F♭; from D they read D, E, F♯, G, A, B; every
   accessible name says "sharp" or "flat" and holds no sign (70, 18).
3. Move do: four each way and no further, each end's button disabled; the phrase at every position
   from the default sits inside every preset of its voice, and its margins at the default are those
   of 69, checked against `VOCAL_RANGES` imported from `src/stores/settings-store.ts`.
4. Merc's takes (83, 31): both 6.0 s on the beat; take 1 one voice to 4.2 s, a 0.3 s gap, "star"
   from 4.5 to 6.0 s at level 1; take 2 one voice to 5.7 s, "star" from 4.5 s at 0.5, 1.0 at 5.1 s
   and 0.5 at 5.7 s, then a 0.3 s gap; the swell never above the line's own level; each repeated
   note dips to 0.6 for 0.06 s, never to silence; each note holds its pitch and moves to the next in
   0.05 s.
5. The song, Step 3 and Step 4 (85, 86, 87): the verse is 36.0 s with gaps at 5.7, 11.7, 17.7, 23.7
   and 29.7 s and none after the last line, and a line alone 6.0 s; the swell is level 0.5 for a
   second, 1.0 at 2.5 s and 0.5 at 4.0 s, its pitch in from 40 cents low by 0.5 s, then the band's
   centre; the push equals Lesson 5's `takeContour('pushed', so)`; both peak 6 dB over their start;
   each chord's three notes at 0.05, 0.15 together, under Merc's 0.2; the count-in is Lesson 4's
   (89).
6. Every fixed sound's frequency equals `hz(m)` for the notes of 82.
7. The song line's drawing: a scene with none of the new parts paints exactly as today's band chart
   (Lessons 3, 5 and 9 unchanged); each band lands over its note's time; at 344 and 390 px every
   syllable clears its neighbour by at least 2 px and the first reaches at most 8 px into the gutter
   (91); a breath mark sits at its time, its word kept inside the plot, and the song view's marks
   carry no word; a band's light follows the level curve it is given and stays once sounded; take
   2's "star" holds its swell in light after the take; Step 3's two windows and Step 4's chord strip
   land where their times say; every window holds every note its state plays.
8. The range reader (Toys 4), on synthetic frames at the detector's 16 ms hop (`DEFAULT_HOP_SEC`,
   `src/lib/pitch-measurements/f0.ts:35`): line 1 sung on pitch from D3 reads "Take 1, drawn over
   Merc's bands: your line ran from about D3 to B3." with no octave line; the same an octave lower
   reads "… from about D2 to B2." and "You sang it an octave lower: same notes."; two octaves higher
   reads "You sang it two octaves higher: same notes."; a steady A3 for 6.0 s reads "… your line
   stayed at about A3."; D2 to A2 reads its range and no octave line; 1.4 s of voice gives
   `{ heard: false }` and "We didn't hear the phrase that time."; a take with a 0.3 s gap after
   "star" reads as one without it, since the reader reads no breath; changing only the take's
   loudness changes no line; no line holds "Try again", "Listen again", a count or a score.
9. The Sing it flow (`lesson-14/phrase-flow.ts`, Toys 4): with no stored voice the voice choice
   comes before either path, and a stored voice starts pressed and can be changed; "Just listen
   today" shows no Start and picks the rest card; with sound off Start asks for nothing and shows
   the hint; without Web Audio, Sing it is listen-only with no Start; a browser that can't record
   shows its line before Start and offers no Play after take 2; a take with no voice brings no
   feeling question and offers the same Start while fewer than three takes have been made, leaving
   Again unused; take 2 follows only "Easy" or "Workable" on take 1; Again is offered once a visit,
   only after "Easy" or "Workable" on a take 2, and replaces take 2; an abandoned take counts and is
   discarded; a walk over every sequence of take outcomes and answers never reaches a fourth take,
   never offers Again twice, and never shows Start or Again after "Effortful" or "Uncomfortable";
   "Effortful" and "Uncomfortable" end the singing for the visit, keep the takes with their
   playback, and pick the rest card; "Uncomfortable" takes the line away; Delete removes the
   recordings and lines and adds no take; the feelings lock once answered and free again only for
   the next take; nothing is written to storage but `fyp-voice` and `fyp-l14-warmup`.
10. Recording (`kit/record.ts`), with a fake `MediaRecorder` and a spied AudioContext: it starts
    when the take opens and stops when it ends; a take with no voice, or abandoned, is discarded and
    keeps no buffer; Again replaces take 2's buffer; Delete drops both; `localStorage`,
    `indexedDB.open`, `caches.open`, `fetch`, `navigator.sendBeacon` and `XMLHttpRequest` are never
    called with a take, and no storage key but the Contract's is written; playback starts through
    the "now playing" owner, from 0.2 s before the first voiced frame, a new sound stops it, and
    seeking never starts it; two takes recorded at different levels play back with the same peak,
    and one take's own changes in level are kept, so a take that grows 6 dB louder in its middle
    plays back 6 dB louder there, through one gain for the whole take and no compressor (51).
11. Copy: every line of LESSON.md's page copy and every template in Toys 1, 2 and 4 passes
    `validateGuidedDynamicClaim` (surface `finding`); no quiz feedback line starts with "Right",
    "Yes" or "Correct"; no accessible name or live text holds a ♯ or ♭ sign; no two controls on a
    stage share an accessible name; and no learner text holds a word of
    `learn-no-planning-text.spec.ts`'s list.
12. The predict, on this page's markup and hints (Toys 2): the choice locks on the first press;
    before it only Play take 1 plays; after it, the reveal stays hidden until take 2 has been heard
    with sound on, and a silent play shows the `silent` hint; take 1 never reveals; the reveal's
    line for "It rises" is "You said: it rises", and no hint or line holds "right" or "wrong"; with
    sound off, Play take 1 before a choice shows `silent`, which names no take, and Play take 2
    stays disabled; take 1 then heard with sound on, still before a choice, puts back "Choose an
    answer to unlock Play take 2." as the markup has it; after a choice, take 1 heard shows
    `chosen`, in place of `silent` too; and once the reveal shows, a play of either take, with sound
    on or off, leaves `again` as it is, which no kit test checks.
13. Quizzes: the recall's ids are `l05-q2` and `l05-q4`, it takes no `lesson`, and its two step
    links are `/learn/05#step-1` and `/learn/05#step-5`; the quick check's ids are `l14-q1` to
    `l14-q4`, with `lesson: 14`.
14. Season data: Lesson 14's entry has `minutes: 18` and `page: '/learn/14'` in every build,
    whichever way `VITE_DRAFT_LESSONS` reads, as `season.test.ts` checks Lessons 3 to 5's
    (`:241-266`), and the same file's check of every page in the repository then covers it
    (`:322-339`); `seasonFor(LESSONS, defaultPageState(false))` gives Lesson 14 no page and no
    reading time while its line is in `drafts.ts`, and `seasonFor(LESSONS, defaultPageState(true))`
    keeps both, as `publish.test.ts` checks a lesson held back and one published (`:58-135`); that
    file's example of a lesson with no page is found, not named (`:45-56`). When the season's last
    page lands, Lesson 14's in the order `docs/plans/find-your-pitch/HANDOFF.md:220` suggests,
    `lessonWithNoPage` (`kit/season.test-fixtures.ts:22-36`) finds none, and each test that asks it
    for an example fails by saying so. Lesson 14's practise link carries `?lesson=14`, and `EDGES`
    holds [5, 14], [8, 14], [9, 14] and [12, 14].
15. The kit's new option (What the kit and the app still need, 9), if this page lands it:
    `afterFeeling('effortful', { restAfterEffort: true })` is today's answer to "Effortful" with
    `rest: true`; every other answer with the option, and all four without it, give what
    `afterFeeling(f)` gives today (`kit/comfort.ts:56-87`), so Lessons 3 and 5 see no change.
16. One sound at a time, and leaving a step (Audio), with fake timers and a spy on the kit's sound:
    starting any source while another sounds stops the first (a Four words play over Step 1's song;
    Merc's phrase over a singer's take in playback); with Step 1's song sounding, a step change by
    each route, Previous, Next, a swipe, the lesson menu's jump, a `#step-N` address and a
    quick-check step link, stops it, and running the clock past its end starts no note; a layout
    switch, `onStep` with the same step, stops nothing.
17. A play cut short never counts as heard (Audio; Toys 2): the cold open's `play` resolves `false`
    when take 2 is stopped before its end, by another source claiming the owner, by the Sound toggle
    going off or by the tab going hidden, and never when it runs out; take 2 cut short leaves the
    reveal hidden, and take 2 played to its end shows it, as the kit's test of a play that resolves
    `false` does (`predict.test.ts:198-221`); a take 2 cut short leaves the hint as it was.
18. The season's close: `createNextCard(14)` on the page's mark draws "End of Season 1", the line,
    Karaoke Night at `/karaoke-night?lesson=14` with `target="_blank"` and `rel="noopener"`, and
    "See the season map" at `#explorer`, and keeps the still after its words, as `next-card.test.ts`
    checks the kit (`:348-379`); and after each of the three rest endings, "Effortful",
    "Uncomfortable" and "Just listen today", the close keeps "End of Season 1", "You've seen every
    note you sing." and "See the season map", and shows neither "Now sing a whole song." nor its
    Karaoke Night button, while every other ending keeps both.
19. The hook and the tease: the h1 and the head's copies of the hook carry the default, "If every
    note of a song is in tune, what is left to shape?", and `hookFor` and `teaseFor` resolve `band`
    to the old wording and `compelling`, which #1186 dropped, to the default (1, 2).

End to end (Playwright, at 390 x 844 and 1440 x 900, on the e2e build, which shows drafts):

1. No AudioContext before the first tap; nothing plays before a play button.
2. Cold open: Play take 1 plays before a choice; Play take 2 stays disabled until a choice; the
   reveal appears only after take 2 has played to its end with sound on; with sound off, the hint
   shows and no reveal comes; and a take 2 cut short, by the Four words' Swell played over it,
   brings no reveal until it plays to its end (unit test 17). Before a choice, Play take 1 with
   sound off shows "Sound is off, so nothing played. Turn sound on, then play it again."; with sound
   turned on, Play take 1 again puts back "Choose an answer to unlock Play take 2.", and Play take 2
   is still disabled.
3. The song line by keyboard alone: Tab reaches every control; Step 5's scrub bar moves by arrows,
   and Home and End jump; every play reads "Stop" while it sounds; every announcement uses spoken
   names.
4. At 390 x 844 and at 344 px wide, every target measures at least 44 x 44 px, none overlap and
   nothing scrolls sideways.
5. The stage fits short landscape screens: `src/e2e/learn-stage-fit.spec.ts` holds this page to it
   once it is built, as it holds every lesson page, all of which every build carries (`:31-32`), at
   1024 x 640, 1133 x 631, 1280 x 680 and 1366 x 657 and on a phone held sideways (91);
   `src/e2e/learn-no-planning-text.spec.ts` reads it for the team's planning words and every
   variant's note the same way, and `src/e2e/learn-cold-open-fold.spec.ts` holds its title on the
   first screen at seven sizes and reports where Play take 1 and the two choices sit (`:176-203`).
6. Sing it, with the fake microphone (`src/e2e/helpers/tone-wav.ts`, `fakeMicArgs`, `:198`): with
   sound off, Start asks for no microphone and the hint says sound is off; with sound on, a steady
   A3 (`writeToneWav(220)`) reads "Take 1, drawn over Merc's bands: your line stayed at about A3.";
   "Easy" offers Start take 2; after take 2 and "Easy", Play your take 1 and Play your take 2 each
   start a buffer (a spy on `AudioBufferSourceNode.prototype.start`), the seek bar moves without
   starting one, and Delete your takes removes both and the controls. With `writeStepsWav`
   (built, Lesson 9's), the phrase with its breath reads "… from about D3 to B3."; if the fake
   device's start cannot be pinned, the unit tests carry the readings. "Effortful" shows the gentle line, no Start,
   the takes' playback, and the rest card in the Wrap. "Uncomfortable" shows the doctor lines, no
   line under the chart, the takes' playback, and the rest card. "Just listen today" never calls
   `navigator.mediaDevices.getUserMedia` (a spy), shows the doctor lines and leaves the rest card. A
   refused permission shows the no-microphone line and keeps the practice card. With `MediaRecorder`
   removed by an init script, the can't-record line shows before Start, and after take 2 the lines
   are drawn and no Play shows.
7. The microphone's tracks stop at the end of each take, on leaving the section and when the tab is
   hidden (a spy on `MediaStreamTrack.stop`).
8. Nothing leaves the device: from Start take 1 to Done for today, no request carries a body, and
   none goes anywhere but the page's own origin for its own assets (a request spy); after a full run
   no IndexedDB database exists and storage holds only the Contract's keys.
9. The recall shows with an empty `fyp-done`, and answering both its questions marks nothing done;
   its step links are `<a href="/learn/05#step-1" target="_blank">` and
   `<a href="/learn/05#step-5" target="_blank">`; answering all four quick-check questions marks
   Lesson 14 done in the explorer; each feedback line starts "Right." or "Not quite.".
10. Every practice link and the closing card's Karaoke Night carry `?lesson=14` and open a tab of
    their own; `/karaoke-night?lesson=14` opens the room with no intro.
11. The Wrap ends on the season's close: on `/learn/14` the card reads "End of Season 1" and the
    line, holds the two links and keeps its figure after its words;
    `src/e2e/learn-next-card.spec.ts`, which today leaves the close to `next-card.test.ts` because
    the finale has no page (`src/e2e/learn-next-card.spec.ts:16-17`), gains this check. After
    "Uncomfortable" and after "Effortful", each reached with the fake microphone as End to end 6
    reaches them, and after "Just listen today", the card keeps "You've seen every note you sing."
    and "See the season map", and shows neither "Now sing a whole song." nor a link to
    `/karaoke-night?lesson=14`.
12. With reduced motion emulated, a take's bands light in place with no playhead, a line draws
    whole, and nothing moves on its own.
13. After a full run, storage holds only the keys in the Contract.
14. Published out of order (Edge cases), built like `src/e2e/learn-publish-state.spec.ts`, whose
    `serveWith` writes a state into the page's head as the site worker does (`:31-60`). Served by
    `serveWith(page, '/learn/14', state)` with the state
    `{ drafts: false, lessons: { 14: { published: true }, 5: { published: false } } }`, the page
    keeps "After Lesson 5: Steady note" as a plain chip (`ul.meta .chip` with that text counts 1 and
    has no `href`) and links `/learn/05` nowhere (`a[href^="/learn/05"]` counts 0), as that spec
    checks Lesson 4's chip for Lesson 2 (`:106-126`); the recall's answer "It gets steadier" shows
    "Try Lesson 5, Step 1 again" in its feedback with no link.

## Contract

Lesson 1's contract, and what its page on the app changed from the preview (Lesson 1 WEB-SPEC, "On
the app"), unchanged and binding: no CDN, self-hosted fonts, Web Animations in place of GSAP, and
practice links that carry `?lesson=14`. Then the layout, accessibility, sound, motion and storage
rules: 16 px side gutters, no sideways scroll at 390 px, `min-width: 0` on text children, touch
targets of at least 44 px with no two tap zones overlapping, visible focus, a single dark theme with
every colour a token and an explicit body background, sound only after a tap, localStorage only for
per-viewer conveniences inside try/catch, and the whole page usable with no sound, no WebGL, no
storage, no microphone and no recorder. Every ♯ and ♭ the page prints in text (the notes in the
lines, the chart's summary) has a spoken name, as Lesson 2's contract sets: the sign is
`aria-hidden` and a visually hidden word follows it (`nameHtml`, `signsHtml`,
`kit/notes.ts:204-227`), so a screen reader says "F sharp"; the figures' accessible names and every
live region use words only. The page stores the quiz seeds and records (`fyp-l14-recall-seed`,
`fyp-l14-recall-v1`, `fyp-l14-seed`, `fyp-l14-quiz-v1`), `fyp-done` (`kit/progress.ts:12`),
`fyp-voice` (`kit/voice-choice.ts:20`), the warm-up's Skip (`fyp-l14-warmup`), the masthead's Pause
animations choice, `fyp-motion` (`kit/motion-switch.ts:12`), and the steps the viewer reached,
`fyp-pos` (`kit/position.ts:20`); and nothing from the takes: no audio, no line, no range, no answer
to "How did that feel?" and no ending. A take's recording lives in memory until Delete, a new take 2
in its place, or the page's end.

Page QA before publishing (PRODUCTION-PIPELINE § 5) adds, for this page:

- The vocal coach has signed the page off, and Lessons 5, 8, 9 and 12 are live on the site it is
  published to: the console asks about both, but publishes on "Publish anyway" (the intro).
- The microphone is requested only by Start take 1; "Just listen today", sound off and a refused
  permission never open it; the browser's microphone indicator goes off at the end of each take, on
  leaving the section and when the tab is hidden.
- The network panel shows nothing sent while the microphone is open or a take plays back, and
  storage and IndexedDB hold nothing but the keys above; a reload leaves no take behind, because the
  page says "your takes are kept only until you leave this page or press Delete".
- The whole page, Sing it included, runs by keyboard alone, and a screen reader hears every state
  and line, in spoken names.
- No line invites another try, and no visit reaches a fourth take or a second Again.
- With reduced motion emulated, nothing moves on its own and the live line draws on a still frame.
- The Wrap shows the rest card after "Effortful", "Uncomfortable" and "Just listen today", and the
  practice card otherwise; neither carries a first-visit line, and both open Karaoke Night with no
  intro. After each of those three endings, the season's card keeps "You've seen every note you
  sing." and "See the season map", and shows neither "Now sing a whole song." nor its Karaoke Night
  button (What the kit and the app still need, 12).
- Every step stage fits the four short landscape screens with the masthead (End to end 5), and the
  app-check sweep (`.claude/skills/app-check`) passes at phone and desktop width with Sing it open
  in each state, run locally or on dev, never against production.
