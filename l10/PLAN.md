# Lesson 10 page, "Major and minor" (/learn/10): build plan

This plan comes from a read-only survey on 24 October 2026 of
`/home/user/mercurypitch/.claude/worktrees/names-lock`, a detached checkout of origin/main at
`5e08dd4a3`. It also covers Lesson 9's B0 commit, `33537af37` on `feat/lessons-no-page-tests`, read
with `git show` at the coordinator's request. Every status here was checked in the code, not taken
from the spec. Line numbers are main's unless a line says "B0's".

The plan has the shape of Lesson 9's (`…/scratchpad/l9/PLAN.md`). It applies the lead's Lesson 9
decisions (`l9/DECISIONS.md`) and builder rules (`l9/BUILDER-RULES.md`), and it takes account of
`l9/FOLLOWUPS.md` and `arp/CONSENSUS.md`. No other Lesson 9 branch was read. What a Lesson 9 task
delivers is taken from its plan.

Short names used below:

- **Spec**: `docs/plans/find-your-pitch/lessons/10-major-minor/WEB-SPEC.md`. **LESSON** and
  **FACTS N**: the package's `LESSON.md` and the numbered facts in its `FACTS.md`.
- **Tests N** and **End to end N**: the numbered cases in the spec's Tests section (spec:973-1089).
- **kit/**: `src/features/lessons/kit/`. **l10/**: `src/features/lessons/lesson-10/`.
- **A1a to A8, B0 to B16, C1 to C4**: Lesson 9's tasks. **K**, **P**, **C10** and **R1** are this
  plan's tasks.

## 0. Summary

**Status of the spec's 17 items** ("What the kit and the app still need", spec:753-869):

| Status                | Count | Items                       |
| --------------------- | ----- | --------------------------- |
| Done                  | 5     | 6, 8, 9, 10, 16             |
| Partly                | 3     | 4, 5, 7                     |
| Not done              | 8     | 1, 2, 3, 11, 12, 13, 14, 17 |
| Waits for the release | 1     | 15                          |

Item 4 says "the kit's spiral needs nothing". Its API is on main, but two things are missing. A tap
on a bead never reaches the page's one-sound owner, and the spiral's drawer never lets the frame
loop rest (section 2, G2 and G3).

**Missing from the list** (section 2): sounds that can be stopped; the spiral's sound owner; a
spiral that rests; the quick check's play button; the plan-back link every lesson page carries; the
end-to-end specs that name the next lesson with no page; first-paint room on Lessons 3 and 4.

**No conflict with main in the head.** The spec's head passes every test on main. The title has 57
characters and the description 159, with "A seventeen-minute lesson". `h1.hook`, `og:description`,
`twitter:description` and `alternativeHeadline` carry the season's hook
(`kit/lesson-copy.test.ts:323-358`). The one chip links Lesson 6, matching `PREREQ[10]`, built from
the edge `[6, 10]` (`kit/season.ts:419`, `:430`). Smaller places where main rejects the spec as
written are in section 6, item 15.

**Lesson 9's B0 changes the test work.** With B0 in the base, no unit test needs a shift for this
page. Several end-to-end specs still name a lesson. Section 5 says which ones this page changes and
which it leaves alone.

**Task order.** Details are in section 4.

- **Kit**, each its own PR to main:
  - K1: the names switch's modes, and the do-based minor's syllables, move into the kit.
  - K2: chords on A2's kit runs: one start for a chord, a level per note, runs combined, and "not
    heard" when every sound stops.
  - K3 (on the lead's yes): Move do's end buttons take `aria-disabled`, on Lessons 4, 6 and 8 too.
  - K4 (on the lead's yes): the spiral lets the frame loop rest.
  - K5: the spiral plays through a page's one-sound owner.
- **Page modules that need no page**, each on its own branch, joining the page branch by rebase: P1
  chords, P2 sounds, P3 the ear game's rounds, P4 the Sing it flow, P5 the Sing it guide, P6 the
  chord beads' layout, P7 the page's lines, P8 the quiz questions, P9 the hero's marks and the bead
  slide, P10 the share card.
- **The page**, on one branch, `feat/lesson-10-page`, stacked on `feat/lesson-09-page`, one commit
  per task: P11 shell and registration, P12 the chord beads, P13 the cold open, P14 recall and quick
  check, P15 Four words, P16 Steps 1 and 2, P17 Steps 3 and 4, P18 Step 5 and leaving a step, P19
  Sing it, P20 the Wrap, P21 checks across the page, P22 final measurement and docs.
- **App**, independent of the page: C10-1 Drone's "richness" (no Lesson 10 code), C10-2
  `/exercises/thirds-on-a-drone`, C10-3 `/exercises/major-or-minor`, C10-4 the app copy this lesson
  contradicts.
- **R1**, the release, once Lesson 6's page is live and the vocal coach has looked at Sing it.

**Blockers and open questions** (detail in section 6):

- The word "thirds" in the description and in `teaches`.
- How the work ships, and the drafts line's wording.
- Which practice link the explorer card shows (owner).
- Whether Drone's richness needs a Lesson 10 task.
- Move do's `aria-disabled`.
- Whether the page rests page-wide (K4).
- The recall's button name.
- Where K1 lives, and one owner each for K1 and K2 across Lessons 10 and 12.
- First-paint room.
- How the share card is rendered.
- Whether to accept K5.
- LESSON's stale Lesson 11 hook.
- What a stage control does to a sound already playing.
- Three asks of Lesson 9's builders.

**Everything else waits.**

- K2 (`feat/kit-run-chords`, moderate) stacks on `feat/kit-run` after A2's fix commits.
- K3 (`feat/kit-move-do-aria`, simple) waits for the lead's yes.
- K4 (`feat/kit-spiral-rest`, hard) waits for the lead's yes and goes after K5.
- The page, P11 to P22 on `feat/lesson-10-page`, starts from `feat/lesson-09-page` once B0 and B2
  are on it.
- C10-2 and C10-3 wait for C1.
- R1 waits for the release.

The tasks below touch no file that a Lesson 9 task edits.

**Can start now**

- K1, names modes in the kit: `feat/kit-names-modes`, moderate.
- K5, the spiral's sound owner: `feat/kit-spiral-owner`, moderate.
- P1, chords: `feat/lesson-10-chords`, simple.
- P2, sounds: `feat/lesson-10-sounds`, simple; stacked on P1.
- P3, the ear game's rounds: `feat/lesson-10-game-rounds`, simple; stacked on P1.
- P4, the Sing it flow: `feat/lesson-10-sing-flow`, moderate.
- P5, the Sing it guide: `feat/lesson-10-sing-guide`, simple.
- P6, the chord beads' layout: `feat/lesson-10-chord-layout`, moderate.
- P7, the page's lines: `feat/lesson-10-lines`, moderate; stacked on P1.
- P8, the quiz questions: `feat/lesson-10-quiz`, simple.
- P9, the hero's marks and the bead slide: `feat/lesson-10-hero-marks`, moderate.
- P10, the share card: `feat/lesson-10-share-card`, moderate; stacked on P9.
- C10-4, the app copy: `feat/lesson-10-app-copy`, simple.

## 1. Status of each spec item

| #   | Item | Status | Evidence (file:line) | What remains |
| --- | ---- | ------ | -------------------- | ------------ |
| 1 | Lesson host | Not done | `learn/` holds `01.html` to `08.html` and `index.html`. The build takes every `learn/NN.html` with no entry of its own (`tools/draft-lessons.ts:16-18`, `lessonPages` `:77-86`; `vite.config.ts:78-87`, `:147-149`, `:489`). The service worker's lesson paths are `src/lib/sw-runtime.ts:131-157`, Lesson 8's at `:155-157`. `src/lesson-gate.ts` has no per-lesson code. | `learn/10.html`, `l10/` and two worker paths (P11). B2 adds Lesson 9's first. |
| 2 | Drafts line | Not done | `kit/drafts.ts:31-38` has lines for Lessons 3 to 8 only. No test pins a line's words. | The line (P11), worded as section 6, item 2 decides. R1 deletes it. |
| 3 | `chord-beads.ts` and its layout helper | Not done | No `l10/` folder exists. | P6, P12. |
| 4 | `cold-open.ts`; "the spiral needs nothing" | Partly | On main: `SpiralOptions` (`kit/spiral.ts:82-107`, `overlay` `:99-100`, `ring` `:105-106`) and `Spiral` (`:120-149`). Missing: a bead tap or slider key plays through the internal `play` (`:264-271`), which calls `playTone`, so the tap never claims `NowPlaying` and cannot be stopped. `addDrawer` (`:545-592`) has no `wants`, so the loop runs while the page is open (`frame-loop.ts:134-136`). | P13; K5, K4. |
| 5 | Names switch with a choice of modes | Partly | The kit has `createModeStore` (`kit/names.ts:27-51`) and `bindModeToggle` (`:58-80`). Lesson 4's three modes and syllables stay page-local (`lesson-04/stairs-words.ts:17-35`), as do Lesson 6's two modes (`lesson-06/tune-words.ts:21-23`). No lesson has minor syllables. | K1. |
| 6 | Ear game for N answers | Done | `kit/ear-game.ts`: `deal` `:122`, `play` `:129`, `slower` `:131`, `seed` `:140`, `owner` `:142`, `freshSeed` `:96`. `stop` (`:173-180`) also clears a pending replay. Feedback opens "Yes." or "Here it is again, slower." (`:234`). Lesson 6 uses it (`lesson-06/games.ts:30-67`). | P3 deals; P16 and P17 mount. |
| 7 | Move do | Partly | `kit/move-do.ts`: `MOVE_MAX` `:21`, `clampMove` `:24-25`, `setMoveEnds` `:31-40` (sets `b.disabled`, `:38`), `COUNT_IN` `:43`, `countIn` `:46-51`. Lessons 4, 6 and 8 use it. | K3 (`aria-disabled`). |
| 8 | Breath mark on the guide | Done | `GuideOptions.breaths` (`kit/slide-guide.ts:63-64`); Lesson 6 passes it (`lesson-06/sing.ts:101`). | P19 passes `[4.2]`. |
| 9 | `recallStepHref` | Done | `kit/quiz.ts:141-143`. | Nothing. |
| 10 | `kit/comfort.ts` | Done | `afterFeeling` `:56-87` with `restAfterEffort` (`:53`, `:77`); `mountFeelings` `:175-206` locks an answer unless `changeable` (`:178`, `:188`). | P4 passes the option; P19 keeps the lock. |
| 11 | Season entry | Not done | `kit/season.ts:342-350`: hook `:348`, `pr: { needs }` `:349`. No `minutes`, `page` or `link`. Lesson 8's entry, with the draft comment, is `:303-324`. | P11. |
| 12 | Head | Not done | No document yet. These tests will hold the page from its first commit: `src/tests/lesson-pages.test.ts:139-276` and `kit/lesson-copy.test.ts:323-358`. The spec's strings pass both. | P11; "thirds" is section 6, item 1. |
| 13 | Share image | Not done | `public/learn/` holds `lesson-01-og.jpg` to `lesson-08-og.jpg`; `lesson-pages.test.ts:229-249` needs one per document. | P10. |
| 14 | First-paint budget | Not done | `scripts/assert-first-paint-budgets.mjs`: JS entries `:97` to `:190`, CSS `:242` to `:271`. A document with no budget fails (`:543-546`, `:575-578`), and so does a budget for a page not emitted (`:559-562`). | P11 first values, P22 final. |
| 15 | Release steps | Waits for the release | `public/sitemap.xml`, `public/llms.txt`. The draft rules (`lesson-pages.test.ts:307-344`) apply until then. | R1. |
| 16 | Lessons 1 to 9's pages | Done, by design | Explorers and next cards read the season through the page state (`kit/page-state.ts:54-57`). | No page edit. End-to-end specs move (section 5). |
| 17 | App content | Not done | `src/types/walkthrough.ts:892-907`; "just intonation" `DroneIntonationExercise.tsx:134-135`, "pure intonation" `exercise-help.ts:142`; Drone's grade `use-drone-intonation-controller.ts:218-233`; neither slug in `EXERCISE_SLUGS` (`slug-map.ts:47-65`). The rooms' links back (spec:709-711; SEARCH.md § 8): every generated entry document's nav links every released lesson (`src/seo/entry-pages.ts:779-795`, `tools/lesson-links.ts`), so `/ear-lab`, `/piano-night` and `/guitar-night` link Lesson 10 from R1 on. The per-room field SEARCH.md § 8 plans is not built. | C10-1 to C10-4. The per-room field is season-wide work, not this page's. |

**Season and copy data.**

- Lesson 10's season entry (`kit/season.ts:342-350`) has the hook "Which single note turns a major
  chord into a minor one?" (`:348`) and `pr.needs` "Drone Intonation and Ear Lab Stack" (`:349`).
- `PREREQ[10]` is `[6]`, from the edge `[6, 10]` (`:419`). Lesson 12 builds on Lesson 10 through
  the edge `[10, 12]` (`:421`).
- Lesson 11 (`:351-359`) is "Registers and the break", with the hook "Why does your voice sometimes
  flip as you slide up?" (`:357`).
- The teases are in `kit/lesson-copy.ts`: Lesson 10's at `:115` and Lesson 11's at `:116`.
- The signatures are in `kit/team-notes.ts`: Lesson 10's at `:42` and Lesson 11's at `:43`.
- `/ear-lab?lesson=NN` already appears in Lesson 2's and Lesson 6's season links (`:194`, `:278`)
  and in Lesson 8's practice card (`learn-lesson-08.spec.ts:268-271`).

**The do-based minor is settled, and nothing on main contradicts it.**

- MASTER-PLAN:523-529 (item 12, decided 19 October 2026) sets do re me fa so le te do, with the
  fifth spelled "so".
- The package follows it: LESSON:18, FACTS 8 and 26, and spec:276. LESSON's Go deeper names
  la-based minor once (LESSON:235; FACTS 29).
- No lesson module has minor syllables yet.
- The app's Ear Lab already sings minor from do:
  - `MINOR_SOLFEGE` at `src/lib/ear/wild.ts:159`, which is not exported;
  - the bank at `src/lib/ear/item-bank.ts:65-72`.

  It writes 'Sol', capitalised. The lessons write "so", so K1 writes the lessons' own list and
  imports nothing from the Ear Lab.

**Practice links, checked.**

The Wrap's card leads with Drone Intonation and offers Ear Lab's Stack second. The rest card names
Drone Intonation for a day the voice feels comfortable and still offers Stack (LESSON:321-338;
spec:142-147). Both versions carry both links. The explorer card's link is the season's `pr.link`,
which section 6, item 3 settles.

- **`/pitch-training?lesson=10` works today.** `lessonFromSearch` accepts 01 to 14
  (`src/lib/lesson-marker.ts:18-25`). The marker steps First Light aside
  (`src/stores/onboarding-store.ts:310-316`) and holds back the takeover (`src/App.tsx:975-979`).
  The viewer then taps Drone Intonation:
  - At the default difficulty (5, factor 1) a run has six rounds (`ROUNDS`, `:11`; `:62-80`), drawn
    from the intervals at `use-drone-intonation-controller.ts:17-24`.
  - A round scores 100 − 1.5 × the mean absolute cents, with no octave folding (`:124-143`).
  - A run scores 0.4 × accuracy + 0.15 × best round + 0.25 × stability + 0.2 × richness
    (`:226-233`).
  - **The grade includes the `approximateRichness` bug.** That function divides clarity by 100
    (`src/lib/vocal-analyzer.ts:911`), but production clarity already runs from 0 to 1. Richness is
    therefore 0 or 1, and a flawless run scores about 80.
  - The unit tests feed clarity on a 0-100 scale (`src/tests/vocal-analyzer.test.ts:597-626`),
    which hides the bug.
  - The lead's `arp/CONSENSUS.md` deletes the term (C10-1).
- **`/ear-lab?lesson=10` works today.**
  - The marker sits before the `#/ear-lab` hash that the entry document adds on arrival
    (`src/seo/entry-pages.ts:444`; `src/seo/render-entry-page.ts:214-222`).
  - The viewer taps Stack: `IDENTIFICATION_ROUNDS = 12`
    (`src/features/ear-lab/use-identification-controller.ts:54`).
  - Each round is one chord named from six qualities (`STACK_BANK`, `src/lib/ear/banks.ts:115-158`),
    on six pads (`src/lib/ear/drills.ts:192`), with a guess floor of 1/6 (`:233-237`).
  - Answers are Elo-rated. Stack uses no microphone and has no richness term.
- **The proposed slugs**, `/exercises/thirds-on-a-drone` and `/exercises/major-or-minor`, do not
  exist (C10-2, C10-3).

**Already on main** (spot-checked):

- the predict (`kit/predict.ts`): options `:30-72`, `unlocks` `:66-67`, `plays` `:68-69`, the
  choice handler `:113-131`, the play handler `:176-191`;
- `NowPlaying` (`kit/now-playing.ts:17-39`);
- `bindWordPlays` with `{ owner }` (`kit/words-strip.ts:54-87`);
- the quiz's slot, options and away links (`kit/quiz.ts:52-58`, `:80-104`, `:186-216`);
- the note helpers `spellOn` (`kit/notes.ts:151`), `spellScale` (`:170`), `wordName` (`:193`) and
  `signsHtml` (`:221`);
- `mountGuide` (`kit/slide-guide.ts:381`), `mountRing` (`kit/sing.ts:135`), the voice choice, the
  next card and the explorer.

The server already accepts this lesson's quiz answers: `workers/db-worker/src/mirror-metrics.ts:61-62`
takes lessons 1 to 14.

## 2. Needed, but not on the spec's list

- **G1. Sounds that can be stopped.**
  - The spec's Audio plays chords through `playTone` and moves through `playContour`
    (spec:638-646). Both resolve only when their voice ends (`kit/sound.ts:560-569`, `:571-584`),
    so neither can be stopped early.
  - The spec still asks for three things that need stopping:
    - a play cut short resolves `false` (Toys 3; Tests 4);
    - one sound plays at a time (Toys 1);
    - leaving a step stops its sound and any queued replay.
  - A2 brings stoppable runs into the kit (`kit/run.ts`, from `lesson-07/play.ts:21-106`).
  - Chords need four additions to it (K2), and so do Lesson 12's (its needs 8; HANDOFF:196-198).
- **G2. The spiral's own plays.**
  - A bead tap or a slider key calls the internal `play` (`kit/spiral.ts:264-271`, from `:301`,
    `:395`, `:467` and `:508`), which goes straight to `playTone`.
  - So a tap during a move neither stops the move nor can be stopped. That breaks Toys 1's rule
    that "every source of sound on this page goes through it" (spec:347-349) and Tests 4's "new
    play".
  - K5 gives the spiral an optional owner.
- **G3. A page that rests.**
  - HANDOFF lists the spiral and the hero's sky among the drawers that never rest
    (`HANDOFF.md:257-258`).
  - Lessons 6 to 8 rest page-wide (`learn-frame-loop.spec.ts:285-321`), and Lesson 9 joins them
    (Lesson 9 decision 11).
  - K4 gives the spiral a `wants`. P13 uses `stillSky` (`kit/still-sky.ts:18`), as Lessons 6 to 8
    do, never `mountSky` (`kit/hero-sky.ts:87-104`).
- **G4. Tests that name the next lesson with no page.**
  - B0 makes the unit tests among them find one (`lessonWithNoPage()`, B0's
    `kit/season.test-fixtures.ts`), so with B0 in the base no unit test shifts for this page.
  - Three end-to-end specs still name the first lesson with no page, and two list the lesson pages
    by hand. After B2 they name Lesson 10, and P11 moves them on (section 5).
- **G5. A test helper that cannot reach Lesson 10.**
  - `open()` in `learn-frame-loop.spec.ts:207-214` loads ``/learn/0${n}`` (`:213`), which is
    `/learn/010` for Lesson 10.
  - Pad it with `String(n).padStart(2, '0')`, as `learn-lesson-menu.spec.ts:258` does.
  - B15 edits that spec, so this is an ask of B15; otherwise P21 does it.
  - Three other tests write `0${n}`, for Lessons 1 to 5 only (`tools/draft-lessons.test.ts:127-130`,
    `kit/lesson-state.test.ts:22`, `kit/quiz.test.ts:397`), so they need nothing.
- **G6. The quick check's play button.**
  - Question 2's slot plays D4, F4 and A4 together (FACTS 79).
  - Lesson 6's `bindQuizPlays` (`lesson-06/quiz-play.ts:18`) knows only Lesson 6's slots.
  - The page needs `l10/quiz-play.ts`. Lesson 12's recall will bind it too (section 3).
- **G7. First-paint room on Lessons 3 and 4.**
  - The season and drafts data load in every lesson page's first paint.
  - P11 adds about 210 bytes to each: about 123 for Lesson 10's minutes, page and link, and about
    86 for its drafts line.
  - Room on main, measured by A1a's builder (`l9/a1a-fp-bytes-before.txt`):

    | Lesson | Room on main (bytes) | After A1a |
    | ------ | -------------------- | --------- |
    | 3      | 784                  | 737       |
    | 4      | 882                  |           |
    | 5      | 1,983                |           |

  - B2's own fields and drafts line spend some of it first.
- **G8. A stale hook in LESSON.**
  - LESSON:350-352 gives Lesson 11's old hook, "Why does your voice flip at roughly the same note
    every time you slide up?".
  - The season (`season.ts:357`) and FACTS 5 have the current one, and the season's is what the
    card prints.
  - Changing LESSON changes its word count, which `scripts/lesson-words.test.mjs:317-352` holds
    equal to FACTS 3 and to the spec's Length, step by step. The line is outside the steps, so only
    the total moves. All three change in one commit (P22).
- **G9. The plan-back link.**
  - `kit/plan-back.test.ts:304-370` requires a hidden "Back to your plan" link on every lesson
    page, straight after `div[data-next-card]`, booted by one dynamic import.
  - The patterns are `learn/04.html:1488-1493` and `lesson-04/main.ts:97-103`.
  - The spec does not mention it. P11 adds it.

## 3. How the work ships

**Guardrails.** These are Lesson 9's, from its plan's section 3 and from `l9/BUILDER-RULES.md`.

- **Git:**
  - Branches take the `feat/` prefix, never `claude/`.
  - Never push to `main`. Bring a branch up to date by rebasing; push with
    `git push --force-with-lease`, never plain `--force`.
  - Never rewrite a branch you do not own.
  - No commit, push, PR or merge unless asked.
  - No Claude attribution. No emojis; use SVG icons.
- **Testing:** never test against production; work locally or on dev.
- **Heavy commands** go through `scratchpad/bin/heavy` with
  `NODE_OPTIONS=--max-old-space-size=7168`.
  - Iterate with `pnpm exec vitest run <files>`, and run `pnpm check` once at the end.
  - `build:e2e` exits 1 at the Glassworks step in this container, before its asserts. Then run
    `node scripts/assert-first-paint-budgets.mjs dist` by hand, and record every affected lesson's
    numbers before and after. A change to the drafts also runs
    `node scripts/assert-draft-lessons.mjs dist --shown`, the chain's last assert.
- **Playwright:** `PLAYWRIGHT_BROWSERS_PATH=…/scratchpad/pw-browsers`, `--retries=0`, the default
  two workers.
- **Gates:**
  - a new module: `node scripts/gen-agent-index.mjs`, then `pnpm docs:index:check`;
  - moved cited code: `pnpm plan:cites reanchor --base origin/main --write`, then
    `node scripts/plan-cites.mjs check`, which must stay at or under main's 183 findings;
  - every change: `pnpm pr:validate`;
  - new files stay under 800 lines, because `pnpm metrics:check` ratchets the count of files over
    800 (METRICS.md:148).
- **Never:**
  - use the Artifact tool or publish anything outside the repo and the scratchpad;
  - touch the six `art/glass-adventure/proofs/camera-comfort-2026-09-24/*` files;
  - open `.env` files, or edit `.claude/settings.json`.

**Order.**

1. K1, K5 and P1 to P10 start now. K2 waits for A2's fix commits. K3 and K4 wait for the lead.
2. P11 opens `feat/lesson-10-page` from `feat/lesson-09-page`, once B0 and B2 are on it. P11 edits
   the same lines as B2. From P11 on, these tests take the page by themselves:
   - `src/tests/lesson-pages.test.ts`;
   - in the kit: `lesson-copy.test.ts:323-358`, `team-notes.test.ts:84-102`,
     `plan-back.test.ts:304-370` and `season.test.ts:286-303`;
   - `src/lib/sw-runtime.test.ts:243-266` and `src/lesson-gate.test.ts:59`;
   - `tools/learn-hub.test.ts` and `tools/draft-lessons.test.ts:145`;
   - B0's converted tests;
   - the specs `learn-stage-fit`, `learn-cold-open-fold` and `learn-no-planning-text`.

   So P11 alone must provide:
   - five steps on the sticky stage, each with a control of at least 44 px, and at most 60 px of
     scroll inside the stage;
   - a `.viz` figure;
   - the title on the first screen;
   - the next card, the plan-back link, the lesson menu and the explorer.
3. P12 to P22 follow on the same branch, one commit each. Each commit passes `pnpm check` and its
   tests. The P1 to P10 branches join by rebase or cherry-pick, never by a merge commit.
4. One PR. Nothing merges before the owner cuts the release tag (Lesson 9 decision 2).
5. Review fixes go on the branch as `git commit --fixup=<sha>` commits, never a rebase. The lead
   folds them in at integration (Lesson 9 decision 16).
6. When `feat/lesson-09-page` moves, rebase with
   `git rebase --onto <new tip> <old base> feat/lesson-10-page`.

**Coordination with Lesson 9.** Where a Lesson 9 task creates or moves a shared part, the Lesson 10
task depends on it by id. No task here builds a second copy.

| Lesson 10 task | Lesson 9 task | Shared file or behaviour | How to sequence |
| --- | --- | --- | --- |
| K2 | A2 | `kit/run.ts` | Stack on `feat/kit-run` after A2's fix commits (S1, N1-N3 and N6 in `l9/FOLLOWUPS.md`). Rebase whenever A2 moves. |
| K3 | B12 | Move do's end buttons | K3 lands first, so B12 asserts `aria-disabled`. Otherwise K3 updates B12's assertions in its own change. |
| P11 | B0 (`33537af37`) | Unit tests that need a lesson with no page | P11's base must hold B0. Then no unit test shifts. |
| P11 | B2 | `kit/drafts.ts`, `src/lib/sw-runtime.ts`, `kit/season.ts`, both budget tables, the end-to-end shifts | P11 starts after B2. |
| P11 | B2 | B2's recorder for kit runs (`lesson-09/page-dom.test-fixtures.ts`) | Import it. If it is page-local, move it beside `kit/run.ts` and point Lesson 9's fixtures at it (section 6, item 14). Never copy it. |
| P11, P20 | B14 | `learn-next-card.spec.ts` | P11 turns B14's Lesson 9 card to Ready. P20 comes after B14. |
| P21 | B15 | `learn-frame-loop.spec.ts` | P21 comes after B15. Ask B15 to pad `open()` (G5). |
| P22 | B16 | The `now-playing.ts:14-15` header, the `mirror-metrics.ts:52-53` count, HANDOFF and MASTER-PLAN | P22 comes after B16. |
| C10-2, C10-3 | C1 | `slug-map.ts`, `applyExerciseSlug`, the launch override | Both come after C1. |
| C10-1 | C3 | The richness term | `arp/CONSENSUS.md` decides both. |
| P14 | B9 | `lesson-06/quiz-questions.ts`, `lesson-06/quiz-play.ts` | Both only read them. No conflict. |
| K1, K5, P1 to P10, C10-4 | none | `lesson-04/*`, `lesson-06/*` (K1), `kit/spiral.ts`, `l10/*`, `walkthrough.ts` | No Lesson 9 task edits these. |

Both lessons' branches regenerate `docs/agent/INDEX.md` and the plan-cites anchors. After every
rebase, regenerate both rather than merging their text by hand.

**Shared with Lesson 12.** Lesson 12's planner is running in parallel, so each shared part needs one
owner.

- **K1:** Lesson 12's names switch (its needs 5; HANDOFF:186).
- **K2:** Lesson 12's stoppable chords (its needs 8; HANDOFF:196-198).
- **K3:** Lesson 12 needs `aria-disabled` too, plus a limit for each side, four lower and three
  higher (its needs 7). Build K3 so a page can pass its own limits, or leave that to Lesson 12.
- **K4 and K5:** Lesson 12's hero and its ring of rooms use the kit's spiral from above, with
  `setLabels` (its needs 3).
- **P8 and P14:** Lesson 12's recall imports `l10-q1` and `l10-q2`, including question 2's slot and
  its play (Lesson 12 spec:634-647). The ids, the slot and `l10/quiz-play.ts`'s exported binder are
  a shared part.
- **The drafts line:** Lesson 12's line names Lesson 10's page in the same form (Lesson 12
  spec:848).
- **The publish order:** Lesson 12 goes out after Lesson 10 (Lesson 12 spec:995-998).
- **Not shared:** spec:219-220 says Lesson 12 draws its triads with the chord beads, but Lesson 12's
  spec keeps them on this page (its :36-38). P12 stays page-local.

**The alternative.** Branching the page from main would conflict with B2 in four files and in the
shifted specs, and whichever page merged second would redo its shifts. Not recommended while
nothing merges before the tag.

## 4. Tasks

Every task gives its goal, files, tests, how to tell it is done, what it depends on and the pages it
can affect. These checks apply to every task and are not repeated:

- `pnpm check` passes.
- The named tests pass.
- A new module has a banner header (CONVENTIONS.md § 7), and `pnpm docs:index:check` passes after
  `node scripts/gen-agent-index.mjs`.
- Where cited code moved, it is re-anchored and `plan-cites check` stays at or under 183.
- `pnpm pr:validate` passes.

### Kit (K): each its own PR to main

**K1. Names modes in the kit** (moderate)

- **Goal:** one kit home for the names switch's modes and syllables, shared by Lessons 4, 6, 10 and
  12 (spec needs 5; HANDOFF:186). A new `kit/names-modes.ts` holds:
  - `NamesMode` (`'letters' | 'numbers' | 'solfege'`) and `NAMES_MODES`, which are Lesson 4's;
  - a two-mode type, `Exclude<NamesMode, 'numbers'>`, with its list, for Lessons 6, 10 and 12.
    Lesson 6's functions take two modes (`lesson-06/tune-words.ts:39`, `:86`, `:99`);
  - `MAJOR_SOLFEGE`, do to do, which is Lesson 4's `SOLFEGE`;
  - `MINOR_SOLFEGE`, `['do', 're', 'me', 'fa', 'so', 'le', 'te', 'do']` (MASTER-PLAN:523-529).

  `kit/names.ts` does not change; its store and toggle are already generic.
- **Files:**
  - New `kit/names-modes.ts` and `kit/names-modes.test.ts`.
  - Lesson 4: the definitions leave `stairs-words.ts:17-35`. The importers switch to the kit:
    `main.ts:45-46`, `sing.ts:31`, `steps.ts:20`, `stairs-toy.ts:29`, `stairs-draw.ts:22`,
    `stairs-core.ts:28` and `stairs-toy.test.ts:16`.
  - Lesson 6: the definitions leave `tune-words.ts:21-23`. The importers switch:
    `main.ts:48-49`, `steps.ts:29`, `tune-toy.ts:39`, `tune-toy.test.ts:20-21`,
    `page-dom.test-fixtures.ts:24-25` and `wrap.ts:21`.
  - Optionally, `lesson-06/melody.ts:64` becomes `MAJOR_SOLFEGE.slice(0, 6)`.
- **Tests:**
  - The lists.
  - Tests 13's syllable half: under Minor, do re me fa so le te do; under Major, do re mi fa so la
    ti do.
  - Lessons 4 and 6's existing tests, unchanged.
- **Done when:**
  - The `learn-lesson-04*` and `learn-lesson-06*` specs pass.
  - Lessons 4 and 6's first paint is unchanged, give or take a few bytes. Record the numbers.
  - Citations are re-anchored. Both Lessons 10 and 12's packages cite these files, for example
    `lesson-04/stairs-words.ts:17-35`, `lesson-06/tune-words.ts:21-23` and `lesson-04/main.ts:58-65`.
- **Depends on:** nothing. Section 6, item 8 settles the module's home.
- **Pages it can affect:** Lessons 4 and 6. Lesson 12 later.

**K2. Chords on the kit's runs** (moderate)

- **Goal:** five additions to `kit/run.ts`.
  1. **One start for a chord.** Notes that share an onset start in one timer task, so they read one
     `currentTime` (`kit/sound.ts:169`). `onNote` still never fires synchronously. Lesson 7 compares
     `run !== r` on a `const r` that is not yet assigned (`lesson-07/cold-open.ts:125-128`).
  2. **A level for each note.** An optional `gain` on each note, falling back to the run's. A
     chord's voices sound at 0.075 (FACTS 81); a tapped note uses the soft tone's 0.13
     (`sound.ts:181`).
  3. **`playLine` honours `gain`.** Today it drops it (`lesson-07/play.ts:62-68`; FOLLOWUPS).
  4. **`allOf(runs)`.** One `Run` made of several. It resolves `true` only if every part ended by
     itself, and its `stop` stops them all. A move is two held notes plus a contour
     (spec:641-646).
  5. **Recommended: a run resolves `false` when every sound stops.** That happens when the Sound
     switch goes off, on the hush, and when the page is hidden.
     - Use one module-level `onStopAll` listener that stops the live runs (`sound.ts:493`).
       `onStopAll` has no unsubscribe, so a listener per run would leak.
     - Today a hidden page silences the voices (`:475-477`), but the run's timer still resolves
       `true`, so a predict counts the silenced play as heard.

  Check first that A2's S1 fix landed: a run's length must come from the note that ends last. The
  default kind stays Merc's; Lesson 10 passes `kind: 'soft'`.
- **Files:** `kit/run.ts` and `kit/run.test.ts`.
- **Tests:** with fake timers and a spy on `Sound`:
  - three notes at one onset build their voices in one task;
  - a note's `gain` reaches `Sound.voice`, and `playLine`'s reaches `contourVoice`;
  - `allOf` resolves `true` when every part ends by itself, and `false` once one is stopped;
  - `stopAll` makes a run resolve `false`;
  - `onNote` at t = 0 is never called synchronously.
- **Done when:**
  - Lesson 7's unit tests and its `learn-lesson-07*` specs pass, and so do Lesson 9's run tests on
    its branch.
  - Lesson 7's first paint is unchanged, give or take a few bytes.
- **Depends on:** A2 and its fix commits.
- **Pages it can affect:** Lessons 7 and 9. Item 5 means that a play cut short by a hidden page or
  by the Sound switch no longer reveals either lesson's predict.

**K3. Move do with `aria-disabled`** (simple; on the lead's yes)

- **Goal:** at its limit, a Move do button takes `aria-disabled="true"` instead of `disabled`, so a
  keyboard user's focus stays put (spec needs 7; Toys 6, state 4; Edge cases).
  - `nextShift` already clamps (`kit/move-do.ts:27-29`).
  - But Lessons 6 and 8 call `stopRun()` before it. A click at the limit would then stop a running
    guide.
  - So each handler returns first when its button is `aria-disabled`.
- **Files:**
  - `kit/move-do.ts:31-40`.
  - The calls and handlers: Lesson 4's `sing.ts:92` and `:164-169`; Lesson 6's `sing.ts:152` and
    `:253-258`; Lesson 8's `sing.ts:187` and `:282-287`.
- **Tests:**
  - Switch these assertions to `aria-disabled`: `kit/move-do.test.ts:59`,
    `lesson-04/page.test.ts:81`, `lesson-08/sing.test.ts:137` and
    `learn-lesson-06-sing.spec.ts:165`.
  - Add: a click at the limit leaves the shift, the focus and a running guide as they were.
- **Done when:** the `learn-lesson-04*`, `learn-lesson-06*` and `learn-lesson-08*` specs pass, and
  first paint is unchanged.
- **Depends on:** the lead's yes (section 6, item 5). Sequence with B12 as section 3 says.
- **Pages it can affect:** Lessons 4, 6 and 8, and Lesson 9's B12. Lesson 12 later adds limits for
  each side.

**K4. A spiral that rests** (hard; on the lead's yes)

- **Goal:** the spiral's drawer gets a `wants` (the model is `frame-loop.ts:1-18`). It is true only
  while something moves or has changed:
  - the drift or the turning;
  - the camera's move to the top view;
  - unrolling, or the pan;
  - a pulse, or the tap label's fade;
  - hover, focus or the selection;
  - the labels (`setLabels`), lit keys, `Names` or the size.

  A new `overlayWants?: () => boolean` lets a page's overlay ask for frames, as Lesson 10's bead
  slide and gold glow need. Compare what the spiral shows with what it last drew, rather than relying
  on `wake()`, as A7 does for the band chart.
- **Files:** `kit/spiral.ts` (`addDrawer`, `:545-592`) and `kit/spiral.test.ts` (201 lines, built
  on `spiralRoot()`). Drive the loop with `handLoop` (`kit/frame-loop.test-fixtures.ts:74`).
- **Tests:**
  - At rest, the spiral asks for no frame.
  - A tap's pulse asks for frames until it fades.
  - `setView('top')` animates, then rests.
  - `overlayWants` keeps frames coming.
  - A change made without a wake is caught at the next input.
- **Done when:**
  - Lessons 1 and 2's unit tests pass, and so do their `learn-lesson-01*` and `learn-lesson-02*`
    specs and `learn-frame-loop`.
  - Lessons 1 and 2 still do not rest page-wide: their sky and other drawers keep drawing.
  - Their first paint stays under the ceilings.
- **Depends on:** K5, which edits the same file, and the lead's yes (section 6, item 6).
- **Pages it can affect:** Lessons 1 and 2. Lesson 12's ring later.

**K5. The spiral's own plays through a page's owner** (moderate)

- **Goal:** add `SpiralOptions.owner?: SoundOwner` (`kit/now-playing.ts:17-22`).
  - With an owner, a bead tap or a slider key builds its voice with `Sound.voice`, so it can be
    stopped. The voice claims the owner and releases it at the note's end, and a claim from
    elsewhere stops it.
  - Without an owner, `playTone` runs as today.
  - The internal `play` (`:264-271`) and its callers (`:301`, `:395`, `:467`, `:508`) change. The
    public `play` (`:605-606`) keeps its signature.
- **Files:** `kit/spiral.ts` and `kit/spiral.test.ts`.
- **Tests:**
  - With an owner, a tap claims it, and a second claim stops the tap's voice.
  - Without one, nothing claims and `playTone` runs.
  - With sound off, there is no voice, but the bead still lights.
- **Done when:** Lessons 1 and 2's tests and specs pass, and their first paint is unchanged, give or
  take a few bytes.
- **Depends on:** nothing. Section 6, item 11 asks the lead to accept it.
- **Pages it can affect:** Lessons 1 and 2, which pass no owner, so nothing changes for them.
  Lesson 12's hero later.

### Page modules that need no page (P1 to P10)

**P1. Chords** (simple)

- **Goal:** `l10/chords.ts`, the chord and scale facts the page reads:
  - `triad(root, quality)`, each note spelled with `spellOn` (`kit/notes.ts:151`), so C minor's
    third is E♭4;
  - the white-key roots from C4 to B4, with `nextRoot(root, ±1)`;
  - the window from C4 to F♯5, MIDI 60 to 78 (FACTS 70a);
  - natural minor, which steps 2, 1, 2, 2, 1, 2, 2 and lowers degrees 3, 6 and 7, with its letters
    from `spellScale` (`:170`);
  - `qualityOf(notes)`: major, minor or neither;
  - `stackInThirds(notes)`: B, E, G becomes E, G, B (FACTS 41a).
- **Files:** `l10/chords.ts` and `l10/chords.test.ts`.
- **Tests:** Tests 1 and 2:
  - FACTS 19's fourteen triads and FACTS 27's fourteen scales, with no double sign and no E♯, B♯,
    C♭ or F♭;
  - C minor's third is E♭4, never D♯4;
  - major is 4 then 3, minor 3 then 4, and both are 7 to the fifth;
  - C, E♭, G is minor, and C, E, G♭ is neither;
  - B, E, G stacks as E minor;
  - the minor scale's steps and lowered degrees.
- **Done when:** Tests 1 and 2 pass.
- **Depends on:** nothing.
- **Pages it can affect:** none.

**P2. Sounds** (simple)

- **Goal:** `l10/sounds.ts`, every fixed sound as timed notes `{ t, midi, dur, gain? }`, which is
  the shape of A2's `RunNote`. Use a local type of that shape until A2 is in the base, then make it
  `RunNote` itself, as FOLLOWUPS asks of Lesson 9's sounds.
  - `chord-c`: C4, E4 and G4 together for 1.6 s, at 0.075 each (FACTS 72, 81).
  - The two moves, 3.1 s each. The two held notes sound throughout. The moving note follows a
    contour: `contourOf(329.63, [{ hold: 1.2 }, { glide: 0.4, to: 311.13 }, { hold: 1.5 }])` for mi,
    or 392.00 to 369.99 for so (`kit/sound.ts:290`; FACTS 73).
  - Step 1's third: 0.6 s each, then 1.0 s together. Step 2's triad: 0.55 s each, then 1.2 s
    together (FACTS 75).
  - The pattern: 16 quavers of 30/70 s (Slow) or 0.1875 s (Fast), each sounding 9/10 of its
    length, then the chord for 1.0 s (FACTS 76).
  - The scales: 0.45 s a note, the last 0.9 s (FACTS 77).
  - Four words (FACTS 74) and quick check question 2's chord (FACTS 79).
  - `slow(sound)`, which doubles every onset and length.
- **Files:** `l10/sounds.ts` and `l10/sounds.test.ts`.
- **Tests:** Tests 3:
  - every frequency equals `hz(m)`;
  - the lengths: 1.6 s; 3.1 s, with a 0.4 s glide from 1.2 s; 1.55, 2.85, 3.2 and 4.05 s; 4.05 s
    for a scale;
  - the pattern lasts 7.857 s slow and 4.0 s fast (section 6, item 15);
  - Slow doubles every length;
  - a chord's voices sound at 0.075.
- **Done when:** Tests 3 passes.
- **Depends on:** P1.
- **Pages it can affect:** none.

**P3. The ear game's rounds** (simple)

- **Goal:** `l10/game-rounds.ts`, with `dealThirds(random)` and `dealChords(random)` returning
  `EarRound`s (`kit/ear-game.ts:45-50`) for the kit's `deal` (`:122`).
  - Thirds: eight rounds. Each is a root from C4 to G4, then the note 3 or 4 semitones above, 0.6 s
    and 0.8 s with 0.15 s between. Four rounds have each answer (FACTS 78).
  - Chords: ten rounds. Each is the first five notes of a scale at 0.32 s, 0.25 s of silence, then
    the triad for 1.2 s. Five rounds have each answer (FACTS 21, 43, 78).
  - Each round's `words` is its feedback line from spec Toys 5. The kit prints "Yes." or "Here it
    is again, slower." before it (`:234`), so no `words` starts with "Yes".
- **Files:** `l10/game-rounds.ts` and `l10/game-rounds.test.ts`.
- **Tests:** the deal half of Tests 7, from a fixed seed:
  - the counts, with half the rounds for each answer;
  - every note lies between C4 and D5 (FACTS 70a);
  - every template passes `validateGuidedDynamicClaim` (`src/lib/guided-voice/claims.ts:116`,
    surface `finding`).
- **Done when:** those pass.
- **Depends on:** P1.
- **Pages it can affect:** none.

**P4. The Sing it flow** (moderate)

- **Goal:** `l10/sing-flow.ts`, a pure rule in the shape of `lesson-06/sing-flow.ts` (`openState`
  `:53`, `nextState` `:74`, `singView` `:165`), with no microphone states.
  - Its inputs: the comfort answer, the voice, whether Merc's notes were heard with sound on, how
    many sweeps have run, and the latest feeling.
  - Its output: the state, the controls shown, the line and the Wrap's card.
  - "Effortful" leads to the rest card through `afterFeeling(f, { restAfterEffort: true })`
    (`kit/comfort.ts:56-87`).
- **Files:** `l10/sing-flow.ts` and `l10/sing-flow.test.ts`.
- **Tests:** Tests 8, with a walk over every sequence of answers.
  - The guide and Move do never show after "Effortful", "Uncomfortable" or "Just listen today".
  - Each of those leads to the rest card, and no later answer brings the practice card back.
  - Start the guide waits until Merc's notes have been heard with sound on.
  - The feeling question follows every sweep, unanswered.

  P19 checks the storage clause.
- **Done when:** Tests 8 passes.
- **Depends on:** nothing.
- **Pages it can affect:** none.

**P5. The Sing it guide** (simple)

- **Goal:** `l10/sing-guide.ts`, in the shape of `lesson-06/sing-guide.ts`.
  - Do is E3 (52) for the lower voice and E4 (64) for the higher. Move do shifts it, clamped by
    `clampMove` (`kit/move-do.ts:24-25`; FACTS 63, 64).
  - Eight rows run from do up to so. The rows for do, me, mi and so (0, 3, 4 and 7) are named and
    the rest are faint (`GuideRow`, `kit/slide-guide.ts:38-45`). They show syllables only.
  - The path is do, mi and so at 1.2, 1.2 and 1.8 s; a 1.6 s gap (the next point marked `gap`,
    `GuidePoint` `:48-53`); then do, me and so the same. That is 10.0 s in all (FACTS 65).
  - The breath mark is at 4.2 s (FACTS 66).
  - Merc's notes, as timed notes.
  - The readout "do is E3", spoken "do is E 3".
- **Files:** `l10/sing-guide.ts` and `l10/sing-guide.test.ts`.
- **Tests:** Tests 9:
  - the clamp at four semitones either way;
  - at every shift, both chords lie inside every preset of the chosen voice, checked against
    `VOCAL_RANGES` (`src/stores/settings-store.ts:91`) with Lesson 6's voice-to-preset mapping;
  - the readouts.

  This survey checked the ranges. The lower voice's notes run from C3 to E♭4, inside tenor,
  baritone and bass. The higher voice's run from C4 to E♭5, inside soprano, mezzo and alto.
- **Done when:** Tests 9 passes.
- **Depends on:** nothing.
- **Pages it can affect:** none.

**P6. The chord beads' layout** (moderate)

- **Goal:** `l10/chord-layout.ts`. From the width, height, state and chord, it gives a rectangle for
  every bead target, gap button, bracket and name, and for the name strip. It covers the full and
  compact layouts (spec Toys 1, "Layout and targets" and "The compact layout"; FACTS 82).
  - Rows are 15 px a semitone.
  - **Full:** 18 rows (C4 to F♯5) make 270 px. With 22 px above, 22 px below and the 26 px name
    strip, the figure is 340 px.
  - **Compact, below 340 px:** the chord's eight rows make 105 px. With 22 px above and below, that
    is 149 px. The strip goes to the top-left corner, and the window follows the chord.
  - **Scale:** the full layout shows the octave on its lowest 12 rows (180 px). The compact layout
    closes rows to 9 px: 108 + 20 + 20 = 148 px. No stair is a target. The stairs share the width,
    38.8 px each at 344 px.
- **Files:** `l10/chord-layout.ts` and `l10/chord-layout.test.ts`.
- **Tests:** Tests 6, at every width from 344 to 1440 px, in every state and both layouts:
  - every target is at least 44 px each way, and no two overlap;
  - the full figure is 340 px;
  - the compact one fits 150 px and is the one chosen below 340 px;
  - the gap buttons' centres sit 52.5 px apart.
- **Done when:** Tests 6 passes.
- **Depends on:** nothing; it takes MIDI numbers.
- **Pages it can affect:** none.

**P7. The page's lines** (moderate)

- **Goal:** `l10/lines.ts`, every line template in spec Toys 1, 2, 3 and 6:
  - the figure's summary per state, and the names of beads and gap buttons;
  - the polite announcements, and the readout (for example "C minor · slow");
  - the hero's live lines;
  - both predicts' hints and "You said" lines;
  - Sing it's status lines.

  Spoken names go through `wordName` (`kit/notes.ts:193`), and shown text through `signsHtml`
  (`:221`).
- **Files:** `l10/lines.ts` and `l10/lines.test.ts`.
- **Tests:** the template half of Tests 10:
  - every template passes the claims check with surface `finding`;
  - no accessible name or live text holds a ♯ or ♭;
  - every line LESSON gives matches LESSON exactly.
- **Done when:** those pass.
- **Depends on:** P1.
- **Pages it can affect:** none.

**P8. Quiz questions** (simple)

- **Goal:** `l10/quiz-questions.ts`.
  - `RECALL_QUESTIONS`: Lesson 6's `l06-q2` and `l06-q3`, filtered from its `QUIZ_QUESTIONS`
    (`lesson-06/quiz-questions.ts:40`; the ids are at `:65` and `:86`).
    - The pattern is Lesson 8's filter of Lesson 6's questions (`lesson-08/quiz-questions.ts:20`,
      `:27-28`) and Lesson 4's of Lesson 2's (`lesson-04/quiz-questions.ts:28-29`).
    - Lesson 9's B9 takes the same two questions; each page keeps its own filter.
  - `QUIZ_QUESTIONS`: `l10-q1` to `l10-q4` from LESSON:276-307, each with three answers and their
    feedback, the right answer first as LESSON lists it. One link back per question, to Steps 1, 3,
    4 and 5 in turn.
    - Question 2's slot holds a button with `data-quiz-play="chord"`. It shows "Play" and is named
      "Play the question's chord" (section 6, item 7).
    - Lesson 12's recall imports `l10-q1` and `l10-q2` with that slot, so the ids and the slot must
      not change once shipped.
- **Files:** `l10/quiz-questions.ts` and `l10/quiz-questions.test.ts`.
- **Tests:** Tests 11, in the shape of Lesson 8's quiz test (`lesson-08/quiz-questions.test.ts:22-112`):
  - the ids, three answers each, the step links and question 2's slot;
  - the recall's two tests: Lesson 6's very objects under its ids, and its step links opening
    Lesson 6's page in a new tab;
  - the right answer first, as Lesson 4's test has it (`lesson-04/quiz-questions.test.ts:38-40`;
    Lesson 9 decision 20);
  - every ♯ and ♭ speakable, as Lesson 4's (`:60`), since question 1's feedback prints E♭. Lesson
    8's "no sign" case does not fit;
  - no feedback line starts with "Right", "Yes" or "Correct", and every line passes the claims
    check.
- **Done when:** Tests 11 passes.
- **Depends on:** nothing.
- **Pages it can affect:** none. Lesson 12's recall later.

**P9. The hero's marks and the bead slide** (moderate)

- **Goal:** `l10/hero-marks.ts`.
  - `slideAt(t, move, reduced)` places the moving bead and its halo along the ring:
    - on its own bead until 1.2 s;
    - gliding to the bead a semitone below by 1.6 s;
    - held there until 3.1 s;
    - home by 3.5 s.

    Under reduced motion it lands at once and returns at once (FACTS 73; Tests 5).
  - `drawMarks(ctx, frame, state)` draws:
    - before the reveal: chrome halos with their syllables round do, mi and so, and the thin chrome
      triangle joining them;
    - from the reveal: the chord's name in the ring's centre, and mi's gold halo glowing once;
    - for so's move: a dashed ink-2 triangle with "?" and "C, E, G♭: neither major nor minor".

    Positions come from `SpiralFrame.beads` (`kit/spiral.ts:70-79`; `BeadHit`,
    `kit/spiral-draw.ts:31-37`).
- **Files:** `l10/hero-marks.ts` and `l10/hero-marks.test.ts`, with a recording 2D context as in
  `kit/still-sky.test.ts:16-27`.
- **Tests:**
  - Tests 5.
  - Before the reveal, nothing gold and no chord name (End to end 2's figure clause, at unit
    level).
  - After it, so's move draws a dashed triangle.
- **Done when:** those pass.
- **Depends on:** nothing.
- **Pages it can affect:** none.

**P10. The share card** (moderate)

- **Goal:** `public/learn/lesson-10-og.jpg`, a 1200x630 baseline JPEG near the other cards' 44-50 KB
  (spec needs 13). It is rendered from the kit, as Lesson 9 decision 3 sets. It shows:
  - the ring from above (`setView('top')`, `ring: 60`, `Names` on flats);
  - P9's marks before any reveal: do, mi and so in chrome, with their triangle;
  - Merc and Tavi's stills (`lesson-01/assets/merc-blue.png`, `merc-orange.png`);
  - "Major and minor", "Lesson 10" and the wordmark.
- **Files:**
  - Committed: the JPEG only.
  - Throwaway, never committed: a render page on the local dev server, never on production.
    Playwright screenshots it, and the screenshot is converted to a baseline JPEG.
- **Tests:**
  - `lesson-pages.test.ts:229-249`, once P11's head names the card.
  - `file` reports a baseline JPEG at 1200x630.
- **Done when:**
  - Both hold.
  - No note is marked as the one that moves (spec needs 13; FACTS 1a; `HANDOFF.md:360-363`).
  - P11's `og:image:alt` names what the card shows.
- **Depends on:** P9. Section 6, item 10 settles the method.
- **Pages it can affect:** none until P11 links it.

### The page (P11 to P22), on `feat/lesson-10-page`

**P11. Page shell and registration** (hard; the branch's first commit)

- **Goal:** `/learn/10` loads with its whole copy and is registered everywhere a lesson page must
  be. Nothing makes sound yet, and every check that reads every lesson page passes.
- **Files:**
  - **`learn/10.html`, the head** (spec needs 12; the pattern is `learn/04.html:9-145`):
    - the title;
    - the description (section 6, item 1);
    - `og:title` and `twitter:title` "Major and minor: Find Your Pitch, Lesson 10";
    - `og:description` and `twitter:description`: the hook, as `kit/lesson-copy.test.ts:334-358`
      requires;
    - `og:image` with its width, height and alt text;
    - the canonical URL, `og:url`, robots and `twitter:card`;
    - the Article as the first JSON-LD block: `alternativeHeadline` the hook, `timeRequired`
      `PT17M`, `position` 10 and `teaches`, with no `datePublished` until R1;
    - the BreadcrumbList.
  - **`learn/10.html`, the body:**
    - the masthead, with Lesson, Sing and Explorer;
    - the hero, laid out as Lesson 2's (`learn/02.html:329-502`):
      - the kicker, and `h1.hook#hook` holding the season's hook (`lesson-copy.test.ts:323-332`);
      - three chips: "17 minutes"; "After Lesson 6: Intervals: the distance between notes" as an
        `a.chip.chip-link` to `/learn/06`; and "Sound on";
      - the promise, and the sound gate;
      - the stage: the bubbles, Merc and Tavi, `canvas.sky`, the spiral root with its
        `role="slider"` canvas (as `learn/02.html:404-409`), and a polite live region;
      - the three plays: "Play the chord" (`data-play="chord-c"`, `data-free`), then the two moves,
        disabled;
    - the predict card: Mi and So, the lock hint and the reveal;
    - `#recall`;
    - Four words: four tickets, each with an inline SVG and a button;
    - `#lesson`: the five steps' copy and the sticky stage:
      - one toy, whose `.viz` holds a canvas and a target layer;
      - `#stepNow`, Previous and Next;
      - each step's control row; Step 5's Major · Minor is disabled;
    - in Steps 1 and 3, a game card each, with `[data-eg-round]`, `[data-eg-play]` holding a span,
      two `[data-eg-answer]` and `[data-eg-feedback]` (`kit/ear-game.ts:151`);
    - Step 5's predict, and the three drawers;
    - `#sing`, and `#quiz`;
    - `#wrap`: the recap, the challenge, `#practiseCard` with both versions, and the free-play
      card. An empty `div[data-next-card]` is followed straight away by the plan-back link (G9,
      `learn/04.html:1488-1493`);
    - `#explorer`, and the footer.

    There is no Watch section.
  - **`l10/main.ts`**, in Lesson 4's boot order (`lesson-04/main.ts`):
    1. The stylesheets: `lesson-fonts`, `lesson-base`, `lesson-sections`, `lesson-stage`,
       `lesson-guide`, `lesson-parts`, `lesson-voice` and `lesson-ear-game`, then `lesson-10.css`.
       That is Lesson 6's list without `lesson-tune-line`.
    2. `Names.set('flats')` (`kit/names.ts:84-88`; never stored).
    3. The sound switch and the motion switch.
    4. `createStepDeck({ toyFor: () => 1, after: { label: 'Sing it', selector: '#sing' } })` and
       `deck.start()` (`:72-78`).
    5. `createNextCard(10)`, then the plan-back `void import(…)`, then
       `createExplorer({ current: 10 })` (`:94-105`).
    6. `initMasthead(sections, { lesson: 10, deck })` (`:108-119`).
    7. `initReveals`, `startFrameLoop`, and `initMercs(q('#heroStage'), { sparkles: 'none' })`.
  - **`l10/lesson-10.css`:**
    - `--viz-min: 340px` on the stuck stage only, under
      `@media (min-width: 961px) and (min-height: 561px)`;
    - the figure's 340 px height;
    - `.l10-duo`. Each page keeps its own; Lesson 2's hero rules are `lesson-02/lesson-02.css:13-83`.
  - **Registration:**
    - `kit/drafts.ts:31-38`: Lesson 10's line (section 6, item 2).
    - `src/lib/sw-runtime.ts`: `'/learn/10'` and `'/learn/10.html'` after Lesson 9's paths, with
      the drafts comment.
    - `kit/season.ts:342-350`: the draft comment, `minutes: 17`, `page: '/learn/10'` and `pr.link`
      (section 6, item 3). `pr.needs` stays.
    - `scripts/assert-first-paint-budgets.mjs`: `learn/10.html` in both tables, after `:190` and
      after `:271`. Each value is the measured size plus a quarter, with a reason comment written
      as Lesson 8's are (`:184-190`, `:268-271`).
  - **Test files:**
    - section 5's end-to-end shifts and its three new unit tests;
    - new `l10/page.test.ts`;
    - new `l10/page-dom.test-fixtures.ts`: `loadPage()`, as `lesson-06/page-dom.test-fixtures.ts:30`,
      and B2's recorder for kit runs (section 3);
    - new `src/e2e/learn-lesson-10.spec.ts`.
- **Tests:**
  - **`l10/page.test.ts`** follows Lesson 6's page test (`lesson-06/page.test.ts:54`, `:66`, `:80`,
    `:98`, `:103`, `:126`). Do not copy Lesson 8's, which rejects any sign at all
    (`lesson-08/page.test.ts:63-67`, `:234`). It checks that:
    - every ♯ and ♭ shown is spoken;
    - no sign appears in an accessible name or the card's alt text;
    - every referenced id exists, once;
    - every button has `type=button`;
    - there is no Watch section;
    - the order is hero, recall, then Four words;
    - there are three chips;
    - "Play the chord" is free, and both moves are disabled;
    - Step 5's Major · Minor is disabled;
    - the practice links carry `?lesson=10`;
    - the share card exists.
  - **`learn-lesson-10.spec.ts`**: End to end 1 and End to end 14 (as `learn-lesson-03.spec.ts:154`).
- **Done when:**
  - These unit tests pass:
    - `src/tests/lesson-pages.test.ts`;
    - in the kit: `lesson-copy.test.ts`, `team-notes.test.ts`, `season.test.ts`, `drafts.test.ts`,
      `publish.test.ts`, `explorer.test.ts`, `plan-back.test.ts`, and B0's converted tests;
    - `tools/draft-lessons.test.ts` and `tools/learn-hub.test.ts`;
    - `src/lib/sw-runtime.test.ts` and `src/lesson-gate.test.ts`;
    - `l10/page.test.ts`.
  - `build:e2e` builds, and both `node scripts/assert-first-paint-budgets.mjs dist` and
    `node scripts/assert-draft-lessons.mjs dist --shown` pass. Record all ten lessons' numbers,
    before and after.
  - These specs pass: `learn-stage-fit`, `learn-cold-open-fold`, `learn-no-planning-text`,
    `learn-next-card`, `learn-explorer`, `learn-lesson-menu`, `learn-sound-gate`,
    `learn-publish-state`, `learn-frame-loop`, `learn-lesson-09*` and `learn-lesson-10`.
  - Each `dist/learn/NN.html` links the same stylesheets, in the same order, as the base's build
    (MISTAKES.md:919-924).
- **Depends on:** B0 and B2 in the base; P10; section 6, items 1, 2 and 3.
- **Pages it can affect:**
  - every lesson page's first paint (G7);
  - Lesson 9's next card, which reads "Ready · 17 min" once both pages are live;
  - Lesson 10's card in every explorer, which gains its link (Tests 12);
  - Lesson 12's chip and recall, later.

**P12. The chord beads** (hard)

- **Goal:** `l10/chord-beads.ts`, the toy in spec Toys 1. It is generic over a root and intervals,
  as spec:219-220 asks, but stays on this page (section 3, "Not shared").
  - **The canvas:**
    - semitone rows and beads, with their names spelled by P1;
    - the gap labels, the fifth's bracket, and the name strip (moved to a corner when compact);
    - the halo that brightens once as a third lands;
    - the staircase.
  - **Real buttons** sit over the drawing at P6's rectangles: the beads (named, for example, "C 4,
    the root") and the gap buttons. The tab order is the stage's controls, then the beads from the
    root up, then the gap buttons.
  - **Motions:** the third slides in 0.4 s; a stacked bead drops in 0.4 s; a root slides in 0.5 s;
    the spread and the fold take 0.6 s on an expo-out curve.
    - `EASE.expoOut` (`kit/reveal.ts:18`) is a CSS string, so add a JavaScript `easeOutExpo` beside
      `easeOut3` (`kit/reveal.ts:24-26`).
    - Under reduced motion or Pause animations, every motion lands at once and the halo does not
      pulse. Plays still light the beads.
  - **States:** thirds, stack, slide, pattern, scale and free play.
  - **Size:** it reads the figure's height and draws the compact layout below 340 px.
  - **Resting:** a `wants` that is true only while something moves or has just changed
    (`frame-loop.ts:1-18`).
  - **Words:** its summary and live text come from P7, in words only.
- **Files:** `l10/chord-beads.ts`, with a painter module beside it if the file would pass 800 lines;
  `kit/reveal.ts` (one export).
- **Tests:** `l10/chord-beads.test.ts`, using `loadPage()`:
  - every state's buttons, names and tab order;
  - a slide respells the names (E♭4, never D♯4);
  - the halo pulses once;
  - reduced motion lands every motion at once;
  - `wants` is false at rest and true during a motion;
  - the compact layout is drawn below 340 px.
- **Done when:** those pass, `learn-stage-fit` passes with the toy drawing, and other lessons' first
  paint is unchanged (the unused export is tree-shaken).
- **Depends on:** P1, P6, P7 and P11.
- **Pages it can affect:** Lesson 10. `kit/reveal.ts` only gains an export.

**P13. The cold open** (hard)

- **Goal:** `l10/cold-open.ts` (spec Toys 2 and 3).
  - **The sky:** `stillSky(stage)` (`kit/still-sky.ts:18`), as `lesson-06/cold-open.ts:71`. Never
    `mountSky` (G3).
  - **The spiral**, mounted as Lesson 2's hero copy (`lesson-02/spiral-copy.ts:189-234`;
    `lesson-02/cold-open.ts:39-58`).
    - Options: `active: watch(stage)`, `ring: 60`, an `overlay` that draws P9's marks, and
      `owner: NowPlaying` (K5).
    - Then `setView('top')`, `setTurning(false)`, and `light` on the turn's five black keys, so each
      move lands on a named E♭4 or G♭4.
  - **The predict:** `mountPredict` (`kit/predict.ts:80`) with:
    - the choices Mi and So;
    - the three stage buttons as `plays`;
    - `revealOn: ['move-mi', 'move-so']` with `revealAfter: 'all'`;
    - LESSON's hints and "You said" lines (P7);
    - an `onReveal` that glows mi's gold halo once and calls `mercCelebrate('orange', 1600)`
      (`kit/merc-duo.ts:195`).
  - **`play(what, audible)`** returns the run's `done`.
    - It builds a kit run from P2's notes with `kind: 'soft'`. A move is `allOf` the held notes and
      a `playLine` (K2).
    - It claims `NowPlaying` and releases it at the end, as `lesson-07/cold-open.ts:108-145` does.
    - It starts P9's slide from the run's start, and speaks P7's line.
    - Both Mercs listen while it plays (`mercListen`, `merc-duo.ts:185`).
  - **Cutting a move short.** The predict ignores taps on its own plays while one runs (`busy`,
    `kit/predict.ts:179`). So the new play that cuts a move short comes from elsewhere: a bead tap
    (K5), a word or a game.
- **Files:** `l10/cold-open.ts`, `l10/cold-open.test.ts`, `l10/main.ts` (one call) and
  `learn-lesson-10.spec.ts`.
- **Tests:**
  - Unit (Tests 4), with fake timers and the run recorder:
    - "Play the chord" plays before a choice and never reveals;
    - the reveal waits until both moves have been heard with sound on;
    - a move cut short by a bead tap, by another play or by a hidden page (K2, item 5) resolves
      `false` and reveals nothing;
    - the hints and "You said" lines match LESSON;
    - `revealOn` and `revealAfter` are passed together.
  - End to end 2, at 390x844 and 1440x900.
- **Done when:** those pass, and `learn-cold-open-fold` still finds the title on the first screen.
- **Depends on:** P2, P7, P9, P11, A2, K2 and K5.
- **Pages it can affect:** Lesson 10.

**P14. Recall and quick check** (moderate)

- **Goal:**
  - **The recall**, `l10/recall.ts`:
    - `createQuiz({ questions: RECALL_QUESTIONS, keys: { seed: 'fyp-l10-recall-seed', record:
      'fyp-l10-recall-v1' }, prefix: 'recall-', away: { href: recallStepHref } })`, with no
      `lesson` (spec Toys 8; the pattern is `lesson-04/main.ts:59-65`);
    - shown to everyone, so it has no `data-if-live` wrapper (Lesson 8's recall has one,
      `lesson-08/recall.ts`);
    - its play goes through Lesson 6's `bindQuizPlays` (`lesson-06/quiz-play.ts:18`) on the quiz's
      host, as `lesson-08/recall.ts` does. That binder already claims `NowPlaying`.
  - **The quick check:** `createQuiz({ questions: QUIZ_QUESTIONS, lesson: 10, keys: { seed:
    'fyp-l10-seed', record: 'fyp-l10-quiz-v1' }, deck })`.
  - **`l10/quiz-play.ts`** (G6): an exported `bindQuizPlays(host)` in Lesson 6's shape. It plays
    question 2's chord as a kit run and claims `NowPlaying`. Lesson 12's recall binds it on its own
    host.
- **Files:** `l10/recall.ts`, `l10/quiz-play.ts`, `l10/quiz-play.test.ts`, `l10/main.ts` and
  `learn-lesson-10.spec.ts`.
- **Tests:**
  - Unit: question 2's play claims the owner; another claim stops it; with sound off it plays
    silently.
  - End to end 9.
- **Done when:** those pass.
- **Depends on:** P8, P11, A2 and K2.
- **Pages it can affect:** Lesson 10, and Lesson 12's recall later.

**P15. Four words** (simple)

- **Goal:** `l10/words.ts`, on `bindWordPlays` with `{ owner: NowPlaying }`
  (`kit/words-strip.ts:54-87`). The four plays (FACTS 74):
  - "Play: C up to E", 1.55 s;
  - "Play: C, E and G", 2.85 s;
  - "Play: major, then minor", 3.2 s, each word lighting as its chord sounds;
  - "Play: C natural minor", 4.05 s.

  The figures are P11's inline SVG, and none answers a predict. Under reduced motion, beads and
  words light in turn and nothing else moves.
- **Files:** `l10/words.ts`, `l10/words.test.ts` and `l10/main.ts`.
- **Tests:**
  - each button's run and length;
  - a word play stops a sound that is already playing;
  - no figure marks the third before Step 5.
- **Done when:** those pass.
- **Depends on:** P2, P11, A2 and K2.
- **Pages it can affect:** Lesson 10.

**P16. Steps 1 and 2, with the game on thirds** (moderate)

- **Goal:** `l10/steps.ts`, the deck's toy (P17 and P18 extend it), and `l10/games.ts`, the games'
  adapter (as `lesson-06/games.ts:30-67`).
  - **Step 1:**
    - "Play the third" and the gap button: each note for 0.6 s, then both together for 1.0 s;
    - Slow (`aria-pressed`) doubles every length;
    - Major · Minor (`aria-pressed`, starting on Major) slides the top bead to E♭4;
    - both beads are chrome.
  - **Step 2:**
    - opens on Step 1's beads in C major;
    - Stack a third drops G4 in over 0.4 s, and hands its place and the focus to Play the triad;
    - Play the triad plays each note for 0.55 s, then all three together for 1.2 s;
    - the middle bead turns gold.
  - **The game on thirds:** `mountEarGame` (`kit/ear-game.ts:152`) with:
    - P3's `deal`, and `play` as a kit run;
    - `slower: 1.5` (Lesson 6's `MISS_SLOWER`, `lesson-06/examples.ts:36`);
    - `owner: NowPlaying`, and the kit's fresh seed.
- **Files:** `l10/steps.ts`, `l10/games.ts`, their tests and `l10/main.ts`.
- **Tests:**
  - `steps.test.ts`, with `loadPage()` and the run recorder: the lengths, `aria-pressed`, the focus
    hand-off, and one announcement per action.
  - `games.test.ts`, on `lesson-06/one-sound.test.ts`'s pattern:
    - a miss replays at 1.5 times its lengths;
    - a new play elsewhere stops a round that is sounding.
  - Steps 1 and 2's part of End to end 4.
- **Done when:** those pass, and `learn-stage-fit` still passes.
- **Depends on:** P3, P12, A2 and K2.
- **Pages it can affect:** Lesson 10.

**P17. Steps 3 and 4, the game on chords and the pattern** (hard)

- **Goal:**
  - **Step 3:**
    - Major · Minor moves the middle bead.
    - Root lower and Root higher move the whole chord to the next white-key root, between C4 and
      B4, in 0.5 s and silently, respelling its names.
    - At each end, the root button is `aria-disabled` and a click does nothing (Edge cases).
    - Play the triad works as in Step 2.
    - The game on chords sits under the Notice, with the drawer "Why do stays home".
  - **Step 4:**
    - Play the pattern runs through a page-local player, `l10/pattern.ts`, built on kit runs. It
      schedules one quaver at a time, so a change of Slow · Fast or Major · Minor applies from the
      next quaver.
    - Each bead lights as it sounds.
    - Slow · Fast is a segmented switch with `aria-pressed`.
    - The readout says what is set, for example "C minor · slow".
    - The mix-up card and the drawers sit in the step's text.
- **Files:** `l10/steps.ts`, `l10/pattern.ts`, `l10/games.ts` and their tests.
- **Tests:**
  - `steps.test.ts`:
    - the root's ends;
    - spelling on every root (E♭, never D♯);
    - the pattern lasts 7.857 s slow and 4.0 s fast;
    - a change mid-pattern applies from the next quaver;
    - each bead lights as it sounds.
  - `games.test.ts`: the game on chords, with the same checks as P16's game.
  - Steps 3 and 4's part of End to end 4.
- **Done when:** those pass.
- **Depends on:** P16.
- **Pages it can affect:** Lesson 10.

**P18. Step 5, the names switch, and stopping sound when the step changes** (moderate)

- **Goal:**
  - **Step 5:**
    - Chord · Scale (`aria-pressed`) spreads the chord into its staircase over 0.6 s (P12); Chord
      folds it back.
    - Slow.
    - Its predict:
      - the choices "Just one: mi" and "Three";
      - the plays "Play C major" and "Play C minor". Each spreads the chord first if it is folded,
        and lights each stair as it sounds;
      - `revealOn` names both plays, with `revealAfter: 'all'`;
      - LESSON's hints and "You said" lines;
      - `unlocks` enables Step 5's Major · Minor (`kit/predict.ts:66-67`). `onChoice` (`:65`)
        sets a flag the toy keeps, so the switch stays enabled after the viewer leaves and returns
        (End to end 3).
  - **The names switch, Letters · Do-re-mi:** one page-wide store from `createModeStore` with K1's
    two modes, bound by `bindModeToggle` (`kit/names.ts:58-80`). Under Minor, Do-re-mi uses K1's
    `MINOR_SOLFEGE`; the letters come from `spellScale`.
  - **Leaving a step:** `registerToy({ onStep(next, previous) {…} })` (`kit/step-deck.ts:94`,
    called at `:167`). It stops the stage's runs and both games (`stop`, `kit/ear-game.ts:173-180`)
    whenever `next !== previous`. A layout switch calls it with the same step, so it does nothing
    then. Lesson 9's B8b uses the same rule.
- **Files:** `l10/steps.ts`, `l10/main.ts`, the tests and `learn-lesson-10.spec.ts`.
- **Tests:**
  - Tests 13's staircase half.
  - Step 5's predict counts a scale that was cut short as not heard.
  - Tests 7's last clause, for every route out of a step: nothing new plays afterwards. The routes
    are Previous, Next, a swipe, the lesson menu's jump, a `#step-N` address and a quiz link.
  - End to end 3.
- **Done when:** those pass.
- **Depends on:** K1 and P17.
- **Pages it can affect:** Lesson 10.

**P19. Sing it** (hard)

- **Goal:** `l10/sing.ts` builds the card's states from P4's rule.
  - **The comfort check:** `mountComfort` (`kit/comfort.ts:159-166`).
  - **The voice choice**, with its two lines (`VoiceChoice` and `bindVoiceButtons`,
    `kit/voice-choice.ts:30-47`, `:60-77`).
  - **Just listen today:** Play Merc's notes, and the doctor lines.
  - **Ready:**
    - Play Merc's notes: P5's notes in Merc's "ooh", the kit run's default kind. The path lights
      amber, and the ring shows the singing Merc's still.
    - Move do (`setMoveEnds`, `kit/move-do.ts:31-40`), with K3's `aria-disabled` if K3 has landed.
    - Start the guide stays `aria-disabled`, with its hint, until Merc's notes have been heard.
  - **The guide:**
    - `mountGuide` (`kit/slide-guide.ts:381`) with P5's rows and path and `breaths: [4.2]`;
    - the count-in (`countIn`, `kit/move-do.ts:46-51`), the sweep, and the ring (`mountRing`,
      `kit/sing.ts:135`).
  - **"How did that feel?":** `mountFeelings` (`kit/comfort.ts:175-206`), keeping the kit's lock,
    reset after each sweep.
  - **The Wrap's card:** `VisitEnding` and `mountPractiseCard` (`:101-149`).
  - **Leaving:** Lesson 8's rule (`lesson-08/sing.ts:289-304`). Whatever plays stops after 600 ms
    off screen, when the page is hidden, or on `pagehide`.
  - **Focus** moves to text, never to a button (spec:540; REQ-GVC-080).
  - Nothing calls `getUserMedia`.
- **Files:** `l10/sing.ts`, `l10/sing.test.ts`, `l10/main.ts` and a new
  `src/e2e/learn-lesson-10-sing.spec.ts`.
- **Tests:**
  - Unit, with `loadPage()`, the run recorder and a spy on `getUserMedia`:
    - every state shows exactly the controls P4 offers;
    - nothing but `fyp-voice` is written to storage (Tests 8's storage clause).
  - End to end 7 and 8. The spy follows `learn-lesson-03.spec.ts:323-332`.
- **Done when:** those pass.
- **Depends on:** P4, P5, P11, A2 and K2; K3, if the lead says yes.
- **Pages it can affect:** Lesson 10.

**P20. The Wrap** (moderate)

- **Goal:** `l10/wrap.ts`.
  - **Free play:** a second chord-beads toy (P12) with every control:
    - Root lower and Root higher, Major · Minor, and Chord · Scale;
    - Play, Play the pattern and Slow;
    - the names switch, on the page's store.

    A scale spread from B4 reaches B5 (987.77 Hz). Nothing locks.
  - **`#practiseCard`'s two versions** (LESSON:321-338; spec:142-147), picked by `VisitEnding`:
    - Drone Intonation, with Ear Lab's Stack as the second drill;
    - after "Effortful", "Uncomfortable" or "Just listen today", the rest card: "Rest today. Drone
      Intonation will be here when your voice feels comfortable", with the same address, then
      Stack.

    Both versions carry both links, and every link opens in a new tab.
  - **The tease still in `[data-next-card]`:** an inline SVG, `aria-hidden`, of a siren's line
    crossing a shaded grey seam, never red (CURIOSITY-MOMENTS.md:196-197; Lesson 11's signature,
    `kit/team-notes.ts:43`). It has no button. Its styles go under `.l10-tease` in `lesson-10.css`
    (section 6, item 15).
- **Files:** `l10/wrap.ts`, `l10/wrap.test.ts`, `learn/10.html`, `l10/lesson-10.css`,
  `learn-next-card.spec.ts` and `learn-lesson-10.spec.ts`.
- **Tests:**
  - `wrap.test.ts`:
    - free play's lines;
    - Slow plays the pattern at the slow tempo;
    - a play in free play stops any other sound.
  - End to end 10: in both versions the card's links are `/pitch-training?lesson=10` and
    `/ear-lab?lesson=10`, the marker before any hash, as Lesson 8's spec checks its card
    (`learn-lesson-08.spec.ts:265-271`).
  - End to end 11's tease test in `learn-next-card.spec.ts`, shaped like Lesson 8's (`:121-145`):
    - the `.next-tease` line reads Lesson 11's tease, one line above its hook;
    - the card's children are `next-words`, then `l10-tease`;
    - the card holds no button.
- **Done when:** those pass.
- **Depends on:** P12, P18, P19 and B14.
- **Pages it can affect:** Lesson 10.

**P21. End-to-end checks across the page** (moderate)

- **Goal:** the checks that span the whole page.
- **Files:**
  - `learn-lesson-10.spec.ts`:
    - End to end 4, as a keyboard sweep:
      - Tab reaches every control, bead and gap button;
      - each toggle flips `aria-pressed`;
      - Stack a third hands the focus to Play the triad;
      - each announcement reaches the live region;
      - at 390x844, every target is at least 44 x 44 px, and none overlaps another.
    - End to end 13, under reduced motion.
  - `learn-frame-loop.spec.ts`:
    - Lesson 10's ring, guide and explorer rest.
    - If K4 has landed and both chord-beads toys have a `wants`, the whole page rests too
      (`runRests(…, true, …)`, as Lesson 6's test at `:285-298` does).
    - `open()` is padded, unless B15 has already done it (G5).
- **Tests:** the above.
- **Done when:** they pass at both viewports on `build:e2e`.
- **Depends on:** P12 to P20 and B15; K4 for the whole-page clause.
- **Pages it can affect:** none; only specs change.

**P22. Final measurement and docs** (moderate)

- **Goal:** the page's numbers, records and citations, closed out.
  - Re-measure first paint, and set Lesson 10's two ceilings to the measured size plus a quarter,
    with the reason.
  - Compare each `dist/learn/NN.html`'s stylesheet links with the base's build
    (MISTAKES.md:919-924).
  - Run the app-check skill, locally or on dev and never against production, at phone and desktop
    widths. Cover:
    - the cold open before and after its reveal;
    - Sing it in each state;
    - "Play the chord" on the first screen at 390x844 (End to end 6).

    Then walk the spec's QA list (spec:1112-1131).
  - Run `pnpm lesson:words`; the spec gives 2,336 words. Make G8's LESSON change in the same commit
    as FACTS 3 and the spec's Length.
  - Re-anchor the citations, and fix section 6, item 16's stale statements and findings.
  - Update the `createQuiz` count in `workers/db-worker/src/mirror-metrics.ts:52-53`: 15 on main,
    17 after Lesson 9, 19 after Lesson 10.
  - In HANDOFF § 4.1's "Done since", record K1, K2, K5 and K4. Point Lesson 12's needs 8 at
    `kit/run.ts` (FOLLOWUPS).
  - After the merge, write the MASTER-PLAN § 11 and CURIOSITY-MOMENTS records, as B16 does.
- **Files:**
  - `scripts/assert-first-paint-budgets.mjs`;
  - the package's `LESSON.md`, `FACTS.md` and `WEB-SPEC.md`;
  - `workers/db-worker/src/mirror-metrics.ts`;
  - `docs/plans/find-your-pitch/HANDOFF.md`, and later `MASTER-PLAN.md` and
    `CURIOSITY-MOMENTS.md`;
  - `docs/agent/INDEX.md`, regenerated.
- **Tests:**
  - `scripts/lesson-words.test.mjs`: `GOLDEN` (`:317`) includes '10', and `:325-352` hold the
    total and each step's count equal;
  - `node scripts/plan-cites.mjs check`, at or under 183;
  - `pnpm docs:index:check`.
- **Done when:** those pass, the ceilings are set with their reasons, and the app-check verdicts are
  recorded with screenshots.
- **Depends on:** P11 to P21, and B16.
- **Pages it can affect:** none; docs and ceilings only.

### App (C10): independent of the page

**C10-1. Drone Intonation's richness** (no Lesson 10 code)

- **Goal:** none on this page. This entry records the dependency.
  - `arp/CONSENSUS.md` (24 October) decides it. Its Step 0 deletes `richness * w` from the
    Call-Response, Mirror Melody, Scale Runner and Drone grades. It does not reweight the other
    terms or bump a version.
  - The function is to be deleted, never fixed.
  - Drone drops its best-round term later, in its own bump. Whether stability stays in the grade is
    the owner's call.
- **Files:** none here. When Drone's grade changes, update LESSON:432-433, FACTS 49 and spec:709,
  as the consensus's "With the other bumps" lists.
- **Tests:** none here.
- **Done when:** the consensus's Step 0 has landed, and the three copy lines describe the grade that
  is live when the page ships.
- **Depends on:** the consensus's owner, on C3's track.
- **Pages it can affect:** none. The card's text never mentions richness (LESSON:325-331), so the
  page is right whichever grade is live, as FOLLOWUPS notes for Lesson 9's card.

**C10-2. `/exercises/thirds-on-a-drone`** (moderate)

- **Goal:** Drone Intonation on the two thirds only, `intervals: [3, 4]` (LESSON:340-348; FACTS 53).
- **Files:**
  - `src/features/exercises/slug-map.ts`: an entry in `EXERCISE_SLUGS` (`:47-65`).
  - `use-drone-intonation-controller.ts`:
    - read the launch's intervals with C1's `launchIntervals` in place of `INTERVALS` (`:17-24`);
    - let `pickIntervals` (`:26-31`) repeat an interval, never twice running (spec:690-694);
    - keep the difficulty's round count (`:72-76`) rather than capping it at the pool's size, as
      Lesson 9 decision 18 settles for the Interval Trainer.
- **Tests:**
  - A line in `src/tests/slug-map.test.ts`.
  - Controller tests: a two-interval pool gives the difficulty's round count, and never the same
    interval twice running.
- **Done when:** the app's checks pass. Switching the card to the slug is a later page-and-docs
  change.
- **Depends on:** C1, which adds the `intervals` field and passes it through `applyExerciseSlug`.
- **Pages it can affect:** none until the card switches.

**C10-3. `/exercises/major-or-minor`** (hard; App track)

- **Goal:** the planned `ear-drill` launch kind (CURRICULUM § 4 item 5, `:503-504`). It opens Stack
  with `stack:maj` and `stack:min` only, and has:
  - its own `RunTrack` (`use-identification-controller.ts:56-63`);
  - a guess floor of one half (`drills.ts:58-60`, `:233-237`);
  - `updateItem: false` (FACTS 53).

  Lesson 2's Leap subset (`season.ts:191-192`) and Lesson 8's "Ear Lab Time" (`:314`) wait on the
  same kind.
- **Files:** C1's launch plumbing, the Ear Lab identification controller and drills, and
  `slug-map.ts`.
- **Tests:** a slug-map line. A two-pad run rates on its own track with a floor of one half and
  leaves item difficulties alone.
- **Done when:** the app's checks pass.
- **Depends on:** C1, and the owner's decision on the kind.
- **Pages it can affect:** none. It does not gate the page.

**C10-4. App copy this lesson contradicts** (simple)

- **Goal:** correct the Learn chapter "Common Musical Scales" (FACTS 55).
  - Its moods are written as properties of the scales; they are tendencies.
  - It gives C minor's relative major as A major. It is E♭ major.
- **Files:**
  - `src/types/walkthrough.ts:892`, `:896`, `:899`, `:903`, `:906` and `:907`.
  - Drone's "just intonation" (`DroneIntonationExercise.tsx:134-135`) and "pure intonation"
    (`exercise-help.ts:142`) are on the consensus's "Fix now" list. Include them only if the lead
    hands that item to this task.
- **Tests:** no test pins the chapter. `src/tests/walkthrough-*.test.ts(x)` must still pass.
- **Done when:** those pass.
- **Depends on:** nothing.
- **Pages it can affect:** the app's Learn panel. No lesson page.

### Release (R1)

**R1. Publish the page** (owner)

- **Goal:** release Lesson 10 once Lesson 6's page is live and the vocal coach has looked at Sing
  it, on the owner's word (spec intro; Decisions 3).
- **Files:**
  - `kit/drafts.ts`: delete the line. The generated entry documents then link the lesson by
    themselves (`tools/lesson-links.ts:5-9`), `/ear-lab`, `/piano-night` and `/guitar-night` among
    them (spec:709-711).
  - `public/sitemap.xml`, and the Lessons list in `public/llms.txt` (`:66-80`).
  - `datePublished` in `learn/10.html`, in the same commit or straight after the console publishes
    the page (SEARCH.md § 3.2, § 12).
- **Tests:** the released lessons' checks (`src/tests/lesson-pages.test.ts:278-305`) replace the
  draft ones (`:307-344`).
- **Done when:** those pass, and the console has published the page.
- **Depends on:** P22, Lesson 6's release, and the coach's look.
- **Pages it can affect:** the generated entry documents, the hub, and Lesson 9's card on
  mercurypitch.com.

## 5. The test shifts P11 carries

The base holds B0 (`33537af37`) and B2. Lines are main's unless marked B0's. B2 edits the same
end-to-end lines first, so read them on the base.

The next lesson with no page becomes **Lesson 11, "Registers and the break"**
(`kit/season.ts:351-359`). It stays the right example even if Lesson 12's page lands first.
HANDOFF's suggested order is 9, 10, 12, 11 (`HANDOFF.md:219`).

**Unit tests: no shifts.**

B0 made every unit test that needed a lesson with no page call `lessonWithNoPage()` (B0's
`kit/season.test-fixtures.ts`). It also made the menu's season bar and the admin page's live column
and site paths read the season. The converted tests are:

- `kit/publish.test.ts`, `kit/lesson-menu.test.ts`, `kit/next-card.test.ts` and
  `kit/explorer-reveal.test.ts`;
- the explorer card test that selected Lesson 10 (`kit/explorer.test.ts:289-299`). P11's link
  would otherwise break it;
- `admin/lessons/lesson-admin.test.ts` and `admin/AdminLessonsPage.test.tsx`.

Once Lesson 10 has a page, they find Lesson 11 by themselves. B0's commit message says they all
pass with Lessons 9 and 10 given pages and draft lines.

**Three new unit tests** (Tests 12):

- `kit/publish.test.ts`: two tests in the shape of B0's `:58-74`:
  - Lesson 10 held back, by its draft default or by `{ 10: { published: false } }`, has neither
    `page` nor `minutes`;
  - `defaultPageState(true)` keeps both.
- `kit/season.test.ts`: one test in the shape of Lesson 8's (`:268-284`). It checks:
  - `/learn/10`, 17 minutes and no film;
  - the link `/ear-lab?lesson=10`;
  - a `note` that matches none of the backlog words in main's regex (`:186-187`).
- `kit/explorer.test.ts`: in B0's draft block (`:421-490`), a case in the shape of Lesson 5's
  (B0's `:464-489`):
  - with `VITE_DRAFT_LESSONS` at '0', Lesson 1's explorer shows Lesson 10 as "Coming later", with
    no link to `/learn/10` and its practice link kept;
  - with '1', it links Lesson 10 to read.

**Still naming a lesson, but unchanged by this page:**

- `kit/lesson-copy.test.ts:213-226` pins the copy of Lessons 9, 10 and 11's teases, not their
  pages.
- `kit/season.test.ts:93-119` checks `litEdges(9)`, which reads the prerequisite graph. No page
  changes the graph.
- `learn-next-card.spec.ts:121-145` checks Lesson 8's tease and word order, whatever Lesson 9's
  state.
- `learn-lesson-08.spec.ts:16` and `:260-283` check Lesson 8's card, which always leads to Lesson 9.
  B2 moves it to "Ready".
- `learn-publish-state.spec.ts` names Lessons 2, 3, 4, 7 and 8 only.

**End-to-end shifts P11 makes:**

- `learn-next-card.spec.ts`:
  - `CARDS` (`:27-76`):
    - B2's `/learn/09` row becomes "Next lesson 10 · Major and minor Ready · 17 min", linking
      `/learn/10`, with "Start lesson";
    - a new `/learn/10` row: "Next lesson 11 · Registers and the break Coming later", linking
      `#explorer`, with "See it on the map" (End to end 11).
  - The map test (`:195-207`), which B2 moves to `/learn/09`, moves on to `/learn/10` with
    "Registers and the break".
  - B14's Lesson 9 card test changes from "Coming later" to "Ready · 17 min", linking `/learn/10`,
    with "Start lesson".
- `learn-explorer.spec.ts:141-158`: `/learn/10` and "Registers and the break".
- `learn-lesson-menu.spec.ts`:
  - the row at `:378-382` becomes "Lesson 11, Registers and the break, coming later";
  - `NO_FILM` (`:250-255`) gains `{ n: 10, title: 'Major and minor' }`.
- `learn-sound-gate.spec.ts:15`: add `'10'`, and make the header (`:10`) say "Lessons 1 to 10".
- `learn-frame-loop.spec.ts`: only the header (`:1-26`). Lesson 10's test is P21's.
- Any Lesson 9 spec, from B14 or B15, that reads "Coming later" on Lesson 9's own card.

**Recommended.** Three specs need "the first lesson with no page":

- the map test;
- `learn-explorer.spec.ts:141-158`;
- `learn-lesson-menu.spec.ts:378-382`.

They could call B0's `lessonWithNoPage()` and open the page before it, as B0's unit tests do. End-to-end
specs already import kit fixtures (`learn-no-planning-text.spec.ts:20`). If B2 does this (section
6, item 14), this page shifts only `CARDS`, B14's card test, `NO_FILM` and the sound gate's list.

## 6. Ambiguities, conflicts and blockers

1. **The description (lead; before P11).** The spec's description passes every check on main.

   The question is the word "thirds". The cold open asks which note to move, and the answer, mi,
   is the chord's third. The description says "thirds", and `teaches` lists "Major and minor
   thirds". HANDOFF records answer leaks through the description or the share card as the season's
   most common review finding (`HANDOFF.md:360-363`).

   An alternative of 158 characters: "Which single note turns a major chord into a minor one? A
   seventeen-minute lesson with sound toys: major and minor chords by ear, and the natural minor
   scale."
2. **Shipping and the drafts line (lead; before P11).** The recommendation follows Lesson 9's
   decision 2:
   - kit tasks go up as small PRs;
   - the page is one branch, stacked on `feat/lesson-09-page`, with one commit per task and one PR;
   - nothing merges before the tag.

   The spec's drafts line, `"Lesson 6's page at /learn/06, and the vocal coach's look at the sung
   checkpoint"`, costs about 86 bytes on every page (G7). Lesson 12's line copies its form, so one
   wording should serve both.
3. **The explorer card's practice link (owner; P11).** The recommendation is Stack,
   `/ear-lab?lesson=10`, "then tap Stack" (spec Decisions 4).
   - It needs no voice.
   - It has no richness term.
   - Lessons 2, 6 and 8 already link `/ear-lab?lesson=`.

   The other choice is Drone Intonation, whose run tops out near 80 today.
4. **Drone's richness (lead).** `arp/CONSENSUS.md` already deletes the term. Confirm two things:
   - no Lesson 10 task is needed;
   - LESSON:432-433, FACTS 49 and spec:709 change with Drone's grade.
5. **Move do's `aria-disabled` (lead; K3).** The spec asks for it, and so does Lesson 12. It
   changes Lessons 4, 6 and 8, and B12 asserts `disabled` today. If the answer is no, Lesson 10 uses
   `disabled`, and the spec's state 4 and Edge cases are corrected.
6. **Resting page-wide (lead; K4, P21).** Without K4, the hero's spiral keeps the loop running for
   as long as the page is open, and Lesson 10 sits with Lessons 1 to 5 rather than 6 to 9.
   Changing the loop's rule for inactive drawers (`frame-loop.ts:134-136`) is the alternative, but
   it touches every lesson.
7. **Button names (lead; P8, P14).** The recall imports `l06-q3` with its slot. That button reads,
   and is named, "Play" (`lesson-06/quiz-questions.ts:37-38`, `:88`), but the spec wants "Play two
   notes" (spec:604). Lesson 9's B9 takes the same slot.
   - Recommended: keep "Play" and correct the spec. The alternative edits Lesson 6's slot, which
     Lessons 8 and 9 share.
   - Quick check question 2 shows "Play" and is named "Play the question's chord", so its name
     contains its visible label (WCAG 2.5.3).
8. **Where K1 lives, and the parts shared with Lesson 12 (lead).**
   - Recommended: a new `kit/names-modes.ts`.
   - Name one owner each for K1 and K2, which Lesson 12 needs too.
   - Spec:219-220 and Lesson 12's spec (its :36-38) disagree about reusing the chord beads.
     Recommended: they stay page-local, and spec:219-220 is corrected.
9. **First-paint room (lead, only if a ceiling must rise; P11).** A ceiling rises only in the change
   that needs it, with its reason (Lesson 9 decision 10; the budget file's rule, `:47-58`).
10. **The share card (lead; P10).** It follows Lesson 9 decision 3: rendered in a headless browser
    from the kit's own spiral, seen from above, with P9's pre-reveal marks. Its text is "Major and
    minor" and "Lesson 10".
11. **K5 (lead).** An optional `owner` on the spiral. The hero needs it for one sound at a time.
    Lessons 1 and 2 pass no owner, so nothing changes for them.
12. **LESSON's Lesson 11 hook (lead or owner; P22).** See G8. The page is right either way; only the
    copy source is stale.
13. **Sound during a stage change (lead; P16 to P18).** The spec settles two cases: a slide is
    silent, and Step 4's switches act from the next quaver. It does not say what these controls do
    to a chord or scale already sounding in Steps 1 to 3 and 5:
    - Major · Minor;
    - the root buttons;
    - Stack a third;
    - Chord · Scale;
    - the names switch.

    Recommended: each stops the stage's sound first, except in Step 4.
14. **Three asks of Lesson 9's builders (lead).**
    - B15 pads `open()` in `learn-frame-loop.spec.ts` (G5).
    - B2's recorder for kit runs lives beside `kit/run.ts`, so Lesson 10 imports it.
    - B2 makes the three end-to-end specs that name the next lesson with no page call
      `lessonWithNoPage()` (section 5), so no later page shifts them.
15. **What main rejects in the spec as written.** Each is handled in the task named.
    - Audio (spec:638-646): `playTone` and `playContour` cannot be stopped (G1; K2, P13).
    - Needs 4 says the spiral "needs nothing" (spec:779; G2, G3; K5, K4).
    - "7.9 s" (spec:258, :986) is 16 × 30/70 + 1.0 = 7.857 s, so a `toBe(7.9)` fails. Assert
      `toBeCloseTo(7.9, 1)` or the formula (P2).
    - Tests 12's backlog regex (spec:1029) is narrower than main's (`kit/season.test.ts:186-187`
      adds `launch`, `durationSec`, `placeholder` and `first visit`). "then tap Stack" passes both;
      use main's.
    - Lesson 8's page test rejects every ♯ and ♭ (`lesson-08/page.test.ts:63-67`, `:234`). This page
      prints E♭ and G♭, so its page test follows Lesson 6's (P11).
    - The tease still is to use "the kit's shared still styles" (spec:626-627), which do not exist.
      Each page keeps its own (`lesson-08/lesson-08.css:271-300`), so P20 uses `.l10-tease`.
    - The frame-loop spec's `open()` cannot reach `/learn/10` (G5).
    - The predict ignores a tap on its own plays while one sounds (`kit/predict.ts:179`), so Tests
      4's "new play" comes from outside the predict (P13).
    - Checked and passing:
      - the head, against `lesson-pages.test.ts` and `lesson-copy.test.ts:323-358`;
      - LESSON's page copy, which carries none of `learn-no-planning-text.spec.ts:22-40`'s words.
        Only its editorial note (:340-348) and the coach's list (:434) do, and neither reaches the
        page.
16. **Drift, findings and stale statements (P22).**

    | What | Spec cites | Now at |
    | --- | --- | --- |
    | `initMasthead` in Lesson 4 (spec:103) | `lesson-04/main.ts:99-110` | `:108-119` |
    | Lesson 4's next card and explorer (spec:150) | `lesson-04/main.ts:94-96` | `:95` and `:105`, with the plan-back import at `:100-103` |
    | `mercListen` (spec:663) | `merc-duo.ts:206` | `:185` |
    | `mercCelebrate` (spec:665) | `merc-duo.ts:216` | `:195` |
    | `MercDuoOptions` (spec:667) | `merc-duo.ts:120-126` | `:99-105` |

    Main's plan-cites report has nine findings in this package:
    - FACTS:104, :106, :168, :178 and :192;
    - spec:663, :665 and :667 (the `merc-duo.ts` rows above);
    - spec:740, which quotes "Ear Lab, then tap Stack". `practiseMarkup` builds that string at run
      time (`kit/explorer.ts:177-182`).

    B0 has already re-anchored spec:1024 and :1028. Re-anchor first, then reword what re-anchoring
    cannot fix.

    Stale statements:
    - spec:12-17: Lesson 6's page is on main, and the ear game, breath mark and Move do are kit
      parts.
    - spec:219-220: Lesson 12 does not reuse the chord beads (item 8).
    - spec:348 and :426, "#1149's fix pass": `NowPlaying` and the predict's `false` are on main.
    - spec:495, :545-546, :564, :784 and :802 read `feat/lesson-06-page`; read main instead.
    - spec:593, "If Lesson 6's page lands first": it has.
    - spec:626-627: the shared still styles (item 15).
    - spec:779: the spiral "needs nothing" (item 15).
    - spec:800, Move do "is to take `aria-disabled`": main still sets `disabled` (K3).
    - spec:801-803, the breath mark "Until that lands": `breaths` is on main.
    - spec:638-646: the Audio section's players (G1).
    - spec:1080-1081, "as Lesson 7's row reads for Lesson 8": on main, Lesson 8's row is the one
      coming later.
    - LESSON:350-352: Lesson 11's hook (G8).
17. **Not build blockers.** Publishing waits for Lesson 6's page and the coach's look (owner).
    Lesson 12 publishes after Lesson 10. C10-1 to C10-4 do not gate the page.

## 7. Where each spec test lands

| Spec test                       | Task                                                                                                        |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tests 1, 2 (spelling, chords)   | P1                                                                                                          |
| Tests 3 (sounds)                | P2; chord levels through K2                                                                                 |
| Tests 4 (cold open's predict)   | P13; `false` from A2 and K2; a bead tap as the new play through K5                                          |
| Tests 5 (bead slide)            | P9                                                                                                          |
| Tests 6 (layout)                | P6                                                                                                          |
| Tests 7 (Major or minor?)       | P3 (deal, notes, templates); P16 and P17 (the 1.5 replay, one sound at a time); P18 (leaving a step)        |
| Tests 8 (Sing it flow)          | P4; the storage clause in P19                                                                               |
| Tests 9 (Move do and guide)     | P5                                                                                                          |
| Tests 10 (copy)                 | P7 (templates), P8 (quiz feedback), P11 (`page.test.ts`, signs)                                             |
| Tests 11 (quizzes)              | P8                                                                                                          |
| Tests 12 (season)               | P11's three new unit tests; B0 for the isLive test                                                          |
| Tests 13 (names switch)         | K1 (syllables); P18 (the staircase's names)                                                                 |
| End to end 1                    | P11                                                                                                         |
| End to end 2                    | P13                                                                                                         |
| End to end 3                    | P18                                                                                                         |
| End to end 4                    | P16 to P18, step by step; P21's sweep                                                                       |
| End to end 5, 6, 12             | Automatic from P11 (`learn-stage-fit`, `learn-cold-open-fold`, `learn-no-planning-text`); 6's screenshot in P22 |
| End to end 7, 8                 | P19                                                                                                         |
| End to end 9                    | P14                                                                                                         |
| End to end 10                   | P20                                                                                                         |
| End to end 11                   | P11 (the card's row); P20 (the tease)                                                                       |
| End to end 13                   | P21                                                                                                         |
| End to end 14                   | P11                                                                                                         |
