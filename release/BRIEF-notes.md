You are drafting the release notes for MercuryPitch 0.9.22, so that the release PR can be cut within minutes when the owner says "tag it". You write drafts in the scratchpad only. The lead reviews them, then cuts the PR. You never commit, push, open or comment on PRs, or publish artifacts.

## Where
- Repo: /home/user/mercurypitch. Work read-only through git plumbing against `origin/main`: `git -C /home/user/mercurypitch show origin/main:<path>`, `git -C ... grep <pattern> origin/main -- <paths>`, `git -C ... log`, `git -C ... diff`. Do not check out, switch branches, create worktrees or write anywhere in the repo or its worktrees. Never `cd` in a shell command; use `git -C` or a `( cd <dir> && ... )` subshell for a script that needs a working directory.
- S=/tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad. Your output goes in $S/release/notes/ (create it). Keep logs small.
- Disk: about 840 MB is free for every agent together, and another builder may need it. So no build, no `pnpm install`, no worktree. Where an earlier release checked reach with a production web build, check it in the code instead, and say so.
- GitHub: read PR bodies, commits and files with the GitHub MCP tools (load them with ToolSearch: `mcp__github__pull_request_read`, `mcp__github__search_pull_requests`, `mcp__github__list_commits`). Read only. Repo `mercurypitch/mercurypitch`.

