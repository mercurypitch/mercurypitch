# Lesson 12 page, "Chords and the four-chord song" (/learn/12): build plan

This plan comes from a read-only survey on 24 October 2026 of
`/home/user/mercurypitch/.claude/worktrees/names-lock`, a detached checkout of origin/main at
`5e08dd4a3`. In-flight work was read with `git log` and `git show` only:

- Lesson 9's B0, `33537af37` on `feat/lessons-no-page-tests`;
- A2, `e6b3d7e7c` on `feat/kit-run`;
- C1, `d58e393ad` on `feat/leap-ladder-slug`.

Every status was checked in the code, not taken from the spec. Line numbers are main's unless a line
says "B0's" or "A2's".

The plan has the shape of Lesson 9's (`…/scratchpad/l9/PLAN.md`) and Lesson 10's
(`…/scratchpad/l10/PLAN.md`). Lesson 10's plan was read as it stood at 16:11, while its planner was
still revising it, so its task ids are used, but not its line numbers. The plan also applies the
lead's Lesson 9 decisions (`l9/DECISIONS.md`, 19 items) and builder rules (`l9/BUILDER-RULES.md`).
It takes account of `l9/FOLLOWUPS.md` and `arp/CONSENSUS.md`.

Short names used below:

- **Spec**: `docs/plans/find-your-pitch/lessons/12-chords-four-chord-song/WEB-SPEC.md`.
- **LESSON** and **FACTS N**: the package's `LESSON.md`, and the numbered facts in its `FACTS.md`.
- **Needs N**: item N of the spec's "What the kit and the app still need" (spec:823-966).
- **Tests N** and **End to end N**: the spec's numbered test cases (spec:1145-1272).
- **kit/**: `src/features/lessons/kit/`. **l12/**: `src/features/lessons/lesson-12/`.
- Lesson 9's tasks keep their plan's ids: **A1a to A8, B0 to B16, C1 to C4**.
- Lesson 10's tasks get a prefix: **L10-K1 to L10-K5**, **L10-P1 to L10-P22**, plus **C10-1 to C10-4**.
- This plan's tasks are **L12-K** (kit), **L12-P** (page), **L12-C** (app) and **L12-R1** (release).

## 0. Summary

**Status of the spec's 17 needs** (spec:823-966):

| Status                | Count | Items                          |
| --------------------- | ----- | ------------------------------ |
| Done                  | 4     | 6, 9, 10, 16                   |
| Partly                | 3     | 5, 7, 8                        |
| Not done              | 9     | 1, 2, 3, 4, 11, 12, 13, 14, 17 |
| Waits for the release | 1     | 15                             |

Needs 3 says "the kit's spiral needs nothing". Its API is on main, but three things are missing:

- a bead tap never reaches the page's one-sound owner;
- its drawer never lets the frame loop rest;
- a drag still turns the ring after `setTurning(false)`.

Section 2 covers these as G3 to G5. Needs 8's stoppable `schedule` is now A2's `kit/run.ts`. Lesson
12 needs one more field on it than L10-K2 adds (G1).

**Missing from the list** (section 2):

- a chord and a tune note in two different voices, started together;
- runs that count as "not heard" when the page is hidden;
- the spiral's sound owner, a spiral that rests, and the drag;
- the overlay's view of the lit turn while the camera moves;
- the expo-out curve as a function;
- the recall's play button, which is Lesson 10's;
- the plan-back link;
- what shipping before Lesson 11 asks of the build;
- first-paint room on Lessons 3 and 4;
- Chord Stacker's missing chord-type choice.

**No conflict with main in the head.** The spec's head passes main's tests:

- The title, "The four-chord song: how chords work | MercuryPitch", has 51 characters.
- The description has 150, with "A fifteen-minute lesson" (`MINUTE_WORDS`,
  `src/tests/lesson-pages.test.ts:75-89`).
- `og:title`, "Chords and the four-chord song: Find Your Pitch, Lesson 12" (58), holds both the headline and
  "Find Your Pitch".
- `timeRequired` is `PT15M`.
- The one chip links Lesson 10, which is `PREREQ[12]` (`kit/season.ts:421`).

Section 6, item 17 lists the statements in the spec that main contradicts.

**Shipping before Lesson 11** (section 3). Nothing in the code needs the lesson pages to be
contiguous.

- Lesson 10's next card keeps naming Lesson 11, "Coming later", by design: it reads `current + 1`
  (`kit/next-card.ts:95-123`).
- The menu, the explorer, the hub, the console and the budgets read the season or the files on disk.
- Main's tests had two assumptions. Its count tests are removed by B0. The `/learn/0${n}` in
  `learn-frame-loop.spec.ts:213` is padded by B15 or L10-P21.
- The console does not check the order.

Section 3 lists the seven things Lesson 12's build must do so that `/learn/12` stays right with no
`/learn/11`, whether it is published first or not.

**B0 with Lesson 12 built before Lesson 11** (section 5).

- Every converted test holds. `lessonWithNoPage()` returns Lesson 11, so `later.n - 1` is Lesson 10.
  Lesson 10 has a page (from L10-P11), though it is not the newest one.
- The lesson before the first lesson with no page always has one, so `later.n - 1` is always safe.
- Lesson 12's page changes none of the tests that still name a lesson. It only adds rows and cases.
- A note for Lesson 11's builder: once Lessons 11 and 12 both have pages, the predicate in B0's
  `explorer.test.ts:291-293` finds no lesson and throws, because 13 and 14 open nothing. Whichever
  of the two pages lands second rewrites that test; with 12 first, that is Lesson 11's. Section 5
  gives a one-line fix.

**Task order.** Details are in section 4.

- Kit tasks, each its own PR:
  - L12-K1: a voice kind on each note of a kit run. It folds into L10-K2, or stacks on it.
  - L12-K2: Move do's reach, set for each side. It folds into L10-K3, or stacks on it.
- Pure modules, each on its own branch, joining the page branch by rebase:
  - L12-P1: the music.
  - L12-P2: spoken numerals.
  - L12-P3: the sounds.
  - L12-P4: the page's lines.
  - L12-P5: the chord strip's layout.
  - L12-P6: the Sing it flow.
  - L12-P7: the Sing it guide.
  - L12-P8: the quick check's questions.
  - L12-P9: the rooms painter.
  - L12-P10: the share card.
- The page, on `feat/lesson-12-page`, stacked on `feat/lesson-10-page` after L10-P11, with one
  commit per task:
  - L12-P11: page shell and registration.
  - L12-P12: the ring of rooms, with Steps 1 and 2.
  - L12-P13: Steps 3 and 4, the names switch, and stopping sound on a step change.
  - L12-P14: Step 5's tune toy.
  - L12-P15: the cold open.
  - L12-P16: recall and quick check.
  - L12-P17: Four words.
  - L12-P18: Sing it.
  - L12-P19: the Wrap.
  - L12-P20: end-to-end checks across the page.
  - L12-P21: final measurement and docs.
- App tasks:
  - L12-C1: the copy that changes with Arpeggio Jumper v2.
  - L12-C2: a console warning about the publishing order, on the owner's yes.
  - L12-C3: Chord Stacker's triads, which need a design first.
  - L12-C4: Cadence's own launch, after C10-3.
- Release: L12-R1.

**Blockers and open questions** (section 6):

- how the work ships, and the drafts line's wording (lead);
- one owner each for L10-K2 with L12-K1, and L10-K3 with L12-K2 (lead);
- `aria-disabled` on Move do: one answer for Lessons 10 and 12 (lead);
- whether the page rests page-wide, which needs L10-K4 (lead);
- the drag, and the stop on a hidden page (lead);
- the octave sentence, which the copy-fix list in `arp/CONSENSUS.md` misses (owner);
- which practice link the explorer card shows; Cadence is recommended (owner);
- what "leaving the hero for a step" means (lead);
- the tune toy's Stop label against its accessible name (lead);
- the console warning (owner);
- the two tunes' likeness to known songs (owner, before release);
- the coach's items;
- Lesson 11's still rule (the lead passes it on);
- first-paint room on Lesson 3.

**Everything else waits.**

- L12-K1 waits for L10-K2's branch (`feat/kit-run-chords`, on A2's fix commits).
- L12-K2 waits for the lead's answer on L10-K3.
- The page waits for L10-P11 on `feat/lesson-10-page`, which needs B0 and B2 below it.
- L12-C1 waits for Arpeggio Jumper v2 and the owner. L12-C2 had the owner's yes (24 Oct) and is built (25 Oct, `feat/lesson-order-warning` 6c5aed259; reviewed, backed up).
- L12-C3 waits for a design and for C1. L12-C4 waits for C10-3. L12-R1 waits for the release.

The tasks below are all new files under `l12/`, plus `public/learn/lesson-12-og.jpg`. No Lesson 9
task and nothing in Lesson 10's plan (as of 16:11) touches either. As in both other plans,
`docs/agent/INDEX.md` is regenerated after each rebase, not merged by hand. A task marked
**(L10)** follows a design in Lesson 10's plan, so recheck it if that plan changes.

**Can start now**

- L12-P1, the music: `feat/lesson-12-music`, moderate.
- L12-P2, spoken numerals: `feat/lesson-12-numerals`, simple.
- L12-P3, the sounds: `feat/lesson-12-sounds`, moderate; stacked on P1. **(L10)** Its note type
  follows L10-K2's gain on each note and L12-K1's kind. Use a local type of that shape until both
  land.
- L12-P4, the page's lines: `feat/lesson-12-lines`, moderate; stacked on P1 and P2. It takes the
  names as input, so it does not wait for L10-K1.
- L12-P5, the chord strip's layout: `feat/lesson-12-strip-layout`, moderate.
- L12-P6, the Sing it flow: `feat/lesson-12-sing-flow`, moderate.
- L12-P7, the Sing it guide: `feat/lesson-12-sing-guide`, simple. **(L10)** Its reach `{ lower: 4,
  higher: 3 }` stays plain data until L12-K2 lands through L10-K3.
- L12-P8, the quick check's questions: `feat/lesson-12-quiz`, simple; stacked on P2. The recall's
  questions come later, in L12-P16, by import, so no copy is made.
- L12-P9, the rooms painter: `feat/lesson-12-rooms-draw`, moderate; stacked on P1. **(L10)** It takes
  its easing as a parameter until L10-P12 adds `easeOutExpo`. It reports when it is animating, for
  L10-K4's `overlayWants`.
- L12-P10, the share card: `feat/lesson-12-share-card`, moderate; stacked on P9. Render it locally
  through the heavy wrapper.

One task is also clear of other tasks' files but needs a decision first. L12-C2, the console warning
(`feat/lesson-order-warning`, moderate), can start on the owner's yes.

## 1. Status of each spec item

| #   | Item                                         | Status                | Evidence (file:line)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | What remains                                                                                         |
| --- | -------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | Lesson host                                  | Not done              | `learn/` holds `01.html` to `08.html` and `index.html`. The build takes every `learn/NN.html` without an entry of its own (`tools/draft-lessons.ts:77-86`, `:109-117`; `vite.config.ts:78-87`, `:147-149`, `:489`). `STANDALONE_DOCUMENT_PATHS` is at `src/lib/sw-runtime.ts:93`. The lesson paths are at `:131-157`, with the drafts group from `:138` and Lesson 8 last, at `:155-157`.                                                                                                     | `learn/12.html`, `l12/`, and `'/learn/12'` and `'/learn/12.html'` in the drafts group after Lesson 10's: L12-P11. |
| 2   | Drafts line                                  | Not done              | `kit/drafts.ts:31-38` has lines for Lessons 3 to 8 only. Every one names a sign-off, and none names another lesson's page. No test pins a line's wording.                                                                                                                                                                                                                                                                                                                                          | L12-P11, worded as section 6, item 2 decides. Deleting the line is L12-R1.                           |
| 3   | `l12/rooms.ts`; "the kit's spiral needs nothing" | Not done          | There is no `l12/`. On main: `SpiralOptions` (`kit/spiral.ts:82-107`: `overlay` `:100`, `range` `:104`, `ring` `:106`) and `Spiral` (`:120-149`: `light`, `setLabels`, `setTurning`, `setView`, `top`, `yaw`). Missing:<br>- The internal `play` (`:264-271`) calls `playTone`, so a tap never claims `NowPlaying` and cannot be stopped.<br>- `addDrawer` (`:545-592`) has no `wants`.<br>- A drag (`:372-381`), Shift+Arrow (`:489-493`) and a flick's glide (`:519-523`) still turn the ring. `setTurning(false)` stops only the drift (`:523`, `:626-628`). | L12-P1, P5, P9, P12 to P14. L10-K5 and L10-K4 for the kit (G3 to G5).                               |
| 4   | `l12/cold-open.ts`                           | Not done              | There is no `l12/`. Patterns to follow: Lesson 2's hero copy and overlay trail (`lesson-02/cold-open.ts:39-58`, `lesson-02/spiral-copy.ts`); Lesson 6's still sky and sing-along (`lesson-06/cold-open.ts:71`, `:84-93`).                                                                                                                                                                                                                                                                         | L12-P15.                                                                                             |
| 5   | Names switch with a choice of modes          | Partly                | Already in the kit: `createModeStore` (`kit/names.ts:27-51`) and `bindModeToggle` (`:58-80`). Still page-local: Lesson 4's `NamesMode`, `NAMES_MODES` and `SOLFEGE` (`lesson-04/stairs-words.ts:17-35`), and Lesson 6's two modes (`lesson-06/tune-words.ts:22-23`).                                                                                                                                                                                                                              | L10-K1 (`kit/names-modes.ts`). L12-P13 takes its two-mode list and `MAJOR_SOLFEGE`.                  |
| 6   | Breath mark on the guide                     | Done                  | `GuideOptions.breaths` (`kit/slide-guide.ts:63`). Lesson 6 passes it (`lesson-06/sing.ts:101`).                                                                                                                                                                                                                                                                                                                                                                                                    | Nothing. L12-P18 passes `[5.6]`.                                                                     |
| 7   | Move do and the count-in                     | Partly                | In `kit/move-do.ts`: `MOVE_MAX` `:21`, `clampMove` `:24-25`, `nextShift` `:28-29`, `setMoveEnds` `:32-40` (it sets `b.disabled` at `:38`), `COUNT_IN` `:43-44`, `countIn` `:47-51`. The reach is the same both ways, and the end buttons use `disabled`.                                                                                                                                                                                                                                        | L10-K3 (`aria-disabled`) and L12-K2 (a reach for each side).                                         |
| 8   | The sound rules' helpers                     | Partly                | Done: `NowPlaying` (`kit/now-playing.ts:17-39`), and a play may resolve `false` (`kit/predict.ts:30-41`; `busy` `:179`; the heard check `:187-188`). The stoppable schedule comes with A2's `kit/run.ts`: `RunNote` `:21-25`, `Run` `:28-31`, `RunOptions` `:33-38` (one `kind` and one `gain` per run), `playNotes` `:78-109`. Lessons 2 and 4 each keep a `schedule` with no handle on its timers (`lesson-02/examples.ts:124-134`, `lesson-04/examples.ts:81-92`).                       | A2, L10-K2 and L12-K1 (G1, G2).                                                                      |
| 9   | `recallStepHref`                             | Done                  | `kit/quiz.ts:142-143`, beside `lessonPageHref` (`:138-139`); `linkAway` is at `:191-216`.                                                                                                                                                                                                                                                                                                                                                                                                          | Nothing.                                                                                             |
| 10  | `kit/comfort.ts`                             | Done                  | `afterFeeling` (`:56-87`), with `restAfterEffort` at `:53` and `:77`. `mountFeelings` (`:175-206`) locks an answer unless the page passes `changeable` (`:178`).                                                                                                                                                                                                                                                                                                                                   | Nothing. L12-P6 passes `restAfterEffort`; L12-P18 keeps the lock.                                    |
| 11  | Season entry                                 | Not done              | `kit/season.ts:360-371`: the hook is at `:366` and `pr.needs` at `:367-370`. There is no `minutes`, `page` or `link`.                                                                                                                                                                                                                                                                                                                                                                                | L12-P11.                                                                                             |
| 12  | The page's head                              | Not done              | There is no document yet. These tests will hold it: `src/tests/lesson-pages.test.ts:143-228` (canonical, series, minutes and trail) and `:251-263` (chips equal to `PREREQ`); and `kit/lesson-copy.test.ts:323-357`. The spec's strings pass all of them (section 0).                                                                                                                                                                                                                               | L12-P11.                                                                                             |
| 13  | Share image                                  | Not done              | `public/learn/` holds `lesson-01-og.jpg` to `lesson-08-og.jpg`. `lesson-pages.test.ts:229-249` requires a card at its head's size for every lesson document.                                                                                                                                                                                                                                                                                                                                       | L12-P10, committed with L12-P11.                                                                     |
| 14  | First-paint budget                           | Not done              | `scripts/assert-first-paint-budgets.mjs` has JavaScript entries for Lessons 1 to 8 at `:97` to `:190`, and CSS entries at `:242-271`. A document with no budget fails (`:541-547` for JavaScript, `:573-579` for CSS). So does an entry for a page the build did not emit (`:558-564`, `:595-605`).                                                                                                                                                                                             | L12-P11 sets the first values; L12-P21 sets the final ones.                                          |
| 15  | Steps at the release                         | Waits for the release | `public/sitemap.xml` and `public/llms.txt` (`:66-80`). Until the release, the draft rules in `lesson-pages.test.ts:317-345` apply.                                                                                                                                                                                                                                                                                                                                                                | L12-R1.                                                                                              |
| 16  | Lessons 1 to 11's pages                      | Done, by design       | Their lists read the season through the page state (`pageLessons`, `kit/page-state.ts:55`). The menu's "up next" is the first live lesson whose prerequisites are done (`kit/lesson-state.ts:70-80`).                                                                                                                                                                                                                                                                                             | No page needs an edit. Section 5 lists the test additions.                                           |
| 17  | App content                                  | Not done              | Arpeggio Jumper's grade (`src/features/exercises/arpeggio-jumper/use-arpeggio-jumper-controller.ts:301`). Chord Stacker's chord types (`src/features/exercises/chord-stacker/use-chord-stacker-controller.ts:11-27`) and its grade (`:295`); its setup offers no type to choose (`chord-stacker/ChordStackerExercise.tsx:119`). Cadence can only be opened by tapping it. `EXERCISE_SLUGS` has no slug for any of the three (`src/features/exercises/slug-map.ts:47-65`).                                                                                                                         | L12-C1 to L12-C4.                                                                                    |

**Season and copy data.**

- Lesson 12's entry is at `kit/season.ts:360-371`: title "Chords and the four-chord song", short
  name "Chords", topics T19, T20 and T21.
  - Its hook (`:366`) is "How can two songs share the same four chords and still sound different?".
  - Its `pr.needs` (`:367-370`) is "Chord Stacker with major and minor triads (today it has only
    maj7, min7, dom7, dim7 and maj6)".
- The graph:
  - `PREREQ[12]` is `[10]`, from the edge `[10, 12]` (`:421`).
  - `unlocks(12)` is `[14]`, from `[12, 14]` (`:426`).
  - Lesson 11's own edges are `[7, 11]` (`:420`) and `[11, 13]` (`:422`).
  - No edge joins Lessons 11 and 12.
- The teases:
  - Lesson 12's tease, shown on Lesson 11's card, is "Four chords, round and round."
    (`kit/lesson-copy.ts:117`).
  - Lesson 13's tease, shown on this page's card, is "Same note, two vowels: ‘ee’, then ‘ah’." (`:118`).
  - Lesson 13's hook (`season.ts:379`) matches LESSON:355-357 word for word. Unlike Lesson 10's
    LESSON, this one has no stale hook.
- The signature is in `kit/team-notes.ts:44`. Only the console may load it; the first-paint check
  fails any page that does (`assert-first-paint-budgets.mjs:296-320`).
- The run time is 15 minutes: 2,336 words (FACTS 3; spec Length). `scripts/lesson-words.test.mjs`
  holds that count, since `GOLDEN` (`:317`) includes '12' and `:325-357` compare the counts.

**Practice links, checked.**

- **`/pitch-training?lesson=12`, then Arpeggio Jumper** (the practice card).
  - It exists.
  - Its grade is `avgAccuracy * 0.45 + bestNote * 0.3 + richness * 0.25`
    (`use-arpeggio-jumper-controller.ts:301`).
  - **Flag: it has both a best-of term (`bestNote`) and a richness term.** Richness divides clarity
    by 100 (`src/lib/vocal-analyzer.ts:894-911`), so it reads about 0.
  - The effects, per `arp/CONSENSUS.md`:
    - a flawless run scores about 75;
    - levels above 5 and the A and S grades cannot be reached.
  - Arpeggio Jumper v2 makes the grade `avgAccuracy` (CONSENSUS, Step 1).
  - The card never says how the grade is made. Its octave sentence still depends on an owner
    decision (section 6, item 8).
- **`/ear-lab?lesson=12`, then Cadence** (the card's second drill, and the recommended explorer
  link).
  - It exists, and runs twelve rounds (`use-identification-controller.ts:54`).
  - Each round has four pads (`src/lib/ear/drills.ts:196-201`), so the guess rate is 1/4
    (`:233-237`), and the answers move an Elo rating.
  - Its bank is the eight `PROGRESSIONS` (`src/lib/ear/progressions.ts:67`;
    `src/lib/guitar/chord-progression.ts:13-22`), with I-V-vi-IV at `:15`.
  - It uses no microphone, and its grade has no best-of term and no richness term.
  - `?lesson=12` is a valid marker (`src/lib/lesson-marker.ts:18-25` accepts 01 to 14).
- **Chord Stacker** is not linked.
  - It has only seventh and sixth chords: `ChordType` `:11`, degrees `:13-19`, labels `:21-27`.
  - Every run shuffles in every type (`:89`).
  - **Flag: its grade, `avgAccuracy * 0.7 + bestRound * 0.3` (`:295`), has a best-of term.**
  - Its setup lists the five types (`ChordStackerExercise.tsx:119`) but offers no choice. The spec's
    "setup's Chord Type menu" does not exist (G12; L12-C3).
- **Play Along** is not linked. No address opens it (FACTS 49).
- **On the server**, `workers/db-worker/src/mirror-metrics.ts:52-62` already accepts Lessons 1 to 14,
  so the quick check needs no change there. Its comment counts `createQuiz` sites: 15 on main, 17
  after Lesson 9, 19 after Lesson 10 and 21 after Lesson 12.

**Do-based minor** (MASTER-PLAN:523-529) is consistent with the package.

- LESSON:36-39 and FACTS 8 say the same thing:
  - the chord on la is "la do mi", A minor;
  - do stays on C;
  - the page never says "relative minor", and never sings from la as home.
- Tests 13 checks that no state names la as home.
- The page needs only the major syllables (L10-K1's `MAJOR_SOLFEGE`). `MINOR_SOLFEGE` goes unused.
- The "Start on vi" drawer (LESSON:211-212) names a rotation of the loop, not a key.

**Already on main, spot-checked:**

- the predict (`kit/predict.ts`: options `:30-72`, `plays` `:68-69`, the play handler `:175-190`);
- `NowPlaying`;
- the words strip (`kit/words-strip.ts:54-87`, with `{ owner }`);
- the quiz (prefix, slot and away links `:52-58`, `:80-104`, `:186-216`; `createQuiz` `:218`);
- the note helpers `spellScale` (`kit/notes.ts:170`), `wordName` (`:193`) and `signsHtml` (`:221`);
- the guide (`mountGuide`, `kit/slide-guide.ts:381`; `GuideRow` `:38-45`; `gap` `:52`) and the ring
  (`mountRing`, `kit/sing.ts:135`);
- `singAlong` and `stopSingAlong` (`kit/sing-along.ts:26`, `:41`);
- Merc and Tavi (`MercDuoOptions` `kit/merc-duo.ts:99`, `mercSing` `:143`, `mercListen` `:185`,
  `mercCelebrate` `:195`);
- `stillSky` (`kit/still-sky.ts:18`);
- the voice choice, the next card (`createNextCard`, `kit/next-card.ts:181`), the explorer, and the
  page state.

## 2. Needed, but not on the spec's list

- **G1. A chord and the tune note over it, started together.**
  - The spec's Audio section (spec:701-713) has the tune in Merc's "ooh" at 0.2 and the chords in
    the soft tone at 0.05. A chord and the tune note that begins with it must start in the same
    callback, and the drawing must hear that same callback.
  - `playTone` (`kit/sound.ts:560-569`) resolves only when its note has ended, so it cannot be
    stopped.
  - A2's runs take one `kind` and one `gain` for the whole run (A2's `run.ts:33-38`). L10-K2 adds
    one timer task for each shared onset and a gain for each note. Two runs joined by L10-K2's
    `allOf` would still start on two timers.
  - **L12-K1** adds a `kind` to each note. One `playNotes` run then carries both the chords and the
    tune, and its `onNote` fires in that same task. Sing it's "Play Merc's notes" needs the same.
- **G2. A run that outlives a hidden page.**
  - When the page is hidden, the kit silences every voice (`sound.ts:475-477`). But the run's timer
    still resolves `true`, so the predict would count a tune silenced half-way as heard.
  - L10-K2's item 5 ends live runs `false` from one module-level `onStopAll` listener (`:493`).
    Lesson 12 relies on it.
  - If L10-K2 drops item 5, L12-P15 subscribes once at page level and stops the live run instead.
  - Lesson 7's page has the same gap (`lesson-07/cold-open.ts` on `feat/kit-run`).
- **G3. The spiral's own plays.**
  - A bead tap or a slider key calls the internal `play` (`kit/spiral.ts:264-271`, called from
    `:301`, `:395`, `:467` and `:508`), and that goes straight to `playTone`.
  - L10-K5 adds `SpiralOptions.owner`. All three of this page's spirals pass the page's owner: the
    hero's, the stage's and free play's.
  - The walk must not call `spiral.play`. Under L10-K5 that play claims the owner, which stops the
    very run that called it. So L12-P9 draws the walk's pulses in the overlay instead.
- **G4. A page that rests.**
  - The spiral's drawer has no `wants`, so the loop keeps running (`kit/frame-loop.ts:134-136`).
  - L10-K4 adds `wants` and `overlayWants`. Lesson 12's overlay needs `overlayWants` for:
    - the key turn (0.6 s);
    - the corner slide (0.3 s);
    - the walk's pulses and the gold ring.
  - Without L10-K4, the page cannot rest page-wide. Its frame-loop test then checks only the
    explorer, the guide and the ring.
- **G5. A drag still turns the ring.**
  - `setTurning(false)` stops only the drift (`spiral.ts:523`). While the spiral is not unrolled
    (`u < 0.5`), these still turn it:
    - a drag (`:372-381`);
    - Shift with an arrow key (`:489-493`);
    - a flick's glide (`:519-523`).
  - Recommended: no kit change.
    - Draw each room from where its beads land in that frame (`BeadHit`, `spiral-draw.ts:31-37`).
    - For the key switch's turn, interpolate each corner's angle round the ring's centre. The centre
      is `(W / 2, 0.52 H)` and the radius `min(0.27 W, 0.29 H)` (`spiral-draw.ts:133-139`).
  - The spec's "holds it still" gets corrected (section 6, item 17).
- **G6. The overlay's beads while the camera moves.**
  - With the camera straight down (`top` = 1), only the lit turn's beads reach `hits` (`ringFade`,
    `spiral-draw.ts:108-113`; the alpha cut, `:386-387`).
  - But `setView('top')` takes 1.2 s at mount (`spiral.ts:529-533`), and until then `hits` holds
    beads from every turn.
  - So pick a note's bead by `s = m - LO` (LO is A2, MIDI 45), for m from 60 to 71.
- **G7. The expo-out curve as a function.**
  - `EASE.expoOut` (`kit/reveal.ts:17-18`) is a CSS string, so a canvas cannot use it.
  - L10-P12 adds `easeOutExpo` beside `easeOut3`.
  - L12-P9 takes its easing as a parameter; L12-P12 passes `easeOutExpo`.
- **G8. The recall's play.**
  - Lesson 10's question 2 has a slot, `data-quiz-play="chord"` (L10-P8). L10-P14's exported binder
    in `l10/quiz-play.ts` plays it.
  - Lesson 12's recall imports both, so nothing is copied (spec:634-647).
- **G9. The plan-back link.**
  - `kit/plan-back.test.ts:303-363` requires it on every lesson page, straight after
    `div[data-next-card]`, booted with one dynamic import.
  - The patterns are `learn/04.html:1488-1491` and `lesson-04/main.ts:100-103`. L12-P11 adds it.
- **G10. Shipping before Lesson 11.** Section 3 lists what the build must do.
- **G11. First-paint room on Lessons 3 and 4.**
  - `season.ts` and `drafts.ts` load in the first paint of every lesson page. Lesson 12's season
    fields and its drafts line add about 0.2 KB to every page.
  - The latest headroom measured (`l9/kit-mic-fp-bytes-after.txt`, 24 October) is 784 bytes on
    Lesson 3, 882 on Lesson 4 and 1,983 on Lesson 5.
  - B2 and L10-P11 each spend about 0.2 KB of it first. That leaves Lesson 3 about 370 bytes before
    L12-P11 and about 170 after, and Lesson 4 about 470 and 270.
  - If Lesson 3's ceiling must rise, it rises in L12-P11, with its reason (Lesson 9 decision 10).
- **G12. Chord Stacker offers no chord type.**
  - It shuffles every type into each run (`use-chord-stacker-controller.ts:89`). Its setup only
    lists the five (`ChordStackerExercise.tsx:119`).
  - So triads (spec:765-772) need a chord-type setting and a launch field, not just two more table
    rows.
  - Its grade keeps a best-of term (`:295`). That is L12-C3.

## 3. How the work ships

**Guardrails.** These are Lesson 9's, as Lesson 10's plan restates them in its section 3.

- **Git:**
  - Branches take the `feat/` prefix, never `claude/`.
  - Never push to `main`.
  - Bring a branch up to date by rebasing, and push with `git push --force-with-lease`, never plain
    `--force`.
  - Never rewrite a branch you do not own.
  - No commit, push, PR or merge unless asked.
  - No Claude attribution. No emojis; use SVG icons.
- **Testing:** never test against production; work locally or on dev.
- **Heavy commands** go through `scratchpad/bin/heavy` with
  `NODE_OPTIONS=--max-old-space-size=7168`.
  - Iterate with `pnpm exec vitest run <files>`, and run `pnpm check` once, at the end.
  - In this container, `build:e2e` exits 1 at the Glassworks step. Then run
    `node scripts/assert-first-paint-budgets.mjs dist` by hand, and record the numbers before and
    after.
- **Playwright:** `PLAYWRIGHT_BROWSERS_PATH=…/scratchpad/pw-browsers` and `--retries=0`, with the
  default two workers.
- **Gates:**
  - a new module: `node scripts/gen-agent-index.mjs`, then `pnpm docs:index:check`;
  - moved code that a lesson package cites: `pnpm plan:cites reanchor --base <base> --write`, then
    `node scripts/plan-cites.mjs check`, which must stay at or under main's 183 findings;
  - every change: `pnpm pr:validate`;
  - new files stay under 800 lines (METRICS.md:148).
- **Never:**
  - use the Artifact tool, or publish anything outside the repo and the scratchpad;
  - touch the six `art/glass-adventure/proofs/camera-comfort-2026-09-24/*` files;
  - open `.env` files, or edit `.claude/settings.json`.

**Order.**

1. L12-P1 to P10 start now, each from main on its own branch.
   - L12-K1 starts on L10-K2's branch, if it is not folded into L10-K2.
   - L12-K2 waits for the lead's answer on L10-K3.
2. L12-P11 opens `feat/lesson-12-page` from `feat/lesson-10-page`, once L10-P11 is on that branch.
   B0 and B2 are already below L10-P11.
   - L12-P11 edits lines that B2 and L10-P11 edit: `kit/drafts.ts`, `src/lib/sw-runtime.ts`,
     `kit/season.ts`, both budget tables, `learn-next-card.spec.ts`, `learn-sound-gate.spec.ts`
     and `learn-lesson-menu.spec.ts`.
   - From L12-P11's commit on, these tests take the page by themselves. Unit tests:
     - `src/tests/lesson-pages.test.ts`;
     - `kit/lesson-copy.test.ts:323-357`, `kit/team-notes.test.ts:84-102`,
       `kit/plan-back.test.ts:303-363` and `kit/season.test.ts:286-303`;
     - `src/lib/sw-runtime.test.ts:243-266` and `src/lesson-gate.test.ts:59`;
     - `tools/learn-hub.test.ts` and `tools/draft-lessons.test.ts:145`;
     - B0's converted tests.
   - End-to-end specs: `learn-stage-fit`, `learn-cold-open-fold` and `learn-no-planning-text`.
   - So L12-P11 alone must provide:
     - five steps on the sticky stage, each with a control of at least 44 px, and at most 60 px of
       scroll inside the stage;
     - a `.viz` figure;
     - the seven chips as plain buttons in the markup;
     - the title on the first screen;
     - the next card, the plan-back link, the lesson menu and the explorer.
3. L12-P12 to P21 follow on the same branch, one commit each. Each commit passes `pnpm check` and its
   own tests.
   - The P1 to P10 branches join by rebase or cherry-pick, never by a merge commit.
   - A page task that needs a kit task waits until that kit branch is in the page branch's base.
     Bringing it in is the lead's integration step (Lesson 9 decision 2).
4. The page goes up as one PR. It cannot merge before Lesson 10's, because its recall imports Lesson
   10's modules, and nothing merges before the owner cuts the release tag.
5. When `feat/lesson-10-page` moves, rebase with
   `git rebase --onto <new tip> <old base> feat/lesson-12-page`.
   - L12-P12 needs L10-P12, for `easeOutExpo`.
   - L12-P16 needs L10-P8 and L10-P14.
   - L12-P20 needs L10-P21, or B15, for the padded `open()`.
   - L12-P21 needs L10-P22 and B16.
6. Fix-ups from review go on as `git commit --fixup=<sha>` commits (Lesson 9 decision 16).

**Coordination with Lessons 9 and 10.** Where a Lesson 9 or 10 task creates or moves a shared part,
the Lesson 12 task depends on it by id. No task here builds a second copy.

| Lesson 12 task | Lesson 9 or 10 task | Shared file or behaviour | How to sequence |
| --- | --- | --- | --- |
| L12-K1 | L10-K2, on A2 | `kit/run.ts` and `kit/run.test.ts` | Ask L10-K2's owner to add a `kind` on each note in K2 itself. Otherwise, stack `feat/kit-run-kinds` on L10-K2's branch, `feat/kit-run-chords`. |
| L12-K2 | L10-K3; B12 | `kit/move-do.ts:20-40` and its test; the Move do handlers of Lessons 4, 6 and 8; B12's assertions | L10-K3 already offers "a page can pass its own limits". Fold L12-K2 into it, or stack on it. If L10-K3 is refused, L12-K2 goes alone from main and keeps `disabled`. |
| L12-P12, P15 | L10-K5, L10-K4 | `kit/spiral.ts` | Lesson 12 changes nothing in the spiral. It uses K5's owner, and K4's `wants` and `overlayWants` if K4 is accepted. |
| L12-P13 | L10-K1 | `kit/names-modes.ts`; Lessons 4 and 6's importers | Import it. K1 must be in the page branch's base. |
| L12-P11 | B0, B2, L10-P11 | `kit/drafts.ts`, `src/lib/sw-runtime.ts`, `kit/season.ts`, both budget tables, the end-to-end lists | Start after L10-P11. |
| L12-P11, P12 | B2 / L10-P11 | The recorder for kit runs in the test fixtures | Import it, from beside `kit/run.ts` or from Lesson 9's fixtures. Never copy it. |
| L12-P12 | L10-P12 | `easeOutExpo` in `kit/reveal.ts` | After L10-P12. If Lesson 12 is built first, L12-P12 adds it in the same form, and L10-P12 uses that. |
| L12-P16 | L10-P8, L10-P14 | `l10/quiz-questions.ts` (`l10-q1`, and `l10-q2` with its slot) and `l10/quiz-play.ts`'s binder | Import both. The ids and the slot must not change once shipped. |
| L12-P11, P19 | B14, L10-P11 | `learn-next-card.spec.ts`, `CARDS` | Add this page's row after L10-P11's `/learn/10` row. |
| L12-P20 | B15, L10-P21 | `learn-frame-loop.spec.ts` (`open()` padded) and `learn-publish-state.spec.ts` | After L10-P21. |
| L12-P21 | B16, L10-P22 | The `mirror-metrics.ts` count; the HANDOFF records; the pointer from needs 8 to `kit/run.ts` | After L10-P22. Whichever of B16 or L10-P22 points needs 8 at `kit/run.ts` does it once (FOLLOWUPS). |
| L12-C1 | C3 and CONSENSUS; the re-anchors by B0, L10-K1 and L10-P22 | Lesson 12's `LESSON.md`, `FACTS.md` and `WEB-SPEC.md` | After v2 ships and the owner decides. Rebase onto the re-anchored package. |
| L12-C3, L12-C4 | C1, C10-3 | `slug-map.ts`, `applyExerciseSlug` in `App.tsx`, the launch override, `exercise-contracts.ts` | After C1. L12-C4 also comes after C10-3. |
| L12-P1 to P10 | none | `l12/*` and `public/learn/lesson-12-og.jpg` | No Lesson 9 or 10 task edits these. |

Every branch regenerates `docs/agent/INDEX.md` and the plan-cites anchors. After each rebase,
regenerate both rather than merging their text by hand.

**Shipping before Lesson 11.** HANDOFF suggests building 9, 10, 12, 11 (`HANDOFF.md:219`), and
publishing goes in the same order. On main the console checks no order; L12-C2 (built 25 Oct,
`feat/lesson-order-warning` 6c5aed259, not merged) asks first but never stops it. These are the checks the lead
asked for:

- **Lesson 10's next card** names Lesson 11, "Coming later" and "See it on the map", because it
  reads `current + 1` (`next-card.ts:95-123`). That stays true once 12 is live.
  - A learner reaches 12 through Lesson 10's own explorer card, which lists 12 under "Opens" and
    links it once 12 is live.
  - Or through the menu's "up next", which is 12 once Lesson 10 is done (`lesson-state.ts:70-80`).
  - A card that skipped to the next live lesson would be a change for the whole series (section 6,
    item 13).
- **The lesson menu** builds its rows from `lessonViews`. There is no previous or next switcher. A
  gap reads as 11 "coming later" and 12 ready. B0's bar test reads the season's pages.
- **The `/learn/` hub** lists every lesson and links only the documents that exist
  (`tools/learn-hub.ts:72-95`). Its `hasPart` holds the lessons live by default, and the site
  worker settles it (`learn/index.html:60-64`).
- **The explorer and season data** draw arcs from `EDGES`. No edge joins 11 and 12, and
  `unlocks(10)` is `[12]`.
- **The publishing console** asks only while a drafts line stands (`AdminLessonsPage.tsx:186-207`;
  `waitingOn`, `lesson-admin.ts:96-98`). On main it never checks another lesson's state; with L12-C2 it
  also asks while a lesson it builds on (`PREREQ`) is not published, once for both (`aheadOf`, `publishQuestion`).
- **Tests that assume contiguous pages:**
  - main's count tests, which B0 fixes;
  - `learn-frame-loop.spec.ts:213`, which B15 or L10-P21 fixes;
  - explicit lists, which each gain a row: `learn-sound-gate.spec.ts:15`, `NO_FILM`
    (`learn-lesson-menu.spec.ts:250-254`), `CARDS` (`learn-next-card.spec.ts:27-76`), and the
    chip list (`:248-254`).
  - The `lessonPages(REPO)` specs take whatever pages exist.
- **First-paint budgets** need one entry per emitted page (`:541-564`), so there is no entry for 11.

**What Lesson 12's build must do**, so that `/learn/12` stays right with no `/learn/11`, whether it
is published first or not:

1. Keep B0 in the base. Name no lesson-with-no-page in a new test; call `lessonWithNoPage()`.
2. Link nothing to `/learn/11`. Every link comes from the season: the card leads to 13, the chip to
   10, and the menu and the explorer read the season.
3. Put `/learn/12` in the drafts group of `sw-runtime.ts` (`:138-157`), so a held-back page reaches
   the site worker's 404 page and never the app shell.
4. Carry a drafts line that names Lesson 10's page, so the console's question states the order. This
   holds until L12-C2 merges; after that the console names Lesson 10 itself (`aheadOf`), and the line
   needs only the coach's sign-off.
5. Add the two publish-state cases in section 5:
   - `/learn/12` with Lesson 10 held back;
   - `/learn/10` with Lesson 12 published and Lesson 11 still without a page.
6. Add the next-card row for `/learn/12`, which leads to Lesson 13, "Coming later".
7. Pad no lesson number by hand in a spec. Rely on the padded `open()`.

**The alternative.** The page could branch from `feat/lesson-09-page` after B2, or from main. Either
conflicts with L10-P11's registration in four files and in the end-to-end lists, and leaves the
recall's imports (L10-P8, L10-P14) missing. Not recommended.

## 4. Tasks

Each task gives its goal, files, tests, how to tell it is done, what it depends on and the pages it
can affect. These checks apply to every task and are not repeated:

- `pnpm check` passes, run once through the heavy wrapper.
- The named tests pass.
- A new module gets a banner header (CONVENTIONS.md § 7), and `pnpm docs:index:check` passes after
  `node scripts/gen-agent-index.mjs`.
- Where cited code moved, re-anchor, and `plan-cites check` stays at or under 183 findings.
- `pnpm pr:validate` passes.
- New files stay under 800 lines.
- Nothing listens: no microphone and no `getUserMedia` anywhere on the page.
- A change to LESSON's learner copy updates FACTS 3 and the spec's Length in the same commit
  (`scripts/lesson-words.test.mjs:325-357`).

### Kit (L12-K): each its own PR

**L12-K1. A voice kind for each note of a run** (simple)

- **Goal:** `RunNote` gains an optional `kind` (`VoiceOptions['kind']`), falling back to the run's.
  - `playNotes` passes it to `Sound.voice` note by note.
  - With L10-K2's one task per onset, a chord's soft voices at 0.05 and the tune's Merc note at 0.2
    start in the same task, and `onNote` hears them in that task (G1).
- **Files:** `kit/run.ts` (A2's `RunNote` `:21-25`; `playNotes` `:78-109`, its voice options
  `:86-93`) and `kit/run.test.ts`.
- **Tests:**
  - Three soft notes at 0.05 and one Merc note at 0.2, all at t = 0, build four voices in one task,
    each with its own kind and gain.
  - A note without a kind takes the run's.
  - Lesson 7's tests pass unchanged.
- **Done when:** Lesson 7's unit tests and its `learn-lesson-07*` specs pass, and Lesson 7's first
  paint is unchanged, give or take a few bytes.
- **Depends on:** L10-K2, which edits the same lines. It is best as part of K2, with one owner
  (section 6, item 3).
- **Pages it can affect:** Lessons 7 and 9. Neither passes a kind per note, so neither changes.

**L12-K2. Move do's reach for each side** (simple)

- **Goal:** a reach `{ lower, higher }` for `clampMove`, `nextShift` and `setMoveEnds`
  (`kit/move-do.ts:20-40`).
  - The default is `{ lower: MOVE_MAX, higher: MOVE_MAX }`, so Lessons 4, 6 and 8 stay as they are.
  - Lesson 12 passes `{ lower: 4, higher: 3 }` (FACTS 60).
- **Files:** `kit/move-do.ts` and `kit/move-do.test.ts`.
- **Tests:**
  - Tests 9's clamp: -4 and +3 hold, and +4 and -5 are refused.
  - With the default reach, plus and minus 4, as today.
  - `setMoveEnds` marks only the end that was reached, with `aria-disabled` once L10-K3 is in.
- **Done when:** the `learn-lesson-04*`, `learn-lesson-06*` and `learn-lesson-08*` specs pass, and
  those pages' first paint is unchanged.
- **Depends on:** L10-K3, which edits the same function. If K3 is refused, L12-K2 goes alone and
  keeps `disabled`, and section 6, item 4 corrects the spec.
- **Pages it can affect:** Lessons 4, 6 and 8, and B12. With the defaults, none changes behaviour.

### Page modules that need no page (L12-P1 to L12-P10)

Each is pure, or a painter tested against a recording 2D context, and each has its own unit test.
Each starts from main on its own branch and joins `feat/lesson-12-page` by rebase.

**L12-P1. The music** (moderate)

- **Goal:** `l12/music.ts`, the facts the page draws and plays.
  - A major key from its tonic: C4 (60) or G3 (55) for the sound, and its pitch classes for the
    ring.
  - Its seven chords by degree, each with:
    - its notes as MIDI, spelled one letter per degree (`spellScale`, `kit/notes.ts:170`);
    - its gaps and its quality: major 4 then 3, minor 3 then 4, diminished 3 then 3 with a fifth of
      6;
    - its numeral, I, ii, iii, IV, V, vi or vii°.
  - Each room's sides round the ring (major 4, 3 and 5; minor 3, 4 and 5; diminished 3, 3 and 6),
    and its corners as pitch classes.
  - The loop, I-V-vi-IV, voiced as FACTS 34 gives it: C4 E4 G4; G3 B3 D4; A3 C4 E4; F3 A3 C4.
  - The roots, C4 G3 A3 F3, then C4 again.
  - The tunes of FACTS 35 to 37: tune 1, tune 2, and tune 2 in even notes. Each note has its onset,
    its length, its chord, and whether it is a corner of that chord's room.
  - G major: the loop, the roots and the tunes five semitones lower (FACTS 69a). The chips sound
    from the key's own octave, C from C4 and G from G3 (FACTS 69).
  - Names are left out: the module holds degrees and MIDI, and the names switch adds syllables
    (L12-P13), so P1 does not wait for L10-K1.
- **Files:** `l12/music.ts` and `l12/music.test.ts`.
- **Tests:**
  - Tests 1 to 4.
  - Tests 1's numerals are checked against `romanOf` (`src/lib/ear/progressions.ts:30-32`), because
    `ROMAN` (`:28`) is not exported. Only the test imports it.
  - G major spells G B D through to F♯ A C, with no flat.
- **Done when:** Tests 1 to 4 pass.
- **Depends on:** nothing.
- **Pages it can affect:** none.

**L12-P2. Spoken numerals** (simple)

- **Goal:** `l12/numerals.ts`.
  - `spokenNumeral`, which reads 'vi' as "six minor", 'vii°' as "seven diminished", and
    'I–V–vi–IV' as "one, five, six minor, four".
  - `numeralHtml`, which prints each numeral `aria-hidden` with a visually hidden spoken form after
    it, as `signsHtml` (`kit/notes.ts:221`) does for a sharp or flat sign.
- **Files:** `l12/numerals.ts` and its test.
- **Tests:**
  - Tests 10's numeral clauses, for all seven numerals and the loop.
  - The spoken text holds no bare numeral.
- **Done when:** those pass.
- **Depends on:** nothing.
- **Pages it can affect:** none.

**L12-P3. The sounds** (moderate) **(L10)**

- **Goal:** `l12/sounds.ts`, every fixed sound as timed notes `{ t, midi, dur, gain?, kind? }`.
  That is A2's `RunNote` with L10-K2's per-note gain and L12-K1's kind. Use a local type of that
  shape until both land, then write `export type SoundNote = RunNote`, as FOLLOWUPS asks of Lesson
  9.
  - A chip's chord: 1.4 s at 0.075 a voice.
  - Play I, then vi: 1.4 s, a 0.3 s gap, then 1.4 s, so 3.1 s in all.
  - The loop: four chords of 2.0 s, so 8.0 s. The roots: 2.0 s each, soft, at 0.13.
  - A tune play: the loop at 0.05 a voice under Merc's notes at 0.2, 8.0 s.
  - The four words: 4.8, 2.7, 2.7 and 2.7 s (FACTS 70).
  - Sing it: Merc's notes, 1.6 s each with 0.4 s between and the last do 2.0 s, over I, V, vi, IV
    and I at 0.05, 10.0 s; and the guide's chords alone.
  - `slow(sound)`, which doubles every onset and length, and `inKey(sound, -5)` for G.
- **Files:** `l12/sounds.ts` and its test.
- **Tests:** Tests 5. Each frequency is `hz(m)` for FACTS 66's notes. The lengths are 8.0 s, and
  16.0 s under Slow, then 1.4 s, 3.1 s, 4.8 s and 2.7 s. A voice is 0.075 alone and 0.05 under
  Merc.
- **Done when:** Tests 5 passes.
- **Depends on:** L12-P1, stacked.
- **Pages it can affect:** none.

**L12-P4. The page's lines** (moderate)

- **Goal:** `l12/lines.ts`, every string a toy builds, in words only (`wordName`,
  `kit/notes.ts:193`; the numerals from P2):
  - each chip's accessible name, by step and mode: "The chord on do: C, E, G"; "Chord one, C major:
    C, E, G"; "Chord seven, F sharp diminished: F sharp, A, C"; with the syllables in place of the
    letters under Do-re-mi;
  - the figure's summary, such as "C major's seven chords, three lit: one, two and three.";
  - the live lines: "G major: every chord turned round the ring." and "One, C major, then six, A
    minor: C and E stay, and G becomes A.";
  - Step 4's moves, "do", "down to so", "up to la" and "down to fa";
  - the counts, such as "On a corner: 11 of 15";
  - the hero's lines: "Four chords: C major, G major, A minor, F major." and "Tune 1, over the four
    chords.";
  - Sing it's readout, "do is C4: C4, G3, A3, F3, C4", spoken "do is C 4", and Move do's readouts
    in Lesson 4's names for the key (FACTS 60).
  - It takes a function from degree to name as input, so it does not wait for L10-K1.
- **Files:** `l12/lines.ts` and its test.
- **Tests:**
  - Tests 10's copy clauses. Every template passes `validateGuidedDynamicClaim`
    (`src/lib/guided-voice/claims.ts:116`, surface `finding`).
  - No name or live line holds a ♯ or ♭ sign or a bare numeral.
- **Done when:** those pass.
- **Depends on:** L12-P1 and L12-P2, stacked.
- **Pages it can affect:** none.

**L12-P5. The chord strip's layout** (moderate)

- **Goal:** `l12/strip-layout.ts`. From the figure's width and height it gives:
  - the chips' rectangles: one row of seven at 440 px or wider, else rows of four and three;
  - the row for the step's own buttons;
  - whether the compact layout applies, below 240 px of height (spec Toys 1, :338).
- **Files:** `l12/strip-layout.ts` and its test.
- **Tests:** Tests 7, at every width from 344 to 1440 px:
  - every chip is at least 44 px each way, and no two overlap;
  - one row at 440 px and above, two below;
  - the compact layout below 240 px.
- **Done when:** Tests 7 passes.
- **Depends on:** nothing.
- **Pages it can affect:** none.

**L12-P6. The Sing it flow** (moderate)

- **Goal:** `l12/sing-flow.ts`, a pure rule in the shape of Lesson 6's (`lesson-06/sing-flow.ts`).
  - Its inputs: the comfort answer, the stored voice, whether Merc's notes were heard with sound on,
    the number of sweeps run, and the latest feeling.
  - Its outputs: the state, the controls shown, the line, and the Wrap's card (`afterFeeling` with
    `restAfterEffort: true`, `kit/comfort.ts:56-87`).
  - It keeps the kit's lock on the feeling answer until the coach decides (spec Decisions 7).
- **Files:** `l12/sing-flow.ts` and its test.
- **Tests:** Tests 8, apart from its storage clause, which belongs to L12-P18.
- **Done when:** that passes.
- **Depends on:** nothing.
- **Pages it can affect:** none.

**L12-P7. The Sing it guide** (simple) **(L10)**

- **Goal:** `l12/sing-guide.ts`.
  - Eight `GuideRow`s from fa up to do, a semitone apart, four of them named (`kit/slide-guide.ts:38-45`).
  - Merc's path, do so la fa do, with `gap` on every note after a silence (`:51-52`).
  - The breath at 5.6 s.
  - The reach `{ lower: 4, higher: 3 }` as data, and the notes at every shift for each voice, on a
    do of C4 or C5.
  - It takes a shift and never clamps it. The clamp is L12-K2's.
- **Files:** `l12/sing-guide.ts` and its test.
- **Tests:** Tests 9, apart from the clamp:
  - At every shift from -4 to +3, each note lies at least a semitone inside every preset of the
    voice. The presets are `VOCAL_RANGES` (`src/stores/settings-store.ts:91-152`); only the test
    imports it.
  - At +4, the bass preset has no room left.
  - The readouts run from A♭3 to E♭4, and from A♭4 to E♭5.
  - The chords move with do.
- **Done when:** those pass.
- **Depends on:** nothing.
- **Pages it can affect:** none.

**L12-P8. The quick check's questions** (simple)

- **Goal:** `QUIZ_QUESTIONS` in `l12/quiz-questions.ts`: `l12-q1` to `l12-q4` from LESSON:280-314.
  Each has three answers and a feedback line for each answer, with the numerals printed through P2.
  The recall's questions join this file in L12-P16, filtered from Lesson 10's own (G8).
- **Files:** `l12/quiz-questions.ts` and its test.
- **Tests:**
  - The quick-check half of Tests 11: the ids and the keys.
  - No feedback line starts with "Right", "Yes" or "Correct".
  - Every line passes the claims check.
- **Done when:** those pass.
- **Depends on:** L12-P2, stacked.
- **Pages it can affect:** none.

**L12-P9. The rooms painter** (moderate) **(L10)**

- **Goal:** `l12/rooms-draw.ts`, which draws in the spiral's overlay frame,
  `{ ctx, W, H, now, u, beads }`:
  - each room from its corners' beads, picked as G6 says, faint or lit. A lit room has a brighter
    line, a faint fill and chrome halos on its corners, plus the centre label;
  - the key switch's turn: every room moves 210 degrees in 0.6 s, each corner's angle interpolated
    round the ring's centre (G5), on an easing passed in (G7);
  - the corner slide from G to A in 0.3 s;
  - the walk: a pulse on each sung note's bead and a blue line from the note before. A note on a
    corner turns gold and grows a ring. The walk fades once the tune ends. The painter also draws
    the count readout;
  - under reduced motion, every motion lands at once;
  - whether it is still animating, reported for L10-K4's `overlayWants`.
- **Files:** `l12/rooms-draw.ts` and its test.
- **Tests:** against a recording 2D context:
  - a room's three corners sit at its beads;
  - mid-turn, the corners sit on the ring between beads;
  - only a corner note gets the gold ring, and nothing is gold before a choice;
  - under reduced motion everything lands at once;
  - at rest, it reports no animation.
- **Done when:** those pass.
- **Depends on:** L12-P1, stacked.
- **Pages it can affect:** none.

**L12-P10. The share card** (moderate)

- **File:** `public/learn/lesson-12-og.jpg`, a 1200x630 baseline JPEG near the other cards' 44 to 50
  KB.
- **How to render it** (locally only, never against production; Lesson 9 decision 3):
  1. On the dev server, build a throwaway page with the kit's spiral seen from above (`ring: 60`,
     sharps).
  2. Draw P9's four loop rooms in chrome. Draw no tune, no walk, no gold and no count (FACTS 1a).
  3. Put Merc and Tavi's stills on either side (`lesson-01/assets/merc-blue.png` and
     `merc-orange.png`), with "Chords and the four-chord song", "Lesson 12" and the wordmark.
  4. Take a screenshot with Playwright and convert it to a baseline JPEG.

  Commit only the JPEG.
- **Done when:**
  - `file` reports a baseline JPEG at 1200x630.
  - The card matches the alt text in needs 13.
  - `lesson-pages.test.ts:229-249` passes in L12-P11.
- **Depends on:** L12-P9, stacked. Run the render through the heavy wrapper.
- **Pages it can affect:** none until L12-P11 links it.

### The page (L12-P11 to L12-P21), on `feat/lesson-12-page`

**L12-P11. Page shell and registration** (hard; the branch's first commit)

Files:

- **`learn/12.html`:**
  - The head, as needs 12 gives it, on the pattern of `learn/04.html:3-145`, with no
    `datePublished`.
  - The masthead, with the anchors Lesson, Sing and Explorer.
  - The hero, laid out as Lesson 2's (`learn/02.html:329-502`):
    - the kicker and `h1.hook#hook`;
    - three chips: "15 minutes"; "After Lesson 10: Major and minor", an `a.chip.chip-link` to
      `/learn/10`; and "Sound on";
    - the promise and the sound gate;
    - the stage: the bubbles, Merc and Tavi, `canvas.sky`, the spiral's root as `role="slider"`, a
      polite live region, and the three plays. `loop-c` is free (`data-free`); `tune-1` and
      `tune-2` start disabled.
  - The predict card: the choices [ Most of them ] and [ Hardly any ], the lock hint "Choose an
    answer to unlock the two tunes.", and the reveal.
  - The `#recall` host.
  - Four words: four tickets, each with an inline SVG figure and a button.
  - `#lesson`: the five steps and the sticky stage.
    - The stage holds one `.viz.tall` figure, with its canvas and readouts, then `#stepNow`, Previous
      and Next.
    - The seven chips are plain buttons.
    - Each step has its row of controls:
      - Step 2: C · G.
      - Step 3: Play I, then vi; Slow; Letters · Do-re-mi.
      - Step 4: Play the loop; Play the roots; Slow.
      - Step 5: the three tune buttons and Slow.
    - The drawers: "Plain numbers" under Step 2, and "Start on vi" and "Another loop" under Step 4.
  - `#sing`, with its static copy, and the `#quiz` host.
  - `#wrap`:
    - the recap;
    - `#practiseCard`, in both versions;
    - `div[data-next-card]`, followed straight away by the plan-back link (G9), with the slot for
      the tease still;
    - the free-play card.
  - `#explorer` and the footer. No Watch section.
- **`l12/main.ts`**, in Lesson 4's boot order:
  1. The stylesheets: `lesson-fonts`, `lesson-base`, `lesson-sections`, `lesson-stage`,
     `lesson-guide`, `lesson-parts` and `lesson-voice`, then `lesson-12.css`. That is Lesson 6's list
     without `lesson-tune-line` and `lesson-ear-game`.
  2. No `Names.set`: sharps is the default (`kit/names.ts:84-88`).
  3. The sound switch and the motion switch.
  4. `createStepDeck({ toyFor: () => 1, after: { label: 'Sing it', selector: '#sing' } })`.
  5. `createNextCard(12)`, then the plan-back import, then `createExplorer({ current: 12 })`.
  6. `initMasthead(sections, { lesson: 12, deck })`.
  7. `initReveals`, `startFrameLoop`, and `initMercs(q('#heroStage'), { sparkles: 'none' })`.
- **`l12/lesson-12.css`:**
  - `--viz-min: 300px` on the stuck stage only, under
    `@media (min-width: 961px) and (min-height: 561px)`;
  - the hero duo, `.l12-duo`; Lesson 2's is at `lesson-02/lesson-02.css:14-82`;
  - the tease still's own class.
- **`kit/drafts.ts`:** Lesson 12's line, worded as section 6, item 2 decides.
- **`src/lib/sw-runtime.ts`:** `'/learn/12'` and `'/learn/12.html'` in the drafts group, after
  Lesson 10's.
- **`kit/season.ts`, Lesson 12's entry:**
  - the draft comment, `minutes: 15` and `page: '/learn/12'`;
  - `pr.link`: `{ href: '/ear-lab?lesson=12', addr: 'mercurypitch.com/ear-lab', label: 'Ear Lab',
    note: 'then tap Cadence' }` (owner; spec Decisions 5);
  - `pr.needs` stays.
- **`scripts/assert-first-paint-budgets.mjs`:** `learn/12.html` in both tables, each at the measured
  size plus a quarter. Write the reason comment the way Lesson 8's is (`:184-190`, `:268-271`): no
  microphone, and Merc's renderer as the only dynamic import.
- **`public/learn/lesson-12-og.jpg`,** from L12-P10.
- **The additions in section 5 that need only the shell.**
- **New `l12/page.test.ts`,** on Lesson 6's pattern (`lesson-06/page.test.ts`). It checks that:
  - every ♯ and ♭ and every numeral the page prints is spoken;
  - no sign and no numeral appears in an accessible name or in the share card's alt text;
  - every referenced id exists, once;
  - every button has `type=button`;
  - there is no Watch section;
  - the order is hero, then recall, then Four words;
  - there are three chips;
  - `loop-c` is free and both tunes are disabled;
  - every practice link carries `?lesson=12` before any hash;
  - the share card exists.
- **New `l12/page-dom.test-fixtures.ts`:** `loadPage()` for `learn/12.html`, importing the recorder
  for kit runs (section 3).
- **New `src/e2e/learn-lesson-12.spec.ts`:** End to end 1 and End to end 14.

Done when:

- These unit tests pass:
  - `lesson-pages`, `lesson-copy`, `team-notes`, `season`, `publish`, `explorer` and `plan-back`;
  - `draft-lessons` and `learn-hub`;
  - `sw-runtime` and `lesson-gate`;
  - B0's converted tests, and `l12/page.test.ts`.
- `build:e2e` builds, and the budget check passes. The numbers for every lesson are recorded, before
  and after.
- These end-to-end specs pass: `learn-stage-fit`, `learn-cold-open-fold`, `learn-no-planning-text`,
  `learn-next-card`, `learn-explorer`, `learn-lesson-menu`, `learn-sound-gate`,
  `learn-publish-state`, `learn-lesson-10*` and `learn-lesson-12`.
- Each `dist/learn/NN.html` links the same stylesheets, in the same order, as the base's build
  (MISTAKES.md:919-924).

Depends on: L10-P11, with B0 and B2 below it; L12-P10; and section 6, items 1, 2 and 9.

Pages it can affect:

- the first paint of every lesson page (G11);
- Lesson 10's explorer, where 12 appears under "Opens", linked wherever it is live;
- later, Lesson 11's card, once Lesson 11 has a page.

**L12-P12. The ring of rooms, with Steps 1 and 2** (hard)

- **Goal:** `l12/rooms.ts`, split into two modules if it nears 800 lines. It mounts the kit's spiral
  on the stage:
  - `setView('top')`, `ring: 60`, `range: () => [60, 71]` and `setTurning(false)`;
  - the five black keys lit at mount;
  - `owner: NowPlaying` (L10-K5);
  - P9's painter as its overlay, and P5's layout on the chips from the markup.
  - The build and numerals states: each chip plays P3's chord as a kit run through `NowPlaying`, and
    lights its room.
  - The key switch, C · G, is silent. A play already sounding stops first, then the rooms turn
    (Edge cases). It passes `easeOutExpo` (G7).
  - The compact layout, below 240 px of height: `setLabels('letter')`, the label in the top-left
    corner, and syllables on the chips only.
  - The summary and live text come from P4.
  - The tab order: the step's buttons, the switches, the chips from I to vii°, then the slider.
- **Files:** `l12/rooms.ts`, `l12/main.ts` and `learn/12.html` (the step rows), with their tests.
- **Tests:** `rooms.test.ts`, using `loadPage()`:
  - each state's chips, names and tab order;
  - G relabels vii° as "F♯ A C", spoken "F sharp", and C restores it;
  - a chip's play claims the owner, and a second claim stops it;
  - with sound off, the visuals still run;
  - the compact layout below 240 px;
  - End to end 4's Step 2 half.
- **Done when:** `learn-stage-fit` passes with the toy drawing, and the other lessons' first paint is
  unchanged.
- **Depends on:** L12-P1, P3, P4, P5, P9 and P11; L10-K2 with L12-K1; L10-K5; L10-P12; and L10-K4 if
  the page is to rest.
- **Pages it can affect:** Lesson 12.

**L12-P13. Steps 3 and 4, the names switch, and stopping sound on a step change** (moderate)

- **Goal:**
  - Step 3: Play I, then vi, with the corner slide and Slow.
  - The names switch, Letters · Do-re-mi:
    - a page-wide `createModeStore` over L10-K1's two-mode list;
    - the syllables are `MAJOR_SOLFEGE`, with do on the key's tonic;
    - the black keys carry no syllable.
  - Step 4: Play the loop and Play the roots, with the moves readout and Slow.
  - Every step change stops the stage's sound and any queued play: Next, Back, a swipe, the menu's
    jump, `#step-N`, or a quiz link. The deck's `onStep` (`kit/step-deck.ts:167`, with
    `registerToy` at `:94`) carries this.
- **Files:** `l12/rooms.ts` and `l12/main.ts`.
- **Tests:**
  - Tests 13:
    - the chord on la reads "la do mi", and the chord on do "do mi so";
    - in G, do is G and ti is F♯;
    - no state names la as home.
  - End to end 4's Step 3 half, ending on "vi · A minor".
  - A step change mid-loop stops the run and clears its timers.
- **Done when:** those pass.
- **Depends on:** L12-P12 and L10-K1.
- **Pages it can affect:** Lesson 12.

**L12-P14. Step 5's tune toy** (moderate)

- **Goal:** `l12/tune-play.ts`, which the cold open also uses.
  - It builds a tune play as one run: the chords soft at 0.05, with Merc's notes at 0.2 (L12-K1).
  - Its `onNote` drives the walk and the count.
  - Step 5 has three buttons, Tune 1, Tune 2 and Even notes, plus Slow.
  - While a tune plays, its button reads "Stop" and its name becomes "Stop tune 1" (section 6, item
    11).
  - The counts end on 11 of 15, 10 of 12 and 10 of 12.
- **Files:** `l12/tune-play.ts`, `l12/rooms.ts` and their tests.
- **Tests:**
  - each note starts in the same task as the chord under it;
  - Stop clears every timer and every voice;
  - the counts are right, and Slow doubles every length;
  - the walk stays, faint, until the next play.
- **Done when:** those pass.
- **Depends on:** L12-P12, L12-P13 and L12-K1.
- **Pages it can affect:** Lesson 12.

**L12-P15. The cold open** (hard)

- **Goal:** `l12/cold-open.ts`.
  - The hero's own spiral: seen from above, `ring: 60`, letters on the beads, the black keys lit,
    and the page's owner.
  - Four faint rooms, with no labels; and the still sky, `stillSky` (`kit/still-sky.ts:18`).
  - The predict (`kit/predict.ts:30-72`):
    - the plays `loop-c` (free), `tune-1` and `tune-2`;
    - `revealOn: ['tune-1', 'tune-2']` with `revealAfter: 'all'`, passed together;
    - LESSON's hints and guess lines.
  - Each play resolves with its run's `done`. So a tune cut short reveals nothing, whatever cut it:
    a bead tap, another sound, a hidden page (G2), or leaving the hero (section 6, item 10).
  - Merc sings through `singAlong('blue')`, and a stop calls `stopSingAlong` (`kit/sing-along.ts:26`,
    `:41`; the pattern is `lesson-06/cold-open.ts:84-93`).
  - Both listen while the four chords sound (`mercListen`).
  - Tavi celebrates once, on the reveal: `onReveal: () => mercCelebrate('orange', 1600)`.
  - The live lines come from P4.
- **Files:** `l12/cold-open.ts`, `l12/main.ts`, its test and `learn-lesson-12.spec.ts`.
- **Tests:** Tests 6 and End to end 2.
- **Done when:** those pass at both viewports.
- **Depends on:** L12-P9, P11 and P14; L10-K5; and G2's source, either L10-K2's item 5 or the page's
  own listener.
- **Pages it can affect:** Lesson 12.

**L12-P16. Recall and quick check** (moderate)

- **Goal:**
  - `RECALL_QUESTIONS` joins `l12/quiz-questions.ts`, filtered by id (`l10-q1`, `l10-q2`) from
    Lesson 10's `QUIZ_QUESTIONS`. The pattern is Lesson 4's filter of Lesson 2's
    (`lesson-04/quiz-questions.ts:28-29`).
  - **The recall**, `l12/recall.ts`:
    - `createQuiz({ questions: RECALL_QUESTIONS, keys: { seed: 'fyp-l12-recall-seed', record:
      'fyp-l12-recall-v1' }, prefix: 'recall-', away: { href: recallStepHref } })`, with no
      `lesson`;
    - shown to everyone, so it has no `data-if-live` wrapper;
    - L10-P14's binder on its host. The question's button reads "Play the question's chord".
  - **The quick check:** `createQuiz({ questions: QUIZ_QUESTIONS, lesson: 12, keys: { seed:
    'fyp-l12-seed', record: 'fyp-l12-quiz-v1' }, deck })`.
- **Files:** `l12/quiz-questions.ts`, `l12/recall.ts`, `l12/main.ts` and `learn-lesson-12.spec.ts`.
- **Tests:**
  - The recall half of Tests 11. Both questions equal Lesson 10's, because they are imported, and
    `recallStepHref(10, 1)` is `/learn/10#step-1`.
  - End to end 9.
- **Done when:** those pass.
- **Depends on:** L12-P8, L12-P11, L10-P8 and L10-P14.
- **Pages it can affect:** Lesson 12.

**L12-P17. Four words** (simple)

- **Goal:** `l12/words.ts`.
  - The four tickets' SVG figures: small rings, `aria-hidden`.
  - The plays go through `bindWordPlays(root, play, { owner: NowPlaying })`
    (`kit/words-strip.ts:54-87`), with the sounds from P3.
  - Each button is named "Play" plus LESSON's label. "I, then V" is spoken "chord one, then chord
    five".
  - Under reduced motion, the corners light in turn.
- **Files:** `l12/words.ts`, its test and `learn/12.html`.
- **Tests:**
  - a word's play claims the owner;
  - the lengths match P3's;
  - every name is in words only.
- **Done when:** those pass.
- **Depends on:** L12-P3, L12-P11 and L10-K2.
- **Pages it can affect:** Lesson 12.

**L12-P18. Sing it** (hard)

- **Goal:** `l12/sing.ts`.
  - P6's flow on the kit's comfort check, voice choice and feelings: `mountComfort`
    (`kit/comfort.ts:159`), `bindVoiceButtons` (`kit/voice-choice.ts:60`), and `mountFeelings` (`:175`) without `changeable`.
  - P7's guide on `mountGuide` (`kit/slide-guide.ts:381`), with `breaths: [5.6]`.
  - The ring (`kit/sing.ts:135`), with the singing Merc's still.
  - Play Merc's notes, as one run (P3; L12-K1).
  - Start the guide stays `aria-disabled`, with its hint, until Merc's notes have been heard with
    sound on.
  - The count-in (`countIn`, `kit/move-do.ts:47-51`), then the sweep with the chords under it.
  - Move do takes L12-K2's reach and L10-K3's `aria-disabled`. It moves Merc's notes, the chords,
    the count-in and the readout together.
  - Leaving stops the sound: the section off screen for 600 ms, or a hidden page
    (`lesson-03/sing.ts:388-412`).
- **Files:** `l12/sing.ts`, `l12/main.ts`, `learn/12.html`, its test and `learn-lesson-12.spec.ts`.
- **Tests:**
  - Tests 8's storage clause: only `fyp-voice` is written.
  - End to end 7 and End to end 8.
- **Done when:** those pass at both viewports.
- **Depends on:** L12-P6, P7 and P11; L10-K2 with L12-K1; L12-K2; and L10-K3, on the lead's
  decision.
- **Pages it can affect:** Lesson 12.

**L12-P19. The Wrap** (moderate)

- **Goal:**
  - The recap.
  - The practice card, in the version `VisitEnding` picks (`kit/comfort.ts:101-114`;
    `mountPractiseCard` `:126`):
    - Arpeggio Jumper;
    - or, after Effortful, Uncomfortable or Just listen today, the rest card;
    - with Cadence as the second drill either way.
  - The free-play card: its own copy of the rooms toy, with every control (as
    `lesson-04/main.ts:90-92`).
  - The tease still in the next card's slot (`kit/next-card.ts:27-30`): an SVG, `aria-hidden`, with
    no button and a class of its own.
- **Files:** `learn/12.html`, `l12/main.ts`, `l12/lesson-12.css` and the specs.
- **Tests:**
  - End to end 10 and End to end 11, with section 5's tease test;
  - the rest card after each of the three answers;
  - every link opens in a new tab.
- **Done when:** those pass.
- **Depends on:** L12-P12 to P14, and P18.
- **Pages it can affect:** Lesson 12.

**L12-P20. End-to-end checks across the page** (moderate)

- **Files:**
  - `learn-lesson-12.spec.ts`:
    - End to end 3, as a keyboard sweep at 390x844:
      - Tab reaches every chip, switch and button;
      - each toggle flips `aria-pressed`;
      - each announcement reaches the live region;
      - every target is at least 44 x 44 px, and none overlaps another.
    - End to end 13, under reduced motion.
  - `learn-frame-loop.spec.ts`: Lesson 12's ring, guide and explorer rest. The whole page rests only
    with L10-K4.
  - `learn-publish-state.spec.ts`: the two cases in section 5.
- **Done when:** these pass at both viewports on `build:e2e`.
- **Depends on:** L12-P12 to P19; and L10-P21 (or B15) for the padded `open()`.
- **Pages it can affect:** none; only specs change.

**L12-P21. Final measurement and docs** (moderate)

- **Goal:**
  - Re-measure first paint, and set Lesson 12's two ceilings to the measured size plus a quarter,
    with the reason.
  - Compare each `dist/learn/NN.html`'s stylesheet links with the base's build.
  - Run the app-check skill, locally or on dev and never against production, at phone and desktop
    widths. Cover:
    - the cold open, before and after its reveal;
    - Sing it, in each state;
    - "Play the four chords" on the first screen at 390x844 (End to end 6).

    Then walk the spec's QA list (spec:1290-1316).
  - `pnpm lesson:words` must give 2,336.
  - Re-anchor the spec's citations, and correct the drift in section 6, item 17.
  - The `mirror-metrics.ts` count goes from 19 to 21.
  - HANDOFF § 4.1's "Done since" records L12-K1 and L12-K2. After the merge, add the MASTER-PLAN § 11
    and CURIOSITY-MOMENTS records.
- **Files:**
  - `scripts/assert-first-paint-budgets.mjs`;
  - Lesson 12's `LESSON.md`, `FACTS.md` and `WEB-SPEC.md`;
  - `workers/db-worker/src/mirror-metrics.ts`;
  - `docs/plans/find-your-pitch/HANDOFF.md`, and later `MASTER-PLAN.md` and `CURIOSITY-MOMENTS.md`;
  - `docs/agent/INDEX.md`, regenerated.
- **Tests:**
  - `scripts/lesson-words.test.mjs`;
  - `node scripts/plan-cites.mjs check`, at or under 183;
  - `pnpm docs:index:check`.
- **Done when:** those pass, the ceilings are set with their reasons, and the app-check verdicts are
  recorded with screenshots.
- **Depends on:** L12-P11 to P20, L10-P22 and B16.
- **Pages it can affect:** none; docs and ceilings only.

### App (L12-C): independent of the page

**L12-C1. The copy that changes with Arpeggio Jumper v2** (simple; docs)

- **When v2 ships** (`arp/CONSENSUS.md`, Step 1):
  - Delete the richness clause from LESSON:447-449 (the coach note), from FACTS 46 and from
    spec:779. These are the three that CONSENSUS lists for Lesson 12.
  - If the owner includes the octave offset (CONSENSUS decision 2), rewrite the octave sentence too.
    It is at LESSON:334-335, LESSON:463-465, spec:750-751 and FACTS 46. CONSENSUS's copy-fix list
    names this sentence for Lesson 9 but misses it for Lesson 12.
  - The octave sentence is learner copy, so FACTS 3 and the Length change in the same commit.
- **Once C1 merges:**
  - FACTS 51's claim that "a slug launch carries only `exercise`, `notes`, `scaleId` and
    `difficulty`" goes out of date, since C1 adds `intervals`.
  - FACTS 51's `App.tsx:593-638` citation is already stale; `applyExerciseSlug` is at `:724-769`.
  - Add FACTS 51 to the facts that FOLLOWUPS says C1 makes out of date.
- **Depends on:** v2, the owner's decision 2, and the re-anchors by B0, L10-K1 and L10-P22. Rebase
  onto those.

**L12-C2. A console warning about the order** (moderate; on the owner's yes)

- **Goal:** before a publish, the console checks the lessons in `PREREQ[n]`. If one is not published
  in the console's state, it asks first, for example "Publish Lesson 12 before Lesson 10?". It
  does so whether a drafts line stands or not (`AdminLessonsPage.tsx:186-207`).
- A pure helper goes in `src/features/admin/lessons/lesson-admin.ts`, returning the lessons a
  publish would get ahead of.
- Its test goes in a new file, so it does not meet B0's edits to `lesson-admin.test.ts` and
  `AdminLessonsPage.test.tsx`.
- It also covers Lesson 10, which recalls Lesson 6, and every later lesson.
- **Depends on:** the owner's yes (spec Decisions 3).

**L12-C3. Chord Stacker's triads** (hard; a design first)

- **Goal:** the drill has no choice of chord type (G12). It needs:
  - a chord-type setting;
  - `maj` at 0, 4 and 7, and `min` at 0, 3 and 7, with their labels;
  - a launch field for the chord type.
- The best-of term in its grade (`:295`) belongs to CONSENSUS's later steps.
- Only once triads ship does the card name Chord Stacker (LESSON's editorial note).
- **Depends on:** C1's launch plumbing, and the owner.

**L12-C4. Cadence on its own** (moderate)

- **Goal:** once C10-3's `ear-drill` launch kind exists, add a Cadence launch under a slug the owner
  names. Then the season link and the card drop "then tap Cadence".
- **Depends on:** C10-3.

### Release (L12-R1)

**L12-R1. Publish the page** (owner)

- **When:** Lesson 10's page is live, the vocal coach has looked at Sing it (spec Decisions 3), and
  the owner has heard both tunes (spec Decisions 4).
- **Steps:**
  - delete Lesson 12's drafts line;
  - add the page to `public/sitemap.xml` and to the Lessons list in `public/llms.txt` (`:66-80`);
  - set `datePublished` straight after the console publishes the page (spec Decisions 12).
- The released checks then apply (`lesson-pages.test.ts:278-305`). The entry documents link the page
  by themselves (`navLinksFor`, `src/seo/entry-pages.ts:778-805`).
- **Depends on:** L12-P21, and Lesson 10's release.

## 5. The test shifts, and B0 with Lesson 12 built before Lesson 11

The base holds B0, B2 and L10-P11. Lines are main's unless marked B0's.

**B0's conversions, checked with Lesson 12 built and Lesson 11 not.** `lessonWithNoPage()` returns
Lesson 11.

| Test | What it now asks for | With 12 built before 11 | Holds |
| --- | --- | --- | --- |
| `kit/publish.test.ts`, the isLive test (B0's `:45-56`) | `lessonWithNoPage().n` | 11 | Yes |
| `kit/lesson-menu.test.ts`, rows and label | `later`: "Lesson 11, Registers and the break, coming later", with no link | 11 | Yes |
| `kit/lesson-menu.test.ts`, the season bar | Lessons 6 on, read from the season's pages | ready for 6 to 10, later for 11, ready for 12, later for 13 and 14 | Yes. The test reads the gap; it does not assume there is none. |
| `kit/next-card.test.ts` | `nextCard(…, later.n - 1)` and `createNextCard(later.n - 1)` | On Lesson 10: Lesson 11's card, "Coming later", "See it on the map" | Yes. `nextCard` reads only `current + 1` (`next-card.ts:95-123`), so 12's page changes nothing. |
| `kit/explorer-reveal.test.ts` | `pageWithNextCard(later.n - 1, later.n)`, then `h3` is `later.title` | (10, 11), "Registers and the break" | Yes |
| `kit/explorer.test.ts` (B0's `:291-293`) | A lesson with no page and no link that opens another | 11, since `unlocks(11)` is `[13]` | Yes. Once 11 also has a page, 13 and 14 open nothing, and the helper throws. Whichever of 11 and 12 lands second rewrites the test: drop the `unlocks` clause, and expect `['Topics', 'Builds on']` plus `'Opens'` only when `unlocks(later.n)` is not empty. |
| `lesson-admin.test.ts:96` and `:481` | `rowFor(lessonWithNoPage().n)` | 11: planned, with no drafts line and no page | Yes |
| `AdminLessonsPage.test.tsx` | The live column and the site paths, read from the season | 11 shows "No page yet"; 12 joins the paths | Yes |

`later.n - 1` is always safe. `lessonWithNoPage()` returns the first lesson after the trailer with
no page, so every lesson before it has one. Lesson 1 has a page, so `later.n - 1` is never the
trailer. It need not be the newest page, and none of these tests asks that.

**The tests that still name a lesson** (the coordinator's list). Lesson 12's page changes none of
them.

- `learn-next-card.spec.ts`:
  - `:72`, Lesson 8's row, which leads to Lesson 9;
  - `:121-145`, Lesson 8's tease;
  - `:195-207`, the map test.

  B2 and L10-P11 move these.
- `learn-explorer.spec.ts:141-158`: B2, then L10-P11.
- `learn-lesson-menu.spec.ts:378-382`: L10-P11.
- `learn-lesson-08.spec.ts:16` and `:260-283`: B2.
- `kit/lesson-copy.test.ts:213-225`: the season's copy, not its pages.
- `kit/season.test.ts:93-119`, `litEdges(9)`: the graph, which no page changes.

Lesson 10's plan asks B2 to make three of these specs call `lessonWithNoPage()` and open the page
before it: the map test, the explorer test and the menu test. Then no later page edits them. With
12 built before 11, they would open `/learn/10` and find Lesson 11, which is right.

**What Lesson 12 adds.**

Unit tests, in L12-P11:

- `kit/season.test.ts`: a test in the shape of Lesson 8's (`:268-284`): `/learn/12`, 15 minutes, no
  film, and `/ear-lab?lesson=12`, with a `note` clear of the backlog words at `:186-187`.
- `kit/publish.test.ts`: Tests 12's two cases, in the shape of B0's `:58-74`.
- `kit/explorer.test.ts`: in B0's draft block (`:421-490`), a case in the shape of Lesson 5's (B0's
  `:464-489`).
  - With '0', Lesson 12 shows as "Coming later", with no link and its practice link kept.
  - With '1', it is linked to read.

Nothing else: B0 made the rest read the season.

End-to-end specs:

- `learn-next-card.spec.ts` (L12-P11):
  - a `CARDS` row after L10-P11's `/learn/10` row: `['/learn/12', 'Next lesson 13 · Resonance and
    vowels Coming later', '#explorer', 'See it on the map']`;
  - a tease test in the shape of `:121-145`, on `/learn/12`:
    - `.next-tease` is `LESSON_COPY[13].tease`;
    - the words run `['eyebrow', 'next-tease', 'q2', 'chip']`;
    - the card's children are `['next-words', 'l12-tease']`, with no button (End to end 11);
  - optionally, `'/learn/12'` in the prerequisite-chip list (`:248-254`), which leaves out Lessons 7
    and 8 too.
- `learn-sound-gate.spec.ts` (L12-P11): add `'12'` at `:15`, and make the header at `:10` list the
  lessons.
- `learn-lesson-menu.spec.ts` (L12-P11): `NO_FILM` gains `{ n: 12, title: 'Chords and the four-chord
  song' }`, as L10-P11 adds 10.
- `learn-frame-loop.spec.ts` (L12-P20): Lesson 12's test, `open(page, 12)` after the padding, and
  `explorerRests(page, 12, whole)`.
- `learn-publish-state.spec.ts` (L12-P20):
  1. `/learn/12` with `{ drafts: true, lessons: { 10: { published: false } } }`, modelled on the
     `/learn/04` case (`:106-126`):
     - the "After Lesson 10" chip stays, as a plain chip;
     - no `a[href^="/learn/10"]` is left, the recall's step links included: after a wrong answer,
       "Try Lesson 10, Step 1 again" shows as plain words;
     - Lesson 10's map card and menu row read "Coming later";
     - the page raises no error.
  2. `/learn/10` with Lesson 12 published and Lesson 11 still without a page:
     - the card reads "Next lesson 11 · Registers and the break Coming later" and links
       `#explorer`;
     - Lesson 12's map card and menu row link `/learn/12`.

These pick the page up by themselves:

- unit tests: `lesson-pages.test.ts`, `kit/lesson-copy.test.ts:323-357`,
  `kit/team-notes.test.ts:84-102`, `kit/plan-back.test.ts:303-363`, `kit/season.test.ts:286-303`,
  `sw-runtime.test.ts:243-266`, `lesson-gate.test.ts:59`, `learn-hub.test.ts` and
  `draft-lessons.test.ts:145`;
- end-to-end specs: `learn-stage-fit`, `learn-cold-open-fold` and `learn-no-planning-text`.

## 6. Ambiguities, conflicts and blockers

1. **Shipping (lead; before L12-P11).**
   - Recommended: the page stacks on `feat/lesson-10-page` after L10-P11, as one PR with one commit
     per task, and nothing merges before the tag.
   - It cannot merge before Lesson 10's page, because its recall imports Lesson 10's modules.
2. **The drafts line (lead; L12-P11).**
   - The spec's line is "Lesson 10's page at /learn/10, and the vocal coach's look at the sung
     checkpoint", about 90 bytes on every page.
   - Lesson 10's line copies the same form, so one wording should serve both.
   - A shorter line helps Lesson 3's ceiling (G11).
3. **One owner each for the shared kit parts (lead).**
   - L12-K1 folds into L10-K2.
   - L12-K2 folds into L10-K3, which already offers a page its own limits.
4. **`aria-disabled` on Move do (lead; L10-K3).** One answer serves Lessons 10 and 12. If the answer
   is no, Move do keeps `disabled`, and the spec's Toys 6, state 4 and End to end 7 are corrected.
5. **Resting page-wide (lead; L10-K4).**
   - Without K4, Lesson 12 never rests page-wide, with three spirals on the page.
   - If K4 goes ahead, Lesson 12 also needs `overlayWants` (G4).
6. **The drag (lead).** Recommended: no kit change. The rooms follow the beads (G5), and the spec is
   corrected.
7. **The stop on a hidden page (lead; L10-K2's item 5).** Recommended: keep item 5. Otherwise the
   page subscribes to `onStopAll` itself (G2).
8. **Arpeggio Jumper's copy (owner; CONSENSUS decision 2).**
   - If the octave offset ships, the octave sentence (LESSON:334-335) changes. CONSENSUS's copy-fix
     list for Lesson 12 names only the richness lines; add the octave sentence (L12-C1).
   - Until v2 ships, the drill's grade also has the best-of term, `bestNote` at 0.3 (section 1).
9. **The explorer card's practice link (owner; L12-P11).** Recommended: Cadence, as spec Decisions 5
   gives it. It needs no voice, so it is right however Sing it ends.
10. **"Leaving the hero for a step" (lead; L12-P15).** The spec does not define the trigger.
    Recommended: any step change of the deck, or the hero off screen for 600 ms, as Sing it's rule
    has it.
11. **The tune toy's Stop label (lead; L12-P14).**
    - While a tune plays, its button shows "Stop", but its accessible name stays "Play tune 1". That
      fails WCAG 2.5.3, as Lesson 9 decision 17 found.
    - Recommended: while it plays, the name is "Stop tune 1", "Stop tune 2" or "Stop tune 2 with even
      notes".
12. **The tunes' likeness (owner; before L12-R1).** Spec Decisions 4: the owner listens to both
    tunes before the page publishes.
13. **Lesson 10's card once Lesson 12 is live (owner).**
    - The card names Lesson 11, by design. A learner reaches 12 through the map or the menu's "up
      next".
    - A card that skipped to the next live lesson would be a kit change for the whole series. Lesson
      12 does not need it.
14. **The console warning (owner; L12-C2).**
15. **The vocal coach's items (owner and coach):**
    - the rest card after Effortful (spec Decisions 6);
    - the lock on the feeling answer (7);
    - Move do's top, three semitones higher (8);
    - the chords at 0.05 under the voice (9);
    - the volume line (10).
16. **Lesson 11's still (lead).** Spec Decisions 13 sets a rule for the still that previews this
    lesson on Lesson 11's card: no tune note on the ring. The lead passes it to Lesson 11's writer.
17. **Drift and stale statements.** Each is fixed in the task named, or in L12-P21.
    - Needs 3: "the kit's spiral needs nothing" (G3 to G5).
    - Needs 8: "a schedule that can be stopped" means `kit/run.ts` (B16 or L10-P22; FOLLOWUPS).
    - Audio: chords played "through `playTone`" (`sound.ts:560-569`) cannot be stopped. They become
      runs (G1).
    - Toys 1: "the kit's `expoOut` curve" (`reveal.ts:17-18`) is a CSS string (G7).
    - Toys 1: "`setTurning(false)` holds it still" (G5).
    - Tests 1: "the app's `ROMAN`" is not exported; use `romanOf`.
    - Toys 5, and Merc and Tavi: Merc should sing through the kit's `singAlong`, not a direct
      `mercSing`. The merc-duo lines `:164`, `:206`, `:216` and `:120-126` are now `:143`, `:185`,
      `:195` and `:99-106`.
    - `comfort.ts`:
      - `mountComfort` `:158-166` is now `:159`;
      - `mountFeelings` `:168-206` is now `:175-206`;
      - `VisitEnding` `:95-114` is now `:101-114`.
    - `stairs-words.ts`: `SOLFEGE` `:25-35` is now `:26-35`.
    - `lesson-04/main.ts`:
      - the recall, `:58-65`, is now `:59-65`;
      - the explorer, `:94-96`, is now `:105`;
      - the masthead, `:99-110`, is now `:108-119`.
    - FACTS 51 (L12-C1):
      - `App.tsx:593-638` should be `applyExerciseSlug`'s `:724-769`;
      - "carries only" becomes false once C1 lands.
    - Practice links: "the setup's Chord Type menu" does not exist (G12).
    - B0 has already re-anchored three of the spec's citations (`publish.test.ts` `:58-74`;
      `explorer.test.ts` `:464-489`, in the block `:421-490`). Read the spec on the base.
    - SEARCH.md § 8 lists Lesson 12 under `/piano-night` and `/guitar-night`. Its practice rooms
      are `/pitch-training` and `/ear-lab`. Every entry document links every released lesson anyway
      (`entry-pages.ts:778-805`), so this is a docs fix for the lead.
18. **Asks of Lesson 9's and Lesson 10's builders (lead).**
    - B15 or L10-P21 pads `open()`.
    - B2's recorder for kit runs lives beside `kit/run.ts`.
    - L10-P14 exports its quiz-play binder.
    - L10-P8's ids and slot stay fixed once shipped.
    - L10-K2 takes a kind on each note.
    - L10-K3 takes a reach for each side.
19. **Not build blockers.**
    - Publishing waits for Lesson 10's live page and the coach's look.
    - L12-C1 to L12-C4 do not gate the page.

## 7. Where each spec test lands

| Spec test | Task |
| --- | --- |
| Tests 1 to 4 | L12-P1. Tests 1's numerals are checked against `romanOf`. |
| Tests 5 | L12-P3 |
| Tests 6 | L12-P15 |
| Tests 7 | L12-P5 |
| Tests 8 | L12-P6. The storage clause goes to L12-P18. |
| Tests 9 | L12-P7. The clamp goes to L12-K2. |
| Tests 10 | L12-P4 (claims, words only), L12-P2 (spoken numerals), L12-P8 (quiz feedback), and L12-P11's `page.test.ts` (signs and numerals in the markup) |
| Tests 11 | L12-P8 (the quick check) and L12-P16 (the recall) |
| Tests 12 | L12-P11 |
| Tests 13 | L12-P13 |
| End to end 1 | L12-P11 |
| End to end 2 | L12-P15 |
| End to end 3 | L12-P20, on the controls from L12-P12 to P14 |
| End to end 4 | L12-P12 (Step 2) and L12-P13 (Step 3) |
| End to end 5 | Taken automatically: `learn-stage-fit` reads the page from L12-P11 on. |
| End to end 6 | Taken automatically: `learn-cold-open-fold`. L12-P21's app-check sweep confirms it. |
| End to end 7 and 8 | L12-P18 |
| End to end 9 | L12-P16 |
| End to end 10 | L12-P19, and `page.test.ts` in L12-P11 |
| End to end 11 | L12-P11 (the row and the tease test) and L12-P19 (the still) |
| End to end 12 | Taken automatically: `learn-no-planning-text`. |
| End to end 13 | L12-P20 |
| End to end 14 | L12-P11 |
