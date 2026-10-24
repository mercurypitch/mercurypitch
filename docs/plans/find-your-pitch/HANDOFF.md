# Find Your Pitch: handoff

Written on 22 October 2026, once every Season 1 lesson was written and reviewed, the pages for
Lessons 1 to 8 were on the dev site, and every citation in the lesson packages had been read again
on main. It is for the owner first, and then for whoever carries the series on. It covers what
stands, what release day needs, what waits on a decision, what was left for later on purpose, and
what is ahead.

The registers of record stay where they are, and this file points at them instead of copying them:

- [MASTER-PLAN.md](MASTER-PLAN.md) § 11 (what exists) and § 12 (owner decisions);
- [CURRICULUM.md](CURRICULUM.md) (the season, lesson by lesson);
- [CURIOSITY-MOMENTS.md](CURIOSITY-MOMENTS.md) (hooks, teases and the openings);
- [SEARCH.md](SEARCH.md) (heads, structured data and the checklist for each new lesson);
- [youtube/YOUTUBE.md](youtube/YOUTUBE.md) (the upload guide);
- each lesson's own folder in [`lessons/`](lessons/);
- [README.md](README.md), "How the plan cites the app" (how to read a package's `file:line`).

## 1. Where the season stands

Every lesson has a written lesson: its facts (`FACTS.md`), its copy (`LESSON.md`) and its page spec
(`WEB-SPEC.md`), each reviewed and fixed at least once. A page is built only where the table says
so.

| Lesson                             | Page                              | On mercurypitch.com           | What it waits on                                |
| ---------------------------------- | --------------------------------- | ----------------------------- | ----------------------------------------------- |
| 1. What is a note?                 | `/learn/01`, with its film (5:14) | from the next release         | the film's upload                               |
| 2. Twelve notes                    | `/learn/02`, with its film (7:11) | from the next release         | the film's upload                               |
| 3. Match a note                    | `/learn/03`, draft                | when the console publishes it | the vocal coach                                 |
| 4. The major scale and home        | `/learn/04`, draft                | when the console publishes it | the owner's go-ahead                            |
| 5. Breath and a steady note        | `/learn/05`, draft                | when the console publishes it | the vocal coach                                 |
| 6. Intervals                       | `/learn/06`, draft                | when the console publishes it | the owner's review; the coach's look at Sing it |
| 7. Slides, sirens and your range   | `/learn/07`, draft                | when the console publishes it | the owner's review; the coach                   |
| 8. Beat, tempo and the backbeat    | `/learn/08`, draft                | when the console publishes it | the coach (its one sung line)                   |
| 9. Landing a leap                  | not built                         |                               | its page; the coach                             |
| 10. Major and minor                | not built                         |                               | its page; the coach's look                      |
| 11. Registers and the break        | not built                         |                               | its page; the coach                             |
| 12. Chords and the four-chord song | not built                         |                               | its page; the coach's look                      |
| 13. Resonance and vowels           | not built                         |                               | its page; the coach                             |
| 14. Phrasing: sing a whole song    | not built                         |                               | its page, after a kit change; the coach         |

A draft is in every build. The dev site and the previews serve it. From the next release,
mercurypitch.com answers it with the 404 page until the Content Studio's Lessons page,
`/admin/lessons`, publishes it; publishing then needs no release, and neither does unpublishing.
The publishing gate and the console reach production with that release: v0.9.21, the one live now,
has neither.

A page links the earlier lessons its prerequisite chips and its recall name: Lesson 3 links Lessons
1 and 2; 4 links 2; 5 links 2 and 3; 6 links 4; 7 links 3; 8 and 10 link 6 (8 also links 1 since
#1186, by its chip); 9 links 3 and 6; 11 links 7; 12 links 10; 13 links 11; 14 links 5, 8,
9 and 12. While the earlier page is not live, the link shows as words with no link, so nothing
breaks. Publish in that order anyway: MASTER-PLAN § 11 says when each page can go live, and the
console does not check the order.

## 2. Release day

Lessons 1 and 2 are the first lesson pages to reach mercurypitch.com. No web release carries
`learn/01.html` yet: the last, v0.9.21 (18 October), predates the page, and the `mp-v` tags since
are the mobile app's builds. The next `v` tag carries both pages.

### Before the tag

1. **Films.** Upload each film's two MP4s to R2: the 1080p and the 720p, both cut from the delivery
   master, with the moov atom at the front so they start before they have downloaded. Each lesson's
   pair goes on one line in `src/features/lessons/kit/films.ts`, where Lessons 1 and 2 are `null`
   today. That one line is the whole change: the Watch section, its masthead link and the card's
   "Watch the episode" appear with it.
   - The host must be one the site's `media-src` allows (`public/_headers`: `*.r2.dev` or
     `*.r2.cloudflarestorage.com` today). Cloudflare rate-limits `r2.dev` and meant it for
     development (MASTER-PLAN § 12 item 7), so launch on the custom domain,
     `media.mercurypitch.com`, and add it to `media-src` first.
2. **A re-cut film.** If the polish re-times a film or changes a word, the page needs its new
   captions (the VTT) or its final scene times. A test holds the page's captions and chapters to
   the lesson's copies, and Lesson 2's last caption inside 7:11. The length label (5:14 and 7:11
   today) takes the film's own running time once the video loads.
3. **The date.** In a commit before the tag, set `datePublished` for Lessons 1 and 2 to the planned
   release day, and their sitemap `lastmod` (2026-10-20 today) with it (SEARCH.md § 3.2). Both
   ship as built, so a date set after the tag waits for the next release. Neither page has a
   `datePublished` yet.
4. **A release before the films.** Any `v` tag cut before the films are uploaded makes both pages
   live without them: no Watch section and no "Watch the episode". If one must go out first,
   unpublish Lessons 1 and 2 from the console as soon as it deploys; the site follows within about a
   minute.
5. **The release.** Its changelog entry lands on main first. The `prod-upd` skill then tags main at
   `CHANGELOG.md`'s version, and the tag deploys production. Only the owner cuts a release. The same
   release takes the publishing gate and `/admin/lessons` to production, with Lessons 3 to 8 held
   back as drafts. If the release carries the lesson answer events, the privacy notice on
   about.mercurypitch.com (another repository) first needs a line on them: what a lesson page sends,
   that it is anonymous, and that in the EEA, the UK and Switzerland it sends nothing without a
   recorded yes (you asked for this reminder on 23 October 2026).

### On the day

6. **Being found.** Request indexing in Search Console and Bing, and publish each episode on YouTube
   with the lesson's link first (SEARCH.md § 12 item 5; every Studio field is in YOUTUBE.md).

### Publishing more lessons later, without films

7. **Publish** from `/admin/lessons`. The button reads Publish, or Unpublish once a lesson is live.
   For a lesson that still waits on its sign-off, the console asks first ("Publish anyway"). "Use
   default" goes back to what the code says.
8. **The date, again.** The site worker never writes `datePublished`; it gives a published draft
   only a sitemap `lastmod`. Set the lesson's `datePublished` in a commit straight after the
   console publishes it, or in the commit that deletes its `drafts.ts` line (SEARCH.md § 3.2);
   either reaches mercurypitch.com with the next release. Request indexing the day the console
   publishes it.
9. **Hooks and teases** switch in the same place. Every alternative shows its note, which says why
   it exists. The notes live in `kit/team-notes.ts`, which only the console loads.

## 3. Decisions you made

1. **The vocal coach** (MASTER-PLAN § 12 item 8): who, and when. Eleven lessons wait on the coach.
   The voice lessons, 3, 5, 7, 9, 11, 13 and 14, wait on the coach's sign-off of the "For the vocal
   coach" list in their LESSON.md. Lessons 4, 6, 8, 10 and 12 are theory lessons, which the coach's
   gates do not bind, but each has a sung part: Lesson 8's page stays a draft until the coach signs
   off its sung line, and Lessons 6, 10 and 12 wait on the coach's look at theirs. Lesson 4's list
   is for a look only: its page waits on your go-ahead alone (item 2). This is the season's critical
   path. Decided (22 October 2026): you find the coach.
2. **Lesson 4** waited on your go-ahead (held back on 21 October, before the release). Decided (22
   October 2026): you publish it from the console a few days after Lessons 1 and 2, once the release
   carrying the handoff follow-ups is out.
3. **Hook alternatives that break the copy rules.** Under your rule of 20 October, a changed hook
   stayed in the console as an alternative. Five of them broke the copy rules in
   `kit/lesson-copy.ts`'s header: `harder` (Lesson 9), `same-note` (11), `hundreds` (12) and
   `compelling` (14) each made a claim no source in their FACTS.md supports, and `bright-dark` (10)
   used mood labels, which its lesson refutes. Decided: you dropped all five on 22 October 2026, and
   #1186 deletes them and their notes. Each lesson keeps its tease, and Lesson 14 its tease
   alternative `band`.
4. **"Compelling" in two drafts.** YouTube row 14's title 3 and SEARCH.md § 4's draft title for
   Lesson 14 used the old hook's word, which no source defines. Decided (22 October 2026): drop it.
   #1186 makes title 3 "Beyond in tune: phrasing a whole song" and the draft "Phrasing in singing:
   breath, swell and shape | MercuryPitch".
5. **Lesson 3's hook changed on 22 October** (#1168). It is now "Asked, most students said they
   couldn't copy a tune. What happened when researchers tested it?" The hook you approved on 20
   October, "Asked, most students said they couldn't copy a tune. Tested, most could. So what's
   going on?", told the predict under it how the tests came out (CURIOSITY-MOMENTS § 1 rule 4). It
   stays in the console as the alternative `tested` if you prefer it. Lesson 5's promise had the
   same fault and was reworded in the same PR. The older alternative, `figures` ("In tests, only
   about one in ten to one in six missed by a semitone or more"), gives the same answer away with
   numbers. Its note did not say so. Decided (22 October 2026): both stay as alternatives, and since
   #1186 the note on `figures` warns of it.
6. **Lesson 5's hook** leans a little towards its predict's answer. "Singers are told to “support” a
   long note. If that doesn't mean pushing, what keeps it steady?" suggests that pushing is not what
   keeps a note steady. Decided (22 October 2026): it stays the default, as your approved wording,
   and since #1186 the console also holds a neutral alternative, `steady`, "Singers are told to
   “support” a long note. What keeps it steady?"; you pick which goes live.
7. **Lesson 8 in the lesson menu.** On Lesson 1's own page, before Lesson 1 was done, the menu
   offered Lesson 8 as "up next" wherever Lesson 8 was live: the menu skips the page's own lesson,
   and Lesson 8 built on no lesson. Decided (22 October 2026): Lesson 8 comes after Lesson 1. #1186
   adds the edge [1, 8] to `EDGES` in `kit/season.ts` and to CURRICULUM § 3.3, so the explorer
   joins Lesson 1 to Lesson 8, and `kit/lesson-menu.test.ts` records the new order. Lesson 6 only
   helps, so Lesson 8's recall still shows once Lesson 6 is done; its page gains a Lesson 1 chip.
8. **Recall links, one rule or two.** Lessons 3, 4, 5, 7 and 8 open the earlier lesson at the step a
   question comes from (`/learn/02#step-5`). Lesson 6 opened Lesson 4's page at its top, as its
   brief asked (its WEB-SPEC, Toys 7), though the step address would work there too. Both open a new
   tab. Decided (22 October 2026): one rule. Since #1186 Lesson 6 opens Lesson 4's page at the
   step too (`/learn/04#step-1`).
9. **Open since before this run** (MASTER-PLAN § 12), each decided on 22 October 2026, as
   MASTER-PLAN § 12 and SEARCH.md § 13 now record: orange Merc's name and pronouns (item 1; Decided
   (23 October 2026): Tavi, she, where 22 October left her unnamed); whether the lessons are free
   (3); 1080p or 4K (4); where the lessons live in the app (6); orange Merc as an app palette (10);
   the lesson telemetry exception (11). SEARCH.md § 13: titles, bylines, the hub (built in #1188),
   watch pages, articles, the lesson licence and aggregate data. CURIOSITY-MOMENTS § 5 item 5,
   whether lesson pages send events at all: yes, with consent, built in their own PR (MASTER-PLAN
   § 12 item 11).
10. **Run times past the budget.** Most lessons run past MASTER-PLAN § 4.2's 8 to 12 minutes of
    active time. Decided (22 October 2026): none is trimmed to fit. Decided (23 October 2026): every
    lesson's chip states its real run time, Lessons 1, 2 and 4 included, whose chips read an
    estimate of 10 minutes; #1192 sets them from today's word counts, to 8, 13 and 14 minutes.

## 4. Left for later, on purpose

### 4.1 Pages for Lessons 9 to 14

Each WEB-SPEC's "What the kit and the app still need" lists its parts, checked against main on the
day it was written; re-check each against main before building. The shared pieces, and which pages
need them ("needs 5" is item 5 of a lesson's list):

- **The names switch** from Lesson 4 (10 and 12).
- **The band chart's rungs** (`kit/band-chart.ts`): Lesson 9 brings them, and Lesson 14's song line
  reuses them.
- **The range chart** (`kit/range-chart.ts`), new with Lesson 7's page: Lesson 11 adds four options
  to it, each off by default so that Lesson 7's chart stays as it is: Merc's line in two gears, the
  seam, slots and the stretch gauge (its WEB-SPEC, "What the kit and the app still need", 5).
- **Voice options in `kit/sound.ts`**: Lesson 11 proposes `wave` and `lowpass` (its needs 6), and
  Lesson 13 `partials` and `resonators` (its needs 5). Whichever page is built first lands one
  design, and the other uses it. Lesson 13 also needs a spectrum strip under the band chart.
- **Smaller shared parts**: `kit/siren-flow.ts` from Lesson 7's page (11's needs 7), an open turn
  for the ring's `RingRun` (11's needs 12), `kit/hold-flow.ts` and `kit/hold-run.ts` from Lesson
  5's page (13's needs 8 and 9), `writeStepsWav` for the end-to-end tests (9's needs 13, 14's needs
  16), and a `schedule` that can be stopped (12's needs 8).
- **Lesson 14** waits on one kit change before its page is built (its needs 12): a season close
  that knows a rest ending, with no "Now sing a whole song." after "Effortful", "Uncomfortable" or
  "Just listen today" (the lead's decision, 21 October). Item 11 of its list, Move do and the
  count-in as kit parts, is done (below).
- **Lesson 14 also proposes** `kit/record.ts` with `Listener.media`, the first kit module that keeps
  audio, in memory only; `kit/twinkle.ts`, the whole first verse as data; and a `playNoise` that can
  be stopped, so a page can cut an in-breath when the viewer leaves a step.
- **Done since the specs were written:**
  - `recallStepHref` is in `kit/quiz.ts` (Lesson 8's page, #1172), and every page whose recall
    opens a step uses it. Lessons 10 to 14's specs proposed the move; #1171 says in their words
    that it is done.
  - **Move do and the count-in are kit parts** (`kit/move-do.ts`, #1192), as Lessons 9, 10, 12
    and 14 ask. Lessons 4, 6 and 8 share its step and its ends, and Lessons 4 and 6 its count-in;
    Lesson 8's count-in is a bar on its beat clock, another mechanism, and stays on its page. Each
    page keeps its own wiring, readout and labels.
  - **"Effortful" goes to the rest card by a kit option** (#1192),
    `afterFeeling(f, { restAfterEffort: true })` in `kit/comfort.ts`, as Lessons 9, 11, 13 and 14
    ask. Lessons 6, 7 and 8 pass it in place of their own overrides. The specs of 9, 11, 13 and 14
    say it is built, and those of 10 and 12 follow Lesson 6, so their pages can pass it too.

A suggested order: 9 (it brings the rungs), then 10, 12, 11, 13 and 14.

### 4.2 Kit cleanups

- **Done in this run: the team's strings off the lesson pages** (#1170). Each lesson's signature and
  every hook and tease note moved into `kit/team-notes.ts`, which only the console imports, and the
  first-paint check, which CI runs in `build:e2e`, now fails a build that pulls it into a lesson
  page. Every lesson page lost 2,877 bytes of JavaScript: Lesson 3's headroom went from 37 bytes to
  2,914, and Lesson 4's from 111 to 2,988.
- **Done in #1192**, each with a test that fails without it:
  - **The sound gate** keeps its height when sound comes on: both of its lines stay in it, and the
    one not current is hidden. It shrank by 19 to 21 px on Lessons 1 to 6 and 8, and by 40 to 42 px
    on Lesson 7.
  - **A take that opens in a hidden tab, or after its section is left,** lets the microphone go at
    once on Lessons 3, 5 and 7, and starts nothing. On Lessons 3 and 5, leaving while the microphone
    opens no longer scrolls the card back into view.
  - **Lesson 8 with sound off:** Start on the take and "Play the groove" each say they need sound,
    and neither runs.
  - **The service worker's list** (`STANDALONE_DOCUMENT_PATHS` in `src/lib/sw-runtime.ts`) groups
    Lesson 4 with the drafts.
  - **Lesson 6's step 2** is one Tab stop: its 27 buttons are a grid that the arrow keys move
    through (`kit/tune-line.ts`, on for that step only), and `src/e2e/learn-lesson-06-qa.spec.ts`
    walks it.
  - **`singAlong`** is in the kit (`kit/sing-along.ts`) for Lessons 4 and 6, and a replay started
    within a note's length is no longer quieted by the play before it.
  - **The frame loop rests.** The ring, the slide guide and the explorer tell it when they have
    nothing to draw (`wants`), any input wakes it, and a ring's last ripples fade out after its
    run. On Lessons 6, 7 and 8 the whole page asks for no frame at rest
    (`src/e2e/learn-frame-loop.spec.ts`).
  - **Lesson 6's chip** read 15 minutes from the text package's 2,258 words, and today's 2,590
    make it 17. On 22 October 2026 the owner kept the longer lessons untrimmed: over the cap of
    2,379 words were Lessons 4 by 138, 5 by 25, 6 by 212, 7 by 101 and 8 by 123, and on
    `pnpm lesson:words` today they are 4 by 132, 5 by 22, 6 by 211, 7 by 98 and 8 by 155. On 23
    October 2026 the owner chose real run times for every chip, Lessons 1, 2 and 4 included: 8, 13
    and 14.
- **Still open:**
  - **The masthead over the sticky stage.** The layout sweeps show it over the stage at `#sing`,
    691 by 59 pixels at 1440x900, on Lessons 3 to 8 alike.
  - **Lessons 1 to 5 never rest page-wide.** Twenty-one drawers there still draw every frame: the
    spiral, the dial, the loudness toy, the hero's sky, the band chart and the lessons' own toys.
    Each needs a `wants` of its own. Left as they were, by the review: the slide guide's and the
    explorer's `wants` read the layout every frame, as their drawing did before, and a canvas
    resized by layout alone draws one frame late.
  - **Lesson 5's hold reads short under load.** On a loaded machine its spec's holds read "In the
    band for 9.8 of the 10 seconds" (and 14.8 of 15), on main too. The frame loop is not the cause:
    the hold takes its seconds from the microphone's frames, and a unit test reads a whole
    15-second hold while the loop rests. Find out whether the reading counts frames or time before
    calling it a flake: on a slow phone, a learner who held for 10 s could be told 9.8.

### 4.3 App fixes the lessons found

The writers found these while checking what each lesson's practice link opens. Neither is a
lesson-page bug, and #1192 fixes both:

- **The Siren exercise's slide score** (30 % of its grade) rewarded jumps between steady stretches,
  so a smooth glide, the thing Lessons 7 and 11 teach, scored nothing on that part. It now scores
  the glide itself, per second: a step counts at up to six times the round's guide pace, and one
  across more than 0.12 s counts nothing, so a take scores much the same at 30, 60 and 120 frames
  a second. The Siren has a new scoring version, so its Best, grade and play count start again
  from the next run, and the high-notes and range challenges, which run it, start new attempt
  threads. The interval trainer's challenge threads split once with them, which is right: they
  have mixed its two scorings since August.
- **Dynamic Swell** promised breath support on its card, though its score rewards a wider swell in
  decibels, and two daily routines promised breath support and a wider range. The card, its help
  and idle screen, and the two routines now promise only what the app measures.

What the new glide part still gets wrong, measured and left as it is:

- **A staircase.** Semitone steps of 50 ms every 300 ms earn the glide part; the old slide part
  paid such steps most of all, so this is no regression. No speed rule can tell such a step from a
  glide, but the stops between steps can. A rule measured on synthetic frames scores those
  staircases 0 and leaves every glide as it was: a stop is 200 ms or more within 0.35 semitone, and
  a burst under 150 ms between two stops, at 8 semitones a second or more, moving their medians 0.6
  semitone or more, is a step whose ground earns nothing. Build it from real recordings, not
  synthetic frames.
- **A register flip** lowers the glide part by the ground it skips, and Lesson 11 says so in one
  neutral sentence. Inside a dropout under 0.12 s a flip can earn that ground, so Lesson 11 says a
  flip "can" lower the score.
- **Wide vibrato**, a semitone either way, on a 3-semitone round scores about 0.31 of the glide
  part (0.31 to 0.42 by frame rate).
- **A 120 Hz phone.** Frames carry the display's frame time, not the audio's
  (`docs/agent/MISTAKES.md`). If a phone's analyser hands over audio in bursts of 20 to 40 ms, a
  quick glide at 120 Hz can score 0 on that part. Check a quick siren on a 120 Hz Android phone;
  if it fails, skip a frame whose pitch equals the one before exactly, in the glide part only.
- **Stored bests and the weekly key.** A Siren challenge's best on the server stays on the old
  scale; completing one is unaffected, since a single attempt must reach the target. The weekly
  attempt key (`src/features/challenges/weekly-attempt.ts`) leaves the scoring version out, so a
  weekly that ran a rescored drill would thread its old and new scores together.

Lessons 7 and 8's builds found no other. Lesson 8's moved two pieces of the app into `src/lib` so
that its page can share them, both unchanged: Drum Night's input latency estimator
(`src/lib/timing/input-latency.ts`) and the Ear Lab's tap rule (`src/lib/ear/tap-rule.ts`).

### 4.4 Films for Lessons 3 to 14

Only Lessons 1 and 2 have films. YOUTUBE.md has titles, thumbnail ideas, opening lines and tags for
the trailer and Lessons 3 to 14. Each film goes through the motion pipeline (PRODUCTION-PIPELINE.md
and the motion-designer skill). Lessons 1 and 2's pages need only their line in `films.ts`; every
other page first needs what theirs have: the Watch section, its masthead link and a `film.ts` for
`kit/episode.ts` to play.

### 4.5 Season 2

- **Mix.** Lesson 11 names no mixed voice (its FACTS 15), so S12 dropped "mix" with Lesson 11's PR,
  both in CURRICULUM § 3.2 and in the season's topic name in `kit/season.ts`. It is a candidate for
  Season 2.
- **Sight-singing** inherits the do-based minor (MASTER-PLAN § 12 item 12).
- The season ends on the trailer's question, answered, and teases nothing (CURIOSITY-MOMENTS § 5
  item 4).

### 4.6 The plan's citations

#1171 read every citation in the packages again on main, with scripts that lived outside the
repository. Since #1192 the tools are in it (`scripts/plan-cites.mjs`, with tests):

- `pnpm plan:cites:check` reads every citation by content: the quoted words must be in the cited
  lines, and those lines inside the section the citation names. On main it reports about 150
  findings, most of them kinds it cannot settle alone: a file outside the repository (the films'
  build files), a name two files share, a bare `:N` with no file before it, or a quote it cannot
  attach. Compare a branch's findings with main's; a branch should add none.
- `pnpm plan:cites reanchor --base <ref>` moves the citations into every file changed since
  `<ref>` by the lines added and removed above them, reports those whose cited lines changed, and
  with `--write` rewrites their digits only. This PR re-anchored its own changes that way.

Three things stay as they are:

- **Lesson 10's reads of the Lesson 6 page branch** stay pinned to `f6333d527`, where they are
  right. Now that #1149 has merged, they can be read again on main.
- **Superseded rows** keep their numbers, as history.
- **Line widths.** Not every file wraps at 100 columns: each FACTS.md keeps a fact to a line,
  YOUTUBE.md keeps its paste-ready text whole, CURIOSITY-MOMENTS.md wraps near 120, the research
  notes and Lesson 2's DECISIONS.md do not wrap, and a few dozen other lines run past 100. Leave
  them. The packages cite many of these files by line, and a rewrap moves every citation below it,
  so re-anchor in the same commit if one must change, and keep prettier's `proseWrap` at its
  default, `preserve`.

## 5. What is ahead: what this run learned

- **The coach is the critical path.** Eleven of the fourteen lessons wait on the coach, all but
  Lessons 1, 2 and 4: eight on a sign-off, three on a look. Naming the coach early decides when the
  season can go live, more than any page build does.
- **The predict's answer leaks.** The most common review finding across the season: a line the
  learner meets before the reveal (the title, the meta description, the promise, the share card, a
  thumbnail, the next lesson's tease) gives the answer away. Every review now checks each of those
  against the predict; keep doing it, for the console's alternatives too.
- **Packages drift with the kit.** A written lesson cites the kit and the app by `file:line`, and
  the kit moves under it while it waits. Lesson 14's three blocking review items were all kit
  changes made after its writer started. Cite at a named commit, re-anchor in the PR that changes
  the code, and compare citations across every rebase.
- **A shift keeps a wrong citation wrong.** Re-anchoring moves a citation by the lines a change adds
  or removes above it, which is right only if it pointed at the right line before. Checked by
  content (the cited lines must hold the words the citation quotes, and sit inside the section it
  names), many citations of the shared plan files were 20 or more lines out on main, every citation
  of CURIOSITY-MOMENTS § 5 in Lessons 9 to 14's FACTS among them, and each rebase had moved them
  faithfully. #1171 then read every citation in the packages by content: 404 got a new number, 18
  follow code that moved to another file, and the facts the plan, the kit or the app had overtaken
  now say what was, with the commit that changed it, and what is. Citations outside the section they
  name fell from 35 to 3, all three false positives. Re-anchor by shift, then check by content.
- **What the checks could not see.** Each of these was found by reading by hand: a quote written
  after its citation, or one that runs across a wrapped comment line; a file name two files share
  (`predict.ts`, `metrics.ts`); a file deleted on main; a bare `:N` whose file is named only in
  prose, which the tools attached to an earlier file, even across table rows; a pattern such as
  `learn/NN.html`, taken for a file; a pin, which the tools saw only on the citation right before
  "at `<sha>`", where the README pins the whole list; and a line that the PR under check rewrote.
  `pnpm plan:cites` (#1192) has a test for each, and reports what it cannot settle instead of
  passing it.
- **First paint grows with the season.** Every lesson page carries the whole season's data, so each
  new lesson's entry and each hook alternative add bytes to every page. The ceilings in
  `scripts/assert-first-paint-budgets.mjs` say why each was raised; keep new kit code in modules of
  its own, loaded by the page that uses it, and keep the team's words in `kit/team-notes.ts`.
- **Health is never the lesson's call.** Lesson 11's first predict asked whether a flip was "a sign
  something's wrong"; a page cannot tell anyone their voice is healthy, so it now asks whether a
  flip is a mistake. Sung lessons keep the comfort check, the rest card and the "see a doctor"
  lines.
- **A writer never signs off its own lesson.** Each package went through four hands: a writer
  working from a brief, a reviewer who had not seen it, the writer again for the fix pass, and the
  lead, who wrote the shared-file entries, put any hook change into code and re-anchored the
  citations on main. Nearly every finding came from the review, not from the writer's own checks,
  and nearly all were of three kinds: a predict's answer leaking, a citation that no longer pointed
  at what it meant, and a claim with no source. Keep the reviewer separate.
- **The review scripts are in the repository now.** The citation printer, the re-anchor and the
  content checks are `pnpm plan:cites` (`scripts/plan-cites.mjs`), and the word counter is
  `pnpm lesson:words` (`scripts/lesson-words.mjs`), whose golden tests hold each package's stated
  count to its copy. Both came with #1192, with tests that `pnpm test:scripts` runs in CI. Each
  lesson's verifier stayed outside, but the rules they applied are in the repository: the house
  rules for claims and safety in [TEACHING-PLAYBOOK.md](TEACHING-PLAYBOOK.md), and the copy rules in
  `kit/lesson-copy.ts`'s header. The tool that wrote re-anchored numbers back once rewrote each
  whole line as it stood before the change, which undid the numbers its other half had just set; a
  test now holds `--write` to the digits.

## 6. Working on the series

- **Where things live.** The plans: this folder. The pages: `learn/NN.html` with
  `src/features/lessons/lesson-NN/`, on the shared kit in `src/features/lessons/kit/`. The season:
  `kit/season.ts`. Hooks and teases: `kit/lesson-copy.ts`, with the team's notes in
  `kit/team-notes.ts`. Drafts: `kit/drafts.ts`. Films: `kit/films.ts`. The publishing gate:
  `src/lesson-gate.ts`. The console: `src/features/admin/AdminLessonsPage.tsx`, with its parts in
  `src/features/admin/lessons/`.
- **A new lesson page** follows SEARCH.md § 12's checklist and its WEB-SPEC. It joins `drafts.ts` in
  its first commit and is published from the console. Its record in the shared files (MASTER-PLAN §
  11, its CURIOSITY-MOMENTS heading) follows once it merges.
- **A changed hook or tease** goes live with the current wording kept as an alternative, with a note
  (CURIOSITY-MOMENTS § 5, the owner's answer of 20 October). A hook that needs a source waits for
  one in FACTS.md.
- **Tests that hold the season together**: `src/tests/lesson-pages.test.ts` (every lesson document's
  head, drafts included), `kit/lesson-copy.test.ts` (the hooks and their copies),
  `kit/team-notes.test.ts` (a note for every alternative, and none of the team's words on a page),
  `kit/drafts.test.ts`, `scripts/lesson-words.test.mjs` (each package's stated word count), the
  first-paint check in `scripts/assert-first-paint-budgets.mjs`, and the `learn-*` end-to-end
  specs. `pnpm check`, then the specs, before every push, and `pnpm plan:cites:check` after a
  change to a package or to code one cites.
