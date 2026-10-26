The 0.9.22 release notes and version, shaped like 0.9.21's release PR (#1093): `CHANGELOG.md`, `dev-changelog.md` and `package.json`, plus the lessons' release day (`datePublished` on Lessons 1 and 2, and the sitemap dates of `/learn/`, `/learn/01` and `/learn/02`). #1135 covered the first 40 PRs; this covers all 112. Not merged and not tagged here: Release Tours on `main`, the merge and the `v0.9.22` tag come after review.

## What ships

650 commits since `v0.9.21` (bd524160a), from 112 PRs, on 562 first-parent entries, up to 238ef7115. 23 PRs came in as merge commits, 77 were rebased and 12 squashed. Every commit came through a PR.

**On the web**

- **Find Your Pitch goes live with two lessons:** Lesson 1 "What is a note?" and Lesson 2 "Twelve notes" at `/learn/01` and `/learn/02` (#1048, #1111), each with its film from `media.mercurypitch.com` (#1197), and the season's hub at `/learn/` (#1188).
  - Every lesson page: the lesson menu (#1140, #1142), one next-lesson card (#1143), a first-visit tour (#1201), Merc and Tavi by name (#1191, #1195), plain words (#1138), the release review's accessibility fixes (#1177), the follow-ups and real run times (#1192), search-led titles (#1187), Merc's shader compile off the page's path (#1200), and a trail back to the hub with links to the lessons either side (#1216).
  - Each quick-check question's first answer in a visit goes to the DB worker anonymously, under the app's consent rule (#1193).
- **Lessons publish at run time** (#1150), from the state the admin console keeps (#1147, #1151). Lessons 3 to 8 ship as drafts: held back on mercurypitch.com, shown on dev, previews and local (#1111, #1129, #1127 then #1156, #1149, #1169, #1172).
  - **Production as built, before anyone touches the console:** `/learn/01` and `/learn/02` live; `/learn/03` to `/learn/08` answer the 404 page (404, `noindex`, not stored); `/learn/` links Lessons 1 and 2 and shows the rest as "Coming"; the sitemap and `llms.txt` list `/learn/`, `/learn/01` and `/learn/02`.
- **Onboarding:** First Light's four questions and the plan they make (#1190), Home's tour on the plan card (#1194), the plan's typed lines and the email chip on a phone (#1209), keys kept in surveys and confirms (#1210), the tour and first-value counts (#1134), the `#/map` router race (#1196), and the plan's polish (#1217): Start here as the main button, an unclean range read no longer taken for a narrow one, Home's Lessons link and a Lessons door on the Map to the visitor's lesson, and a tablet's width.
- **Practice and karaoke:** the Guided Warmup without a grade (#1124), the range test's comfortable top (#1125), the hold cards (#1126), Bass-baritone (#1128), First Light's held note (#1110), the Siren's glide score (#1192), the Zen stage and tour focus (#1165), low tier overlays (#1158), the streamed vocal's pitch guide and the lyrics pick (#1189), and UVR's cancel and saves (#1178, #1184).
- **Search:** #1105, #1106, #1107, #1109, #1122, #1116, the 404 scene (#1118), and the lesson pages' and room pages' links to the lessons in their served HTML (#1216).

**Not on the web**, in `dev-changelog.md` and left out of `CHANGELOG.md`:

- native only: the onboarding (#1098, #1101, #1103, #1112, #1120, #1123), the Warm-up (#1096, #1099, #1100, #1102, #1104, #1113, #1130), #1091, #1097, the TV work (#1157, #1175, #1179, #1182) and #1189's native fixes;
- Glass, Beside Cue's game, compiled on the web only into the unlisted `/glass-game` (#1087, #1090, #1092, #1167, #1180, #1183);
- admin only: the console's Lessons page and publishing (#1144, #1147, #1151) and its tests (#1211);
- refactors (#1094, #1095), dev tooling and CI (#1166, #1176), tests (#1114) and docs (#1108, #1115, #1132, #1141, #1146, #1154, #1161, #1162, #1163, #1164, #1171, #1173, #1181, #1185).

Reach comes from the code: build flags (`src/lib/native-build.ts`), `apps/`, routes, the lesson gate and static import tracing. No production build was made for these notes.

## CHANGELOG.md

`node scripts/changelog-stats.mjs 0.9.22`: 33 bullets, average 161 characters, longest 313 (Smaller things). The model, 0.8.0, has 61 bullets at about 142. No line is over 78 columns, and there is no em dash.

Left out of it, and kept in `dev-changelog.md`:

- the native-only, admin-only and Glass PRs;
- search markup, sitemap dates and IndexNow, which show nothing on screen;
- the draft lessons, which production holds back;
- the onboarding counts (#1134) and UVR's error paths (#1178, #1184), which change nothing a user sees.

Two lines wait on the owner: the Siren bullet (its Best, grade and play count restart) and the feedback form's "No account needed." (#1210).

## Gates

- **Migration:** one, `0071_lesson_state.sql` (#1147). Additive: `lesson_state`, `lesson_state_log` and one index, no rows seeded. The tag's `deploy-db-prod` job backs up the prod database and runs `wrangler d1 migrations apply mercurypitch-db --remote --env prod` before it deploys the worker. Dev has had it since Deploy DB Worker run 39440215676.
- **Secrets, variables and bindings:** no new secret.
  - `wrangler.jsonc`: `run_worker_first` gains `/learn/*`, `/sitemap.xml` and `/llms.txt`; new variable `LESSON_DRAFTS` ("0" in `env.prod`).
  - `workers/db-worker/wrangler.jsonc` and its PR-preview template: rate-limit binding `LESSON_EVENT_LIMIT` (300 per 60 s; prod namespace 4103).
  - The `env.*` names read in `workers/`, `src/worker.ts` and the gate go from 70 to 73: `LESSON_DRAFTS`, `LESSON_EVENT_LIMIT` and the existing KV binding `SHARE_STORE`.
  - `.env.development` (+10) and `.env.production` (+11) changed (#1111, #1150). For the reviewer to read; their contents are not quoted here.
- **Worker code:**
  - Site worker: the lesson gate (#1150, extended to the hub by #1188) and #1178's UVR cancel.
  - DB worker: the lesson-state routes (#1147), `lesson_answer` with its rate limit and no address kept (#1193), and the funnel catalog's new names (#1134, #1190, #1193). Dev has run it since Deploy DB Worker run 40059234793, green; nothing in its graph changed since.
  - Jam worker: no change.
  - The site and DB worker deploy in parallel. If the site lands first, the gate serves the site as built and the old worker answers the new event names with a 400 for a few minutes.
- **Step 0c, links into about.mercurypitch.com:** the lesson pages' and the hub's footers link `/privacy/`, `/terms/` and `/imprint/`, the paths the app already links. No new path, no query parameter. The owner says the landing carries the new privacy notice; it should cover #1190's survey answers and #1193's lesson answers (with Cloudflare's 7-day logs and D1's 30-day recovery). The landing repository was not readable from here.
- **Social cards:** `pnpm run og:versions` on this PR: 13 cards stamped, no change.
- **What's New:** untouched, as this is a patch.
- **Version files:** only `package.json`'s version, as in 0.9.21. The native apps version from their own tags.
- **The lessons' release day** (`SEARCH.md` § 3.2 and § 12 step 6): `datePublished` on `learn/01.html` and `learn/02.html` (after line 90 of each), and `<lastmod>` on lines 97, 101 and 105 of `public/sitemap.xml`, all set to the tag day. No lesson page or the hub carries a `VideoObject`.

## Checks

- [x] `pnpm pr:prepare`: `docs/agent/INDEX.md` already current, the 6 changed files already formatted, no whitespace errors; nothing changed
- [x] `pnpm run docs:index:check` and `pnpm pr:validate`: both pass
- [x] `git diff --check`: clean
- [x] Vitest of the tests that read `CHANGELOG.md`, the version or the lesson markup (`ChangelogModal`, `SettingsNativeBilling`, `use-whats-new`, `SupportBadge`, `og-image-cache-busting`, `lesson-pages`): 6 files, 120 passed
- [x] `pnpm check`: 0 errors, 11 warnings (as on `main`), nothing rewritten
- [x] `node scripts/changelog-stats.mjs 0.9.22`: 33 bullets, average 161 characters, longest 313
- [ ] The films: the owner's dev pass played both. Dev loads the same `media.mercurypitch.com` files as production (`kit/films.ts`), so nothing is requested from production: waits on the owner's dev pass. Locally, a production-like build of this tree played both episodes from a stub file; nothing was requested from `media.mercurypitch.com`
- [x] CI on 6347932ca: 85 of 86 checks pass, PR Gate among them (unit 2/2, browser 4/4, lint and typecheck, code health, workers, validate, Build & Deploy, iOS, Android, Beside Cue); the 86th, the prod deploy job, is skipped, as on every PR
- [x] A browser walk of a production-like build of this tree (drafts held back, no API), with sound: 78 checks, 0 failures. First Light with a steady tone and with a sung sweep, the plan's buttons and lesson covers at six widths, Keep, the Map's Lessons door and section, Home's Lessons link for four done-lists, Lessons 1 and 2 (tour, trail, tones, both films with captions, the question mark at nine sizes), the hub, and the served pages' links

## Before the tag

1. **The owner's two wording calls:** the Siren bullet, and the feedback form's "No account needed." (the form also writes "Mercury Pitch" as two words).
2. **The films play on dev** in the owner's test pass: the same `media.mercurypitch.com` files production loads.
3. **The privacy notice** on about.mercurypitch.com covers #1190's and #1193's data (the owner says it does), and the owner checks #1217's one new funnel name, `onboarding_map_door_lessons`, sent like the other Map doors'.
4. **Release Tours on `main`** (prod-upd step 4). The baseline is 0 misses.
5. **The release day's dates** match the tag day: if the tag slips a day, move the five dates first.
6. **Anything merged after 238ef7115** gets its bullet and its paragraph first.

## After the tag

- The owner checks production as built: `/learn/01` and `/learn/02` play their films, `/learn/03` answers 404, `/learn/` links two lessons, and `/admin/lessons` loads for an admin.
- The first Notify IndexNow run sends every listed URL, as the key file is new since `v0.9.21`. If it warns, send them by hand from a checkout of `v0.9.22`: `pnpm indexnow --since v0.9.21`.
- Request indexing for `/learn/`, `/learn/01` and `/learn/02` in Search Console, and publish the episodes on YouTube with the lesson's link first.

## Found while preparing this release

All of these are in `dev-changelog.md`; none blocks the tag on its own.

- **The lesson pages' head comment invited a VideoObject** ("no VideoObject until the episode plays here", `learn/01.html` and `learn/02.html` lines 61 to 68). The films play now, and `SEARCH.md` § 3.2 says no `VideoObject` on a lesson page, so this PR rewrites the comment as `datePublished` goes in.
- **The tag deploys the site and the DB worker in parallel:** a few minutes of 400s for the new event names if the site wins.
- **#1210 merged with its body asking for a dev test first.** Its four checks are in the release test.
- **First-paint budgets on a production build** (#1144's note): `mirror.html` and `vocal-range-test.html` went over on a production `dist`; the check runs on `build:e2e` only.
- **The lesson share cards are outside `og:versions`**, still.
- **Home's Lessons link opened `/learn/01` for everyone** (#1177's W-01): #1217 makes it the visitor's current lesson.
- **#1200's freeze fix is unverified on Windows.** The CHANGELOG says only what the code does.
- **#1134's funnel loads on Guitar Night's first paint**, which its PR asks the consent review to cover.
- **"To your highest" without "comfortable"** is still the voice type test's description.
