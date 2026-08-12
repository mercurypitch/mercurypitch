# Cross-Device Library Sync

**Date**: 2026-07-26 · **Revised**: 2026-08-12 · **Status**: proposed, re-sequenced
against what the jam room shipped in the meantime (research complete, decisions
partly locked)

## Context

A user separates and prepares karaoke songs on the desktop app: stems, lyrics,
word timings, pitch analysis, playlists with singer names. None of that is on
their phone. To sing in the car they must currently export a ZIP, move it by
hand (AirDrop/USB/Drive), and re-import it in mobile Chrome.

Uploaded audio is user-supplied copyrighted material, so **the audio must never
transit or rest on our servers**. That constraint is already encoded in
`src/db/adapters/hybrid-adapter.ts`: _"Audio data is huge and never syncs to the
cloud by design."_

This plan covers making the phone copy of a library appear with as little
friction as possible, under that constraint, in a way that survives the
Capacitor wrap planned in [mobile-native/](mobile-native/README.md).

## What already exists

The starting position is stronger than it looks:

| Asset                          | Where                                           | Notes                                                                                                                                                                                                                                  |
| ------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versioned bundle format        | `src/db/services/session-export-service.ts`     | `session.json` + original + stems + lyrics + Whisper transcription + pitch analysis, plus `karaoke.json` (playlists, groups, singers, play modes). Import remaps IDs. Round-trip tested in `src/tests/karaoke-playlist-import.test.ts` |
| WebRTC P2P transport           | `src/lib/jam/service.ts`, `signaling.ts`        | RTCPeerConnection lifecycle, DataChannels, glare resolution, ICE buffering                                                                                                                                                             |
| Signaling relay + room codes   | `workers/jam-worker/`                           | `newRoomId()` already emits typeable codes with no `0`/`O`/`1`/`I`                                                                                                                                                                     |
| Invite UX (code + link + copy) | `src/components/jam/JamInviteModal.tsx`         |                                                                                                                                                                                                                                        |
| Google Sign-In                 | `src/db/services/auth-service.ts:234`           | Full redirect flow through db-worker (COOP breaks popups)                                                                                                                                                                              |
| Cloud/local entity split       | `src/db/adapters/hybrid-adapter.ts`             | `CLOUD_ENTITIES` allowlist against D1 via db-worker                                                                                                                                                                                    |
| Per-song content hash          | `UvrSessionRecord.fileHash` (`entities.ts:270`) | SHA-256 — free dedupe and resume                                                                                                                                                                                                       |
| Storage quota pre-flight       | `hasRoomFor()` (`src/db/durable-write.ts`)      |                                                                                                                                                                                                                                        |
| Platform seam                  | `src/lib/platform/index.ts`                     | The established pattern for anything that differs web vs native                                                                                                                                                                        |
| Mobile karaoke stage           | `src/components/KaraokeMobileStage.tsx`         |                                                                                                                                                                                                                                        |

**We do not need to design a sync payload. It exists and is tested.**

## What shipped since this plan was written (verified 2026-08-12)

Sharing a song with a jam room needed the same primitives as sync, so most of
the transport half of this plan is already in production and tested on real
phones. Verified against `origin/main` today, not assumed:

| Plan called for                                         | Where it now lives                                                    | State                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1's portable-audio encoder                        | `src/lib/jam/stem-encoder.ts`                                         | **Done.** AAC-in-MP4 at `STEM_BITRATE = 128_000` — the exact default tier this plan chose. WebCodecs with a `@mediabunny/aac-encoder` wasm fallback (Firefox on every platform, older Safari), decoded at the source's own sample rate, fed in slices that respect encoder backpressure, with progress and cancellation |
| A packed bundle with per-part hashes                    | `src/lib/jam/jam-song-share.ts`                                       | **Done.** `EncodedStem { stem, bytes, sha256, mime }`, `encodeStemsForShare` packs once and caches by key, `getPackedStems` / `forgetPackedStems`                                                                                                                                                                       |
| Phase 5's chunking and backpressure                     | `src/lib/jam/jam-song-transfer.ts`                                    | **Done.** `TransferHeader` (transferId, stem, bytes, sha256, mime), `sendInChunks`, `chunkCount` / `chunkRange`, `sha256Hex`                                                                                                                                                                                            |
| Phase 5's "detect a relay and refuse"                   | `isRelayedConnection()` in the same file                              | **Done**, and enforced before a byte moves                                                                                                                                                                                                                                                                              |
| Phase 5's blocker: sync must never ask for the mic      | `openLocalStream()` / `startLocalAudio()` in `src/lib/jam/service.ts` | **Gone.** Entering a room now creates an empty `MediaStream`; the microphone is captured only when somebody unmutes. A data-only WebRTC path is an extraction, not a refactor                                                                                                                                           |
| A transport seam                                        | `ShareTransport` + `shareStemsWithPeers` in `jam-song-share.ts`       | **In miniature.** Two methods (`sendMessage`, `nextTransferId`) and a driver that walks targets one at a time                                                                                                                                                                                                           |
| "`fflate.zip()` builds the whole archive in RAM"        | `StreamingZipArchive` in `session-export-service.ts`                  | **Half fixed.** The writer compresses one stream chunk at a time; compressed output still accumulates until the final Blob, and the reader is still a one-shot `unzipSync`                                                                                                                                              |
| The offline shell (listed as a dependency, not a phase) | `src/sw.ts`, `src/lib/pwa-service-worker.ts`                          | **Done.** Shell precache + install prompt shipped                                                                                                                                                                                                                                                                       |

