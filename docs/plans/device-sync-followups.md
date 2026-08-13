# Device sync: the next round

Written 2026-08-13, after the first real two-device run on dev.

Phase 5 of [device-sync.md](device-sync.md) shipped and songs cross between
two devices. What follows is what the first real use of it surfaced —
one bug (fixed in this PR), three product gaps, and an honest account of
what our tests do and do not prove.

The parent plan stays the source of truth for the architecture. This one
is narrow: it covers only what comes next, and it stops where the parent
picks up again.

## 0. What the first run found

**Fixed here — a dead device's storage figure outlived it.** `resetSync`
cleared the peer's label but not `syncPeerRoom`, so closing a session and
pairing with a second device left the FIRST device's free-space reading in
place until the new one's `sync-hello` arrived. In that window the modal
showed the wrong number, every song larger than the old device's allowance
was marked "too big for that device", and `sendSongToPeer` refused against
a figure belonging to a television that had already gone. `onPeerLeft`
always cleared both; ending the whole session did not. Two tests in
[sync-store.test.ts](../../src/tests/sync-store.test.ts) fail without the
fix.

**Observed, not yet chased — a received song needs a moment before it will
play.** Reported after three successful sends; all three played correctly
once the view was refreshed. Nobody has measured it, and a fix designed
before a measurement is a guess. Phase F below is the measurement.

**Reported, and the subject of Phase A — the receiver is silent while the
sender packs.** Covered in full below.

## A. Tell the receiver something is coming

### Why it is silent

`sync-offer` is the first frame the receiver ever hears about a song, and
the offer carries the manifest — which cannot exist until the bundle is
packed, because the manifest is the parts list with a SHA-256 per part.
Packing is a full decode and re-encode of every stem: tens of seconds on a
desktop, longer on a phone.

So the sequence today reads, from the receiving device:

| Sender                                      | Receiver sees           |
| ------------------------------------------- | ----------------------- |
| Send pressed, route checked, packing begins | nothing                 |
| …30–90 seconds of encoding…                 | nothing                 |
| `sync-offer`                                | "Receiving _Song_ — 0%" |

The receiver's screen is correct at every instant and misleading over the
whole minute: somebody watching it has no way to tell "working" from
"nothing happened".

### The frames to add

```ts
| { type: 'sync-preparing'; fileHash: string; title: string; estimatedBytes?: number }
| { type: 'sync-cancelled'; fileHash: string; message?: string }
```

`sync-preparing` goes out immediately **after** the pre-flight checks pass
and immediately **before** `buildPortableBundle`. Placing it after the
checks is deliberate: a route refusal or a known-full receiver aborts
before any promise is made, so those paths need no retraction.

`sync-cancelled` covers the paths that remain — the pack throwing, the
session being torn down mid-pack (`packAbort`), and the post-pack checks
that can still refuse once the real byte count is known. Without it, a
receiver that heard "preparing" and then nothing waits for ever.

Progress during packing is deliberately **not** streamed. The sender knows
its own encode ratio, but a frame every 250 ms buys a smoother bar in
exchange for chatter on a channel that is about to carry the song itself.
One frame in, one frame out; the offer replaces the preparing state.

### Old builds are already safe

`isSyncWireMessage` matches against an explicit allowlist, so a device on
an older build silently drops an unrecognised frame and the transfer
proceeds exactly as it does today — no preparing state, but no error
either. Adding frames is forward-compatible by construction. Worth a test
that pins this, because it is the property that lets the wire grow.

### Receiver state

A new `SyncTransfer.status`: `'preparing'`, rendered as _"Computer is
preparing “Song” — this can take a minute"_ with an indeterminate bar. The
existing `transferStateLabel` and the `Show` guarding the progress bar in
[SyncDevicesModal.tsx](../../src/components/sync/SyncDevicesModal.tsx)
both need the new case; the bar should read indeterminate rather than 0%,
because 0% of a thing that has not started is a number pretending to be
information.

### Tests

Over the in-memory pipe, in `sync-protocol.test.ts`:

- preparing → offer: the receiver's transfer moves from preparing to
  transferring without a second row appearing
- preparing → cancelled: the row resolves and `syncBusy` is released
- preparing → the channel dies: the receiver does not wait for ever
- an unknown frame type from a newer build is ignored, and the transfer
  that follows still completes