## The range
- From `v0.9.21` (bd524160a, 18 Oct) to `origin/main` (cddefd571 at the time of writing, after #1210). Run `git fetch origin main` first and use whatever main is then; name the head you used.
- More PRs may merge before the tag. Write the notes so a late PR adds a bullet and a paragraph without reshuffling the rest.

## Start from #1135
- PR #1135 ("chore(release): 0.9.22", another agent's branch `feat/release-0.9.22`, b4fe5a4a8 on 2ad8e8576 of 20 Oct) covers the first 171 commits, from 40 PRs. Read its body and `git -C ... diff 2ad8e8576 b4fe5a4a8` (CHANGELOG.md, dev-changelog.md). Reuse its text for those PRs wherever it is still true. Do not push to it or comment on it.
- Since then, 466 more commits and about 70 more PRs merged, and some of #1135's statements stopped being true. Known examples (verify each):
  - Lesson 4 went back to being a draft (#1156). Only Lessons 1 and 2 are published on mercurypitch.com. Lessons 3 to 8 ship as drafts: hidden on mercurypitch.com, shown on dev, previews and local. `src/lesson-gate.ts` (LESSON_DRAFTS, run-time publishing from the admin console's state, cached about 30 s, falling back to KV and then to the site as built) decides. Find out from the code exactly what production shows before anyone touches the admin console, and say it in the notes.
  - Lessons 1 and 2 now play their films, from media.mercurypitch.com (#1197); #1136 made Watch show only a film that can play. #1135 said no film plays.
  - There is now one migration: `workers/db-worker/migrations/0071_lesson_state.sql`. #1135 said none.
  - #1135's dates (2026-10-20) and "three lessons" no longer hold.

## What to produce, in $S/release/notes/
1. `CHANGELOG-entry.md`: the exact text to insert above `## [0.9.21]` in CHANGELOG.md, with the date written as `2026-10-DD` for the lead to fill in.
   - Read first: `.claude/skills/prod-upd/SKILL.md` (the steps, and its "Writing the release notes" section, in full), CHANGELOG.md's header, and its 0.9.21 and 0.9.20 entries as models, then #1135's entry.
   - What a user of the web app gets, in plain words: a two-sentence summary, then Added, Changed and Fixed, each bullet with a bold lead sentence. No PR numbers, file names or rationale. No em dash. No line over 78 columns.
   - Native-only, admin-only, search markup, CI, tests and docs stay out of it (they go in the dev changelog), as #1135 did.
   - Measure it: run `node scripts/changelog-stats.mjs 0.9.22` against a temporary copy of CHANGELOG.md with your entry inserted (find out how the script picks its file; copy the script and the file into a temp folder under $S/release/notes/tmp/ if it needs a working directory). Aim for an average near 150 characters a bullet; the skill says much over 180 is engineering detail.
2. `dev-changelog-entry.md`: the exact text to insert above `## [0.9.21]` in dev-changelog.md.
   - The header counts, as 0.9.21's entry has them: commits since `v0.9.21` before the release PR, from how many PRs, on how many first-parent entries; which PRs came in as merge commits and which were rebased; whether every commit came through a PR (list any that did not).
   - The web part, then the native part, then the rest (admin, search, CI, tests, docs), one short paragraph per PR, grouped by area. Reuse #1135's paragraphs for its PRs, corrected. The owner's rule is "keep it simple": say what changed, where it reaches and the evidence, and stop.
   - "Release steps (prod)", as 0.9.21 and #1135 have them, each one checked on the range:
     - migrations (0071: what it creates; the tag's `deploy-db-prod` job runs it: check `.github/workflows/build.yml`);
     - secrets, variables and bindings: `wrangler*` files changed or not, and the `env.*` names read in `workers/` and `src/worker.ts` at both ends of the range. Never open, print or grep inside any `.env*` file: if `git diff --stat v0.9.21 origin/main -- '.env*' '**/.env*'` lists one, give only its name and line counts and flag it for the lead;
     - worker code: what changes in the DB worker, the Jam worker and `src/worker.ts` (the lesson gate), and what `deploy-db-prod` ships;
     - links into about.mercurypitch.com (the skill's step 0c): every link from the app into the landing that is new or changed in the range, with its path. The owner says the landing is already updated with the new privacy notice; list what the app links to, and the landing tags you can see (`git -C ... tag -l 'mp-v*'`), for the lead to check;
     - social cards: `pnpm run og:versions` runs at release time (the lead runs it; just say so);
     - What's New untouched (a patch);
     - version files: which files carry the version (package.json; check whether anything else, such as the native apps, is bumped at a release);
     - the lessons' release day: list every exact file and line that must carry the tag day for /learn/01, /learn/02 and the /learn/ hub, `datePublished` and the sitemap's `lastmod` (docs/plans/find-your-pitch/SEARCH.md § 3.2 and § 12 step 6), and confirm the lesson pages carry no VideoObject.
3. `PR-BODY.md`: the release PR's body in #1135's shape (What ships, CHANGELOG.md, Gates, Checks, Before the tag, After the tag, Found while preparing this release), filled in from your findings, with the checks the lead will run left as a list to fill. No attribution footer, no emojis.
4. `REACH.md`: one row per PR in the range: number, title, merged how (rebase or merge commit) and commit count, reach (web, native only, admin only, dev tooling, docs), the evidence (a path, a build flag such as `IS_NATIVE_BUILD`, `PREMIUM_EXERCISES` or `KARAOKE_IMPORT` in `src/lib/native-build.ts`, `apps/`, a route), and the CHANGELOG bullet it feeds or why none.
5. `REPORT.md`: what you did, what you could not verify, and the questions for the owner.

## Things the lead already knows (use them, and check them)
- The owner has two open calls that touch wording. Write the recommended wording into the draft, and put the alternatives in REPORT.md:
  - the feedback form now says "No account needed" instead of "Anonymous" (#1210), because feedback is stored under the visitor's id, which is a signed-in person's account;
  - the Siren's Best, its grade and play count start again from the next run (the glide score change in #1192). Recommended: say so in one bullet; flag it as waiting for the owner's OK.
- #1193 sends each lesson question's first answer in a visit, anonymously. Decide with evidence whether it belongs in CHANGELOG.md (a user may care what is sent), and word it from what the code actually sends.
- Web features since #1135 that the lead expects in CHANGELOG.md (verify each, and find any the lead missed): the /learn/ hub (#1188); the lesson menu and the season in the masthead (#1140, #1142); one next-lesson card on every Wrap (#1143); the hosts named Merc and Tavi, and captions that name them (#1191, #1195); a welcome tour on a first visit to a lesson page, with a "?" to replay it (#1201); plainer lesson words (#1138); the films (#1197); First Light's four questions and the plan they make (#1190), Home's tour opening on the plan card (#1194), the plan's typed lines above a phone's keyboard and the email chip's dismiss (#1209), Space and M staying in surveys and confirms (#1210); Merc's shader compile no longer freezing Chrome on Windows (#1200); the address bar fix (#1196). The admin console's Lessons page and publishing (#1144, #1147, #1150, #1151) are admin-only.
- The other agent's PRs need the most reach work: Glass (#1087, #1090, #1092, #1167, #1180, #1183), TV and AirPlay (#1157, #1175, #1179, #1181, #1182, #1185), UVR (#1178, #1184), karaoke (#1189), onboarding analytics (#1134), "Low tier overlays stay transparent" (#1158), "Accessibility audit" (#1165), app-check (#1166), CI (#1176), tests (#1211).

## Rules
- No emojis. No model identifiers. No Claude attribution anywhere.
- The notes may cite PR numbers (dev changelog and PR body only). They never cite scratchpad files or internal plan task IDs (such as T7, L12-P5 or G5).
- Every claim comes from the code, a commit or a PR body. Where you could not verify one, say so in REPORT.md instead of guessing.
- Do not open `.env*` files or edit `.claude/settings.json`.

## Hand back (your final message is your report to the lead)
- The head of main you used, and the counts.
- The five files, with one line on each.
- The CHANGELOG stats (bullets, average, longest).
- The owner's questions, and anything found that should be fixed before the tag.
