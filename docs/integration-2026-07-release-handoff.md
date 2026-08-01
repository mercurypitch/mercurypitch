# MercuryPitch post-integration release and migration handoff

Prepared: 2026-07-31/08-01 (Europe/Zagreb), at the end of the open-PR integration train.
Companion execution log (blow-by-blow): `INTEGRATION_LOG_2026-07.md`.
Governance snapshot taken before #363: `governance-snapshot-2026-07/`.

## 1. Integration identity

- **Integration PR:** https://github.com/mercurypitch/mercurypitch/pull/374 (draft until owner review)
- **Branch:** `feat/open-pr-integration-2026-07`
- **Base:** `6fa4769e9d62b93fb83a2161d50cd0b7eb3156b8` (main at train start; main did not move during the train)
- **Final head:** `73787b53cb3eee0e55b1987a9aa130d566f8e39a` (= the 14 checkpoints + one release-gate tour fix commit)
- Version: package.json `0.7.23` (from #361; final release number is stamped at release per the small-bumps convention)

First-parent history = exactly 14 no-FF merge checkpoints, each with the exact audited source head as second parent (audit script output in the log):

| # | PR | Source head | Merge commit |
|---|----|-------------|--------------|
| 1 | #360 drag gesture | 846bfc7975d5 | 3f981ac167bf |
| 2 | #357 Zen/guided foundation | d03921d2c161 | 5efd1e3ce60a |
| 3 | #365 Analysis redesign | 9649a58be3c3 | 959c5b6c5a2d |
| 4 | #361 accounts/leagues/migrations | 92980d010d6a | b6bae979e15a |
| 5 | #358 Content Studio | 33f5b4950838 | f0a9d01a3735 |
| 6 | #368 Studio preview auth/layouts | 1e3e006e8877 | 264a608ad925 |
| 7 | #370 versioned preview API | 0a54dfd03164 | 15d43ce99751 |
| 8 | #372 password reset + AuthModal | 763130b85304 | 3ee962657092 |
| 9 | #373 signup funnel events | f1199d8a37e9 | 7caa61220cd9 |
| 10 | #362 donations/supporter tiers | eab65bce013e | 1d29a16edff4 |
| 11 | #367 survey timing/feedback | 68defe364b79 | 667c5528a98d |
| 12 | #371 instrumental split/RunPod | 7e036b88ac0c | 2086fb5aa259 |
| 13 | #366 First Light + voiceprints | 01a5dd3c1eda | 4a9f31d34c8e |
| 14 | #363 docs/governance reorg | 439ea523a935 | b69402173875 |

Notes: #371's head MOVED after the handoff snapshot (7b013f0aa5f3 + one commit, `fix(uvr): a failed pickup must not forfeit a completed split`) — the current head was audited and merged. Drafts **#359** (e8e920351775) and **#364** (fe100cb38fd8) were excluded and nothing was copied from them.

## 2. User-facing changelog (grouped)

**Features**
- Zen singing pitch loops + eight guided exercises, entry points from Singing/Exercises/mobile/Ascent (#357)
- Guided-exercise Content Studio: owner authoring, immutable publishing, managed media on R2, path assignments (#358), responsive at narrow widths (#368)
- Privacy-first accounts: lazy identity (mint on first write), friend codes, opt-in leaderboards, weekly leagues with seven trophy rungs, full account erasure (#361)
- Password reset via email + one shared sign-in modal everywhere (#372)
- Supporter donations: Chime/Chorus/Anthem + pick-your-own amount, time-boxed supporter perks, badge, say-hello contact block (#362)
- Instrumental split (drums/bass/guitar/piano/other), pop-free playback envelopes, waveform outlines, RunPod bridge (#371)
- First Light onboarding (two-track first run) + voiceprints history with growth timeline (#366)
- Analysis rebuilt as one honest responsive dashboard; Sonic-Visualiser tooling moved to hidden Lab routes (#365)
- Survey asks at a fair moment and feedback is reopenable from Account (#367)

**Fixes**
- Drag gestures: stuck pending press / hover-drag + slider click-focus (in-merge fixes on #360)
- Signup funnel events fire for anonymous→account upgrades, exactly once (#373)
- The full set of in-merge integration fixes below (section 6)

**Security/privacy**
- Public profile reads masked to public identity columns (friendCode/opt-in/league/streak telemetry now owner-only)
- League standings pseudonymise non-opted-in members; leaderboard payloads stop shipping streaks outside friends view
- League point awards replay-safe (unique source keys); reset tokens hash-only, atomic single-use, sessions revoked on reset; forgot-password timing oracle closed
- Account erasure covers league rows, reset tokens, voiceprints (added in-train)

**Infrastructure**
- Tracked D1 migrations 0001–0010 replace schema.sql everywhere (CI applies before worker deploy)
- PR previews: build:dev-pinned bundle with prod-origin guard; versioned preview db-worker + one persistent preview D1 migrated by the chain
- RunPod: ROCm image assets, length-based pricing with server-side duration verification, R2-direct staging for large inputs

**Documentation**
- Agent index (generated, CI-checked), EARS spec consolidation, AGENTS.md as canonical agent governance, 235 stale docs removed (#363)

## 3. Feature inventory (routes/entry points/data owners)

| Feature | Entry | Data | External deps |
|---|---|---|---|
| Zen loops | Singing/Exercises buttons, `singingZenLaunch` overlay | Dexie v5 `zenTakes` (local-only, 50 cap, no audio) | none |
| Guided catalog | Zen exercise picker; `/api/guided-exercises` | D1 guided tables + R2 `mercurypitch-guided-media[-dev/-prod]` | R2 |
| Content Studio | `#/admin/<section>` (admin key) | D1 drafts/versions/media; `/api/admin/guided-*` (X-Admin-Key) | R2 |
| Accounts/friends/leagues | Settings→Account, AuthModal, `#/leaderboard?add=CODE` | D1 users/profiles/follows/league tables | — |
| Password reset | `#/reset-password[?token=]`, AuthModal link | D1 passwordResets | Resend (email) |
| Donations | Settings→Credits DonatePanel, header heart | D1 pricingPlans(kind=donation), creditLedger claims, entitlements | Stripe |
| Instrumental split | Karaoke stem mixer parts UI | Dexie uvr tables (optional new fields), R2 staging, RunPod jobs | RunPod, R2 |
| First Light | Welcome screen → FirstLight flow; `#/map` replay | localStorage + D1 voiceprints (accounts) | — |
| Analysis | Analysis tab; Lab at `#/lab`, `#/pitch-test`, `#/pitch-algo` (advanced/dev) | reads practice history/SessionPitchData/stems | — |
| Survey/feedback | auto-modal + Account "Share feedback" | D1 userSurveyResponses | — |

## 4. Conflicts and resolutions (summary; full detail in the log and merge-commit messages)

Every conflict was resolved semantically; each merge commit message records file, both intents, and the chosen composition. Highlights:

- `vocal-analysis.css` (#365×#361): kept #365's restructure, grafted only #361's pure-append league block; nothing deleted by #365 was resurrected.
- Worker `index.ts` (#361×#358): composed masking/admin-flag/profile-streak with guided routing; discarded #358's inherited copy of the old day-derived streak.
- Auth model (#361×#370×#372×#373): `restoreAuth`/`requireAuth` is the surviving model; #370's ensureAuth dedup wrapper dropped (its concurrency regression ported onto requireAuth); AuthModal is the only sign-in surface; #373's two isNew flips applied on the branch's formatting.
- AccountSection (#361×#372×#362×#367×#366): AuthModal architecture carries the render; opt-in + erasure + supporter pill + say-hello (feedback first) + VoiceSection all reachable.
- vite.config (#358/#368×#371): function-form config kept; #371's uvr-proxy delta applied inside it.
- Rename-detection trap (three occurrences — #358, #372(+#362), #366): git kept appending schema DDL into applied `0001_baseline.sql`; each time reverted and converted to a new numbered migration. **Anyone merging future schema.sql-era branches must watch for this.**
- CHANGELOG: all entries folded under one `[Unreleased]`; version stamped at release.
- #363 last: index regenerated from the final tree; three live-referenced docs kept (premium.md, users-auth-plan.md, db-migration-plan.md); two required policy lines (PR-per-task→main, Komediruzecki reviewer) added to the new AGENTS.md.

## 5. Historical findings — final dispositions

Complete per-finding dispositions live in `INTEGRATION_LOG_2026-07.md` (checkpoints 1–14). Summary of categories:
- Fixed at source head before the train: #360's broader coverage, #366 voice-session teardown, #362 claim-release atomicity, #361's 17-finding adversarial pass.
- Still open at head → fixed in-merge: listed in section 6.
- Accepted by owner decision: league client-authority model (caps hold), longestStreak publication gate deterrence-only, admin-key localStorage pattern, refunds/disputes manual (terms state non-refundable), preview D1 content shared across PRs by design.
- Not applicable/environment: the "22 unrelated UI failures" in several PR bodies never reproduced under a clean NODE_ENV=test environment (three clean full-suite baselines).

## 6. New findings found and fixed during integration

1. #360 stale pending press → buttons-free hover-drag; slider click-focus suppression (fixed + 3 regression tests).
2. #365 fabricated signed cents "bias" (production stores magnitudes) — removed; malformed legacy rows crashed/counted-perfect — hardened; mic left running when live-capture construction failed — teardown added.
3. #361 public `SELECT *` profile reads leaked friendCode/opt-in/league/streak (BLOCKER) → publicCols masking; leaderboard payload leaked streaks outside friends view; league standings named non-consenting users; award replay-unsafety under client retry (0006 + INSERT OR IGNORE gate); `source` enum validation; `GET /api/friends/code` rate limit; deleted legacy migrate scripts restored (0002 depends on hand-added weeklyChallengeId — live prod risk).
4. #370 preview workflow executed the retired schema.sql (would fail + never create new tables) → `d1 migrations apply` + template migrations_dir + contract test updated; draft-only guided media fetchable by UUID → lifecycle guard (fixed at stack tip).
5. #372 erasure missed passwordResets; forgot-password timing oracle (inline Resend round-trip) → ctx.waitUntil; token consume made atomic (DELETE…RETURNING).
6. #362 DonatePanel imported removed ensureAuth (compile break) → restoreAuth (read path must not mint); webhook/sweep recorded billingEvents on duplicate outcomes → permanent-strand race closed (winner-only recording; sweep skips duplicates + per-event isolation); NaN entitlementDays wedged the reconciliation sweep → finite guard + regression test.
7. #367 survey lost under lazy auth (surveyChecked set before token check) → re-arm; showAdminWeekly rename; AuthModal/feedback/FirstLight added to the moment gate; failed submit no longer discards typed feedback.
8. #363 deleted three docs still referenced by live code/migrations → restored; index regenerated from the final tree.

## 7. Database migration manifest

Chain (`workers/db-worker/migrations/`, applied by `wrangler d1 migrations apply`, tracked in `d1_migrations` by filename):

| File | sha256 (first 16) | Contents | Idempotency |
|---|---|---|---|
| 0001_baseline.sql | 407477f1ef769c3e | schema.sql verbatim + header (all IF NOT EXISTS) | re-runnable; no-op on deployed DBs |
| 0002_sessionRecords_source.sql | 5bf75461a6cf8d6c | +source column, index, weekly/challenge backfill | one-shot ALTER; **requires weeklyChallengeId to exist** |
| 0003_userProfiles_social.sql | 8089f11be4836e60 | +leaderboardOptIn/At, friendCode + partial unique idx | one-shot ALTERs |
| 0004_leaderboardConfig.sql | 704a9fc209743af1 | leaderboardConfig table | IF NOT EXISTS |
| 0005_leagues.sql | 3c95313749c4bc5e | +currentLeagueId; leagues/cohorts/membership/events/config/meta + INSERT OR IGNORE seeds | tables IF NOT EXISTS, seeds idempotent; ALTER one-shot |
| 0006_leaguePointEvents_sourceId.sql | 9b5225c5215f1b58 | +sourceId + partial unique (award replay-safety) | one-shot ALTER; index IF NOT EXISTS |
| 0007_guided_exercises.sql | 9b6e3551a7cc4278 | guidedExercises/Media/Versions + ready-media triggers + pathLessonAssignments | IF NOT EXISTS throughout |
| 0008_passwordResets.sql | eafc5740aaf159dd | passwordResets table + index | IF NOT EXISTS (no-op on hand-migrated dev) |
| 0009_donations.sql | e3ca441129bf8880 | pricingPlans +entitlementDays/customAmount/perks + 4 INSERT OR IGNORE seeds (NULL prices) | ALTERs one-shot; seeds idempotent, never overwrite |
| 0010_voiceprints.sql | 07c8834eef72a1d1 | voiceprints table + userId/takenAt indexes | IF NOT EXISTS |

Verification performed (local sqlite 3.53.4): full chain from empty = clean; deployed-shape (main's schema.sql) + chain = clean; **schema dumps byte-identical between the two paths**; FK check clean; 37 tables, 2 triggers, 4 donation seeds; duplicate-award INSERT proven changes()=0; standings consent CASE proven on seeded rows; draft-media lifecycle SQL proven (draft 0 / published 1).

**Pre-flight before the FIRST `d1 migrations apply` on a deployed DB** (see `scripts/README-legacy-migrations.md`):
1. `PRAGMA table_info` on users/userProfiles/sessionRecords (read-only).
2. Missing legacy columns (tokenVersion, stripeCustomerId, lastActiveAt, streak-freeze set, weeklyChallengeId, emailVerifications) → run the matching restored `scripts/migrate-*.sql` first. **Prod is recorded as having pending hand-migrations — this step is NOT optional there.**
3. Chain-owned columns already present from hand-testing (`source`, `leaderboardOptIn`, `friendCode`, `currentLeagueId`, `sourceId`, donation columns) → insert that file's name into `d1_migrations` instead of running it.
4. Back up first via D1 Time Travel bookmark (private); **never** export a dump into a public artifact.
5. Rollback = application revert + `wrangler d1 time-travel restore` (documented in deploy-db.yml); no destructive down migrations exist by design.

Non-D1 state validated: Dexie — zenTakes is additive v5; #371 adds optional fields only (no version bump; upgrade-safe). R2 — guided buckets per env in db-worker wrangler.jsonc; UVR staging bucket bound in dev config (dev bucket only). Preview D1 — one persistent `mercurypitch-db-preview`, migrated by the chain, additive-only so concurrent PR applies race harmlessly.

## 8. Dev deployment runbook (exact commands; owner-run or explicitly approved)

```bash
# 0. freeze
git fetch origin && git rev-parse origin/feat/open-pr-integration-2026-07   # = b6940217...

# 1. backup dev D1 (private path)
cd workers/db-worker
npx wrangler d1 time-travel info mercurypitch-db-dev --env dev   # record bookmark

# 2. pre-flight (read-only)
npx wrangler d1 execute mercurypitch-db-dev --remote --env dev \
  --command "SELECT name FROM pragma_table_info('sessionRecords') WHERE name IN ('weeklyChallengeId','source'); SELECT name FROM pragma_table_info('userProfiles') WHERE name IN ('leaderboardOptIn','friendCode','currentLeagueId'); SELECT name FROM pragma_table_info('pricingPlans') WHERE name IN ('entitlementDays','customAmount','perks'); SELECT name FROM sqlite_master WHERE name IN ('passwordResets','voiceprints','guidedExercises','leagues','d1_migrations')"
#    -> apply scripts/README-legacy-migrations.md decisions (run legacy scripts / mark chain files applied)

# 3. apply the chain to dev
npx wrangler d1 migrations apply mercurypitch-db-dev --remote --env dev

# 4. deploy db-worker (dev) BEFORE the frontend
pnpm deploy:db:dev            # or: gh workflow run deploy-db.yml -f environment=dev

# 5. frontend dev deploy
pnpm deploy:dev

# 6. smoke (dev origin, not workers.dev)
# auth: anonymous mint on first write only; login/register via AuthModal
# reset: POST /api/auth/forgot-password (dev logs link if RESEND_API_KEY unset)
# guided: GET /api/guided-exercises returns the catalogue
# leagues: GET /api/league/me after a scored exercise
# donations: GET /api/billing/pricing shows the donations bucket ("Soon" until prices wired)
# erasure: DELETE /api/auth/me on a scratch account; verify tables empty for that id
```

RunPod/UVR (#371) deploys are **separate and gated** on the measured-cost step (multipliers are provisional); do not roll out the image/worker path without that measurement.

## 9. Production-release prerequisites (never automatic)

- Prod D1: Time-Travel bookmark → legacy pre-flight (mandatory) → `d1 migrations apply` via `gh workflow run deploy-db.yml -f environment=prod`.
- Stripe: live donation price IDs wired per environment (UPDATE pricingPlans...), webhook already on api.mercurypitch.com.
- Resend: RESEND_API_KEY + EMAIL_FROM secrets on prod worker (reset emails).
- GitHub Sponsors: activate the mercurypitch org listing before flipping SPONSORS_LIVE (never chaos-matters).
- Terms: donation language (non-refundable, perks description) — published before donations take money.
- R2: `mercurypitch-guided-media-prod` bucket exists + binding (wrangler.jsonc has it; create bucket if absent).
- RunPod: pinned image tag + measured cost multipliers before enabling the split tiers on prod.
- FREE_ROAM_DEFAULT launch-day decision (pre-existing open decision).
- Full `/prod-upd` flow (includes the tour walk) at release time.

## 10. Ownership/config surfaces

Documented per env in wrangler.jsonc (db-worker: DB + guided R2 + migrations_dir on all three blocks; app worker: UVR staging bucket in dev config, RUNPOD_STEM_PREFIX matching the endpoint's S3_KEY_PREFIX). Preview: `wrangler.pr-preview.template.jsonc` reuses the dev worker name (inherits dev ADMIN_KEY/JWT_SECRET, never prod), workers_dev off, version Preview URLs only, CI guard fails any preview bundle containing the prod API origin. No secrets in the repo or this document.

## 11. Test matrix (final head b6940217...)

| Check | Result |
|---|---|
| pnpm check (typecheck+eslint+prettier+docs:index:check) | clean; 3 pre-existing TaskDemo warnings (= baseline) |
| pnpm typecheck:db | clean |
| Unit suite | 3,660 passed / 1 skipped (baseline 3,315; +345 from the train incl. ~40 integration regression tests) |
| Coverage run | (final-gate run; same counts) |
| Build (vite prod) | clean |
| Wrangler dry-run bundles | app 94.22 KiB gz 23.36; db-worker 758.66 KiB gz 126.00 |
| Migration replay | empty + deployed-shape → byte-identical schemas; FK clean |
| Full Playwright E2E (chromium, complete suite) | **425 passed / 0 failed**, 9.3 min |
| Tour walk (`pnpm test:tours`, both-viewport) | **114/114 steps spotlight, 0 misses** (after fixing the two pre-existing Path misses: reveal added for .path-week-card/.path-cta — the only post-checkpoint commit) |
| CI on PR #374 | Build & Deploy App / check / Run Tests / E2E (smoke) all **pass** (re-runs on the final push) |
| One-off observed flake | one vitest EnvironmentTeardownError (worker rpc teardown) at checkpoint 8; clean on immediate re-run; not test-related |

Manual owner acceptance (browser/audio/device) is deliberately left to the owner's dev-testing pass per instruction; suggested checklist:
- Mic: denial, delayed grant, repeated start/stop across Zen/Analysis/Onboarding; no stuck indicator (`window.__micSentinel.dump()` if in doubt).
- Audio: no pops on stem play/pause/seek/part-toggle on a PA; no doubled audio after stop/unmount.
- Keyboard/focus: AuthModal, ResetPasswordPage, ConfirmDialog traps + Escape + return focus; slider click-then-arrows.
- Mobile 390px: Analysis, Studio, DonatePanel, League strip, First Light.
- Deep links: `#/reset-password?token=x`, `#/leaderboard?add=CODE`, `#/map`, `#/admin/exercises`, `#/lab`.
- Preview pairing: a PR preview hits its own versioned worker (network tab shows the version URL, never api.mercurypitch.com).

## 12. Preview URL
The integration PR's own CI produces the paired preview (frontend pinned to the versioned db-worker preview). Use the PR checks' "Version Preview URL" output.

## 13. Observability
- `wrangler tail` on dev db-worker during smoke: expect `[league]`, `[billing]`, `[auth]` prefixed lines; zero `error` on the happy path; reconcile sweep logs recovered events only (duplicates no longer alert).
- mirrorEvents: `signup` rows must appear ONLY on anonymous→account upgrades and fresh registrations.
- Post-deploy window: watch webhook 200s and the 30-day sweep alert email for false "webhook broken" (should be gone after the duplicate fix).

## 14. Rollback boundaries
- Application: revert the squash-merge commit on main (single commit if squash-merged) or `git revert -m 1` per checkpoint on the branch.
- Workers: redeploy previous version (wrangler versions) — db-worker first-compatible both ways because migrations are additive.
- Data: additive chain → old worker runs fine against migrated DB (new columns/tables ignored). No destructive rollback; Time Travel only for catastrophe.
- Feature disables: donations = deactivate rows (`UPDATE pricingPlans SET active=0 WHERE kind='donation'`); leagues = leaguePointsConfig weights to 0; guided catalogue falls back to bundled seeds if the API is absent.

## 15. Remaining polish / debt (explicitly non-blocking; no known regressions hide here)

- No worker-route test harness (miniflare/unstable_dev) — the biggest gap; unit-level module tests cover the new logic, endpoint-level coverage exists only for auth (#373's file).
- mirrorEvents.clientId rows survive account erasure (pseudonymous residue after users-row deletion).
- Pre-existing on main: weekly board aggregates client-writable weeklyChallengeId with no membership check; register 409 remains an enumeration channel; unverified-password-account absorbing a later Google sign-in (auto-link direction).
- passwordResets has no TTL sweep for stale unused rows (superseded/consumed only).
- Client matches RESET_LINK_DEAD by string (brittle coupling, documented in both files).
- Index generator doesn't escape `|` in first-comment lines (cosmetic table breakage only; --check keeps content honest).
- Analysis take-selection memo compares by id (documented; deep-equality would re-fetch on every UVR tick).
- league standings limited to top 50 rows of a cohort (as implemented).
- Owner league-polish queue from the Ascent memory (HomePage header rule, NoteName "G4", etc.) untouched by this train.

## 16. Source PR closure plan (after the owner merges #374)

1. Merge #374 per owner instruction (squash-merge acceptable per the handoff; rebase-merge would replay 14 merge commits — squash is the sane choice here and explicitly allowed).
2. Close (not merge) #357, #358, #360, #361, #362, #363, #365, #366, #367, #368, #370, #371, #372, #373 with: "Integrated into main via #374 (exact head <sha> merged as checkpoint <n>); closing in favor of the integration train."
3. Leave drafts #359 and #364 open and untouched.
4. Delete `feat/open-pr-integration-2026-07` after merge (or keep for audit until the release ships).
5. Dev D1 apply + dev deploys per section 8, then prod per section 9 at release time.
