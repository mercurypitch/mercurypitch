# EARS Specification — Score visibility controls

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-08-09 | Scope: reversible operator exclusion from
> the main leaderboard and per-user weekly challenge score retraction.

**Source:** `workers/db-worker/migrations/0022_score_visibility.sql`,
`workers/db-worker/src/score-visibility.ts`, and
`workers/db-worker/src/index.ts`.

**Tests:**
`workers/db-worker/node-tests/score-visibility-integration.test.ts` and the
local Company Report Viewer bridge and user-insight tests.

---

## 1. Authorization and validation

### REQ-SV-001 — Shared privileged authorization

**When** a caller requests a score visibility change, the DB worker shall
await the shared admin policy before reading or changing a target: a verified
Cloudflare Access identity, or the server-side admin key only while that
environment's staged rollout permits it. **While** Access strict mode is
enabled, the shared key alone shall not authorize the action. The browser
shall never receive either credential.

### REQ-SV-002 — Strict target and reason

**When** an authorized caller requests a change, the DB worker shall require a
UUID user id, an explicit `leaderboard` or `weekly-challenge` scope, a boolean
target state, and a trimmed 8–280 character reason without ASCII control
characters. Weekly scope shall also require a bounded challenge id; leaderboard
scope shall reject one to avoid an ambiguous target.

### REQ-SV-003 — Atomic, idempotent transitions

**When** current visibility changes, the DB worker shall mutate current state
and append exactly one audit event in one D1 batch. **While** the requested
state already holds, it shall report `changed: false` and append no event.

## 2. Main leaderboard exclusion

### REQ-SV-004 — Operator override wins over opt-in

**While** an account has a leaderboard exclusion, none of its session
aggregates shall appear in the live global or friends leaderboard, including
to the account itself, regardless of `userProfiles.leaderboardOptIn`.

### REQ-SV-005 — Account and scores remain intact

**When** an account is excluded from the main leaderboard, the system shall
retain the user, profile, sessions, user-controlled opt-in preference, league
state, achievements, and weekly challenge visibility. Restoring the override
shall make otherwise-eligible aggregates visible again.

## 3. Weekly challenge retraction

### REQ-SV-006 — User-and-week scope

**When** an operator retracts a weekly result, every session by that user for
that challenge shall be ignored by the live weekly board, attempted count,
completed count, and closing snapshot. Other users, other weeks, and the main
leaderboard shall be unchanged.

### REQ-SV-007 — No practice-history deletion

**Ubiquitous:** Weekly retraction shall retain all underlying session records,
scores, achievements, badges, and league events. A single current-state marker
shall represent the user-and-week retraction, and restoration shall remove
that marker without recreating source data.

### REQ-SV-008 — Active-week boundary

**While** a weekly challenge is queued or closed, the DB worker shall reject
retraction and restoration. Closing a challenge shall freeze the standings
that already reflect any active retractions, and later operator actions shall
not rewrite that archived outcome.

## 4. Operator visibility

### REQ-SV-009 — Reporter state and audit evidence

**When** the Company Report Viewer loads a user or weekly scoreboard, it shall
show active account-level exclusions and weekly retractions, keep the hidden
attempt metrics visible to the operator for investigation, and display the
append-only action history. Overview responses shall expose the visibility
state but reserve free-text operator reasons for the selected user's detail.

### REQ-SV-010 — Guarded, reversible controls

**When** the relevant schema and server-only credential bridge are available,
the user detail shall offer explicit exclude/retract and restore actions with
an operator reason and typed confirmation. **While** either dependency is
missing, the controls shall be disabled with a reason and all read-only data
shall remain available.

## 5. Release acceptance scenarios

1. Exclude an opted-in account from the main leaderboard twice: it disappears
   on the first request, the second is a no-op, one audit event exists, and its
   weekly score and source sessions remain.
2. Restore the account-level override: its preference is unchanged and its
   otherwise-eligible aggregate reappears.
3. Retract a singer with multiple attempts from the active weekly challenge:
   the singer and all attempts leave live board counts while session rows,
   general leaderboard aggregates, badges, and league events remain.
4. Restore that weekly result: the same stored attempts determine the singer's
   best score and standing again.
5. Try either weekly transition on a closed challenge: the request returns a
   conflict and neither current state nor audit history changes.
6. Call the endpoint without authorization, with a weak reason, or with an
   ambiguous target: it changes no state and appends no audit event.