Consequences for the phasing below: Phase 1 shrinks to promoting code that
already exists out of `lib/jam/`, and Phase 5 shrinks to extracting a data-only
path from a service that no longer demands a microphone. **The remaining work is
mostly Phases 2, 3 and 4 — the seams, the manifest, and Drive.**

What has _not_ moved, also verified today:

- `uvrSessions`, `uvrStemBlobs`, `karaokePlaylists` and `sessionGroups` are still
  **local-only Dexie stores** — absent from `CLOUD_ENTITIES`
  (`src/db/adapters/hybrid-adapter.ts`) and from the worker's `TABLES`
  (`workers/db-worker/src/tables.ts`). `sessionRecords` (practice results) does
  sync; the song library does not. Phase 3 is untouched.
- No Drive scope anywhere in the repo. Google auth is still the redirect flow
  (`loginWithGoogle` / `googleSignInUrl`).
- No blob-store seam: audio is read straight out of Dexie
  (`src/db/services/uvr-read-service.ts`). Phase 2 is untouched.
- No Library or Sync tab. `TAB_SCOPES` in `src/features/tabs/constants.ts` has no
  home for this; the library lives inside the Karaoke tab today, and where the
  sync surface goes is an open question (see D7).

## Correcting a misconception: P2P bandwidth is not the blocker

Measured WebRTC data-channel throughput on a LAN averages **~18 MB/s**
(Eskola, below); tuned implementations reach 176–422 Mbps. At 18 MB/s:

| Payload                     | Transfer time |
| --------------------------- | ------------- |
| One song (~53 MB, lossless) | ~3 s          |
| 20 songs (~1 GB, lossless)  | **~60 s**     |

Moving gigabytes phone↔desktop over Wi-Fi is routine. The three real
constraints are all tractable:

1. **RTT sensitivity.** WebRTC's SCTP layer uses a default 128 KiB receive
   window, so throughput collapses as RTT rises. Same-Wi-Fi (1–5 ms) is fine;
   cross-internet (30–100 ms) is not. _"Both devices on the same Wi-Fi"_ is
   therefore a genuine product requirement — which matches the use case anyway.
2. **Current code would OOM a phone.** Partly addressed since: the export writer
   is now `StreamingZipArchive`, which compresses one chunk at a time. What
   remains is that compressed output accumulates until the final Blob, and
   import still inflates the whole archive in one `unzipSync()`. That is a
   desktop-download implementation choice, not a platform limit. Streaming
   per-file on the read side fixes it.
3. **TURN relay fallback.** If a direct connection fails, WebRTC silently
   relays through the free `openrelay.metered.ca` servers
   (`jam/service.ts:10`) — pushing a GB through a public relay. Sync must
   detect a relay candidate and refuse.

## The real constraint: where the bytes land

Reported per-origin storage quotas (iOS 17+):

| Host                              | Quota                         |
| --------------------------------- | ----------------------------- |
| Safari (browser)                  | large share of disk           |
| **WKWebView inside a native app** | **~15% of total disk**        |
| Chrome Android                    | up to ~60% of disk per origin |

Two consequences:

- **Capacitor does not fix the storage problem — it can make it worse.** An
  embedded WKWebView reportedly gets a _tighter_ origin quota than Safari does.
  Lift-and-shifting IndexedDB blob storage into the shell inherits that cap plus
  the same eviction rules.
