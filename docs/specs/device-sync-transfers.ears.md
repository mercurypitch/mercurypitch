# Device Sync Transfers — EARS Requirements

Requirements for what the sync follow-ups added on top of the base
transfer protocol: the packing notice, a received song arriving playable,
the multi-send queue, session-state hygiene, and the send list. The base
protocol (manifest + hashed parts, pull, retry, timeouts) is specified by
its tests in `sync-protocol.test.ts`; this file covers the behaviours
layered onto it by `docs/plans/device-sync-followups.md`.

**Source:** `src/stores/sync-store.ts` — the queue, the transfer rows and
the interlock; `src/lib/sync/sync-protocol.ts` — the two frames;
`src/db/services/portable-bundle-service.ts` — import hydration;
`src/components/sync/SyncDevicesModal.tsx` — the send list
**Tests:** mapped per requirement below, in
`src/tests/sync-store.test.ts`, `src/tests/sync-protocol.test.ts` and
`src/components/__tests__/SyncDevicesModal.test.tsx`; crossed end to end
by `src/e2e-devices/device-sync.spec.ts` (two real browsers, not in CI —
see `docs/agent/TWO-DEVICE-E2E.md`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## The packing notice — `REQ-SYNC-001..008`

`sync-offer` carries the manifest, and the manifest cannot exist until
every stem is re-encoded — tens of seconds in which the receiving screen
used to show nothing at all.

### REQ-SYNC-001 — Announce before packing, after the checks

**WHEN** a send passes its pre-flight checks, the system shall send
`sync-preparing` BEFORE `buildPortableBundle` starts. **IF** a check
refuses the send first, **THEN** no announcement shall be made, so no
retraction is ever owed for a send that never began.
_Tests:_ `sync-store` — "announces before it starts packing, not after";
"promises nothing when it refuses before packing".

### REQ-SYNC-002 — Retract when the promise cannot be kept

**WHEN** packing throws, is torn down mid-pack, or the post-pack room
check refuses once the real byte count is known, the system shall send
`sync-cancelled` for that song. **IF** it did not, **THEN** a receiver
that heard "preparing" would wait for ever.
_Tests:_ `sync-store` — "retracts the promise when packing throws".

### REQ-SYNC-003 — The receiver shows work without inventing a number

**WHILE** a `sync-preparing` row is open, the receiving system shall show
the song as being prepared WITHOUT a percentage — the sender does not
stream pack progress (one frame in, one frame out, by design), and 0% of
a thing that has not started is a number pretending to be information.
_Tests:_ `sync-store` — "shows the far device working, without inventing
a percentage".

### REQ-SYNC-004 — Preparing must not block the offer it announces

**WHILE** a preparing row is open, the receiving system shall NOT set the
transfer interlock (`syncBusy`) — the offer that follows is the same
song, and a busy receiver refuses offers.
_Tests:_ covered by every preparing → offer test reaching
"transferring"; the guard is documented at the `sync-preparing` handler.

### REQ-SYNC-005 — One row per song, start to finish

**WHEN** the offer for an announced song arrives, the system shall turn
the preparing row into the transferring row rather than adding a second.
_Tests:_ `sync-store` — "replaces that row with the transfer rather than
adding a second".

### REQ-SYNC-006 — A cancellation only kills what is still preparing

**WHEN** `sync-cancelled` arrives for a song still preparing, the row
shall fail with the sender's reason. **IF** the same frame arrives late,
after the transfer has started moving, **THEN** it shall change nothing —
a cancellation is a retraction of a promise, not a kill switch for a
transfer that superseded it.
_Tests:_ `sync-store` — "ends the row when the far device gives up";
"does not let a late cancellation undo a song already moving".

### REQ-SYNC-007 — A departed packer closes its rows

**WHEN** the peer leaves WHILE any of its songs are still preparing, the
receiving system shall fail those rows with the reason, so nothing waits
on a device that is gone.
_Tests:_ `sync-store` — "closes the row when the packing device leaves".

### REQ-SYNC-008 — Old builds drop the new frames unharmed

**WHEN** a build receives a frame type it does not recognise,
`isSyncWireMessage` shall reject it and the transfer machinery shall
ignore it, so adding frames is forward-compatible by construction — a
device on an older build simply shows no preparing state.
_Tests:_ `sync-protocol` — "lets a build recognise the frames it knows
and drop the rest"; "does not let an unknown frame disturb a transfer in
flight".

## A received song plays — `REQ-SYNC-009`

### REQ-SYNC-009 — Import ends with URLs a player can load

**WHEN** an import completes, `session.outputs` shall hold object URLs
hydrated from the stored blobs — never the blob table's row ids. **IF**
reading the stems back fails, **THEN** the import shall fail loudly and
roll back rather than register a song that cannot play. (The shipped
regression: a row id in `outputs` made `ensureSessionHydrated` take its
remote-stem branch, and the song would not play until a reload.)
_Tests:_ `sync-protocol` — "leaves the arrived song with URLs a player
can load"; crossed for real by `e2e-devices/device-sync.spec.ts`, which
also checks the stored stems are non-empty and smaller than the source.

## Sending several songs — `REQ-SYNC-010..015`

A queue of the bundles we already have, not an archive: partial success,
per-song decline and flat memory are the design (plan §B, decision S1).

### REQ-SYNC-010 — One at a time, in the order chosen

**WHEN** several songs are queued, the system shall send them strictly
one at a time, in the order they were chosen, through the same
`sendSongToPeer` a single send uses.
_Tests:_ `sync-store` — "sends them one at a time, in the order they
were chosen".

### REQ-SYNC-011 — Queueing is idempotent

**WHEN** songs are enqueued WHILE already queued, the system shall ignore
the duplicates, so pressing Send twice on the same selection sends
nothing twice.
_Tests:_ `sync-store` — "does not send the same song twice for pressing
Send twice".

### REQ-SYNC-012 — One failure does not cost the rest

**WHEN** a queued song fails, the system shall keep its reason on that
song's row and continue with the next — one unreadable stem must not
cost somebody the other five songs (decision S2).
_Tests:_ `sync-store` — "keeps going when one song fails".

### REQ-SYNC-013 — A departed peer stops the queue

**WHEN** the peer leaves WHILE songs are waiting, the system shall drop
the remainder and say so — a device that left will not take song five
(decision S3).
_Tests:_ `sync-store` — "stops when the other device leaves, and says
so".

### REQ-SYNC-014 — Stop keeps the song already in flight

**WHEN** the queue is stopped, the system shall drop only what is still
waiting; the song in flight is already half sent and completes.
_Tests:_ `sync-store` — "drops what is still waiting when asked to
stop".

### REQ-SYNC-015 — Ending the session forgets the queue

**WHEN** the sync session ends, the system shall clear the queue along
with the rest of the session state.
_Tests:_ `sync-store` — "forgets the queue when the session ends".

## Session-state hygiene — `REQ-SYNC-016..017`

### REQ-SYNC-016 — A dead device's figures die with it

**WHEN** the sync session ends, the system shall forget the far device's
label and its free-space reading. **IF** the reading survived, **THEN**
every song larger than the OLD device's allowance would be refused
against a device that is no longer there — which is the first bug the
first real two-device run found.
_Tests:_ `sync-store` — "forgets it when the session ends"; "does not
judge the next device by the last one".

### REQ-SYNC-017 — Every refusal releases the interlock

**WHEN** a send ends — completed, refused at any of its pre-flight
checks, or failed — the system shall release `syncBusy`. **IF** any path
kept it, **THEN** the modal would wedge with every control disabled.
_Tests:_ `sync-store` — the "every way a send can be refused" table;
"releases it after a send that goes all the way through".

## The send list — `REQ-SYNC-018..022`

### REQ-SYNC-018 — Only songs that can travel are offered

The send list shall offer only completed sessions that carry a content
hash — the hash is the song's identity on the far device, and without it
dedupe cannot answer "already have it".
_Tests:_ `SyncDevicesModal` — "offers only songs that carry a content
hash".

### REQ-SYNC-019 — The list renders with songs in it

**WHEN** the send list mounts on a device with songs, it shall render
them — pinned specifically because the memo-ordering regression threw
only when songs were present (`[].filter` calls nothing), so an
empty-library test proves nothing here.
_Tests:_ `SyncDevicesModal` — "mounts with songs to send"; "mounts with
no songs at all".

### REQ-SYNC-020 — A song that cannot fit sinks and loses its checkbox

**WHILE** the far device reports too little room for a song, that song
shall sink below the ones that fit, lose its checkbox and keep only its
size note — the list reads as "these will fit", not as a minefield. A
device that reports nothing refuses nothing.
_Tests:_ `SyncDevicesModal` — "sinks a song the far device has no room
for, and takes its checkbox away".

### REQ-SYNC-021 — The footer queues; it does not send

**WHEN** "Send N songs" is pressed, the system shall enqueue the picked
songs in one call and clear the selection; per-song sends from the
footer would defeat the queue's ordering and dedupe.
_Tests:_ `SyncDevicesModal` — "queues the ticked songs rather than
sending each one itself".

### REQ-SYNC-022 — Room is checked once, against the whole selection

**WHEN** the picked songs together exceed the far device's reported
room, the system shall disable the footer and say so BEFORE anything
packs. **IF** room were checked per song only, **THEN** a device with
space for two of six would accept two and refuse four, one error at a
time, each arriving after minutes of packing.
_Tests:_ `SyncDevicesModal` — "refuses a selection that will not fit,
before anything packs".

### REQ-SYNC-023 — A group is the playlist

**WHERE** groups exist that contain sendable songs, the list shall offer
them as filters; **WHEN** one is chosen, only its songs are listed, so
filter-then-Select-all is "send this playlist" with no new concept and
nothing new to store.
_Tests:_ `SyncDevicesModal` — "filters the list to one group, and back".

## What the first real four-song run taught — `REQ-SYNC-024..026`

### REQ-SYNC-024 — A dead link stops the queue

**WHEN** a send is refused by the link itself — no peer connection, a
relayed route, a channel that closed — WHILE songs are waiting, the
system shall drop the remainder and say the rest were not sent. **IF**
it kept going, **THEN** every remaining song would fail with the same
message one at a time, which is what four VPN refusals in a row looked
like. A song that fails for its OWN reasons (unreadable stem, no room
for that one song) still does not stop the rest (REQ-SYNC-012).
_Tests:_ `sync-store` — "REQ-SYNC-024: stops the queue when the link
itself is the failure"; the `SendResult` classification on
`sendSongToPeer` is the mechanism.

### REQ-SYNC-025 — The history must not bury the modal

**WHILE** transfer rows accumulate, the modal shall keep every control
reachable — the row list scrolls on its own and the modal body scrolls
inside its height cap — and **WHERE** any row is finished (done,
already, failed), the system shall offer to clear the finished rows
WITHOUT closing the modal, because closing it ends the sync session.
Rows still moving survive a clear.
_Tests:_ `sync-store` — "REQ-SYNC-025: sweeps finished rows and keeps
one still moving"; `SyncDevicesModal` — "REQ-SYNC-025: offers Clear
finished only when something has finished". The scroll itself is CSS
(`min-height: 0` on the modal body — a flex child's min-height is its
content height, so without it the body never engages its own overflow
and four finished rows push the modal past the bottom of a phone).

### REQ-SYNC-026 — A scan is the whole request

**WHEN** the app opens with a scanned sync code stashed (`#/sync:CODE`),
the system shall open the sync modal itself, which then skips the
chooser and joins with the code unprompted. **IF** the code merely sat
stashed, **THEN** the scan would land on the Karaoke tab and do nothing
visible until somebody happened to press the sync button — which is
exactly how it shipped first.
_Tests:_ `UvrPanel` — "REQ-SYNC-026: opens the sync modal without
another press" / "leaves the modal closed when nothing was scanned";
the Karaoke Night page's half is REQ-SKL-011.

### REQ-SYNC-027 — The queue is popped from the present, not a capture

**WHEN** a song is enqueued WHILE the drain is napping on the busy
interlock, the system shall still send it. **IF** the drain popped a
queue captured before its nap, **THEN** the write-back would overwrite
the newer queue and the song would vanish without a send, a transfer
row, or an error — the person just watches their "more waiting" note
disappear.
_Tests:_ `sync-store` — "REQ-SYNC-027: keeps a song queued while the
drain waits its turn".

### REQ-SYNC-028 — "Already here" is only honest with stems on disk

**WHEN** an incoming song's content hash matches a completed local
session, **IF** that session's stem blobs are absent from IndexedDB,
the import shall clear the ghost row (the full strict cascade) and
accept the transfer instead of declining "already-here". **IF** it
declined over an unplayable row, **THEN** the only good copy would stay
stranded on the other device — a torn local delete would permanently
block both the peer transfer and the Drive restore of that song
(REQ-DRV-020 is the scan-side half). A presence answer of `unknown`
still declines: importing over a session whose stems merely could not
be read would duplicate it.
_Tests:_ `sync-protocol` — "REQ-SYNC-028: replaces a hash match whose
stems are gone, instead of declining".
