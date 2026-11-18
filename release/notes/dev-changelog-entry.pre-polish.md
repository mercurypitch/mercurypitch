## [0.9.22] - 2026-10-DD

637 commits since `v0.9.21` (bd524160a) before this release PR, from 110 PRs,
on 549 first-parent entries, up to cddefd571. 23 PRs came in as merge commits:
#1094 (1 commit), #1091 (1), #1095 (3), #1096 (1), #1097 (1), #1099 (1), #1098
(3), #1100 (2), #1101 (3), #1102 (3), #1103 (7), #1104 (1), #1110 (2), #1112
(4), #1113 (3), #1120 (12), #1123 (6), #1128 (1), #1130 (1), #1134 (8), #1166
(2), #1190 (21) and #1194 (1). 75 were rebased onto `main`: #1192 (72), #1048
(62), #1149 (34), #1177 (30), #1193 (21), #1188 (15), #1154 and #1186 (14
each), #1210 (12), #1151 (11), #1172 (10), #1111, #1170 and #1171 (9 each),
#1087, #1138, #1163, #1164, #1169 and #1201 (8 each), #1187 (7), #1148, #1161,
#1167, #1189 and #1200 (6 each), #1150, #1157, #1162, #1165, #1191 and #1195
(5 each), #1116, #1158, #1168, #1185 and #1211 (4 each), #1141, #1159, #1173,
#1196 and #1209 (3 each), #1108, #1109, #1129, #1137, #1143, #1144, #1147,
#1156 and #1160 (2 each), and #1105, #1107, #1114, #1115, #1118, #1119, #1122,
#1124, #1125, #1126, #1127, #1131, #1132, #1133, #1136, #1139, #1140, #1142,
#1145, #1146, #1152, #1153, #1155 and #1197 (1 each). 12 were squashed into
one commit each: #1106 (af0f45eea), #1090 (024c8d828), #1092 (3f1f2f548),
#1178 (f7c542aef), #1176 (f86e4ba7b), #1180 (38d94996d), #1184 (dfa820854),
#1183 (e42381ffe), #1182 (9df503587), #1179 (f604b1a99), #1181 (0991d274c) and
#1175 (921e3bbf1). Every commit came through a PR: each first-parent entry's
committer time matches one PR's merge time.

On the web, the release is:

- **Find Your Pitch on mercurypitch.com.** Lesson 1, "What is a note?", and
  Lesson 2, "Twelve notes", at `/learn/01` and `/learn/02`, each with its film
  from `media.mercurypitch.com` (#1197), and the season's hub at `/learn/`
  (#1188). Every lesson page has the masthead's lesson menu (#1140), one
  next-lesson card on its Wrap (#1143), a welcome tour on a first visit
  (#1201), hosts named Merc and Tavi (#1191, #1195), plainer words (#1138),
  the release review's accessibility fixes (#1177) and anonymous first answers
  from its quick check (#1193).
- **Publishing at run time.** Every build carries Lessons 1 to 8, and the site
  worker decides per request which are live (#1150), from the state the admin
  console keeps on the DB worker (#1147, #1151, migration 0071). Lessons 3 to
  8 are drafts (`kit/drafts.ts`): held back on mercurypitch.com
  (`LESSON_DRAFTS` "0" in `wrangler.jsonc`'s `env.prod`), shown on the dev
  site, previews and local.
- **Onboarding and the plan.** First Light's four questions and the plan they
  make (#1190), Home's tour on the plan card (#1194), the plan's typed lines
  above a phone's keyboard and the email chip's dismiss (#1209), Space and M
  kept in surveys and confirms and the plan review's follow-ups (#1210), the
  tour, first-value and Map counts (#1134) and the router race (#1196).
- **Practice and karaoke.** The Guided Warmup without a grade (#1124), the
  range test's top cushioned (#1125), the hold cards (#1126), Bass-baritone
  (#1128), First Light's held note (#1110), the Siren's glide score and
  Dynamic Swell's copy (#1192), the Zen stage and tour focus (#1165), low tier
  overlays (#1158), the streamed vocal's pitch guide and the lyrics pick
  (#1189), and UVR's cancel and saves (#1178, #1184).
- **Search.** The studio's markup (#1105), `/karaoke-app` (#1106), the
  store-listing signals (#1107), lesson links and markup (#1109), sitemap
  dates (#1122), Bing's findings and IndexNow (#1116), the 404 scene (#1118)
  and search-led lesson titles (#1187).

Reach was read from the code, not from a production build: no build was made
for these notes. Production as built, before anyone touches the admin console:
`/learn/01` and `/learn/02` are live with their films; `/learn/03` to
`/learn/08` answer the 404 page (status 404, `X-Robots-Tag: noindex`, not
stored); `/learn/` lists every Season 1 lesson, with Lessons 1 and 2 linked
and the rest "Coming"; `/sitemap.xml` and `/llms.txt` list `/learn/`,
`/learn/01` and `/learn/02`; Lessons 9 to 14 have no page in any environment.
The evidence: `src/lesson-gate.ts` (`isPublished` is the console's override,
else live unless the lesson is in `DRAFT_LESSONS` and the environment hides
drafts), `kit/drafts.ts` (3, 4, 5, 6, 7 and 8), `wrangler.jsonc`
(`LESSON_DRAFTS` "0" for prod), and migration 0071, which seeds no rows. The
state is cached 30 s per data centre, read with a 1.5 s timeout, kept
last-good in KV (`SHARE_STORE`), and with neither the site serves as built.

The rest is the native app: its own onboarding (#1098, #1101, #1103, #1110,
#1112, #1120, #1123), the Warm-up (#1096, #1099, #1100, #1102, #1104, #1113,
#1130), the iOS volume read (#1091), "One volume in rooms" off by default
(#1097), the TV work (#1157, #1175, #1179, #1182, and #1189's wizard and
Subscribe fixes), and two refactors (#1094, #1095). Glass (#1087, #1090,
#1092, #1167, #1180, #1183) is Beside Cue's game; the web compiles it only
into the unlisted `/glass-game`. The admin console's Lessons page (#1144,
#1151, #1211) is admin only.

### Release steps (prod)

1. **One migration, `0071_lesson_state.sql`** (#1147, ed6d134b3), the only new
   file under `workers/db-worker/migrations` since `v0.9.21`. It is additive.
   It creates `lesson_state`, one row per lesson (0 to 99): `published` (1, 0,
   or NULL for the code's default), `hook` and `tease` (a variant id, or
   NULL), `updated_at` and `updated_by`. It creates `lesson_state_log`, one
   row per changed field (old and new value, when, by whom), and the index
   `idx_lesson_state_log_lesson`. It seeds no rows, so production starts on
   every lesson's default. The tag's `deploy-db-prod` job ("Prod Jam + DB
   migrations + worker" in `build.yml`, through `deploy-db.yml` with
   environment `prod`) checks the seller details, backs up the prod database,
   reconciles the schema, runs
   `wrangler d1 migrations apply mercurypitch-db --remote --env prod`, then
   deploys the worker. Dev has had it since Deploy DB Worker run 39440215676
   (#1147), green.
2. **New bindings and a variable, no new secret.** Three `wrangler*` files
   changed. `wrangler.jsonc` (#1150): `run_worker_first` gains `/learn/*`,
   `/sitemap.xml` and `/llms.txt`, and a variable `LESSON_DRAFTS`, "0" under
   `env.prod` and "1" at the top level and under `env.dev` and `env.preview`.
   `workers/db-worker/wrangler.jsonc` (#1193): a Cloudflare rate-limit
   binding, `LESSON_EVENT_LIMIT`, 300 per address per 60 s, with a
   `namespace_id` per environment (4101 local, 4102 dev, 4103 prod); a worker
   without it refuses every lesson answer.
   `workers/db-worker/wrangler.pr-preview.template.jsonc` (#1193): the same
   binding, namespace 4104. The `env.*` names read in `workers/`,
   `src/worker.ts` and the gate it calls go from 70 to 73: `LESSON_DRAFTS`,
   `LESSON_EVENT_LIMIT` and `SHARE_STORE`. `SHARE_STORE` is the existing prod
   KV binding that `src/og-card-handler.ts` already read; the gate now also
   keeps the last good lesson state there (`lesson-state:last-good:<api>`).
   `build.yml`'s new Notify IndexNow step (#1116) reads no secret. Two
   committed env files changed: `.env.development` (+10, -0) and
   `.env.production` (+11, -0), in 3774c5668 (#1111) and 07ce2ed75 (#1150).
   Their contents were not opened for these notes.
3. **Worker code.**
   - **Site worker** (`src/worker.ts`, deployed by the tag's
     `build-and-deploy` job): the lesson gate (#1150: `src/lesson-gate.ts`,
     `src/lesson-listings.ts`, `src/lib/lesson-state.ts` and the kit's
     `drafts.ts`, `films.ts`, `lesson-copy.ts`, `publish.ts` and `season.ts`),
     which #1188 extends to the hub; and #1178's UVR cancel
     (`src/lib/runpod-bridge.ts`, `src/lib/runpod.ts`): a cancel the server
     refuses now throws, and the refund after a refused debit still runs.
   - **DB worker** (`deploy-db-prod`): the lesson-state routes (#1147:
     `GET /api/lessons/state`, and the admin routes under
     `/api/admin/lessons/`); `lesson_answer` on `/api/mirror/event`,
     rate-limited by `LESSON_EVENT_LIMIT` and kept with no address or time of
     day (#1193); the funnel catalog's new names (#1134's tours, first values
     and Map rooms; #1190's plan and skip questions; #1193's `lesson_answer`)
     and `mirror-metrics.ts`'s allowlists for their numbers; and the shared
     files #1098, #1120, #1123 and #1128 changed (`native-build.ts`,
     `legend-catalog.ts`, `signup-hint.ts`, `auth.ts`). Dev has run all of it
     since Deploy DB Worker run 40059234793 (bb9d432d1, #1193), green; no file
     in the DB worker's import graph changed after that commit.
   - **Jam worker:** no change.
   - **Order.** `deploy-db-prod` and `build-and-deploy` do not wait for each
     other. If the site lands first, the gate's state read fails and the site
     serves as built (Lessons 1 and 2), and the old DB worker answers the new
     funnel names and `lesson_answer` with a 400 until it is replaced (#1134
     and #1190 ask for the worker with or before the site). A few minutes of
     lost counts, nothing else.
4. **Links into about.mercurypitch.com** (prod-upd step 0c). New in the range:
   the footers of `learn/01.html` to `learn/08.html` and `learn/index.html`
   link `https://about.mercurypitch.com/privacy/`, `/terms/` and `/imprint/`
   (for example `learn/01.html:1620-1622` and `learn/index.html:310-312`).
   These are the paths the app already links; no new path and no query
   parameter. `src/seo/entry-pages.ts` gained only a comment. The landing is
   another repository (disjoint-colliders), which this check could not read,
   so its tags are not listed here; the `mp-v*` tags in this repository are
   the native app's (`mp-v0.8.38` to `mp-v0.8.42` in the range). The owner
   says the landing already carries the new privacy notice. It should cover
   #1190's survey answers and typed lines on the account, and #1193's lesson
   answers with what Cloudflare keeps (request logs with address and time for
   up to 7 days, D1 point-in-time recovery up to 30).
5. **Social cards.** `pnpm run og:versions` runs on this PR at release time.
   The lesson cards (`public/learn/lesson-NN-og.jpg`) are outside it (Found
   while preparing this release).
6. **What's New** is untouched: 0.9.22 is a patch.
7. **Version files.** `package.json` goes from 0.9.21 to 0.9.22, the only file
   besides the two changelogs that the 0.9.21 release commit changed.
   `apps/mercurypitch/package.json` and `apps/beside-cue/package.json` stay at
   0.1.0; the native apps take their version names from their own tags
   (`capacitor-app.yml`, "Resolve release version").
8. **The lessons' release day** (`docs/plans/find-your-pitch/SEARCH.md` § 3.2
   and § 12 step 6, HANDOFF § 2 item 3). In this PR, with the tag day:
   - `learn/01.html`: `"datePublished": "2026-10-DD",` in the Article block,
     between line 90 (`"isAccessibleForFree": true,`) and line 91
     (`"position": 1,`). Neither page has one today.
   - `learn/02.html`: the same, between line 90 and line 91
     (`"position": 2,`).
   - `public/sitemap.xml`: `<lastmod>` on line 97 (`/learn/`), line 101
     (`/learn/01`) and line 105 (`/learn/02`), each 2026-10-20 today.
   - The hub takes no `datePublished` (§ 3.2 asks it of a lesson), only its
     sitemap date.
   - No lesson page and not the hub carries a `VideoObject` (§ 3.2: it belongs
     on the watch page). Lines 61 to 68 of `learn/01.html` and `learn/02.html`
     still say "no VideoObject until the episode plays here" (Found while
     preparing this release).
   - Lessons 3 to 8 take their dates when the console publishes them (HANDOFF
     § 2 item 8).
9. **The films' host.** Lessons 1 and 2 play from
   `https://media.mercurypitch.com/learn/0N/v1/lesson-0N-1080p.mp4` and
   `-720p.mp4` (`kit/films.ts`), and `public/_headers` adds the host to
   `media-src`. #1197 asked for
   `curl -I https://media.mercurypitch.com/learn/01/v1/lesson-01-720p.mp4` to
   answer 200 before it merged; HANDOFF § 2 item 1 records both pairs on R2 on
   24 October. Not requested from here: dev loads the same files, and the
   owner's test pass plays them.
10. **Walk the tours on `main`** (Release Tours,
    `gh workflow run release-tours.yml --ref main`, prod-upd step 4). The
    baseline is 0 misses. New steps in the range: Home's plan card (#1194),
    which shows only while the card is drawn. The lesson tour (#1201) is the
    lesson pages' own.
11. **Push the tag `v0.9.22`.**
12. **After the tag.**
    - The owner checks production as built (above): `/learn/01` and
      `/learn/02` play, `/learn/03` answers 404, `/learn/` lists two links,
      and `/admin/lessons` loads for an admin.
    - Notify IndexNow runs by itself against `v0.9.21`. The key file is new
      since then, so it sends every listed URL; if the run warns, send them by
      hand from a checkout of `v0.9.22`: `pnpm indexnow --since v0.9.21`.
    - Request indexing for `/learn/`, `/learn/01` and `/learn/02` in Search
      Console, and publish each episode on YouTube with the lesson's link
      first (HANDOFF § 2 item 6).

### Found while preparing this release

None of these is in a PR's notes unless it says so, and none blocks the tag on
its own.

- **The lesson pages' head comment invites a VideoObject.** `learn/01.html`
  and `learn/02.html` lines 61 to 68: "No datePublished until the release that
  puts the lesson on mercurypitch.com; no VideoObject until the episode plays
  here". Both films now play, and SEARCH.md § 3.2 says no `VideoObject` on a
  lesson page. The comment should say so when `datePublished` goes in.
- **Sitemap dates.** `/learn/` was created on 23 October (#1188) and is dated
  2026-10-20, and `/learn/01` and `/learn/02` changed after that date. Step 8
  moves all three to the tag day.
- **The tag deploys the site and the DB worker in parallel** (step 3). Safe
  for the gate, which falls back to the site as built; the first minutes' new
  funnel events and lesson answers get a 400.
- **#1210 merged with its body asking for a dev test first** ("Not for merging
  until you have"). It merged on the owner's go; its four checks are in the
  release test.
- **The feedback form writes "Mercury Pitch" as two words** ("Tell us what
  would make Mercury Pitch better. No account needed.",
  `src/components/UserSurveyModal.tsx:133`). 0.9.21 made the mails say
  MercuryPitch as one word. The wording is the owner's open call anyway.
- **First-paint budgets on a production build** (#1144's note): a production
  `dist` went over them for `mirror.html` and `vocal-range-test.html` (442 KB
  of JavaScript against 430, 41 KB of CSS against 40); the check runs on
  `build:e2e` only, where both pass. Not rechecked here.
- **The lesson share cards are outside `og:versions`** (still true from
  #1135): `scripts/gen-og-versions.mjs` stamps `public/*-og.png` and
  `glass/og.*`, not `public/learn/lesson-NN-og.jpg`, and the lesson pages' and
  hub's `og:image` URLs carry no `?v=`.
- **"To your highest" without "comfortable"** is still the voice type test's
  description (`src/seo/entry-pages.ts:584`), as #1135 found.
- **Home's Lessons link still opens `/learn/01`**
  (`src/pages/HomePage.tsx:191`), not the hub; #1177 lists it as W-01's open
  half.
- **#1200's freeze fix is unverified on Windows**, where the freeze was seen;
  its PR lists the check. The CHANGELOG says only what the code does (the 10 s
  give-up).
- **#1134 loads the shared funnel on Guitar Night's first paint** (a device
  id, the first-party event, GA4 under Consent Mode), and on Piano Night once
  a pass keeps notes. Its PR asks the consent review to cover both.

### Web: the lesson pages

- **#1048, Lesson 1 at `/learn/01`** (62 commits, 46 only docs).
  `learn/01.html` is its own document, every word in the markup;
  `lesson-01/main.ts` adds the sound, five figure toys, the two Mercs, the
  quiz, the episode player and the Season 1 explorer, on parts that start
  `src/features/lessons/kit/`. Served by the asset layer (through the site
  worker's gate since #1150), with `STANDALONE_DOCUMENT_PATHS` keeping the
  service worker off it; no CDN and no Google Fonts; live Mercs only on a real
  GPU (`kit/merc-duo.ts`). Home gains its Lessons link. The first-paint check
  now walks every folder of `dist`.
- **#1111, the shared kit and Lesson 2 at `/learn/02`** (9 commits). Lesson
  1's code moved into the kit, every toy mounting on its own root; Lesson 2,
  "Twelve notes", carries its LESSON.md on the spiral, the keyboard, the
  tiles, the semitone ruler, an ear game, three predicts, Sing it and the
  quick check. It also brought Lesson 3 as a draft and the draft switch
  (below).
- **#1133, lesson cards speak to learners** (1 commit). The explorer's cards
  stop printing planning fields; one state function, `kit/lesson-state.ts`,
  gives every list "Start lesson", "Continue: step N" or "Read again", with
  the furthest step kept in `fyp-pos`.
- **#1131, the Series blueprint leaves Lesson 1** (1 commit). The "For the
  team" section moves unchanged to
  `src/features/admin/lessons/blueprint-data.ts`.
- **#1119, a lesson's `?lesson=` marker opens its room** (1 commit).
  `src/lib/lesson-marker.ts` reads `lesson=01` to `14` from the query string,
  and `stepAsideForLesson` ends First Light for good on that visit, as the ×
  does. Web only (`src/index.tsx`).
- **#1136, Watch shows only a film that can play** (1 commit). A lesson's film
  state follows its sources, so no card, masthead link or player promises a
  film that is not there; "Film coming soon" goes.
- **#1137, the step stage fits a landscape tablet** (2 commits). The figure
  shrinks to the room the window leaves, so the sliders under it stay in reach
  at 1024x640 and on a phone held sideways.
- **#1138, Lessons 1 to 7 say it plainly** (8 commits). A sentence-by-sentence
  plain-language pass, one commit per lesson and one for the kit's shared
  lines; the first-visit line about the intro's × goes.
- **#1139, legal links and addresses on a phone** (1 commit). The footer's
  legal links sit in the gutter, and a long address wraps after its slash.
- **#1140, the season in the masthead and a lesson menu** (1 commit). The
  masthead's "Lesson 0N" opens a menu (a sheet on a phone) with every lesson
  in the season, this lesson's steps and the reader's progress.
- **#1142, the lesson menu's short lines wrap evenly on a phone** (1 commit).
- **#1143, one next-lesson card on every Wrap** (2 commits), drawn from
  `season.ts` and the reader's place, in the explorer's and the menu's words
  ("Start lesson", "Continue: step N", "Read again", "Coming later").
- **#1145, a lesson tapped in the explorer brings its card's button into
  view** (1 commit), with one Tab stop for the list and a live region.
- **#1148, switchable hooks and teases, the cold open first, a season-end
  card** (6 commits). Every wording lives in `kit/lesson-copy.ts`, which the
  console and the site worker pick from.
- **#1160, two kit fixes** (2 commits): a predict's hint waits for a heard
  play, and a black-key note fits one line in every ring. Every lesson page.
- **#1177, the release review's fixes** (30 commits). On every lesson page:
  one status line for what a screen reader must hear, focus kept when the
  explorer card rebuilds, the spiral's Turn left and Turn right, the quiz's
  "Your answer" and "Right answer" tags, "MercuryPitch home" in every footer,
  "Animations" for the motion switch and a skip link that lands. In the app:
  Learn moves from Home to the sidebar beside Guide and Tour, Home's pills and
  those three are 44 px on touch screens, and the Ear Lab's tap rule
  (`src/lib/ear/tap-rule.ts`) takes clicks from screen readers, switches and
  voice control. `docs/plans/find-your-pitch/RELEASE-REVIEW.md` is the
  checklist.
- **#1186, the owner's decisions of 22 and 23 October** (14 commits): five
  hook alternatives go (Lessons 9 to 14), the season gains the edge from
  Lesson 1 to Lesson 8 (Lesson 8's chip reads "After Lesson 1: What is a
  note?"), Lesson 6's recall opens `/learn/04#step-1`, and Lesson 5 gains a
  neutral hook, `steady`, in the console while its default stays live (the
  owner's open choice).
- **#1187, search-led titles** (7 commits), such as "What is a note? Pitch,
  hertz and the octave | MercuryPitch"; the series name moves to the kicker,
  the breadcrumb, the share titles and the structured data.
- **#1188, the season's hub at `/learn/`** (15 commits): who the series is
  for, how a lesson works ("Every lesson asks you to sing along.") and Season
  1 lane by lane. `learn/index.html` is built from `season.ts`
  (`tools/learn-hub.ts`), the site worker unlinks lessons that are not live,
  every lesson names it as its series and the lesson menu links it ("All
  lessons").
- **#1191, the hosts by name** (5 commits): blue Merc is Merc and orange Merc
  is Tavi, on the pages, in the kit and in the living docs.
- **#1192, the handoff's follow-ups** (72 commits). Real run times (Lesson 1 8
  minutes, Lesson 2 13); the sound gate keeps its height; a take opened in a
  hidden tab lets the microphone go; the frame loop rests when nothing moves;
  Lesson 2's step 5 explains its lock; Lesson 7 keeps its card after "Done for
  today". In the app: the Siren's glide part scores each round's own glide
  (`src/lib/glide-coverage.ts`) under a new scoring version, so its Best,
  grade and play count restart and the high-notes and range challenges start
  new attempt threads; Dynamic Swell's card, help, idle screen and two daily
  routines promise only what is measured. Tools: `pnpm plan:cites` and
  `pnpm lesson:words`.
- **#1195, Lesson 7's answer locks after Done for today, and the captions name
  Merc and Tavi** (5 commits): `MERC:` and `TAVI:` in both films' captions.
- **#1197, Lessons 1 and 2 play their films** (1 commit): `kit/films.ts` gives
  both their `v1` sources on `media.mercurypitch.com` (5:35 and 7:19), and
  `public/_headers` adds the host to `media-src`.
- **#1200, Merc's shader compile no longer waits on the page** (6 commits). It
  enables `KHR_parallel_shader_compile` and polls instead of reading status,
  keeps the march a loop for Direct3D (`uZero`), draws Tavi with Merc's own
  shader text, and keeps the stills after 10 s on screen
  (`LIVE_MERC_WAIT_MS`). Lesson pages and the web onboarding; the native
  welcome's Merc starts on his first frame. Pixels unchanged in 672 shots; not
  checked on Windows.
- **#1201, a welcome tour on a first visit to a lesson page** (8 commits):
  five steps, Back, Next, Skip tour and ×, replayed from the "?" or "Tour this
  page"; it waits for Merc and Tavi on Lessons 1 and 2 and says the microphone
  line only where a page listens.
- **#1193, each question's first answer in a visit, anonymously** (21
  commits). `kit/telemetry.ts` sends one `lesson_answer` per quick-check or
  recall question's first answer to `/api/mirror/event`: the shared client id
  `lesson-anonymous`, the page, the question, right or wrong, its number of
  options, the visit (capped at 3) and the consent state. Nothing after a
  decline, nor in the EEA, the UK or Switzerland without a yes (by clock, and
  the worker checks the address); predicts, ear games and sung or tapped
  checks send nothing; only a page the site worker served sends. The worker
  keeps the UTC day and the seven numbers, no address, time of day or device
  id, under a random row id.

### Web: publishing lessons at run time

- **#1150, the site worker gates the lessons** (5 commits). Every build
  carries every lesson page; `src/lesson-gate.ts` answers `/learn/NN` from the
  console's state, rewrites a live page's hook and its links to lessons that
  are not live, and edits `/sitemap.xml` and `/llms.txt` to match. The
  release-steps entries and the production state above are its.
- **#1156, Lesson 4 goes back to being a draft** (2 commits), so the first
  release launches Lessons 1 and 2 only and no entry page links a lesson that
  answers 404.
- **#1159, Lessons 3 and 5's heads, and every document's head tested** (3
  commits): a draft goes live with the head it was built with, so the head
  checks now cover drafts too.
- **#1170, team notes leave the lesson pages** (9 commits): the signatures and
  variant notes move to `kit/team-notes.ts`, which only the admin console
  imports.

### Web, drafts: live on dev, held back on mercurypitch.com

- **#1111 and #1129, Lessons 3 and 5.** Lesson 3, "Match a note", the first
  page that listens (a take holds the microphone only while open, nothing
  recorded or sent), and Lesson 5, "Breath and a steady note". The build-time
  switch they came with (`VITE_DRAFT_LESSONS`) now only sets the default of a
  page no worker served (#1150).
- **#1127, Lesson 4, "The major scale and home"**, built as released on 20
  October and held back again by #1156.
- **#1149, Lesson 6, "Intervals: the distance between notes"** (34 commits).
  **#1169, Lesson 7, "Slides, sirens and your range"** (8). **#1172, Lesson 8,
  "Beat, tempo and the backbeat"** (10), which also moves the Ear Lab's tap
  rule to `src/lib/ear/tap-rule.ts` and Drum Night's latency estimator to
  `src/lib/timing/input-latency.ts`, unchanged.
- **#1152** (1 commit), Lesson 4's stairs toy stops its queued summary;
  **#1153** (1), Lesson 5's voice line; **#1168** (4), Lessons 3 and 5's
  openings no longer give their predicts away.
- **#1155** (1 commit), Lesson 9's practise link opens Arpeggio Jumper;
  **#1163** and **#1164** (8 each, mostly docs) change Lesson 11's and 14's
  hooks and the S12 topic's name in `season.ts`. These print on every lesson
  page's explorer cards, for lessons that have no page.

### Web: onboarding, the plan and the app

- **#1190, four questions after First Light and the plan they make** (merge
  commit, 21 commits). The instrument, the goal, what gets in the way and what
  was tried, each skippable; a plan of up to three stops (Start here, Learn,
  Play); the plan layer from Guide and `#/plan`, met once by existing users;
  "Your plan" on Home for a week; "Back to your plan" on every lesson page;
  skipping asks first ("Keep going", "Yes, skip"); one takeover per visit; the
  GH #97 survey down to one question; signed-in answers saved to the account
  as one survey row. New funnel names for the plan and the skip questions. Its
  body asks for the privacy policy's purpose list and a consent legal review
  before the tag.
- **#1194, Home's tour opens on the plan card while it is there** (merge
  commit, 1 commit).
- **#1209, the plan's typed lines above a phone's keyboard, and the email
  chip's dismiss in its corner** (3 commits): the studio strip and Karaoke
  Night's pill, with a 44 px tap area.
- **#1210, Space and M stay in the surveys and confirms, and the plan review's
  follow-ups** (12 commits): a focus trap takes a fallen focus back,
  `ConfirmDialog` gains `variant="stay"`, today's session from First Light or
  the plan lands on Home with its first button focused, a plan answered on
  another device is shown rather than asked again, the feedback form says "No
  account needed." instead of "anonymous", and Escape no longer throws away
  typed feedback (cddefd571).
- **#1134, tours, first values and Map picks measured** (merge commit, 8
  commits): `tour_offer`, `tour_start`, `tour_done` and `tour_exit` with
  permanent tour ids (`src/lib/tour-ids.ts`), `first_value_<room>` once per
  device, and `onboarding_map_room_<room>`. Web only; the DB worker's
  allowlist keeps the tour numbers alone.
- **#1196, the address sync waits for a move's hashchange** (3 commits): a
  `#/map` link followed as the app started could be overwritten by `#/home`.

### Web: karaoke, the studio and UVR

- **#1158, low tier overlays stay transparent** (4 commits): on the low
  performance tier the mixer's tour, Zen's song rows and the Learn scrim no
  longer lose what is behind them, and the mixer's tour shows the stem sidebar
  for its first step.
- **#1165, accessibility audit** (5 commits):
  `docs/accessibility-audit-2026-10.md`, axe-core as a dev dependency with a
  baseline spec, and three fixes: the Zen and phone stage is a named dialog
  that holds the focus, the score card shows above the Zen stage, and the
  spotlight tour is a dialog where Enter moves on.
- **#1189, the 0.8.41 device test's fixes** (6 commits). On the web: a
  streamed vocal now finds its notes, so a separated song gets the pitch guide
  and Find my key on a phone (`streamStems` is any mobile device class,
  `useStemMixerAudioController.ts`), and a failed LRCLIB pick keeps the list
  and says why. The refused-song card, the Subscribe wait and the TV latency
  wizard are native.
- **#1178, UVR cancel and session recovery** (squashed): the client keeps a
  session it could not confirm cancelled, and the worker side is in step 3.
  **#1184, UVR session saves keep their order** (squashed). No visible change
  when nothing fails.

### Web: search

- **#1105** (1 commit), one studio and the site's name in the markup.
  **#1106** (squashed), `/karaoke-app` and FAQs for Jam Rooms and key changes.
  **#1107** (1), the store listings drive the native app signals, which render
  nothing until a listing is live. **#1109** (2), every released lesson linked
  from the entry pages and marked up (Article, BreadcrumbList; no
  VideoObject). **#1122** (1), sitemap dates that say when a page changed.
  **#1116** (4), Piano Night's h1, image alt text, and IndexNow with its
  release step. **#1118** (1), the 404 page's error scene ("Off the stave").

### Web: practice

- **#1124**, the Guided Warmup ends with no grade, score or level (1 commit).
  **#1125**, the range test cushions the top and drops its verdicts (1).
  **#1126**, the hold cards stop asking for the longest hold (1). **#1128**, a
  range that ties Bass and Baritone reads Bass-baritone, in the Voice Mirror,
  on the cards and in the welcome mail (merge commit, 1). **#1110**, First
  Light names a note the voice held, the lower of the two middle values (merge
  commit, 2; its Back fix is native).

### Web, unlisted: Glassworks

- **#1087** (8 commits), Cloudway Studio and traversal checks; **#1090**
  (squashed), the Unbroken Archive and the Hush escape; **#1092** (squashed),
  museum art and the Sun seal (Git LFS art); **#1167** (6), Cloudway recipes
  kept and Pearl courts continuous; **#1180** (squashed), gallery textures on
  phones and loading diagnostics; **#1183** (squashed), retired renderers
  released, with `patches/three@0.185.1.patch`. All change
  `packages/glass-game`, Beside Cue's game (its creator levels are imported
  only by `apps/beside-cue`). The web build compiles the package for
  `/glass-game`, which production serves unlisted
  (`tools/glassworks-listing.ts`: no links, `noindex`); static tracing from
  `GlassCampaign.tsx` reaches files each of the six changed. Not in
  CHANGELOG.md.

### Web, no visible change: shared code the Warm-up moved

- `src/lib/auto-continue.ts` (#1102), `src/lib/platform/index.ts` (#1113: the
  web installs nothing, so haptics keep the vibrate patterns), and
  `settings-progress.ts`'s `PREMIUM_EXERCISES` blocks (#1104). The web build
  has no Warm-up path.

### Admin only

- **#1144** (2 commits), a read-only Lessons page at `/admin/lessons`.
  **#1147** (2), the lesson-state API and migration 0071 (DB worker, step 1).
  **#1151** (11), Publish, Unpublish, "Use default" and the hook and tease
  pickers; the site follows within about 30 s; App's shortcuts pause under the
  Content Studio. **#1211** (4), faster Lessons page tests with their own time
  limits, and the checklist kept across updates (`<Index>`).

### Native: the app's own onboarding

All merge commits, 18 to 20 October, behind `NATIVE_ONBOARDING`
(`src/lib/native-build.ts`, equal to `KARAOKE_IMPORT`): test builds only,
compiled out of the store build, never on the web. Merc's first note (#1098),
the range and the voiceprint (#1101), Keep (#1103), the sung line and the
Cloud offer (#1112), Merc in the alley, the counts and the Warm-up landing
(#1120), and Not now to the Cloud offer, then the alley (#1123). In every
native build: #1098's Sing room arrival fix and #1110's Back closing the
voiceprint ask first.

### Native: the Warm-up

All merge commits, behind `PREMIUM_EXERCISES`: the picker's Pitch and Warm-ups
heads (#1096), warm-up mode in the four rooms (#1099), the routine core
(#1100), the path from Start to Sing a song (#1102), the week's dots and
synced days (#1104), the end's re-pack and iOS haptics (#1113, whose haptics
install reaches every native build), and Merc rising first between stops
(#1130).

### Native: audio and TV

- **#1091**, iOS reads the system volume only while someone listens (merge
  commit, 1; every iOS build). **#1097**, "One volume in rooms" off by default
  (merge commit, 1).
- **#1157**, a TV on AirPlay mirrors the phone, then shows the lyrics (5
  commits): the mirroring fix reaches every iOS build, the store build
  included; the lyrics on the TV are a test build's Developer switch.
  **#1182**, the same mirroring fix in Beside Cue (squashed).
- **#1175**, a TV on AirPlay or HDMI, and Bluetooth, keep a latency offset of
  their own (squashed). `src/stores/audio-route-store.ts` compiles into the
  web through `mic-latency-store.ts`, where it keeps the existing keys, so
  nothing changes there. In the native app no flag guards it
  (`apps/mercurypitch/src/main.tsx`), so the store build has it.
- **#1179**, the Karaoke room's stage on a connected TV, POC-3 (squashed): a
  test build's "Stage on a connected TV".
- **#1189**'s native parts: a song too big to play says why, Subscribe shows
  its wait, and the latency wizard hears a TV (`src/lib/mic-latency-route.ts`,
  used only on a route with a delay of its own; the web and the phone's own
  outputs keep the run they had).

### Refactors (no behavior change)

- **#1094** (merge commit, 1): the developer console is armed from the
  component layer. **#1095** (merge commit, 3): the four exercise rooms share
  one page shell (premium rooms, native).

### Dev tooling, CI and tests

- **#1166** (merge commit, 2): the app-check skill's `onTop` samples inside
  rounded corners, plus notes on the consent bar, the hitBox cap and WebKit.
  **#1176** (squashed): CI's browser setup through
  `scripts/install-ci-browser.mjs`, bounded and on signed sources
  (`pr-gate.yml`, `release-tours.yml`). **#1114** (1): Lesson 3's no-upload
  check leaves Cloudflare's `/cdn-cgi/` posts out. **#1211** is under Admin
  only.

### Docs only

- Find Your Pitch: #1141 (Lesson 7's facts and the specs' line references),
  #1146 (one curiosity moment per lesson), #1154 (Lessons 8 to 10's text
  packages), #1161 (Lesson 13), #1162 (Lesson 12), #1163 and #1164 (Lessons 11
  and 14, with their small code changes above), #1171 (the plan's citations
  re-pointed), #1173 (the Season 1 handoff), #1115 (the YouTube guide and
  which pages are built) and #1132 (minor solfège is do-based). TV: #1181 (the
  TV plan and its EARS requirements) and #1185 (the plan after the merges, and
  the owner's Cast and TV app decisions). Search: #1108 (the search and answer
  engines plan).

### native-mercurypitch

Five `mp-v` tags in the range, each on `main`, each with a green Mercury Pitch
Mobile run: `mp-v0.8.38` (790de6bec, #1120; #1135 lists what it carries),
`mp-v0.8.39` (2ad8e8576, #1130; run 39389902919), `mp-v0.8.40` (3c59c6272,
#1157; run 39823066101), `mp-v0.8.41` (921e3bbf1, #1175; run 39989491403) and
`mp-v0.8.42` (df6eb5be5, #1185; run 40178712684). #1209, #1201, #1211 and
#1210 merged after `mp-v0.8.42`. Unflagged, so in the store build too: #1091,
#1157's mirroring fix, #1175's per-route offsets and #1189's wizard (no flag
on their imports from `main.tsx` and `MicrophoneScreen.tsx`), #1110's Back
fix, #1098's Sing room fix and #1113's haptics install. Test builds only: the
onboarding (`NATIVE_ONBOARDING`), the Warm-up and the premium rooms
(`PREMIUM_EXERCISES`), #1157's TV lyrics and #1179's TV stage (Developer
switches). Not traced for this note: whether #1189's Subscribe wait and
refused-song card reach the store build. The lesson pages and the hub are web
documents and no native entry imports them; #1190's plan renders from
`App.tsx`'s web paths (not traced into the native shell).

### native-besidecue

No `bc-v` tag exists. Glass (#1087, #1090, #1092, #1167, #1180, #1183) and
#1182's external display fix reach Beside Cue's next build. Beside Cue Mobile
on cddefd571 (run 40232609860) is green.
