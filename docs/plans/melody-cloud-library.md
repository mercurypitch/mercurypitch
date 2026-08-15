# Melody Library in the Cloud (supporter / premium)

**Date**: 2026-08-15 · **Status**: proposed, not started · **Owner decision
pending on §6**

## Context

A singer's melodies — the ones they wrote in the editor — live in one JSON blob
in `localStorage`, written by `_writeLibraryNow` (`src/stores/melody-store.ts`)
under a single key, debounced 400 ms and flushed on `beforeunload` and
`visibilitychange`. Playlists and practice sessions live in the same blob.

That means:

- clearing site data destroys every melody the singer has written, with no
  warning and no recovery
- a second device shows an empty library, forever
- there is no export path short of the whole-session bundle, which is built for
  separated songs rather than for a handful of hand-written melodies

Stems cannot go to our servers — uploaded audio is user-supplied copyrighted
material, and `hybrid-adapter.ts` says so ("Audio data is huge and never syncs
to the cloud by design"). **Melodies are the opposite case.** A melody is a list
of notes: a 64-note melody serialises to a few kilobytes, it is the singer's own
composition, and none of the copyright reasoning applies. This is the part of
the library that genuinely can be stored.

The ask is to offer that storage to accounts that pay for it — supporters and
premium — which makes it a feature gate as much as a data-model change.

## What already exists

More than the size of this document suggests. Nothing here needs inventing.

| Asset                          | Where                                                | Notes                                                                                                                                           |
| ------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Entity shapes for exactly this | `src/db/entities.ts:410`                             | `MelodyRecord`, `SessionTemplate`, `PlaylistRecord` — already carry `itemsJson`, `isDeleted`, and a comment saying "ready for future migration" |
| Generic cloud CRUD             | `workers/db-worker/src/index.ts`, `tables.ts`        | A new synced table is a migration, one `TABLES` entry, one `CLOUD_ENTITIES` entry                                                               |
| Per-user row scoping           | `scopeRead` / `handleCreate` (`index.ts`)            | `access: 'user'` pins every read and write to the token's userId; nothing per-table to write                                                    |
| Server-held feature grants     | `workers/db-worker/src/supporter-feature-access.ts`  | Automatic group for active supporters, manual groups by verified email, ids allowlisted in `src/lib/supporter-feature-catalog.ts`               |
| Entitlement expiry             | `entitlements` table, `activeSupporterExpiry`        | Already handles "supporter, until"                                                                                                              |
| A credentialed device identity | `users.deviceSecretHash` (migration 0029)            | An anonymous library now has an owner that cannot be claimed from a published id                                                                |
| Soft delete with undo          | `deleteMelody` / `restoreMelody` (`melody-store.ts`) | And `isSessionItemMelodyMissing`, which makes a dangling reference a rendered state rather than a phantom middle C                              |

## 1. What is stored

One table, `melodyRecords`, matching the `MelodyRecord` entity that is already
written down:

```sql
CREATE TABLE IF NOT EXISTS melodyRecords (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  author TEXT,
  bpm INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  scaleType TEXT NOT NULL,
  kind TEXT,
  octave INTEGER NOT NULL DEFAULT 4,
  playCount INTEGER NOT NULL DEFAULT 0,
  lastPlayed INTEGER,
  itemsJson TEXT NOT NULL,
  tags TEXT,
  notes TEXT,
  isDeleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_melodyRecords_user ON melodyRecords(userId, isDeleted);
```

`TABLES` entry: `melodyRecords: { access: 'user', boolCols: ['isDeleted'], jsonCols: [] }`.
`itemsJson` stays a string on purpose — it is opaque to the server, which never
needs to read a note, and keeping it out of `jsonCols` means the worker does no
parsing it could get wrong.

Playlists and session templates are **out of scope for the first pass**. They
reference melodies by id, so syncing them without the melodies would produce
exactly the dangling-reference state we just spent a fix rendering honestly.
Melodies first; the other two follow the same pattern once this is proven.

## 2. Sync model

**Last-write-wins per melody, by `updatedAt`.** Not CRDTs, not a merge UI.

A melody is edited in one editor by one person; the realistic conflict is "the
same singer edited on their phone and forgot they had it open on the desktop",
and the honest resolution there is the newer edit with the older one recoverable
(see §4). Anything more elaborate is machinery with nothing to decide.

Push: the existing 400 ms debounce already batches editor keystrokes. When the
library save fires and the feature is on, diff against the last synced snapshot
and `PATCH`/`POST` only the melodies whose `updatedAt` changed. The generic CRUD
route takes one row per request, so a bulk endpoint (`POST /api/melodyRecords/bulk`,
modelled on `handleAchievementBulk` in `grants.ts`) is worth having from the
start — a first sync of a 60-melody library is otherwise 60 round trips at ~85 ms
each, which is the exact problem `grants.ts` was written to solve.

Pull: on sign-in and on `authVersion()` change, `GET /api/melodyRecords`, merge
by id, newer `updatedAt` wins.

## 3. Deletion

`isDeleted` is a flag, never a `DELETE`.

This is not tidiness. `restoreMelody` is the undo directly below `deleteMelody`,
and session items deliberately keep referencing a deleted melody so that undo
brings the whole thing back. A hard cloud delete would make "undo" mean "restore
locally and then have the next sync delete it again". Tombstones also give the
other device something to act on: a row that vanishes from a list read is
indistinguishable from a row the reader never had.

Purge tombstones older than, say, 90 days in the same operator job that already
runs cleanups, once every device has certainly seen them.

## 4. What happens when the entitlement lapses

The question that decides whether this feature is honest.

**Nothing is deleted, and nothing stops working locally.** A supporter who
lapses keeps every melody they wrote, on the device that wrote it, exactly as
before — because that is where melodies live for everyone. What they lose is the
_sync_: new edits stop being pushed, and the second device stops receiving them.

Server-side rows are kept for a grace period (proposed: 12 months) and the
account page says so plainly, with a one-click "download my melodies" export
that works whether or not the entitlement is live. Deleting somebody's
compositions because a card expired is not a thing to build.

Renewing resumes sync and re-pushes anything edited in the meantime.

## 5. The feature gate

Add one id to `src/lib/supporter-feature-catalog.ts`:

```ts
{
  id: 'melody-cloud',
  label: 'Melody library backup',
  description:
    'Your written melodies are saved to your account and appear on every device you sign in to.',
}
```

That is the whole gate. `resolveSupporterFeatureAccess` already grants it
automatically to active supporters and by manual group to anyone an operator
adds, both keyed server-side; the client already reads that list.

**The gate is checked on the server, in the route, not only in the UI.** A
client-side check decides whether to show a sync toggle; it must not be what
decides whether a write is accepted. `melodyRecords` writes need the same
`resolveSupporterFeatureAccess` call the Lab route makes — otherwise the feature
is "premium" only in the sense that the button is hidden.

Anonymous accounts: no. Not a paywall decision — a supporter entitlement is
resolved through a verified email, and an anonymous identity has none. Signing
in is the prerequisite, and the UI should say that rather than showing a
disabled toggle.

## 6. Decisions still needed

1. **Quota.** Melodies are small, but "unlimited" is a promise. Proposed: 2,000
   melodies and 256 KB per melody, both enforced server-side, both far above
   any real library. Needs a yes/no.
2. **Does this extend to playlists and practice sessions?** They are the same
   shape and the same table pattern, and a library that syncs melodies but not
   the sessions built from them will read as broken. Recommended yes, as a
   second pass, once melodies are proven.
3. **Grace period on lapse.** 12 months is proposed above; anything from 3 to
   forever is defensible and it is a business decision.
4. **Is this a supporter perk or a paid plan feature?** The catalog above makes
   it a supporter perk, which is the cheapest thing to build because the
   machinery exists. If it is meant to sit behind a specific paid tier instead,
   the gate reads `entitlements` directly and the catalog entry is not needed.

## 7. Sequencing

Each step ships on its own and is useful without the next.

1. Migration + `TABLES` entry + `CLOUD_ENTITIES` entry. No UI. Verified by a
   node-test against the migrated schema, the way the follow-request and device
   -secret work is.
2. Bulk write endpoint, modelled on `handleAchievementBulk`, with the
   entitlement check in the route.
3. Push-on-save behind the feature flag, with the last-synced snapshot kept
   beside the library in `localStorage`.
4. Pull-and-merge on sign-in.
5. Account-page surface: state, last sync time, export button.
6. Playlists and session templates, if §6.2 is yes.

## 8. Explicitly out of scope

- **Sharing melodies with friends.** The follow graph now has real consent
  (`workers/db-worker/src/friends.ts`), so "share this melody with a friend"
  becomes possible for the first time — and it is a different feature with its
  own privacy questions. Not this.
- **Audio.** Nothing here touches stems, recordings, or uploads. The rule in
  `hybrid-adapter.ts` is unchanged.
- **Cross-device conflict UI.** See §2.
