# Sing the Legend — Phase 1 detailed engineering plan

> Status: **approved scope, not started** (2026-07-10). Decisions locked in a
> founder interview after a research pass (guided-learning curricula, retention
> mechanics, solo live-ops) + codebase survey. This branch
> (`feat/legend-phase1`) is cut from PR #226's head
> (`feat/charming-hypatia-7cd125`) so Phase 1 builds directly on the closed
> challenge loop without rebasing. Product/strategy background lives in the
> founder's planning notes; this doc is the engineering plan.

---

## 0. Starting point (what PR #226 already gives us)

- Closed challenge loop: drill score returns to the challenge; one attempt
  `>= targetScore` completes it (`src/features/challenges/challenge-attempt.ts`).
- Attempts write `sessionRecords` (tagged `melodyName = "Challenge: <title>"`,
  `challenge-attempt.ts:152`) → feed leaderboard + badge engine.
- 24 challenges / 16 badges, reconciled categories, first-win **Basics**,
  difficulty-aware drills (`challenge-drill-generator.ts`).
- Contour capture: `challenge-trace.ts` (best take per challenge) +
  `src/features/exercises/last-run-trace.ts` (every run) — prerequisite for the
  later pitch-race share video and duet-with-past-self.
- Exercise game-feel layer (window bar, tier words, combo, S–D grades, Lv chip).
- Prod-safety: local tour builds fail fast on remote APIs; db-worker
  `ALLOWED_ORIGINS` gate.

## 1. Locked decisions (founder interview 2026-07-10)

| # | Decision |
|---|---|
| 1 | Phase 1 spine = **weekly Legend live-ops + daily loop**, both thin |
| 2 | **New Home/Today tab** becomes the app's landing tab |
| 3 | Owner publishing = **in-app admin page** gated by the existing `X-Admin-Key` |
| 4 | Retention: **streak freeze + repair** and **weekly progress email**; daily quests + web push deferred |
| 5 | **"Beat the Founder" weekly ritual** — founder sings every week's seed score |
| 6 | Content = **public-domain rotation + official-upload YouTube embeds** |
| 7 | **No named program in P1** (generated daily session only; 21-day program + range calibration = Phase 2) |
| 8 | Streak day = **any 5 scored practice minutes**; unify the rogue streak calcs |
| 9 | Funnel/tracking events ship as an **independent PR from `main`** so they merge while the rest is built |

