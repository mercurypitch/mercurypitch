# EARS Specification — Reports, blocks and the name filter

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-10-31 | Scope: what App Store guideline 1.2 and
> Play's user-generated content policy ask of an app whose singers post: a
> filter on what is posted, a way to report it and an answer in good time, a
> way to block a singer. Slice 4a of
> [`docs/plans/native-more-and-community.md`](../plans/native-more-and-community.md).

**Source:** `workers/db-worker/migrations/0072_reports_and_blocks.sql`,
`workers/db-worker/src/name-filter.ts`, `name-filter-words.ts`,
`public-text.ts`, `report-rules.ts`, `reports.ts`, `blocks.ts`,
`share-authors.ts`, `registered.ts`, and the hooks in `index.ts` (shared
reads, the leaderboard, the weekly board), `league.ts` (standings),
`friends.ts`, `validation.ts`, `auth.ts` (names, rate limits, deletion) and
`email.ts` (the owner's alert).

**Tests:** `workers/db-worker/src/name-filter.test.ts`,
`workers/db-worker/src/public-text.test.ts`,
`workers/db-worker/src/auth.test.ts` (the erasure list), and
`workers/db-worker/node-tests/reports-and-blocks-integration.test.ts`.

---

## 1. The name filter

### REQ-RB-001 — One filter for every name others read

**When** a singer writes a display name, a bio, a shared melody's title or
tags, or a shared result's title, the DB worker shall pass it through
`name-filter.ts` and refuse the write with a 400 naming the column when it is
too long, holds control characters or direction overrides, shows nothing but
is not empty, or spells a word on the list. An avatar address shall be checked
for its shape only (https, at most 500 characters), never read for words.

### REQ-RB-002 — Folding before matching

**Ubiquitous:** The filter shall read a name as a reader sees it: case
(alternating case included), full-width forms, accents, look-alike Cyrillic,
Greek, small-capital, Cherokee and enclosed letters, digits and symbols
written for letters (read both ways where ambiguous: "1" as "i" and as "l"),
stretched letters, hidden characters and separators shall not hide a listed
word. A number alone shall stay a number. Reading shall take time linear in
the text's length.

### REQ-RB-003 — Innocent words stay innocent

**Ubiquitous:** Each word shall be matched on its own, never run together
with the next ("Push It", "Rabbit Chase" and "Who Really Cares" pass); only
the list's phrases ("sieg heil") are read as words in a row. A word that
ordinary words and names contain ("class", "Scunthorpe", "Yamashita",
"Siriporn") shall be refused only standing as a word of its own, with only
the endings the list gives it ("Cumming" and "Spices" pass), and a title a
singer shares innocently ("Moby Dick", "Who Killed Cock Robin") shall pass.

### REQ-RB-004 — Lyrics carry crude words, never slurs

**When** a shared melody's lyrics are written, as JSON text or as an array,
the DB worker shall refuse the slurs on the list's EVERYWHERE tier in them,
including the two a melody might split over two notes ("nig" "ger"), and
shall let crude words and the NAMES tier through: songs carry crude words,
and words like "kys" (Danish) and "en retard" (French) are innocent in
other languages.

### REQ-RB-005 — Names from a sign-in provider

**When** Google or Apple supplies a name, the DB worker shall clip it to the
display name's length and, when the filter refuses it, keep the account's
default handle; the sign-in itself shall not fail over the name. **When** a
singer types a refused name on the sign-up form, registration shall answer
400 with `code: 'display_name_refused'`.

### REQ-RB-006 — A share's author is the poster

**When** a share is created, the DB worker shall write its `author` from the
poster's profile and drop any client value. **When** a share is read, the
worker shall show the poster's current display name, and shall refuse a
non-admin filter or sort on `author`, which would answer from the stored
value nobody is shown.

### REQ-RB-007 — Rows written before the filter

**Ubiquitous:** Existing rows shall not be rewritten. The owner's name audit
(`GET /api/admin/name-audit?kind=profiles|melodies|sessions&after=<id>`) shall
list each row that fails the filter, a page at a time.

## 2. Blocks

### REQ-RB-010 — Who may block

**When** a registered singer posts `{ userId }` to `/api/blocks`, the DB
worker shall record the block and delete every `follows` row between the two
in the same batch. An anonymous identity shall be refused with 403, oneself
with 400 and an unknown singer with 404. A singer holds at most 500 blocks
(409 after that), so the list can show every one. `DELETE
/api/blocks/<userId>` shall lift a block, and `GET /api/blocks` shall list the
caller's own, by current name.

### REQ-RB-011 — Both ways

**While** a block stands, each singer shall be hidden from the other on the
shared melodies and results (lists, counts and reads by id), the leaderboard,
the weekly board and the league standings. A league row shown under a
pseudonym shall stay: hiding it would tie the account just blocked to the
pseudonym. Every other singer's view shall be unchanged.

### REQ-RB-012 — Places never move

**Ubiquitous:** A board shall rank everyone before it drops the singers hidden
from the viewer, so every place shown, the viewer's own included, is the place
it would be without the block, and the league cut and the weekly podium read
the whole field.

The trade-off, taken on purpose: the gap is seen from both sides, so a
blocked singer who remembers who stood above them can guess who blocked them.
Re-ranking around the gap would hide that, at the price of showing each of
the two a place that is not theirs, beside a cut and a podium that disagree.

### REQ-RB-013 — Friend requests

**While** a block stands, a friend request, a code redemption or an accept
between the two shall be refused: the blocker with 409 and words saying to
unblock first, the blocked singer with the 404 the route gives when nobody is
there, so no refusal tells anyone who blocked them.

## 3. Reports

### REQ-RB-020 — Taking a report

**When** a registered singer posts a report naming a singer, a profile, or a
public shared melody or result, with a reason from the fixed list
(`report-rules.ts`) and an optional note of at most 500 characters, the DB
worker shall record it against the singer behind the target. A private
share, an unknown target, oneself, an unknown reason or an anonymous identity
shall be refused.

### REQ-RB-021 — Once per reporter and target

**While** a reporter's report on a target is open, a second one shall change
nothing and answer 200 `{ status: 'open' }`.

### REQ-RB-022 — The owner hears

**When** the first open report on a target arrives, the DB worker shall mail
the owner (`BILLING_ALERT_EMAIL`, subject `[MercuryPitch report]`) with the
target, its title and singer, the reason, the note and the route to answer
it, after answering the singer (the request's `waitUntil`). "First" is the
earliest open report on the target, so of two arriving at once exactly one
mails, and later reports on the same open target do not mail again.

### REQ-RB-023 — Answering

**When** an admin posts `{ status: 'actioned' | 'dismissed' }` to
`/api/admin/reports/<id>`, the DB worker shall resolve that report and every
open report on the same target, recording when and, for a Cloudflare Access
identity, by whom. `GET /api/admin/reports?status=` shall list reports newest
first with the target's current title and singer.

### REQ-RB-024 — Takedown

**When** an admin deletes `/api/admin/shares/<melody|session>/<id>`, the DB
worker shall delete the share and resolve its open reports as actioned.

### REQ-RB-025 — Suspension hides shares

**While** a singer is suspended, their shares shall be hidden from everyone
else's lists and reads by id.

## 4. Limits and erasure

### REQ-RB-030 — Rate limits

**Ubiquitous:** Reports shall be limited to 10 an hour per caller
(`content-report`) and block writes to 30 an hour (`user-block`).

### REQ-RB-031 — Erasure

**When** an account is deleted, the DB worker shall erase its answered
reports, every report about it, and its blocks from both sides. Its open
reports shall stay in the owner's queue, unsigned (`reporterId` becomes
`erased:<report id>`): they are about somebody else, and still owed an
answer.
