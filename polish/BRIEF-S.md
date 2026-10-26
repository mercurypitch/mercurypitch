You are a builder on the MercuryPitch repo. This run fixes how the Find Your Pitch lesson pages link to each other, to their hub and from the rooms, so search engines and answer engines that do not run scripts can follow them, and moves the lesson tour's "?" off the page content. It is for the 0.9.22 release. The lead reviews your work and opens the PR. You never push, open PRs, merge, rebase or use git stash.

## Where
- Worktree: /home/user/mercurypitch/.claude/worktrees/kit-mic, branch `feat/lesson-links-search`, at origin/main cddefd571. Check `git log --oneline -3` and `git status` first. Work only there.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Logs, notes and screenshots go under $S/polish/S/ (create it). Keep logs small.
- Another builder works at the same time in /home/user/mercurypitch/.claude/worktrees/e2e-wav on onboarding, the plan screen, the Map and Home (it may move the `fyp-done` key's parse into src/lib). Stay out of those; the only shared file is docs/agent/INDEX.md, which you regenerate last.

## Read first
- $S/polish/BUILDER-RULES.md: git, the heavy and light lanes, builds, disk, browser tests, the report. It applies in full.
- CLAUDE.md, AGENTS.md, docs/agent/CONVENTIONS.md, docs/agent/TESTING.md, docs/agent/MISTAKES.md (the lesson pages' stylesheet order and first paint in particular).
- docs/plans/find-your-pitch/SEARCH.md: § 3.3 (links out of a lesson: the home page, the hub, previous and next lesson, the room that practises it), § 3.4, § 5 (the hub) and § 8 (links between the lessons and the rooms).
- How a lesson's state reaches its links: src/lesson-gate.ts (its header: on lesson pages and the hub, every link to a lesson that is not live loses its link, and of each `data-if-live` / `data-if-planned` reading the true one stays), src/features/lessons/kit/page-state.ts and publish.ts (the same rule for a page no worker served), tools/draft-lessons.ts (the readings' allowed shapes), tools/learn-hub.ts and tools/lesson-links.ts (build-time links), src/features/lessons/kit/drafts.ts (Lessons 3 to 8 are drafts: held back on mercurypitch.com, shown on dev, previews and local).
- The walk's screenshot of Lesson 1's top at 390 px with the tour open: $S/onb/shots2/05-learn01-first.png (the "?" disc sits on the "Sound" chip), and its log $S/onb/shots2/walk2.log (the links a rendered Lesson 1 has: /mirror?lesson=01, /learn/02 from the next card, /#/plan, /, legal).

## Scope, in this order, one commit each

1. **A breadcrumb back to the hub on every lesson page** (feat(lessons)).
   - Today: no lesson page links /learn/. Each page's BreadcrumbList (structured data) names MercuryPitch, Find Your Pitch and the lesson, but nothing on the page links the hub.
   - Want: a visible breadcrumb in the served HTML of every lesson page (learn/01.html to learn/08.html, and any later lesson by the same means), linking /learn/ as "Find Your Pitch", with the same names in the same order as its BreadcrumbList. It is a `nav` with an accessible name, the lesson marked as the current page. Decide whether the trail shows MercuryPitch as a link to / (the masthead may already link home), and say why.
   - One source for all pages: either the build writes it (as tools/learn-hub.ts and tools/lesson-links.ts write theirs), or each document carries it and a test holds them to one shape. Say which and why. Place it where a reader meets it near the top without pushing the hero down on a phone, and check the masthead's own layout at 320 px.

2. **Previous and next lesson in the served HTML** (feat(lessons)).
   - Today: Lesson 1 links Lesson 2 only after its script builds the next card on the Wrap (kit/next-card.ts). A crawler that does not run scripts (Bing in part, GPTBot, ClaudeBot, Perplexity) never finds the next lesson.
   - Want: in the served HTML of every lesson page, a link to the next lesson, and from Lesson 2 on, to the previous one, so that the site worker and the page's own reading treat them as the lesson's other links:
     - On mercurypitch.com today (drafts held back): Lesson 1's link to Lesson 2 stays; Lesson 2's link to Lesson 3 loses its link, or its planned reading shows instead. On dev, previews and local (drafts shown): both stay. Prove both in src/lesson-gate.test.ts on a rewritten page, and the page-side rule (page-state.ts) in its own test.
     - A reader never meets the same next lesson twice: either the Wrap's next card builds on this markup, or these links sit where the card is not (for example the page's foot). Describe the choice.
   - Words: the lesson's number and its headline as the hub and the navs already write them. Any frame around them ("Next lesson" and the like) must already exist in the kit (next-card.ts); quote what you used.

3. **The room pages link the lessons that practise them** (feat(seo)).
   - Today: SEARCH.md § 8 marks this **[next]**: a room's entry document should link back to each lesson that practises it once that lesson is out. Every entry document's nav already links every released lesson (navLinksFor, tools/lesson-links.ts); the room-specific link in the page's text does not exist.
   - Want: a field on the entry model (src/seo/entry-pages.ts) holding § 8's table, rendered by src/seo/render-entry-page.ts in the document's text (not only the nav), for released lessons only (drafts are never linked, as tools/lesson-links.ts's header says). With Lessons 1 and 2 released: /mirror and /vocal-range-test link Lesson 1, /ear-lab links Lesson 2; every other row renders nothing until its lesson is released, so each future release links itself. Change § 8's mark to say what shipped.
   - Link words: the lesson's headline with its number, as the navs write them ("What is a note? (Lesson 1)"). If a few words are needed around the link, keep them plain and quote them in your report.
   - Check the entry documents with scripts off (the prelude a crawler reads) and on (the app hides the prelude once it boots).

4. **The tour's "?" no longer covers the page under the masthead** (fix(lessons)).
   - Today (src/features/lessons/kit/lesson-menu.css, `.lm-tour` at max-width 1180px): the "?" hangs under the masthead's right end, position absolute, over whatever is there: the hero's "Sound" chip on Lesson 1 at 390 px, and the kicker at other widths. From 1181 px it sits in the masthead's row, which is fine.
   - Want: at every width from 320 to 1180 px (check 320x568, 360x740, 390x844, 768x1024, 820x1180, 1024x768, 1180x820 and a landscape phone, 844x390), the "?" covers no text and no control on Lessons 1 to 8, keeps a 44 px target, stays easy to find, and is still what the tour's last step lights (kit/tour.ts, tour-copy.ts). Your call how: room in the masthead's row, a place in the lesson menu, or room kept clear under it. Say why.

5. **The module map**, regenerated, as your last commit, if a module was added.

## Rules
- BUILDER-RULES.md applies in full.
- Never write new learner copy. Every word on a lesson page comes from the page itself, the kit, LESSON.md or the season data; quote anything you had to add.
- Lesson pages: their stylesheets load in a set order (MISTAKES.md); keep each page's stylesheet links as they are unless your change needs one, and then say so.
- Each lesson page's first paint is budgeted (scripts/assert-first-paint-budgets.mjs). Raise a budget only as BUILDER-RULES.md says.
- No function above cognitive complexity 15: check your files with `node_modules/.bin/eslint -c eslint.audit.config.js --rule '{"sonarjs/cognitive-complexity": ["warn", 15]}' <files>`.
- Keep each commit to its own item.
- Do not touch feat/seo-* branches or anything outside your worktree.

## Gates before you hand back
- `pnpm check`: no errors and no warnings beyond main's 11; fold its rewrites into the right commits.
- Unit: your test files, then `pnpm exec vitest run src/features/lessons src/tests src/seo src/lesson-gate.test.ts tools` through heavy. A failure outside your files: run that file alone on your branch and on origin/main, and report both.
- `pnpm test:scripts` (it holds the lessons' word counts: a breadcrumb or a link may change them; say how it counts), `pnpm pr:validate`, `pnpm metrics:check`, `pnpm docs:index:check`, `node scripts/plan-cites.mjs check` (no more than before your first change; re-anchor if your changes move cited lines).
- `pnpm build:e2e` (stops at the Glassworks step), then `node scripts/assert-first-paint-budgets.mjs dist` and `node scripts/assert-draft-lessons.mjs dist --shown`. First paint before and after for Lessons 1 to 8 and the hub, exact bytes: `node $S/bin/fp-bytes.mjs <worktree>` if it fits, or the assert's own numbers.
- Browser specs, `--retries=0`: every `src/e2e/learn-*.spec.ts`, and the entry-document specs (grep src/e2e for `vocal-range-test`, `ear-lab`, `entry-prelude`).
- Tours: the lesson tour end to end (learn-lesson-tour.spec.ts) at 390 and 1440 px, and the tour-check skill if it covers lesson pages.
- Screenshots under $S/polish/S/: Lesson 1's and Lesson 2's top (breadcrumb, "?") at item 4's sizes; their previous and next links at 390x844 and 1440x900; /mirror, /vocal-range-test and /ear-lab with scripts off, showing the lesson link.
- Mutations, each with the test that catches it: a lesson page without the breadcrumb, or with one that disagrees with its BreadcrumbList; a next link to a held-back draft left linked on production state; the next lesson shown twice on the Wrap; a room linking a draft; the "?" back over the chip (say how a test or a measured check catches it).

## Hand back (your final message is your report to the lead)
- Commits in order (sha, subject) and files per commit.
- Every test and gate with its result and log path.
- First paint before and after for Lessons 1 to 8 and the hub, and any budget you changed, with its reason.
- Screenshot paths.
- The mutation list.
- Any words you added, quoted.
- What you could not do or did not verify, and open questions.