## B. Send more than one song

### The container question, answered first

The obvious reading of "select several songs, zip them, unzip on the other
side" is the wrong shape here, and it is worth saying why before any code
is written.

The bundle format is already a manifest plus independently hashed parts,
pulled one at a time. That buys three things a zip would take away:

1. **Partial success.** Six songs sent as six bundles means a link that
   dies at song four leaves three songs playable on the far device. One
   zip is all-or-nothing.
2. **Per-song deduplication.** The receiver declines a song it already has
   (`sync-declined: already-here`) before a byte moves. Inside a zip it
   cannot decline anything without unpacking everything.
3. **Flat memory.** A zip has to be assembled somewhere before it is sent
   and unpacked somewhere before it is imported — peak disk on both sides
   is roughly double. The current protocol's whole point is that one part
   is ever in flight.

**So multi-send is a queue of the transfers we already have, not a new
container.** The work is in the store and the modal, and the wire protocol
does not change at all. (An archive format still has a place — it is what
`Export ZIP` already is, for moving a session through a file rather than
through a link.)

### The queue

In `sync-store.ts`:

```ts
const [syncQueue, setSyncQueue] = createSignal<string[]>([])
export function enqueueSongs(sessionIds: string[]): void
export function cancelQueued(sessionId: string): void
export function stopAfterCurrent(): void
```

Strictly sequential, draining through the existing `sendSongToPeer` — the
same reasoning that made single sends sequential (two songs interleaving
on one channel helps neither). `syncBusy` stays the interlock; the queue
just refills it.

Decisions this needs (see the table at the end): whether one song failing
stops the queue or is skipped, and what a peer drop does to the remainder.
The recommendation is skip-and-continue with a per-song reason kept on
screen, and a peer drop stopping the queue outright — a device that left
is not going to accept song five.

### Room, once, for the whole selection

The pre-flight room check currently runs per song. With a selection it has
to run against the sum, or a device with room for two of six songs accepts
two and then refuses four, one at a time, each with its own error. Sum the
estimates, compare once, and say plainly how many will fit.

### The selection UI

- A checkbox per row, a "Select all", and a footer that names the cost:
  _"Send 3 songs — about 74 MB"_.
- The per-row Send button stays for the one-song case; it is the fast path
  and removing it would make the common action slower.
- Progress reads as _"Song 2 of 5"_ above the current transfer's bar.

### Playlists come almost free

`sessionGroups` already exists in the database and every session already
carries its group, rendered as the "Group" row on the session card. A
"Send this group" action is then a selection source, not a new concept:
resolve the group to its session ids and enqueue them. This is the cheapest
version of "send a playlist" and it should be the one we build.

### Tests

- the queue advances on `done`, on `already`, and on `failed`
- `stopAfterCurrent` drains without killing the transfer in flight
- a peer leaving mid-queue stops it and says so
- the summed room check refuses the right subset
- enqueuing a group resolves to its members, and an empty group is a no-op

## C. The session card: compact by default

### What one completed card shows today

Counted from [UvrSessionResult.tsx](../../src/components/UvrSessionResult.tsx)
and [UvrSessionActions.tsx](../../src/components/UvrSessionActions.tsx):

| Region          | Controls                                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Header          | Delete, Copy share link                                                                             |
| Info            | Created, On this device                                                                             |
| Group           | group dropdown                                                                                      |
| Stem pills      | Vocal (+ re-index sub-button, Shazam badge, duration), Inst (+ duration), MIDI                      |
| Stem management | add/replace vocal, add/replace instrumental                                                         |
| Actions         | View Results, Play along (dropdown), Mix, Original, Export ZIP, Send, HQ (dropdown, 2 items), Retry |

Up to **eight controls in the action row alone** and around fourteen
interactive targets on a single card — before the page shows the second
one. Every button added since has been added to the same row, which is how
a row becomes a wall.

### Three tiers

**Always visible.** Title, group chip, size, a read-only stem summary with
durations, status, and exactly one primary action — _View Results_ while
completed, _View Progress_ while processing, _Retry_ when it failed. One
card should be scannable in a second and stackable ten to a screen.

**One tap away, behind an overflow menu.** Play along, Mix, Send to device,
Download original, Export ZIP, HQ re-run, Assign group, Copy share link,
and — separated, at the bottom — Delete.

