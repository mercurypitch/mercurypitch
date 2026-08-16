# Onboarding First-Value Copy — EARS Requirements

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-08-16 | Scope: the sentence that names the note we
> just heard, and the "what this is" line on every First Light Map card

---

**Source:** `src/lib/note-utils.ts` (`noteArticle`);
`src/features/onboarding/beats/BeatFirstLight.tsx` (the `heard` phase headline);
`src/features/onboarding/beats/BeatFork.tsx` (`SangNote`);
`src/features/onboarding/rooms.ts` (`ROOMS[].line`);
`src/features/onboarding/beats/BeatMap.tsx` (the room card body)
**Tests:** `src/tests/note-utils.test.ts` (`NART-*`),
`src/tests/onboarding-copy.test.tsx` (`FVC-*`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

Background: CLAUDE-JOURNEY-002. Beat 2 is the app's first moment of value —
"we heard you, and here is what you sang" — and it rendered a hard-coded "a"
in front of the note name, so a singer holding an A3 was told "That's a A3".
The same clause repeats on beat 3. Note names are read out loud, and A, E and
F are all *said* starting on a vowel sound, so all three need "an".

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
("That's an A3") and the beat 3 opener ("You sang an A3.") — the article
shall come from `noteArticle`, so an A, E or F reads "an". Verified by
`FVC-1` in both describes: beat 2 is driven from the ask screen through a
faked take on a 220 Hz tone, so the headline is asserted as rendered.

### REQ-FVC-002 — "a" is preserved everywhere else

**WHEN** the note heard begins with B, C, D or G, the same sentences shall
still read "a G3". Verified by `FVC-2` in both describes.

### REQ-FVC-003 — Both forks are covered

**WHILE** the visitor already has a voiceprint on file and therefore sees the
returning-singer fork, the note-heard clause shall use the same corrected
article as the first-run fork. Verified by `FVC-3`.

### REQ-FVC-004 — No note, no clause

**IF** no note was heard (the microphone was skipped or denied, so
`firstNote` is null) **THEN** beat 3 shall omit the clause entirely rather
than render a dangling article. Verified by `FVC-4`.

### REQ-FVC-005 — Every Map card says what its room is

**Ubiquitous:** Each card on the Map shall render its room's `line` — the
sentence that says what the room *is* before what you do there. Verified by
`FVC-5`.

### REQ-FVC-006 — The recommended card says what AND why

**WHILE** a room is the picked first stop, its card shall show the room's own
`line` *and* the personalised reason. Previously the reason replaced the line,
so the one card the Map pushes hardest ("Your tone wavers when you hold —
let's steady it") was the only card that never said where it was sending you.
Verified by `FVC-6`.

### REQ-FVC-007 — Lines lead with the thing, not the verb

**Ubiquitous:** Every room line shall open with a noun phrase ("A library of
fourteen short drills…", "The live singing stage — …") rather than an
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
