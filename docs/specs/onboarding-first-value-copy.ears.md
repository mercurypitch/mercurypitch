# Onboarding First-Value Copy — EARS Requirements

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.3 | Date: 2026-10-11 | Scope: the sentence that names the note we
> just heard, who does the listening on the first note, the twin's numbers and
> next step, the launch gift's name, and the "what this is" line on every
> First Light Map card

---

**Source:** `src/lib/note-utils.ts` (`noteArticle`);
`src/features/onboarding/copy.ts` (the lines the owner may swap);
`src/features/onboarding/beats/BeatFirstLight.tsx` (the ask, the meter and the
`heard` phase);
`src/features/onboarding/beats/BeatFork.tsx` (`SangNote`, returning fork only);
`src/features/onboarding/beats/BeatTwin.tsx` and
`src/features/onboarding/beats/TwinStatCard.tsx` (the twin's numbers);
`src/features/onboarding/voice-strip.ts` (the glides as one line);
`src/features/onboarding/beats/KeepGiftCard.tsx` and
`src/features/onboarding/beats/BeatMap.tsx` (the launch gift's lines);
`src/features/onboarding/rooms.ts` (`ROOMS[].line`);
`src/features/onboarding/beats/BeatMap.tsx` (the room card body)
**Tests:** `src/tests/note-utils.test.ts` (`NART-*`),
`src/tests/onboarding-copy.test.tsx` (`FVC-*`),
`src/features/onboarding/beats/TwinStatCard.test.tsx`,
`src/features/onboarding/voice-strip.test.ts`,
`src/tests/onboarding-launch-gift-beats.test.tsx`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

Background: CLAUDE-JOURNEY-002. Beat 2 is the app's first moment of value —
"we heard you, and here is what you sang" — and it rendered a hard-coded "a"
in front of the note name, so a singer holding an A3 was told "That's a A3".
The same clause repeated on beat 3. Note names are read out loud, and A, E and
F are all _said_ starting on a vowel sound, so all three need "an".

Since 2026-10-11 (owner decision V2) the first-run Fork is one question and
one button, so only the returning singer's fork says the note back on beat 3.

## Note article — `NART-*`

### REQ-NART-001 — Vowel-sound letters take "an"

**Ubiquitous:** `noteArticle` shall return `'an'` for any note name whose
letter is A, E or F. F is included because the letter is spoken "eff", not
because it is a vowel. Verified by `NART-1`.

### REQ-NART-002 — Every other letter takes "a"

**Ubiquitous:** `noteArticle` shall return `'a'` for note names beginning B,
C, D or G. Verified by `NART-2`.

### REQ-NART-003 — Accidentals, octaves and case are irrelevant

**Ubiquitous:** The article shall be decided by the first letter alone, so
`A#2`, `Ab2`, `a3` and `' E2'` all take `'an'` and `G#-1` takes `'a'`.
Verified by `NART-3`.

### REQ-NART-004 — Non-note input does not crash the sentence

**IF** `noteArticle` is given an empty or blank string **THEN** it shall
return `'a'` rather than throwing, so a missing reading degrades to a slightly
wrong article instead of a blank screen. Verified by `NART-4`.

## First-value wording — `FVC-*`

### REQ-FVC-001 — "an" before a vowel-sound note

**WHEN** the onboarding says back the note it heard — the beat 2 headline
("That's an A3") and the returning singer's beat 3 opener ("You sang an
A3.") — the article shall come from `noteArticle`, so an A, E or F reads
"an". Verified by `FVC-1` in both describes: beat 2 is driven from the ask
screen through a faked take on a 220 Hz tone, so the headline is asserted as
rendered.

### REQ-FVC-002 — "a" is preserved everywhere else

**WHEN** the note heard begins with B, C, D or G, the same sentences shall
still read "a G3". Verified by `FVC-2` in both describes.

### REQ-FVC-003 — The first-run Fork asks its one question

**WHILE** the visitor has no voiceprint on file and therefore sees the
first-run Fork, beat 3 shall not repeat the note: beat 2 has just named it,
and the Fork's one line is the question "Which legend has a range like
yours?" (owner decision V2, 2026-10-11). Only the returning-singer fork
carries the note-heard clause. Verified by `FVC-3`.

### REQ-FVC-004 — No note, no clause

**IF** no note was heard (the microphone was skipped or denied, so
`firstNote` is null) **THEN** beat 3 shall omit the clause entirely rather
than render a dangling article. Verified by `FVC-4`.

### REQ-FVC-005 — Every Map card says what its room is

**Ubiquitous:** Each card on the Map shall render its room's `line` — the
sentence that says what the room _is_ before what you do there. Verified by
`FVC-5`.

### REQ-FVC-006 — The recommended card says what AND why

**WHILE** a room is the picked first stop, its card shall show the room's own
`line` _and_ the personalised reason. Previously the reason replaced the line,
so the one card the Map pushes hardest ("Your tone wavers when you hold.
Let's steady it.") was the only card that never said where it was sending
you. Verified by `FVC-6`.

### REQ-FVC-007 — Lines lead with the thing, not the verb

**Ubiquitous:** Every room line shall open with a noun phrase ("A library of
eighteen short drills…", "The live singing stage: …") rather than an
instruction, so the card answers "what is this?" before "what do I do?".
Verified by `FVC-7`.

### REQ-FVC-008 — A counted room line counts honestly

**Ubiquitous:** WHERE a room line states how much a room contains, the number
shall match the code. The Exercises line said "Fourteen drills" while eighteen
shipped, so the count is pinned to `EXERCISE_HELP` — a `Record<ExerciseType,
…>`, therefore exhaustive — and adding a drill without updating the line fails
the suite. Verified by `FVC-8`.

### REQ-FVC-009 — No jargon a first-time visitor cannot decode

**Ubiquitous:** Room lines shall not lean on in-app vocabulary the visitor has
not met yet. The Ascent line no longer says "one orb at a time" — an orb is a
themed week, and the Map is the screen where that is not yet known. Verified
by review.

### REQ-FVC-010 — A room line joins its halves without an em dash

**Ubiquitous:** No room line shall contain an em dash. Where a line names
the room and then says what happens there, a colon joins the two ("The live
singing stage: every note you sing…"); where the second half is an
instruction, it is its own sentence ("…in real time. Send someone the
code."). This is the owner's standing product-voice rule for visible copy.
Verified by `FVC-10`.

## The owner's phone test, 11 Oct 2026 — `FVC-11` to `FVC-16`

The lines below live once each in `src/features/onboarding/copy.ts`, and the
tests import them from there, so the owner can swap any of them in one line.

### REQ-FVC-011 — Merc is the one listening on the first note

**Ubiquitous:** Beat 2 shall name Merc as the listener, never "we": the
headline is "Merc is all ears", the meter's caption reads "Merc can hear you"
once the level reads as a voice, the auto-start line says recording starts
"the moment Merc hears you", and the heard screen says "Merc heard you" over
"Your note lit the first star. Now let's find the rest of your range."
Verified by the four `FVC-11` tests, which drive the ask (microphone allowed
and not yet asked), the meter and the heard screen.

### REQ-FVC-012 — The privacy line says where the sound stays

**Ubiquitous:** The ask shall say "Merc listens, and the sound stays on this
device." It names where the sound stays and never the upload that does not
happen (the owner's standing rule). It is true of the whole flow: the
microphone feeds an on-device pitch detector, and only the numbers it
measures are saved or shared. Verified by `FVC-12`.

### REQ-FVC-013 — No em dash on the first note

**Ubiquitous:** No swappable line, and no screen of beat 2 from the ask to
the heard note, shall contain an em dash, the shared microphone help panel
included (its one em dash went in the follow-up to PR 977). Verified by the
two `FVC-13` tests.

### REQ-FVC-014 — The twin says what comes next in one true line

**Ubiquitous:** The twin shall say "Next, the Map: a room picked for your
voice." "A room", not "rooms": the Map picks one first stop from the
voiceprint (`first-stop.ts`). The line takes at most two lines on a 320 px
phone; the longer one it replaced ("…, from daily practice to Karaoke
Night.") took three. No em dash on the screen. Verified by `FVC-14`.

### REQ-FVC-015 — The twin's numbers are one card, drawn from the take

**WHEN** the twin shows its numbers, they shall sit on one card: the
singer's own glides, up and back down, drawn as a gold ridge with its
lowest and highest notes named beside it, and one row of big numbers with
small labels (semitones, steadiness, pitch accuracy), under the ridge on a
phone and beside it on a wider card. On a 375 px phone the numbers take
one row, and never more than two. The ridge is the take itself
(`voice-strip.ts`): a silent stretch is skipped, a pitch past the measured
range is held to its edge, and a range narrower than an octave is drawn as a
low hill. **IF** a number was not measured **THEN** its cell shall be left out
(no range: no ridge and no semitones; a skipped match: no accuracy), and
**IF** nothing was measured **THEN** there shall be no card. Under reduced
motion the ridge shall be drawn whole, with no animation. Verified by
`FVC-15` and `TwinStatCard.test.tsx`; the line by `voice-strip.test.ts`.

### REQ-FVC-016 — The launch gift is named by what it buys

**Ubiquitous:** The launch gift shall be worded as song separations, never
as a count of credits, with "up to": a credit splits one song of up to 12
minutes on the Cloud GPU, and a longer song or a full band split costs more
(`uvrJobCost`). Keep's card says "Up to 5 free song separations" over "Sing
your favorite songs at Karaoke Night and see how you score." The Map says
"Launch gift: up to 5 free song separations with a free account." with "Get
my gift", or "Your launch gift is waiting: up to 5 free song separations."
with "Claim them", and its way back to Keep is "Save it and get the launch
gift". The number is always the server's. Verified by
`onboarding-launch-gift-beats.test.tsx` and
`onboarding-launch-gift-flow.test.tsx`.
