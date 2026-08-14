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