**Expanded, behind "Show more".** Stem management (add/replace), the
re-index control, the session id, provider and processing time. These are
the controls somebody goes looking for; none of them is ever the reason a
card is on screen.

### Rules the redesign has to keep

- **Reuse the menu we have.** `AppNavOverflowMenu` exists and
  `UvrSessionActions` already carries a second, hand-rolled menu with
  outside-pointer and Escape handling. Extract one and delete the other —
  a third implementation is how the Escape key stops working on one of
  them.
- **The stem pills are currently the selection UI.** They double as the
  mix selection, which is why _Mix_ appears and disappears. In the compact
  tier they become informational, and selection moves into the Mix flow or
  the expanded tier. This is the one behavioural change in the redesign
  and it needs its own test.
- **Destructive last, and separated.** Delete sits below a divider.
- **Keyboard and screen readers.** `aria-haspopup="menu"`, roving focus on
  arrow keys, Escape closes and returns focus to the trigger.
- **The phone is the primary surface.** Targets at least 44 px; under
  `isNarrow()` from [use-viewport.ts](../../src/lib/use-viewport.ts) the
  overflow becomes a bottom sheet rather than a popover that runs off the
  edge.

### The risk, and how to take it

`UvrSessionResult.tsx` is 898 lines and its CSS is global — `session-result-btn`,
`stem-pill`, `info-grid` and friends have no module boundary and no single
owner. The repo has already been bitten by deleting a global selector with
users elsewhere.

So: move markup in stages behind the existing component, keep every class
name until the last step, and grep each selector across all `.tsx` before
removing it. The redesign is a sequence of small commits, not a rewrite.
It is also the moment to take the top off the file before it earns a place
in [REFACTOR-PLAN.md](../agent/REFACTOR-PLAN.md) — its parent `UvrPanel.tsx`
is already on that list at 2,641 lines, and the card is where the parent's
next thousand would land.

## D. Polish on the send surface

Smaller than the above, and worth doing alongside B since they touch the
same modal:

- The song list is unsorted and unsearchable. At twenty songs it is a
  scroll; at a hundred it is unusable. Sort by most recent, and add a
  filter box once selection exists.
- Songs too big for the far device are marked but still listed among the
  rest. Group them, or sink them, so the list reads as "these will fit".
- The Send buttons carry a `Share` icon; the feature is called Send to
  device and has its own `DeviceSync` icon on the session card. Use one.
- Nothing on the sending device says what the receiving device is called
  until it has connected, so the pre-connection screen cannot say what you
  are about to send to.

## E. What our tests prove, and what they do not

### What is covered now

