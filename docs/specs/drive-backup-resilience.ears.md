# Drive Backup Resilience — EARS Requirements

What the first real 27-song backup taught: five songs failed with no
reason given and no way to try again, the in-Drive count sat still for
the whole job, and a phone screen going to sleep froze everything.
Shares the `REQ-DRV` namespace with `drive-connect-redirect.ears.md`
(001..007) and `drive-library-scan.ears.md` (010..011).

**Source:** `src/stores/drive-sync-store.ts` — the backup/restore jobs,
`resolveFolder()`, `driveJobFailures`; `src/lib/drive/drive-client.ts` —
`ensureFolder(preferredId)`, the post-upload size check;
`src/components/SyncSettings.tsx` — the counts, the failure list, the
Open in Drive link
**Tests:** `src/tests/drive-sync-store.test.ts`,
`src/tests/drive-client.test.ts`,
`src/components/__tests__/SyncSettings.test.tsx`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## REQ-DRV-012 — A failed upload is retried before it is given up

**WHEN** a song's upload fails for anything except an auth failure or
Stop, the system shall try that upload again, up to three attempts in
all, before counting the song as failed. **IF** one network blip were
final, **THEN** a song that took minutes to pack would be thrown away
for a hiccup that cost a second — which is what a VPN reconnect did to
five songs out of twenty-seven.
_Tests:_ `drive-sync-store` — "REQ-DRV-012: tries a failed upload again
before giving up".

## REQ-DRV-013 — An upload is verified, and a short one is refused

**WHEN** an upload finishes, the system shall compare the size Drive
stored against the size that was sent; **IF** they differ, **THEN** the
stored copy shall be trashed and the upload counted as failed — a
truncated backup discovered at restore time, on the replacement device,
is a song lost for good. (Content integrity inside the file is the
manifest's per-part sha256, verified by the same import code the peer
transport uses, on the way back in.)
_Tests:_ `drive-client` — "refuses an upload Drive stored short, and
trashes the remnant".

## REQ-DRV-014 — A failure has a name and a reason

**WHEN** a job ends with failed songs, the system shall list each failed
song's title with a reason a person can act on, and keep the list on
screen after the job. **IF** the job only said "5 could not be",
**THEN** the person knows neither which five nor whether trying again
could help — which was the first real run's actual experience.
_Tests:_ `drive-sync-store` — "REQ-DRV-014: names the song that failed,
and why".

## REQ-DRV-015 — The headline counts move as songs land

**WHILE** a backup or restore is running, the "in Drive" and "here"
figures shall advance as each song completes, so somebody deciding
whether to press Stop can see what they would keep. The rescan at the
end remains the authoritative count.
_Tests:_ `drive-sync-store` — "REQ-DRV-015: moves the headline counts as
each song lands".

## REQ-DRV-016 — The folder is remembered by id, not by name

**WHEN** the folder has been resolved once, the system shall remember
its id (per account) and ask Drive for that id first, falling back to
the name search only when the id is gone or trashed. **IF** the folder
were found by name alone, **THEN** a rename in Drive would silently
create a second "MercuryPitch" folder and offer the whole library for
re-upload. A folder the user made themselves is invisible to the
`drive.file` scope either way — the app can only ever see the folder it
created.
_Tests:_ `drive-client` — "REQ-DRV-016: trusts the remembered id over
the name"; "falls back to the name when the remembered folder is gone";
"does not trust a remembered folder sitting in the trash";
`drive-sync-store` — "REQ-DRV-016: remembers the folder and asks for it
by id next time".

## REQ-DRV-017 — A running job holds the screen awake

**WHILE** a backup or restore is running, the system shall hold a screen
wake lock (best effort — the browser may refuse) and say on the progress
UI that the job pauses in the background. **IF** the screen slept,
**THEN** the OS would freeze the page and the job with it — the likely
shape of "my songs stopped uploading".
_Tests:_ `drive-sync-store` — "REQ-DRV-017: holds the screen awake for
exactly the job". The browser-refusal path is the platform helper's own
behaviour.

## REQ-DRV-018 — The Drive file is named for a person

The uploaded file shall be named from the song's display title, not the
raw upload name — "Song.mp3.mpsong" is a Drive listing nobody should
have to read. Files uploaded before this rule keep their names.
_Tests:_ `drive-sync-store` — "REQ-DRV-018: names the Drive file from
the title, not the upload".

## REQ-DRV-019 — Settings waits for the library before counting it

**WHEN** the Settings page computes "songs on this device" WHILE the
session cache is still filling from IndexedDB, it shall wait for the
store to finish loading first. **IF** it read the cache at once, **THEN**
a reload straight into Settings would tell somebody with a full library
"0 songs on this device" until they happened to visit the Karaoke tab —
the same boot race REQ-DRV-011 pinned for the scan.
_Tests:_ `SyncSettings` — "REQ-DRV-019: waits for the library before
counting it".

## REQ-DRV-020 — A hash match without stems does not block a restore

