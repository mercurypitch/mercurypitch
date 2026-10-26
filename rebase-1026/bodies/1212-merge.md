Before this, the Lessons console asked before a publish only while a lesson's line in `drafts.ts` stood, and it never looked at any other lesson. So a lesson could go live before the lessons it builds on, the ones its chips link to, and once its drafts line was deleted the console asked nothing at all. Lessons 10 and 12's specs proposed a warning; the owner said yes on 24 October. On 25 October the owner added two things: "Use default" asks too, and the warning also covers Lesson 3's recall of Lesson 2 and Lesson 8's recall of Lesson 6, without changing the season map.

The console still never stops a publish. "Publish anyway" goes ahead, so the order stays the owner's to keep. Unpublishing never asks.

## What it asks

One question, and only when there is something to say. The sign-off comes first:

| Case | Title | Message |
| --- | --- | --- |
| Builds on a lesson not published here | Publish Lesson 12 before Lesson 10? | Lesson 12 builds on Lesson 10, which is not published here. Publish it anyway? |
| Its recall asks a lesson not published here | Publish Lesson 3 before Lesson 2? | Lesson 3's recall asks Lesson 2's questions, and Lesson 2 is not published here. Publish it anyway? |
| Both kinds | Publish Lesson 8 before Lessons 1 and 6? | Lesson 8 builds on Lesson 1, which is not published here. Its recall also asks Lesson 6's questions, and Lesson 6 is not published here. Publish it anyway? |
| A drafts line as well | Publish Lesson 12 before its sign-off and before Lesson 10? | Lesson 12 waits on …. It also builds on Lesson 10, which is not published here. Publish it anyway? |
| Only a drafts line | Publish Lesson 3 before its sign-off? | As before. |

"Use default" asks the same question when clearing the override would put the lesson live: the lesson has a page, is published by default on this site, and is not published here now. Otherwise it saves at once, as before.

## What changes

- **`lessons/lesson-admin.ts`**
  - `aheadOf(n, isPublished)`: what lesson `n` would go live ahead of. It returns `{ buildsOn, recalled }`: the lessons it builds on (season.ts `PREREQ`) and the lessons its recall asks, each not published here, in lesson order. A lesson in both counts once, as one it builds on.
  - `RECALLS`: the console's own list of recalls that ask a lesson outside their page's `PREREQ`, `{ 3: [2], 8: [6] }`. `PREREQ`, the season map, the explorer cards and the prerequisite chips do not change. Its comment says why it is apart from `PREREQ`, and that a new recall of that kind needs a line here.
- **`lessons/lesson-publish.ts`**
  - `publishQuestion(name, waitingOn, ahead)`: the words in the table, or `null` when there is nothing to ask. A recall is never called "builds on". The title names every lesson the publish would go ahead of, in lesson order.
  - `defaultGoesLive(view)`: whether "Use default" would put the lesson live.
- **`AdminLessonsPage.tsx`**: `goLive`, the one path that asks before a lesson goes live. The switch's Publish and a "Use default" that would put the lesson live both go through it, so they ask the same question, once, with the same "Publish anyway". It reads each other lesson's state from the console, not from the build. After "Publish anyway", "Use default" hands the focus to the switch as it did; Cancel stores nothing.
- **`lessons/LessonControls.tsx`**: doc comments only.
- **Docs**: HANDOFF, Lessons 10 and 12's Decisions 3, and the passages in Lessons 8 to 14 (LESSON.md, WEB-SPEC.md, FACTS.md) that said nothing enforces the order or that the console checks none. They now say the console asks but never stops a publish, quote `publishQuestion`, and cite the new lines. No learner copy changes: the lesson word counter gives the same counts for Lessons 8 to 14.

## Commits

1. `feat(admin): Ask before publishing a lesson ahead of one it builds on`
2. `docs(lessons): Say the console asks before publishing ahead of a lesson`
3. `feat(admin): Ask before "Use default" puts a lesson live`
4. `feat(admin): Ask before publishing ahead of the lesson a recall asks`
5. `docs(lessons): Say "Use default" asks too, and the warning covers two recalls`
6. `docs(agent): regenerate the module map`