- This refines `capacitor-readiness.md` **§B6**, whose stated mitigation is a
  Dexie→`@capacitor-community/sqlite` adapter. SQLite solves _metadata_
  durability but not _blob_ volume — a 1 GB audio library in a SQLite blob
  column inside the WebView container hits the same wall.

> **Architecture rule: audio bytes belong on the filesystem. IndexedDB/SQLite
> holds metadata only.**

On web that means keeping blobs in Dexie but behind a swappable interface. In
Capacitor it means `@capacitor/filesystem`, with chunked access — base64
round-tripping large files into the WebView OOMs above a few hundred MB
(`capacitor-file-chunk` exists for exactly this).

Deciding this **now** matters, because it shapes the storage code written over
the next month.

## Design: separate format, transport, and storage

Three seams, following the `src/lib/platform/` precedent (§A3) — components
never import a transport or storage backend directly:

```
        ┌─────────────────────────────────────────┐
        │  Bundle pipeline  (exists, needs        │
        │  streaming refactor)                    │
        │  producer: async iterator {path, blob}  │
        │  consumer: streamed import              │
        └───────────────┬─────────────────────────┘
                        │
     ┌──────────────────┼──────────────────┐
     ▼                  ▼                  ▼
  ManualFile         Drive              P2P
  (exists)        (Phase 4)          (Phase 5)
                        │
        ┌───────────────▼─────────────────────────┐
        │  Storage adapter                        │
        │  web: Dexie   native: Filesystem        │
        └─────────────────────────────────────────┘
```

Each transport is a small adapter over one pipeline. Native reuses all of it.

## What "the library" means, and where it lives (decided 2026-08-12)

**The library is the karaoke UVR sessions.** Not practice results, not jam
rooms: the separated songs a user has built up, with their stems, lyrics, word
timings, pitch analysis, and the playlists and singer names over the top. That
is what has to appear on a second device.

**Two surfaces, deliberately split:**

| Surface                             | What it holds                                                                                                  | Why there                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Karaoke tab**, beside the library | The actions: _sync library_, _send this song_, per-song state (on this device / in the cloud / syncing)        | It is where the library already is. A sync control that lives anywhere else is a control nobody finds     |
| **Settings → a new Sync subtab**    | The configuration: connect Google Drive, quality tier, what to keep on this device, storage used against quota | Configuration is not a per-song action, and Drive account linking belongs with the other account settings |

Sending one song to one person already exists — that is the jam room, over P2P,
and it stays where it is. **This plan is the library, not the song.**

## Quality provenance: a synced song is not the original (decided 2026-08-12)

A portable bundle is lossy by design, and the second device must never pretend
otherwise. Someone who separated a song at home and finds it degraded on their
phone with no explanation will conclude the separation is broken.

- The song manifest carries the tier it was synced at — `lossless`,
  `portable-192`, `portable-128` — alongside the original's `fileHash`.