Research one-liners that justify the shape: current-user retention outweighs
acquisition ~5x (Duolingo CURR model); streak forgiveness is the single
highest-ROI mechanic (freeze cut at-risk churn 21%); weekly-authored +
daily-procedural is the sustainable solo split (Advent of Code retreated from
daily authoring); at low N show percentile + participation ("23 singers tried
this"), never raw rank; transparent founder seeding beats ghost users.

---

## 2. PR slicing

| PR | Branch base | Scope | Size |
|----|-------------|-------|------|
| **PR 0** | `main` | Funnel/tracking events (independently mergeable now) | S |
| **PR 1** | this branch | Home/Today tab + daily session generator + streak freeze/repair | M–L |
| **PR 2** | after PR 1 | Weekly Legend core: table, endpoints, hero, attempt flow, board, archive | M–L |
| **PR 3** | after PR 2 | Admin page + founder-seed flow | M |
| **PR 4** | after PR 1 (parallel to 2/3) | Email consent + weekly recap + win-back + first cron | M |
| **PR 5** | after PR 3 | Content sitting: 4–6 queued weeks + apply-melody pool | S (authoring) |

Each PR: `pnpm check` + unit tests green; `/tour-check` whenever tour-targeted
UI changes; dev/local testing only (never prod); patch-style version bump on
release per repo convention.

---

## 3. PR 0 — Funnel & product events (from `main`)

The Voice Mirror already has the pattern end-to-end: client
`src/features/mirror/funnel.ts` → `POST /api/mirror/event`
(`workers/db-worker/src/index.ts:642` `handleMirrorEvent`) → `mirrorEvents`
table (deliberately outside the generic TABLES allowlist), per-IP rate limit,
4 KB payload cap, server-side `MIRROR_EVENTS` name allowlist, metrics only on
`results_view` filtered to `MIRROR_METRIC_KEYS`. PR 0 generalizes this to the
app.

### 3.1 Server (db-worker)

- Rename nothing; **extend the same endpoint + table** (avoids a migration and
  keeps the mirror funnel queries intact). Add app events to the allowlist:
  `app_open`, `signup`, `session_complete`, `challenge_attempt`,
  `pricing_view`, `checkout_start` (+ reserve `weekly_join`,
  `weekly_attempt`, `email_click` for PR 2/4 — adding names is a 1-line diff
  each).
- Keep the metrics gate: only `results_view` carries metrics today; app events
  carry **no payload** in PR 0 (privacy + simplicity). If a per-event count is
  ever needed, extend the numeric-keys filter, never free-form JSON.
- No auth: events are anonymous by design. `clientId` = the app's existing
  anonymous device id if present, else a dedicated
  `pitchperfect_analytics_id` UUID in localStorage (mirror uses its own id;
  keeping ids separate is fine — funnel joins are per-surface).

### 3.2 Client

- New `src/lib/analytics.ts` (app-side twin of `features/mirror/funnel.ts`):
  - `trackEvent(event: AppFunnelEvent): void` — fire-and-forget `fetch`,
    swallow all errors, **no-op when the API base is empty** (this is what
    keeps `build:tours` / the tour walker hermetic — same guard the mirror
    funnel uses; verify with the walker's zero-escaped-requests assertion).
  - Session-scoped dedupe: `app_open` once per browser session
    (sessionStorage flag), `session_complete` per finished practice/exercise
    run, others on action.
- Emit points:
  - `app_open` — `App.tsx` root `onMount`.
  - `signup` — account-creation success path in the auth service/UI.
  - `session_complete` — the two save paths (`practice-session-store` save +
    `exercise-history-store` record) — post-#226 these are the funnels all
    scoring flows pass through.
  - `challenge_attempt` — `challenge-attempt.ts` after `recordAttempt`.
  - `pricing_view` — Settings → Credits panel open (deep link
    `#/settings/credits` counts).
  - `checkout_start` — billing service right before Stripe redirect.
- Explicitly NOT tracked: page/tab navigation, scores, any content. Cookieless,
  first-party, no consent banner needed (matches the privacy stance).

### 3.3 Reporting

- Extend `scripts/launch-report.sh` with:
  - Funnel section: `app_open → signup → session_complete → pricing_view →
    checkout_start` counts (+ conversion %) over 7/30 days.
  - **User-state (CURR) section** from `userProfiles.lastPracticeDate` +
    `sessionRecords`: `new / current / at-risk-WAU / reactivated / dormant`
    weekly counts — the retention scoreboard the rest of Phase 1 is judged by.
- Manual (no-code, founder dashboard task): enable Cloudflare Web Analytics on
  both hostnames; UTM-tag outbound launch links.

### 3.4 Tests

- Allowlist unit test (new names accepted, junk rejected).
- `trackEvent` no-ops on empty API base; never throws (mock fetch rejection).
- Rate-limit path untouched (existing tests cover `checkRateLimit`).

---

## 4. PR 1 — Home/Today tab, daily session, streak freeze/repair

### 4.1 New Home tab (the landing surface)

- `src/features/tabs/constants.ts`:
  - Add `'home'` to `ActiveTab` + `TAB_ORDER`/`TAB_GROUPS` (first tab of the
    practice group), label "Home", new SVG icon component (house/sunrise; no
    emoji), hash route `#/home`.
  - `TAB_SCOPES['home'] = ['singing', 'guitar', 'piano']` (visible in every
    scope), add to `SIMPLE_TABS`, set `DEFAULT_TAB = 'home'`, and
    `scopeHomeTab()` returns `'home'` for every scope (a scoped Home shows
    scoped content, see 4.2).
- New `src/pages/HomePage.tsx` + `src/features/home/` components:
  - `StreakCard` — current streak (cloud value via `streak-service`), freeze
    chips (equipped/max), repair CTA when eligible, longest streak.
  - `TodaySessionCard` — today's generated session (see 4.2): segment list,
    total minutes, length selector (5/10/15 via existing `applyLength`),
    Start/Resume/Done states (reuses `RoutineState`), progress ring per
    segment.
  - `WeeklyLegendHero` — placeholder card in PR 1 ("coming soon" hidden behind
    the PR 2 flag), fully wired in PR 2.
  - `ProgressStrip` — last-7-days minutes + accuracy delta from
    `sessionRecords`/exercise history (a thin slice of the future
    voice-journey dashboard; numbers only, no charts yet).
- `DailyRoutinePanel` (sidebar): body collapses to a compact "Today's session →
  Home" link once the Home tab exists — single source of truth, no duplicated
  state. Keep `use-daily-routine` as the shared engine.
- Tours (repo rule: tours must cover ≥80% of a page's user-visible features):
  - New `PAGE_TOURS['home']` covering streak card, freeze chips, today
    session, length selector, progress strip (+ weekly hero once PR 2 lands).
  - Update `WALKTHROUGH_STEPS` (main tour) — first-run now starts on Home; the
    steps that assumed the Singing landing get `requiredTab`/`navigate`
    adjustments.
  - Update sidebar-routine tour steps to the compact link.
  - Run `/tour-check` (walker must stay green desktop + mobile).
- Scope guard / deep links: hidden-tab redirects now land on Home; verify
  swipe order and `visibleTabOrder`.

### 4.2 Daily session generator (procedural — zero recurring authoring)

Extend `src/features/routines/use-daily-routine.ts` `pickTemplate()` from
"weakest-area template rotation" to a **4-slot day template** built at
generation time:

1. **Warm-up** (unscored or loose-scored): `long-note`/`siren`/`slide` segment,
   `SegmentKind 'warmup'` already exists; scoring suppressed in the shell for
   warmup segments (display "warm-up — no score").
2. **Review**: exercise targeting the weakest area from
   `generateWeaknessReport()` (`practice-intelligence/weakness-analyzer.ts`) —
   today's behavior, kept.
3. **New/rotate**: deterministic rotation over the remaining skill areas keyed
   on day-of-year (so everyone's "today" is stable across reloads).
4. **Apply**: `call-response` or `sight-singing` on a short public-domain
   phrase from a new `src/data/apply-melodies.ts` pool (~10 PD phrases as
   `MelodyItem[]`: Ode to Joy, Amazing Grace, Greensleeves, Scarborough Fair
   (trad.), Shenandoah, …). Pool is data, not code — grows in PR 5.

- Segment count/durations scale with the 5/10/15-minute length setting
  (existing `applyLength`).
- Existing 9 handcrafted templates remain available under "Choose a different
  workout" (manual picker) — the generated day is the default.
- Day state stays device-local (`mp_daily_routine`, keyed by date) in P1;
  **streak is the cross-device value** (cloud). Cloud-syncing the day plan
  itself is deferred.

### 4.3 Streak: 5-minute rule + freeze + repair

Current: `streak-service.ts` bumps `userProfiles.currentStreak` on any practice
day (`lastPracticeDate` day-string compare). Changes:

- **Minutes accumulator**: new `src/db/services/practice-minutes.ts` —
  `addScoredMs(ms)` accumulates per local calendar day (localStorage
  `mp_practice_ms_<date>`, cloud-mirrored lazily). Called from the two save
  paths (same hooks as `session_complete` in PR 0) with
  `endedAt - startedAt` for sessions and the run duration for exercises. When
  the day's total first crosses **5 min**, call `updatePracticeStreak()`.
- `updatePracticeStreak()` gains freeze logic:
  - Gap of exactly 1 missed day AND `streakFreezes > 0` → consume one freeze:
    streak continues (+1 for today), `streakFreezes -= 1`, record
    `lastFreezeUsedDate`. Gap > 1 day: consume freezes for up to
    `streakFreezes` missed days (Duolingo equips max 2), else reset.
  - **Earning**: +1 freeze each time streak crosses a multiple of 7, cap 2.
  - **Repair**: if streak reset within the last **72 h** (`lastPracticeDate`
    2–3 days ago at next open), Home shows a one-tap "Repair streak" CTA —
    free, limited to once per 30 days (`lastRepairDate`). Restores
    `currentStreak` to the pre-reset value (`previousStreak` snapshot taken on
    reset).
- Schema: `userProfiles` gains `streakFreezes` (int, default 0),
  `lastFreezeUsedDate`, `previousStreak`, `lastRepairDate`, `longestStreak`
  (if not present). D1 `ALTER TABLE` migration + `entities.ts` +
  `tables.ts` column metadata, following the existing worker migration
  pattern.
- **Unify rogue calcs**: `VocalChallenges.tsx` local score>70 streak filter and
  any other ad-hoc streak math route through `streak-service.getCurrentStreak`.
- Tests: table-driven freeze/repair scenarios (no gap / 1-day gap with+without
  freeze / 2-day gap 2 freezes / repair window in+out / earn-cap), minutes
  threshold crossing, midnight boundary (day strings are local-date based —
  keep consistent with `todayDateString()` semantics).

---

## 5. PR 2 — Weekly Legend live-ops core

### 5.1 Data model (D1)

New table `weeklyChallenges` — **the queue, the calendar, and the archive are
the same rows**:

```sql
CREATE TABLE weeklyChallenges (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,            -- 'nessun-dorma-money-note'
  title TEXT NOT NULL,                  -- 'The Impossible Note: Vincerò'
  description TEXT NOT NULL,            -- 2 sentences, founder-authored
  featType TEXT NOT NULL,               -- money-note | sustain | low-note | range | ...
  voiceTypeSplit TEXT,                  -- JSON: per-voice-type target transposition
  difficulty TEXT NOT NULL,             -- beginner | intermediate | advanced
  targetItems TEXT NOT NULL,            -- JSON MelodyItem[] (the line to sing)
  hearItUrl TEXT,                       -- official-upload YouTube watch URL
  startsAt TEXT NOT NULL,               -- ISO; Mondays 00:00 UTC by convention
  endsAt TEXT NOT NULL,                 -- ISO; startsAt + 7d
  rewardBadgeId TEXT,                   -- Completed-tier badge
  founderScore REAL,                    -- seed score (null until founder sings)
  founderTrace TEXT,                    -- compact contour JSON for overlay
  evergreen INTEGER NOT NULL DEFAULT 0, -- eligible for Encore re-runs
  status TEXT NOT NULL DEFAULT 'queued' -- queued | active | closed
);
```

**Not registered in the generic TABLES allowlist** (generic admin tables give
public reads — queued rows would leak upcoming challenges). Served by custom
endpoints only, like `mirrorEvents`.

Attempts: reuse `sessionRecords` with a first-class `weeklyChallengeId TEXT`
column (migration) — cleaner than the `melodyName` convention and the board
query needs an index on it. Best-per-user is derived, not stored.

### 5.2 Endpoints (db-worker, custom handlers)

- `GET /api/weekly/active` — resolve "now" against the rows:
  - Row with `status='active'` and `now < endsAt + 48h` → return it
    (public fields only; `founderTrace` included — it powers the ghost
    overlay).
  - Active row past `endsAt + 48h` → run **lazy close** inline (see 5.4), then
    fall through.
  - Queued row whose window contains now → flip to `active`, return it.
  - Nothing eligible → **Encore**: pick a random `evergreen=1` closed row,
    clone it as a new active row (`slug + '-encore-<n>'`, this week's window).
  - No cron required for any of this.
- `GET /api/weekly/board?id=` — per-user best from `sessionRecords`
  (`weeklyChallengeId` index), returns: top-N (10), the caller's best +
  **percentile**, `attemptedCount` (distinct users), `completedCount`
  (best ≥ target), founder row labeled `isFounder: true`. Rankings freeze at
  `endsAt`; late attempts (≤ +48 h) still earn badges but are flagged
  `late: true` and excluded from the frozen top-N.
- `GET /api/weekly/archive` — closed rows, newest first, with their frozen
  top-3 + counts (computed at close, stored on the row as `resultsJson`).
- Writes to `weeklyChallenges` (create/update/delete/seed-take): admin-gated
  via the existing `isAdmin()` `X-Admin-Key` check; per-IP write rate limit
  reused.

### 5.3 Client — the player loop

- `WeeklyLegendHero` (Home) + "This Week's Legend" section atop the Challenges
  tab: title, feat framing, difficulty, voice-type selector (transposed
  target), **"Hear it"** = official YouTube iframe embed (platform embed API
  only, click-to-load facade for perf/privacy; never audio extraction),
  countdown ("closes in 2 days"), Join/Attempt CTA, tier chips.
- Attempt flow reuses the #226 rail: build a `PendingDrill`-style launch from
  `targetItems` → practice engine scores it → attempt writes `sessionRecords`
  (+ `weeklyChallengeId`) → tier evaluation client-side:
  - **Attempted** (any finished take) → participation credit.
  - **Completed** (score ≥ target) → `rewardBadgeId` via
    `badge-grant-engine`.
  - **Beat the Founder** (score > `founderScore`) → dedicated badge
    (`weekly-beat-founder-<slug>` or one reusable "Giant Slayer" badge —
    decide in PR 3 when badges are seeded; default: one reusable badge).
- Board UI: percentile line ("top 24% of 31 singers"), participation framing
  ("31 singers tried this, 9 completed"), founder row labeled — **never a
  mostly-empty top-100**; archive list of past weeks.
- Trace ghost (stretch, only if cheap): overlay `founderTrace` as a faint
  target-race line during the attempt — the engine already renders
  live-vs-target.
- Events: `weekly_join` on first attempt launch, `weekly_attempt` per finished
  take (allowlist names reserved in PR 0).
- Tours: extend Home + Challenges tours to cover the hero, board, and archive;
  re-run `/tour-check`.

### 5.4 Lazy close ceremony (no cron)

On the first `active` read past `endsAt + 48h`:
1. Compute final board; store `resultsJson` (top-3 + counts) on the row.
2. Set `status='closed'`.
3. Winner spotlight is **display-only** in P1 (no server-side badge grant —
   tier badges were already granted client-side at attempt time). The archive
   card shows the top-3.

### 5.5 Integrity (P1 level)

- Server owns the board: it derives from `sessionRecords` written through the
  normal authenticated write path (existing per-IP rate limit).
- Sanity clamps on the attempt write: score ∈ [0,100], duration vs
  `targetItems` length plausibility.
- Compact trace rides on weekly attempts (existing trace capture) so the
  founder can eyeball top-3 takes in the admin page before featuring them.
  Full server-side re-scoring of traces = Phase 2.

---

## 6. PR 3 — Admin page + founder-seed flow

- Unlock: Settings → "Admin" section appears after entering the admin key
  (stored `pitchperfect_admin_key`, sent as `X-Admin-Key`). Wrong key = the
  server rejects; no client-side secret.
- `AdminWeeklyPanel` (lazy-loaded page, hash `#/admin/weekly`):
  - **Queue list**: all rows (queued/active/closed), window, status,
    founder-seed state; edit/delete for queued rows.
  - **Editor**: form mirroring the table; melody target = pick an existing
    library melody + trim to a phrase, or paste `MelodyItem[]` JSON; per-voice
    transposition helper; official-YouTube URL field with embed preview;
    "next free Monday" auto-fills the window; `evergreen` toggle.
  - **Seed take**: "Record my seed" runs the exact player attempt flow and
    writes `founderScore` + `founderTrace` to the row on finish.
  - **Review**: top-3 takes of the active week (scores + trace thumbnails) —
    founder eyeball before the week closes.
- Authoring workflow this enables: one sitting queues 4–6 weeks (PD rotation
  below); a skipped week auto-falls back to Encore; ~30 min/week steady-state
  (pick + describe + sing the seed).
- Seed content (PR 5 executes; PR 3 makes it possible): Wk1 money-note —
  Nessun Dorma (tenor) / Queen of the Night (soprano) split; Wk2
  breath/sustain — Ave Maria or Danny Boy (any voice); Wk3 low voice — Ombra
  mai fù / Shenandoah + Habanera (mezzo); Wk4 agility — O Holy Night climax /
  Handel run. All PD compositions; embeds point at official uploads only.

---

## 7. PR 4 — Weekly progress email + win-back (Resend)

- **Consent**: `userProfiles.emailOptIn` (default **false** — EU consent),
  Settings → Account toggle "Weekly progress email", optional unchecked
  checkbox on signup. Unsubscribe: signed-token link
  (`GET /api/email/unsubscribe?token=`) flips the flag; `List-Unsubscribe`
  header on every send.
- **Weekly recap** (template in the `email.ts` pure-renderer style + unit
  tests): practice minutes, sessions, accuracy delta vs prior week, streak +
  freezes, badges earned, this week's Legend teaser + deep link. Range delta
  joins later (needs voice-journey aggregation — P2).
- **Win-back**: `lastPracticeDate` in the 21–28-day window → one email
  ("your streak history and scores are saved — 2 minutes keeps the habit"),
  `winBackSentAt` column prevents repeats; a returning win-back user gets a
  free streak freeze.
- **First cron in the project**: db-worker `wrangler.jsonc`
  `triggers.crons = ["0 7 * * MON"]` + a `scheduled()` handler — Monday 07:00
  UTC, right after the new Legend activates: batch recaps to opted-in users +
  win-back scan. Volume is minutes of D1 queries at current N; chunk sends to
  respect Resend rate limits. (The challenge lifecycle stays lazy — the cron
  exists only for email.)
- Guard: `RESEND_API_KEY` unset → handler logs and exits (same pattern as the
  existing transactional mail).

---

## 8. Explicitly deferred

- **Phase 1.5 (first follow-up)**: pitch-race / Duet-the-Legend vertical video
  export + branded sound (traces exist; `card-renderer.ts` does 1080×1920
  statics already) — the growth loop.
- **Phase 2**: voting + community takes, winner prizes, named 21-day program +
  range-calibration onboarding, duet-with-past-self overlay, voice-journey
  dashboard as a first-class surface, daily quests, web push, per-note metric
  extractor (melisma/vibrato/register feat-types), leagues, server-side trace
  re-scoring, cloud-synced day plans.

## 9. Invariants / verification

- Local/dev testing only — never prod (walker guard + origin gate enforce).
- Official-upload YouTube iframe embeds only; never extraction; no lyrics
  hosting; PD compositions only in P1.
- No emojis in UI — SVG icon components.
- Tours updated in the same PR as any tour-targeted UI change; `/tour-check`
  green desktop + mobile before merge; new Home tour covers ≥80% of the tab.
- `pnpm check` + full unit suite per PR; new logic (streak freeze/repair,
  lazy close, percentile, allowlist) lands with table-driven tests.
- Headless-browser loop verification per feature (oscillator mic shim) for the
  attempt flow and the Home session start.

## 10. Open calls (defaults chosen, cheap to change)

- Weekly window timezone: **UTC** boundaries, displayed in local time.
- Beat-the-Founder badge: one reusable badge vs per-week — default reusable.
- Streak repair economics: free, once per 30 days, 72 h window.
- `app_open` dedupe horizon: per browser session (not per day).
- Encore clone vs re-open original row: clone (keeps archives immutable).