## Tests

- `lesson-admin.order.test.ts`: `aheadOf` for every lesson that builds on another, `RECALLS` naming nothing `PREREQ` already has, the dedupe and the order.
- `lesson-publish.order.test.ts`: every wording case, and `defaultGoesLive`'s six cases.
- `AdminLessonsPage.order.test.tsx`, 13 tests on the whole page:
  - the switch asks ahead of a lesson it builds on, and publishes at once when that lesson is published here;
  - a draft is asked once, naming its sign-off too, and publishes on one "Publish anyway";
  - Lesson 3 with Lesson 2 unpublished, and Lesson 8 with Lesson 6 unpublished;
  - "Use default" asks a draft and asks ahead of a lesson it builds on, goes back to the default only on "Publish anyway", hands the focus to the switch, stores nothing on Cancel, and saves at once when it keeps the lesson live;
  - unpublishing never asks.
- `kit/season.test.ts`: `PREREQ` still has Lessons 3 and 8 on Lesson 1 alone, so neither recall reaches the map or the chips.
- Mutations: 19 for the owner's two changes, each turning at least one test red (for example "Use default" saving at once as before: 4 tests; `goLive` saving before it asks: 7; the recall put on the season map instead: 5). For the first commit, 16 of 17; the survivor, a double save, is equivalent, since the page's save refuses a second save in flight.
- `AdminLessonsPage.order.test.tsx` has its own 20 s limit, with the reason beside it, as the page's other test files do since #1211. Rebased onto that change, with every admin test file running at once at loads of 2 to 7, its slowest test ran 2.1 to 2.5 s over three rounds: 8 times under the limit.

## Checks

Rebased onto `{{MAIN}}` on 26 October, after v0.9.22 was tagged and #1205 merged. There were no conflicts. Four of the five code commits keep their patch-ids. The fifth, which edits Lesson 8's FACTS.md, differs only in a line of context: main's #1216 re-anchored a `lesson-sections.css` citation two lines above the branch's edit, and the edit itself is unchanged. The module map commit was regenerated. These checks ran on the same tree, stacked on #1205 before it merged:

- `pnpm check`: no errors and the 11 warnings main already has, none of them in these files; it changed no files.
- Unit tests for `src/features/admin`, `kit/season.test.ts` and `kit/publish.test.ts`: 12 files and 173 tests pass.
- `pnpm test:scripts` (255 of 255), `pnpm pr:validate` and `pnpm metrics:check` (no regressions): pass.
- `pnpm docs:index:check`: up to date.
- `plan-cites check`: 156 findings, one fewer than main's 157. Lesson 12's Decisions 3 had quoted a question that was never literally in the code.

CI runs everything again here, `admin-lessons.spec.ts` among the browser specs. That spec publishes Lesson 3 before its sign-off and puts Lesson 1 back to its default. Lessons 1 and 2 are released, so Lesson 3's question keeps its title there, and Lesson 1's "Use default" has nothing to ask and saves at once.

On the previous base, `2404b342e`, 25 October:

- `pnpm check`: no errors, and the 11 warnings main already has, none of them in these files. It changed no files.
- The same unit tests: 12 files and 173 tests pass.
- `pnpm pr:validate`: passes.
- `pnpm metrics:check`: no regressions.
- `pnpm docs:index:check`: up to date.
- `plan-cites check`: 156 findings, one fewer than main's 157.

## For the owner

Nothing open. The two changes of 25 October are in as asked:

1. "Use default" asks when it would put a lesson live.
2. Lesson 3's recall of Lesson 2 and Lesson 8's recall of Lesson 6 are in the warning only, through `RECALLS`. The season map, the explorer and the chips still show Lessons 3 and 8 building on Lesson 1 alone.

## Merge

v0.9.22 is tagged and #1205 has merged. This merges by rebase once CI is green here. The next PR that touches `docs/agent/INDEX.md` or the lesson docs is then rebased onto main and regenerates the map.
