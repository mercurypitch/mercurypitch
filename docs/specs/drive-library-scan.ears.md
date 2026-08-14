# Drive Library Scan — EARS Requirements

What the Drive scan must count, pinned after the first real connect
reported a full library as "0 songs in Drive — everything matches" and
offered no way to back anything up. Shares the `REQ-DRV` namespace with
`drive-connect-redirect.ears.md` (001..007).

**Source:** `src/stores/drive-sync-store.ts` — `localSongs()` and
`scanDrive()`; `src/stores/uvr-store.ts` — `whenSessionStoreReady()`
**Tests:** `src/tests/drive-sync-store.test.ts`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## REQ-DRV-010 — The scan counts songs, not minted URLs

The scan shall count every completed session that carries a content
hash, whether or not its `outputs` URLs exist — those are minted lazily
the first time a song is played, and a session loaded from the database
carries none at all. **IF** the scan required them, **THEN** every
unplayed song would be invisible after a reload and a full device would
answer "nothing here to back up" — which is the shipped bug. Packing
reads stems from the database itself, so a minted URL proves nothing the
backup needs. The filter is the peer send list's filter (REQ-SYNC-018),
deliberately.
_Tests:_ `drive-sync-store` — "REQ-DRV-010: counts a completed hashed
song this page never played"; the no-hash rule stays pinned by "ignores
songs this device cannot actually send".

## REQ-DRV-011 — The scan waits for the library to load

**WHEN** a scan is requested WHILE the session store is still loading
from IndexedDB, the system shall wait for the store before comparing.
**IF** it compared at once, **THEN** the scan that runs automatically on
the way back from the OAuth redirect — the very first scan a person ever
sees — would read a cache that is merely empty SO FAR and report nothing
to back up.
_Tests:_ `drive-sync-store` — "REQ-DRV-011: waits for the library to
finish loading first".