**WHEN** the scan matches a Drive file to a local session by content
hash, **IF** that session's stem blobs are absent from IndexedDB, the
system shall still offer the song for restore. An interrupted delete can
leave (or resurrect) a completed row whose stems are gone; matching it
by hash alone made the scan swear the song was safe on the device while
the library could not play it — and the one good copy in Drive was never
offered back. A presence answer of `unknown` (the read failed) shall
keep the match blocking, because restoring over a session that may be
healthy would duplicate it. The import path applies the same rule: an
"already-here" decline is only honest about a session that still has its
stems (see REQ-SYNC-028).
_Tests:_ `drive-sync-store` — "REQ-DRV-020: offers a song back when the
local match has no stems", "keeps a hash match blocking when the stem
read merely failed".

## REQ-DRV-021 — Deleting a song deletes it durably, and completely

**WHEN** a person deletes a song from the library, the system shall
remove the session record AND everything it owns — stem blobs,
fingerprints, lyrics, transcriptions, pitch analyses, group membership —
in one awaitable cascade, blobs before the record. **IF** the delete
only re-persisted the surviving rows fire-and-forget, **THEN** a reload
racing it would bring the "deleted" song back whole, and its hash would
then convince the scan that nothing needed restoring — the shipped "it
only offered once" bug. An interrupted cascade now leaves at worst a
stemless row, which REQ-DRV-020 sees through and the boot prune removes.
**IF** the cascade fails outright, the delete shall resolve false and
the UI shall warn that the song can come back after a reload — a delete
the person watched succeed must not silently un-happen. The delete also
tombstones the session and drains its write chain first, so a queued or
whole-list persist carrying a pre-delete snapshot cannot re-create the
row after the cascade commits.
_Tests:_ `uvr-session-reconcile` — "REQ-DRV-021: removes the record AND
everything it owns, awaitably", "a stale whole-list persist cannot
resurrect a deleted row", "resolves false when the cascade fails, so
the UI can warn"; `uvr-delete` — "REQ-DRV-021: warns when the cascade
fails, in words about a reload", "stays quiet when the delete lands".

## REQ-DRV-022 — A failed stem read never reads as "absent"

**WHEN** the stem-presence check cannot read the blob store, it shall
answer `unknown`, never `absent`. The check now asks the compound index
for counts (strict — failures reject) instead of materializing the
session's multi-MB stem rows; where an adapter offers no index counts,
the row-read fallback must pass `throwOnError`, because the generic
read degrades a failure to an empty list — and to a presence check an
empty list IS `absent`, the one answer that authorises the boot prune
to delete a paid library on a transient IndexedDB error.
_Tests:_ `uvr-session-reconcile` — "REQ-DRV-022: a degraded stem read
answers unknown, never absent", "keeps a paid session when the stem
read fails transiently".

## REQ-DRV-023 — A connected Drive is checked without being asked

**WHEN** the Settings sync page opens WHILE Drive is connected, the
system shall run the Drive comparison by itself — it is one folder
listing — showing an indeterminate bar while it runs, and shall keep a
comparison already held from this session rather than re-listing on
every visit. The manual button remains as a refresh arrow for forcing a
re-check. **IF** the page only ever answered to a button, **THEN** the
section would open as a question ("Check Drive") about information the
app could simply have fetched.
_Tests:_ `SyncSettings` — "REQ-DRV-023: checks a connected Drive by
itself on arrival", "keeps a comparison it already holds instead of
re-scanning".

## REQ-DRV-024 — Stop is acknowledged the moment it is pressed

**WHEN** somebody presses Stop during a backup or restore, the system
shall immediately disable the button and say the job is stopping; the
job then halts at its next checkpoint — an upload slice, a streamed
download chunk, a packing step — and the song in flight is offered
again next run rather than counted as failed. **IF** the press changed
nothing on screen, **THEN** it reads as ignored and gets pressed again
and again — the shipped experience.
_Tests:_ `drive-sync-store` — "REQ-DRV-024: acknowledges Stop the
moment it lands"; `SyncSettings` — "REQ-DRV-024: says it is stopping
once Stop is pressed".

## REQ-DRV-025 — The bar moves through a song, not only between songs

**WHILE** a song is being uploaded or downloaded, the system shall move
the progress bar with the actual bytes on the wire and show the moved /
total figures beside the song count. Uploads split the per-song bar
evenly between packing and pushing (neither side dominates on every
connection); downloads stream, so the bar moves inside a part rather
than jumping once per part. **IF** the bar only moved at coarse
boundaries, **THEN** a big song on a slow connection reads as a hang —
the difference between "slow" and "stuck" is numbers that move.
_Tests:_ `drive-sync-store` — "REQ-DRV-025: the bar and the bytes move
through one big upload", "REQ-DRV-025: a restore's bar moves inside a
part, not only between parts".

## REQ-DRV-026 — A restore is a choice, not all-or-nothing

**WHERE** the scan finds songs in Drive that are not on this device, the
system shall list them by name and size, every one chosen by default,
and restore exactly the chosen set — the everything-missing restore
stays one press. **IF** the only restore were the whole list, **THEN**
somebody with a hundred songs in Drive and room for five on a phone
could only decline the entire library.
_Tests:_ `drive-sync-store` — "REQ-DRV-026: restores only the chosen
songs, and keeps the rest on offer", "an empty choice starts no job at
all"; `SyncSettings` — "REQ-DRV-026: restores only what is ticked".