- A song whose local stems came from a portable bundle is **visibly marked** in
  the library: not an error state, a provenance one ("synced copy, standard
  quality").
- Offer the way back, and be honest about what each costs: **fetch the
  full-quality bundle** from Drive or from the device that has it, or
  **re-separate** on this device or on the server.
- **Re-separating needs the original audio, which a portable bundle omits.** So
  on a phone holding only a portable copy, "upgrade" means _fetch_, not
  _re-run_ — unless the user hands over the source file again. This is a real
  constraint of the format, not an oversight, and the UI has to say which of
  the two it is offering.
- Drive therefore supports a **full-quality tier per song** (original + lossless
  stems), opt-in and off by default: the user's own 15 GB, their call. That is
  what makes "get the real thing on this device" a download rather than a
  re-separation.
- Server-side re-separation still uploads the source to RunPod, exactly as the
  existing separation flow does. That is a transient processing path the user
  invokes, not our servers holding a library — the copyright posture in
  **Context** is about storage and sync, and stays intact.

## Reachability: what actually needs the same Wi-Fi

Worth stating plainly, because "P2P" and "same network" get conflated:

- **Connectivity is not the problem.** WebRTC with STUN punches through most
  NATs, and where it cannot, `workers/jam-worker/src/turn.ts` mints short-lived
  Cloudflare Realtime TURN credentials and the connection relays. Two devices on
  different networks, different countries, connect today — the jam room does it.
- **Throughput is the problem.** SCTP's default 128 KiB receive window means
  throughput collapses as RTT rises: fine at 1–5 ms on one Wi-Fi, poor at
  30–100 ms across the internet. A single song is seconds either way; a whole
  library is not.
- **Relaying a library is the expensive problem.** TURN is our metered
  Cloudflare path now, not a free public one. Pushing an entire library through
  it is a bill, so bulk sync must require a direct candidate pair and say so —
  `isRelayedConnection()` already implements the check.

So: **cross-network P2P for a song, yes — it ships. Same Wi-Fi for a library.
Drive for everything else**, which is precisely why Drive is Phase 4 and P2P is
Phase 5.

## Measured on real devices (2026-08-12)

The first readings, from the Settings → Sync page shipped with the Phase 3 PR.
These replace the secondary-source quota figures this plan was built on, and
they change the conclusion.

| Device         | Reported quota | In use at the time          |
| -------------- | -------------- | --------------------------- |
| iPhone, Safari | **38 GB**      | 4 MB (demo songs only)      |
| Android        | **10 GB**      | 4.2 MB (demo songs only)    |
| Desktop        | **10 GB**      | 344 MB (two imported songs) |

**Capacity is not the constraint anywhere.** The headline worry — that an iOS
origin quota would be too small for a library — is false on the hardware we
have. 38 GB is more than the whole lossless library would need, let alone a
portable one. Note the shape of the number: ~15% of a 256 GB disk, which is
exactly the ratio the secondary sources reported. The figure was right; the
alarm drawn from it was not.

**A phone and a desktop reporting the identical 10 GB is a policy ceiling, not
a measurement.** Two machines with very different disks do not have the same
real limit; a browser reporting one figure for both is handing out a cap.
A Chromium preview on a Linux desktop reported 10.45 GB during the same
testing, so this is not one browser's quirk -- 10 GB-ish is what several
report. So treat 10 GB as "at least 10 GB", not as a budget, and do not read
the identical figures as evidence that two devices have the same headroom.

**Stored costs more than exported.** Two imported songs occupy 344 MB, about
172 MB each, while the owner's 10–20 song library exports to 1.3 GB — 65–130 MB
a song. Stored footprint therefore runs roughly 1.5–2.5× the ZIP, because a
session keeps the original plus every stem plus analysis. A real library on
disk is 2–3 GB, not 1.3.

This does not change the case for portable bundles; it strengthens it. AAC
128 kbps is ~1 MB per minute whatever the source was, so a 4-minute song is
~7.6 MB for both stems regardless. That library goes from 2–3 GB to roughly
115–150 MB.

### What this does and does not settle

- **D5 is de-risked for the web.** Audio can stay in IndexedDB on every browser
  measured. The `BlobStore` seam is still worth building in Phase 2 — for the
  native shell, and for chunked access — but not as an emergency.
- **The native case is still unmeasured**, and it is the one D5 was really
  about. These readings come from Safari the browser. An embedded WKWebView
  reportedly gets a tighter allowance, and that number can only be taken once a
  Capacitor build exists.
- **The real iOS risk is eviction, not capacity.** Safari's long-standing rule
  purges script-writable storage after roughly seven days without a visit, and
  home-screen web apps are the documented exemption. For a library that matters
  far more than a ceiling nobody will reach — losing it is precisely what sync
  exists to prevent. So **installing to the Home Screen is part of the sync
  story on iOS**, not a separate PWA nicety, and the Sync page should report
  whether persistent storage was actually granted rather than leaving
  `ensurePersistentStorage()`'s outcome invisible.
- **Confirmed on the device, 2026-08-12:** in Safari the persistence request
  was refused; after adding MercuryPitch to the Home Screen it was granted.
  So on iOS installing is not a nicety, it is the mechanism -- and it is
  reachable today via Share -> Add to Home Screen, with the side benefit of
  dropping the browser chrome. The Sync page says so on exactly the devices
  where it applies.
- **Still worth running:** leave an iOS install alone for a week or two with a
  song in it, and see whether it survives. That is the measurement that decides
  whether a phone can be trusted to hold a library at all.

## A TV is a third device class (added 2026-08-12)

Televisions are already first-class in the code: `classifyDevice()` returns
`'tv'`, `isTvDevice()` exists, and rendering, CSS and upload flows were adapted
for them in `07bbf838`. That makes "put my library on the TV" a transport
target, not a new product.

- A TV is the worst case for typing and the best case for a **room code plus
  QR** — which the jam worker already mints, in an alphabet with no `0`/`O`/
  `1`/`I`.
- A TV is also unlikely to sign into Google comfortably, so **the TV target is
  P2P-first**: push from the phone or the desktop that already has the library.
  This is a genuine argument for Phase 5 that Drive does not cover.
- TV storage is not a library's worth. Expect _stream one song now_ to matter
  more than _hold everything_, so the transport must support "send this one,
  play it, keep nothing".
- **The pairing half is specified and tracked**: issue #489, deferred from
  PR #488, written up in [tv-qr-handoff.md](tv-qr-handoff.md). TV shows a QR of
  the existing jam deep link, phone scans and joins, the shipped jam transfer
  moves the song — no accounts, no new transport. It composes with this plan
  rather than blocking on it: once the account list exists, the same pairing
  can also offer "your account's songs" on the TV.

### Why Google Drive before P2P

- **Asynchronous.** P2P needs both devices awake, on the same Wi-Fi, at the
  same moment. Drive does not — upload at home, pull in the car park. This is
  the single largest friction reduction available.
- **No security-assessment tax.** Per Google's scope documentation, `drive.file`
  is classified **non-sensitive** — access only to files the app created. That
  means basic app verification and **no CASA audit** (restricted scopes such as
  `drive.readonly` require an annual third-party assessment costing five
  figures). Use `drive.file`; never `drive.readonly`.
- **We already have the OAuth flow.** `loginWithGoogle()` / `googleSignInUrl()`
  are live. Drive is an added scope, not new infrastructure.
- **Per-song granularity is native to it** — resumable uploads, one bundle per
  song.
- **Copyright posture is clean.** User's own files in the user's own Drive; our
  servers never touch audio. Same posture as WhatsApp.

`drive.file` over `drive.appdata`: appdata is hidden from the user. `drive.file`
puts a visible `MercuryPitch/` folder in their Drive — they can see, back up,
and delete their own library. Same non-sensitive classification.

Note: WhatsApp's unlimited-Drive-backup deal ended in early 2024; backups now
count against the user's 15 GB. Ours will too — at transcoded sizes that is
~2,000 songs in the free tier, so not a constraint.

Implementation gotcha: browser resumable upload must use **XHR, not `fetch`** —
CORS blocks reading the `Location` header carrying the session URI.

iOS has no iCloud API reachable from web, so Drive stays the cross-platform
default. Do not build two cloud backends.

---

## Phases

Each phase is one or more `feat/*` PRs; every PR runs `pnpm check`.

### Phase 0 — Measure while building, not before (folded in)

**Decided 2026-08-12: this is no longer a separate phase.** There is no spare
afternoon to spend on a lab exercise, and the jam room has already carried
packed songs onto real iPhones and Android phones and played them, which
answers the "does the format work on a phone" half.

Instead, every phase ships the instrumentation it needs and the numbers come
back from the PR test:

- A dev-visible readout of `navigator.storage.estimate()` (usage and quota) on
  whatever device is running — this is the number D5 turns on.
- Real byte sizes logged per bundle at each quality tier, not estimates.
- The library-sync PR reports elapsed time and throughput per song.

The iOS quota figures above come from secondary sources — WebKit's storage-policy
post and Google's scope docs both refused direct fetch during research. Record
what the device testing actually shows back into this doc as it arrives.

### Phase 1 — Portable bundle: user-selectable quality (1–2 days, was 3–4)

**Built (PR #496).** `src/lib/portable/portable-bundle.ts` (format: manifest +
hashed parts) and `src/db/services/portable-bundle-service.ts` (build/import
over the ZIP path's own Strict services, with rollback). Tiers exist
(`portable-128`/`portable-192`, default 192); quality provenance is stamped on
imported sessions and repeated to the cloud manifest. Still open from this
phase: the user-facing tier choice in settings (today every bundle uses the
default) and wiring the tiers into the ZIP export UI.

Introduce a **portable bundle** distinct from the lossless archive, with the
quality **chosen by the user** (decision locked) and a sensible default.

**Most of this is written.** `encodeStemToAac` already produces the default tier;
the work is promotion and tiering, not encoding:

- Move `stem-encoder.ts` out of `src/lib/jam/` into a shared home (it is a codec,
  not a room feature) and leave the jam imports pointing at the new path.
- Make `STEM_BITRATE` a parameter: Standard 128k (default), High 192k, and
  Lossless meaning "use today's archive path unchanged".
- Wire the tier into the export UI and `userSettings` (already a cloud entity, so
  the choice follows the user across devices).
- Keep the `ensureAacEncoder()` probe as the gate: where AAC cannot be encoded,
  the portable tiers are unavailable and lossless export still works.

Per 4-minute song:

| Tier                              | Vocal       | Instrumental | Original | Total       | 20 songs    |
| --------------------------------- | ----------- | ------------ | -------- | ----------- | ----------- |
| Lossless (today)                  | ~24 MB FLAC | ~24 MB FLAC  | ~5 MB    | ~53 MB      | ~1.06 GB    |
| High (AAC 192k)                   | ~5.5 MB     | ~5.5 MB      | omitted  | ~11 MB      | ~220 MB     |
| **Standard (AAC 128k) — default** | ~3.8 MB     | ~3.8 MB      | omitted  | **~7.6 MB** | **~152 MB** |

~7× reduction at the default. 152 MB fits inside every quota on every platform
and uploads to Drive in seconds.

- Encode on the **desktop** side so the phone only ever decodes. (Not a hard
  rule any more: the jam encoder runs on phones too. It is a battery and
  wall-clock choice, not a capability one.)
- AAC-in-MP4 for universal playback (Opus is smaller but Safari support is
  patchier) — already the shipped choice.
- The original file is omitted from portable bundles — the phone needs the
  instrumental plus an optional vocal guide, not the source.
- Lossless export is unchanged. This is an additional path, not a replacement.

**This unlocks every later phase.** Without it, iOS storage and Drive quota both
bite.

### Phase 2 — Transport-agnostic bundle pipeline (3–4 days)

The load-bearing refactor, and **the phase that decides how much of the native
port is packaging versus rewriting**. No user-visible change.

- Refactor `prepareSessionFilesForZip` into an **async producer** yielding
  `{path, blob}` instead of a monolithic `fflate.Zippable`.
- Refactor import into a **consumer of streamed blobs** instead of an
  `Unzipped` map. (The writer already streams; the reader does not.)
- Define `SyncTransport` (`put(path, blob)` / `get(path)` / `list()`) and a
  `BlobStore` adapter (web: Dexie · native: Filesystem), both following the
  `src/lib/platform/` seam convention.
- Generalise `ShareTransport` rather than inventing a second interface — the P2P
  transport should end up as one implementation of `SyncTransport`, not a
  parallel stack.
- **Rewire the existing ZIP export/import onto the new pipeline.** Proves the
  abstraction and keeps one code path so formats cannot drift.
- Route every audio read through `BlobStore` — today `uvr-read-service.ts` and
  its callers reach into Dexie directly, and each of those is a call site that
  will not compile against a filesystem backend later.

### Phase 3 — Metadata sync over the existing cloud (2–3 days)

The highest value-to-effort ratio in the plan.

Playlists, groups, singer names and song titles are **kilobytes and carry no
copyright exposure**. Only stems are big and encumbered.

- Add to `CLOUD_ENTITIES`: `karaokePlaylists`, `sessionGroups`, and a
  lightweight song manifest (`fileHash` + title + duration + stem sizes — **no
  audio**). Mirror the allowlist in `workers/db-worker/src/tables.ts` — an
  entity in one and not the other silently 404s on every access, which is
  exactly how `voiceprints` wrote nothing to D1 for weeks. The drift test in
  `hybrid-adapter` exists to catch this; extend it.
- A numbered D1 migration per the repo convention (next free number in
  `workers/db-worker/migrations/`; never edit an applied file).
- Mark them user-scoped (`USER_SCOPED_ENTITIES`) and `access: 'user'` in the
  worker's `TABLES`.
- Sync the manifest, not `uvrSessions` itself: that record carries RunPod job
  ids, progress and error state, which are this device's business.
- The manifest carries the **quality tier** and the original's `fileHash`, so
  provenance is known before any audio arrives (see _Quality provenance_).
- Mobile library UI renders each song as "on this device" or "not downloaded".

Payoff: **sign in on a phone and the entire library and every playlist is
already there**, before a single byte of audio moves. Most of the _perceived_
friction disappears, and this is the manifest every transport diffs against.

`fileHash` already exists, so dedupe and resume come free.

### Phase 4 — Google Drive transport (5–7 days)

The WhatsApp model. **After this phase the original problem is solved.**

- Add `drive.file` to the existing Google OAuth redirect flow.
- Visible `MercuryPitch/` folder; one portable bundle per song, named by
  `fileHash`, plus an opt-in full-quality bundle per song (D10) for people who
  want the original back on a new device without re-separating.
- Resumable upload via XHR (10 MB chunks; 256 KB minimum).
- New device: _"Found 23 songs in your Drive — restore?"_ → per-song,
  resumable, one at a time.
- Sync state driven entirely by the Phase 3 manifest.

**Start the paperwork on day one, not at the end.** Adding a scope changes the
OAuth consent screen, and `drive.file` being non-sensitive means basic app
verification rather than a CASA audit — but basic verification is still a
Google-side review with its own lead time, and sign-in is a live production
flow. Add the scope incrementally (request it when the user first turns Drive
sync on, not at sign-in) so a pending review cannot break logging in.

### Phase 5 — P2P transport (2–3 days, was 4–6)

**Built (PR #496).** `src/lib/sync/sync-peer.ts` (data-only WebRTC over the
jam worker's rooms — no media, rooms kept out of the jam lobby),
`src/lib/sync/sync-protocol.ts` (receiver-pulled parts, per-part SHA-256,
bounded re-request on corruption, explicit `sync-kept` ACK — the robustness
the jam room's fire-and-forget delivery lacks, built here first as planned),
`src/stores/sync-store.ts` + `SyncDevicesModal` in the Karaoke tab (receive
shows a code, send enters it; per-song Send button on session cards; relay
routes refused). Every finished transfer reports real bytes, seconds and MB/s
in the modal and the console — the Phase 0 numbers. Still open: QR pairing
(issue #489 composes here) and whole-library one-tap sync.

Now an optimization for bulk transfer, not the foundation — and most of it is
already written for the jam room.

- Extract a **data-only** WebRTC path from `jam/service.ts`. The old blocker is
  gone: `createRoom()` / `joinRoom()` now call `openLocalStream()`, which makes
  an empty `MediaStream` and asks for nothing. What remains is separating room
  membership and the data channel from the media plumbing around them.
- Reuse `sendInChunks` / `TransferHeader` / `sha256Hex` from
  `jam-song-transfer.ts` rather than writing a second chunker.
- Reuse the jam worker's room codes as-is; add QR.
- 16 KB chunks with `bufferedAmountLowThreshold` backpressure — the
  cross-browser-safe size; larger chunks stutter or fail on some browser pairs.
- **Detect a relay candidate and refuse** — `isRelayedConnection()` already
  does this in the share path; carry the rule over.
- Inherit the jam room's known weakness rather than repeating it: song delivery
  there is fire-and-forget, with no acknowledgement and no retry, and a
  late-joining peer sometimes never receives (dev testing, 2026-08-03). Sync
  needs the hashed ACK and bounded retry that jam is also going to need; build
  it once, here, and let the room adopt it.

### Offline shell — already covered

An offline app shell is required for the actual use case (no signal in a car);
songs in storage are useless if the app will not load. This is **already
`mobile-native` Phase 4** (PWA service worker + install prompt) and
`capacitor-readiness.md` §A6. No separate phase here — but device sync is not
shippable-complete until that lands.

### Native track — mostly packaging

Because of Phase 2 this is small:

1. Capacitor wrap per `capacitor-readiness.md` §C (Phase 5 there).
2. Swap the `BlobStore` adapter: audio → `@capacitor/filesystem` (chunked);
   metadata stays in IndexedDB/SQLite. This is the whole reason Phase 2 exists.
3. Drive transport works unchanged.
4. P2P could later upgrade to native LAN sockets (Bonjour/TCP, as LocalSend
   does) — but WebRTC will already be fast enough.

**What the web phases must do to earn that.** Everything below is web work that
exists only so the native port is packaging. Doing it later costs several times
more, because by then there are more call sites:

| Web-phase decision                            | What it buys the native shell                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `BlobStore` behind an interface (Phase 2)     | The one swap that turns a WKWebView quota problem into a filesystem write                    |
| Every audio read routed through it (Phase 2)  | No call site reaches into Dexie for bytes, so nothing needs rewriting                        |
| Streamed import (Phase 2)                     | Chunked filesystem access, since base64 round-tripping a large file through the WebView OOMs |
| Portable tiers (Phase 1)                      | A library that fits inside a ~15% -of-disk origin quota                                      |
| Manifest in the cloud (Phase 3)               | First launch of the native app shows the library before any audio moves                      |
| Drive over HTTPS, not a browser API (Phase 4) | Works identically inside the shell                                                           |
| Encoder out of `lib/jam/` (Phase 1)           | Nothing in the sync path depends on a room feature                                           |

---

## Recommended sequence

Revised 2026-08-12, given that the encoder and the chunked transport already
shipped inside the jam room.

**3 → 1 → 2 → 4**, with Phase 0's measurements taken during Phase 3 (they gate
D5, which Phase 2 needs, not Phase 3). Roughly **2 weeks** to a genuinely
low-friction cross-device experience, all of it reusable under Capacitor.

Why 3 first, ahead of the bundle work: it is the only phase that changes what
the user sees without touching a byte of audio, it is independently shippable,
and every later phase diffs against the manifest it creates. Signing in on a
phone and finding your whole library listed — greyed out until downloaded — is
most of the perceived friction gone for 2–3 days of work.

Phase 5 (P2P) is the natural next block and is now small, but it is genuinely
optional: Drive solves the stated problem, asynchronously, and P2P only makes
bulk transfer faster on the same Wi-Fi.

## Open decisions

| #   | Decision                                                                                                                  | Status                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Native via Capacitor reusing this codebase                                                                                | **Locked** — per `mobile-native/README.md` §3                                                                                                                                                    |
| D2  | Portable quality is user-selectable                                                                                       | **Locked** — default AAC 128k, High 192k, Lossless opt-in                                                                                                                                        |
| D3  | Drive before P2P                                                                                                          | Proposed                                                                                                                                                                                         |
| D4  | `drive.file` (visible folder) over `drive.appdata` (hidden)                                                               | Proposed                                                                                                                                                                                         |
| D5  | Audio to filesystem, metadata to IndexedDB/SQLite — refines §B6                                                           | **Narrowed** 2026-08-12 by real readings: not needed for the web (38 GB on iOS Safari, 10 GB+ elsewhere). Build the seam for the native shell and for chunked access; do not migrate web storage |
| D6  | Whether Phase 3 ships standalone first                                                                                    | **Locked** 2026-08-12 — it is the sequence above                                                                                                                                                 |
| D7  | Where the sync surface lives                                                                                              | **Locked** 2026-08-12 — per-song and library actions in the **Karaoke tab**; Drive account, quality tier and storage in a new **Settings → Sync** subtab                                         |
| D8  | Whether the portable encoder moves out of `src/lib/jam/`                                                                  | **Locked** 2026-08-12 — it moves, in Phase 1                                                                                                                                                     |
| D9  | A synced song is marked as a reduced-quality copy, with an offer to get the original back                                 | **Locked** 2026-08-12 — see _Quality provenance_                                                                                                                                                 |
| D10 | Drive holds an opt-in full-quality tier per song                                                                          | **Locked** 2026-08-12 — it is what makes "upgrade" a download                                                                                                                                    |
| D11 | TV as a P2P target (push from phone/desktop, code + QR, stream-one-song)                                                  | Proposed — natural once Phase 5 lands                                                                                                                                                            |
| D12 | Whether "re-separate at full quality" is offered on a device that lacks the original file                                 | Open — it cannot be honoured there without the source; likely offer _fetch_ only, and _re-separate_ solely where the original is present                                                         |
| D13 | Installing to the Home Screen is part of the sync story on iOS, because eviction — not capacity — is what loses a library | Proposed 2026-08-12, from the measurements                                                                                                                                                       |

## Sources

Storage and quota figures marked as reported could not be verified at the
primary source during research (WebKit and Google developer docs both returned
403 to automated fetch) — Phase 0 exists to replace them with measurements.

- Eskola, _Performance Evaluation of WebRTC Data Channels_ — <https://tuhat.helsinki.fi/ws/portalfiles/portal/167373638/Eskola_webrtc.pdf>
- TensorWorks, WebRTC stream limits — <https://tensorworks.com.au/blog/webrtc-stream-limits-investigation/>
- Mozilla, large data channel messages — <https://blog.mozilla.org/webrtc/large-data-channel-messages/>
- MDN, `bufferedAmountLowThreshold` — <https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmountLowThreshold>
- WebKit, storage policy updates — <https://webkit.org/blog/14403/updates-to-storage-policy/>
- MDN, storage quotas and eviction — <https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria>
- Google, Drive API scopes — <https://developers.google.com/workspace/drive/api/guides/api-specific-auth>
- Google, Drive resumable uploads — <https://developers.google.com/workspace/drive/api/guides/manage-uploads>
- CASA assessment overview — <https://deepstrike.io/blog/google-casa-security-assessment-2025>
- Capacitor Filesystem — <https://capacitorjs.com/docs/apis/filesystem>
- `capacitor-file-chunk` — <https://github.com/qrclip/capacitor-file-chunk>
- Ionic, Capacitor + SolidJS templates — <https://ionic.io/blog/new-capacitor-templates-solidjs-vite>
- WhatsApp Drive quota change — <https://www.androidpolice.com/whatsapp-backups-count-against-drive-storage-quota/>