| File                                                                | What it holds down                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/tests/sync-protocol.test.ts`                                   | both halves of the wire protocol over an in-memory pipe           |
| `src/tests/jam-song-transfer.test.ts`                               | chunking, backpressure, route classification                      |
| `src/tests/sync-store.test.ts`                                      | the store's state machine against a faked peer                    |
| `src/tests/session-size.test.ts`                                    | what the size chip reports                                        |
| `src/tests/sync-room-code.test.ts`, `src/tests/hash-router.test.ts` | codes and deep links                                              |
| `src/tests/qr-code.test.tsx`, `PhoneSignIn`, `DeviceLinkModal`      | the QR halves                                                     |
| `workers/db-worker/src/auth.test.ts`                                | device-link start/poll/approve, including the security properties |

That is good coverage of every piece **in isolation**.

### The gap

Every one of those fakes either the peer or the channel. **Nothing
automated has ever moved a song across two real `RTCPeerConnection`s.**
The bugs found by hand this week — ICE not yet settled being read as a
relay, a stale storage figure surviving a session — both live precisely in
the seam that the isolated tests do not span.

### It is buildable

The [jam-two-peer](../../.claude/skills/jam-two-peer/SKILL.md) skill already
solves the hard parts: two `chromium.launch()` instances (contexts share a
network process and never connect), a local jam worker with the test origin
allowed, and a plain-HTTP build so there is no certificate interstitial.
Sync rides the same signaling, so the recipe transfers unchanged.

The one missing piece is a song on the sender. Two options:

- **(a) A fixture bundle imported through `importPortableBundle`.** A
  two-second stem pair, committed as a fixture, imported through the
  production path. Preferred: the fixture loading at all is itself proof
  the import path works.
- **(b) Writing Dexie rows directly from `page.evaluate`.** Faster to
  write, and it asserts against a library state the app never actually
  produces.

Proposed `src/e2e/device-sync-two-peer.spec.ts`, kept out of the default
Playwright project because it needs `wrangler dev`:

1. sender imports the fixture song
2. receiver opens Karaoke → sync → Receive, and the code is read from the DOM
3. sender joins with that code and sends
4. on the receiver: the transfer row reaches done, the session appears in
   the library, and its size chip is not zero
5. both consoles logged `[sync] route to peer: direct`

**And a cheaper one first: QR sign-in.** It needs no WebRTC at all — a TV
context and a phone context against `pnpm dev:db` — and it covers the more
security-sensitive flow. Assert that the code alone does not yield a
session, which is the property the worker tests already check and the
integration never has.

### Cheaper still, before either

- **A property test over the protocol.** Randomise the corrupted part, the
  drop point and the frame ordering; assert the transfer always reaches
  exactly one terminal state and never leaves `syncBusy` stuck true. Both
  of this week's bugs were state-machine bugs.
- **A table-driven test that every refusal path in `sendSongToPeer` clears
  `syncBusy`.** Six of its early returns sit inside the `try` and depend on
  the `finally` to release the interlock; a seventh added outside it would
  wedge the modal with every control disabled.
- **The timeouts.** `SENDER_SILENCE_MS` and `PART_STALL_MS` have no test.
  They are the difference between a failure and a hang.

## F. The hydration delay — DONE, and it was not a delay

Measuring first was the right call, and it closed itself.

`importPortableBundle` wrote the blob table's ROW ID into
`session.outputs`, where every other path in the app holds a playable
URL. A row id is neither `blob:` nor http, so `ensureSessionHydrated`
took its "remote stems don't die with the page" branch, returned the
session untouched, and the mixer was handed a database id as an audio
source. Reloading fixed it because the panel re-hydrates every completed
session on load — which is why it read as "needs time to hydrate" and
"all could be loaded normally after refreshing the view".

The import now points `outputs` at the object URLs `hydrateStemUrls`
builds from the stored blobs, and rolls back if they cannot be read
back. The split timings went in anyway — pull, verify, write, hydrate,
prep, record — because four candidates were plausible here and only
measuring told them apart. They stay for the next surprise.

## Order

1. ~~**A** — the receiver's packing state.~~ Done.
2. ~~**F** — measure hydration.~~ Done; it was a bug, see above.
3. ~~**E's cheap tests** — property test, the `syncBusy` table, the
   missing timeout.~~ Done.
4. ~~**C** — the card redesign, in stages.~~ Done: the shared overflow
   menu, the compact card, and §D's send-surface polish all landed. It had
   to come before B, because B adds selection to a surface that could not
   have taken another control.
5. ~~**B** — multi-select, the queue, and group send.~~ Done. The queue
   lives in `sync-store`; a group filter plus Select all is what "send a
   playlist" turned out to be.
6. **E's two-peer specs** — QR sign-in first, then song transfer. The only
   part still open, and the one that matters most: every sync test so far
   fakes either the peer or the channel, and both bugs found by hand lived
   exactly where nothing automated has ever looked.

## Decisions

| #   | Question                                      | Recommendation                                                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Zip several songs, or queue several bundles?  | **Queue.** Partial success, per-song decline, flat memory — see §B                                                                                                                                                                                                                                                 |
| S2  | Does one failed song stop the queue?          | Skip and continue, with the reason kept on screen                                                                                                                                                                                                                                                                  |
| S3  | What does a peer drop do to the queue?        | Stops it. A device that left will not take song five                                                                                                                                                                                                                                                               |
| S4  | Do stem pills stay the mix-selection control? | **Revised — yes, they stay.** The user named "stems" as compact metadata, and the pills already are it; making them read-only would have cost the Mix flow its only selection UI and bought nothing. What actually moved out of the compact tier: the group picker, add/replace stem, re-index, and the session id |
| S5  | Is the two-peer e2e in CI?                    | Not at first. It needs `wrangler dev`; run it as a script until it is boring                                                                                                                                                                                                                                       |
| S6  | Stream pack progress to the receiver?         | No. One `sync-preparing`, one `sync-offer`                                                                                                                                                                                                                                                                         |
