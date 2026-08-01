# Signup Funnel Account Creation -- EARS Requirements

Requirements for classifying account creation consistently across fresh user
rows and upgrades of existing anonymous device rows.

**Source:** `workers/db-worker/src/auth.ts` -- account creation and session
responses; `src/db/services/auth-service.ts` -- client signup event emission
**Tests:** `workers/db-worker/src/auth.test.ts` (`REQ-SFA-001..002`);
`src/tests/auth-service.test.ts` (`REQ-SFA-003..004`)

EARS keywords: **WHEN** (event), **IF/THEN** (conditional behaviour),
otherwise ubiquitous ("shall").

Scope note: these requirements cover forward-looking signup event delivery.
Historical signup events, funnel stages, event payloads, and joins between
device analytics and account records are out of scope.

## Worker account classification -- `REQ-SFA-001..002`

### REQ-SFA-001 -- Password account creation is new

**WHEN** password registration creates an account, either by inserting a fresh
user row or by upgrading an existing anonymous device row in place, the auth
worker shall issue a session response with `isNew: true`.

### REQ-SFA-002 -- Google account creation is new

**WHEN** a Google identity creates an account, either by inserting a fresh user
row or by upgrading an existing anonymous device row in place, the auth worker
shall classify the resolved user as `isNew: true` for both token and redirect
flows.

## Client event delivery -- `REQ-SFA-003..004`

### REQ-SFA-003 -- Anonymous provisioning is not a signup

**IF** anonymous device provisioning returns `isNew: true`, **THEN** the client
shall not emit a `signup` funnel event for the `anonymous` auth route.

### REQ-SFA-004 -- Google redirect signup is emitted once

**WHEN** the client consumes a successful Google redirect containing
`gauth_new=1`, it shall emit exactly one `signup` funnel event and remove the
auth fragment so consuming the redirect again cannot duplicate the event.
