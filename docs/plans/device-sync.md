# Cross-Device Library Sync

**Date**: 2026-07-26 · **Status**: proposed (research complete, decisions partly locked)

## Context

A user separates and prepares karaoke songs on the desktop app: stems, lyrics,
word timings, pitch analysis, playlists with singer names. None of that is on
their phone. To sing in the car they must currently export a ZIP, move it by
hand (AirDrop/USB/Drive), and re-import it in mobile Chrome.

Uploaded audio is user-supplied copyrighted material, so **the audio must never
transit or rest on our servers**. That constraint is already encoded in
`src/db/adapters/hybrid-adapter.ts`: *"Audio data is huge and never syncs to the
cloud by design."*

This plan covers making the phone copy of a library appear with as little
friction as possible, under that constraint, in a way that survives the
Capacitor wrap planned in [mobile-native/](mobile-native/README.md).

## What already exists

The starting position is stronger than it looks:

| Asset | Where | Notes |
| --- | --- | --- |
| Versioned bundle format | `src/db/services/session-export-service.ts` | `session.json` + original + stems + lyrics + Whisper transcription + pitch analysis, plus `karaoke.json` (playlists, groups, singers, play modes). Import remaps IDs. Round-trip tested in `src/tests/karaoke-playlist-import.test.ts` |
| WebRTC P2P transport | `src/lib/jam/service.ts`, `signaling.ts` | RTCPeerConnection lifecycle, DataChannels, glare resolution, ICE buffering |
| Signaling relay + room codes | `workers/jam-worker/` | `newRoomId()` already emits typeable codes with no `0`/`O`/`1`/`I` |
| Invite UX (code + link + copy) | `src/components/jam/JamInviteModal.tsx` | |
| Google Sign-In | `src/db/services/auth-service.ts:234` | Full redirect flow through db-worker (COOP breaks popups) |
| Cloud/local entity split | `src/db/adapters/hybrid-adapter.ts` | `CLOUD_ENTITIES` allowlist against D1 via db-worker |
| Per-song content hash | `UvrSessionRecord.fileHash` (`entities.ts:270`) | SHA-256 — free dedupe and resume |
| Storage quota pre-flight | `hasRoomFor()` (`src/db/durable-write.ts`) | |
| Platform seam | `src/lib/platform/index.ts` | The established pattern for anything that differs web vs native |
| Mobile karaoke stage | `src/components/KaraokeMobileStage.tsx` | |

**We do not need to design a sync payload. It exists and is tested.**

## Correcting a misconception: P2P bandwidth is not the blocker

Measured WebRTC data-channel throughput on a LAN averages **~18 MB/s**
(Eskola, below); tuned implementations reach 176–422 Mbps. At 18 MB/s:

| Payload | Transfer time |
| --- | --- |
| One song (~53 MB, lossless) | ~3 s |
| 20 songs (~1 GB, lossless) | **~60 s** |

Moving gigabytes phone↔desktop over Wi-Fi is routine. The three real
constraints are all tractable:

1. **RTT sensitivity.** WebRTC's SCTP layer uses a default 128 KiB receive
   window, so throughput collapses as RTT rises. Same-Wi-Fi (1–5 ms) is fine;
   cross-internet (30–100 ms) is not. *"Both devices on the same Wi-Fi"* is
   therefore a genuine product requirement — which matches the use case anyway.
2. **Current code would OOM a phone.** `fflate.zip()` builds the whole archive
   in RAM and `unzipSync()` inflates it in one shot
   (`session-export-service.ts:706`). That is a desktop-download implementation
   choice, not a platform limit. Streaming per-file fixes it.
3. **TURN relay fallback.** If a direct connection fails, WebRTC silently
   relays through the free `openrelay.metered.ca` servers
   (`jam/service.ts:10`) — pushing a GB through a public relay. Sync must
   detect a relay candidate and refuse.

## The real constraint: where the bytes land

Reported per-origin storage quotas (iOS 17+):

| Host | Quota |
| --- | --- |
| Safari (browser) | large share of disk |
| **WKWebView inside a native app** | **~15% of total disk** |
| Chrome Android | up to ~60% of disk per origin |

Two consequences:

- **Capacitor does not fix the storage problem — it can make it worse.** An
  embedded WKWebView reportedly gets a *tighter* origin quota than Safari does.
  Lift-and-shifting IndexedDB blob storage into the shell inherits that cap plus
  the same eviction rules.
- This refines `capacitor-readiness.md` **§B6**, whose stated mitigation is a
  Dexie→`@capacitor-community/sqlite` adapter. SQLite solves *metadata*
  durability but not *blob* volume — a 1 GB audio library in a SQLite blob
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

### Phase 0 — Measure before building (1 day)

Replaces secondary-source figures with real numbers. **Do not skip.**

- Export a 10-song playlist; record real byte size.
- Move it to an iPhone and an Android phone; import in-browser; note failures.
- Log `navigator.storage.estimate()` on both.
- Confirm whether the mobile karaoke loop is good enough to justify the rest.

The iOS quota figures above come from secondary sources — WebKit's storage-policy
post and Google's scope docs both refused direct fetch during research. One
afternoon on real hardware settles it, and everything downstream depends on the
answer. Record findings back into this doc.

### Phase 1 — Portable bundle: user-selectable quality (3–4 days)

Introduce a **portable bundle** distinct from the lossless archive, with the
quality **chosen by the user** (decision locked) and a sensible default.

Per 4-minute song:

| Tier | Vocal | Instrumental | Original | Total | 20 songs |
| --- | --- | --- | --- | --- | --- |
| Lossless (today) | ~24 MB FLAC | ~24 MB FLAC | ~5 MB | ~53 MB | ~1.06 GB |
| High (AAC 192k) | ~5.5 MB | ~5.5 MB | omitted | ~11 MB | ~220 MB |
| **Standard (AAC 128k) — default** | ~3.8 MB | ~3.8 MB | omitted | **~7.6 MB** | **~152 MB** |

~7× reduction at the default. 152 MB fits inside every quota on every platform
and uploads to Drive in seconds.

- Encode with WebCodecs `AudioEncoder` on the **desktop** side so the phone only
  ever decodes.
- AAC-in-MP4 for universal playback (Opus is smaller but Safari support is
  patchier).
- The original file is omitted from portable bundles — the phone needs the
  instrumental plus an optional vocal guide, not the source.
- Quality setting lives in `userSettings` (already a cloud entity, so the choice
  follows the user across devices).
- Lossless export is unchanged. This is an additional path, not a replacement.

**This unlocks every later phase.** Without it, iOS storage and Drive quota both
bite.

### Phase 2 — Transport-agnostic bundle pipeline (3–4 days)

The load-bearing refactor. No user-visible change.

- Refactor `prepareSessionFilesForZip` into an **async producer** yielding
  `{path, blob}` instead of a monolithic `fflate.Zippable`.
- Refactor import into a **consumer of streamed blobs** instead of an
  `Unzipped` map.
- Define `SyncTransport` (`put(path, blob)` / `get(path)` / `list()`) and a
  `BlobStore` adapter (web: Dexie · native: Filesystem), both following the
  `src/lib/platform/` seam convention.
- **Rewire the existing ZIP export/import onto the new pipeline.** Proves the
  abstraction and keeps one code path so formats cannot drift.

### Phase 3 — Metadata sync over the existing cloud (2–3 days)

The highest value-to-effort ratio in the plan.

Playlists, groups, singer names and song titles are **kilobytes and carry no
copyright exposure**. Only stems are big and encumbered.

- Add to `CLOUD_ENTITIES`: `karaokePlaylists`, `sessionGroups`, and a
  lightweight song manifest (`fileHash` + title + duration + stem sizes — **no
  audio**). Mirror the allowlist in `workers/db-worker/src/tables.ts`.
- Mark them user-scoped (`USER_SCOPED_ENTITIES`).
- Mobile library UI renders each song as "on this device" or "not downloaded".

Payoff: **sign in on a phone and the entire library and every playlist is
already there**, before a single byte of audio moves. Most of the *perceived*
friction disappears, and this is the manifest every transport diffs against.

`fileHash` already exists, so dedupe and resume come free.

### Phase 4 — Google Drive transport (5–7 days)

The WhatsApp model. **After this phase the original problem is solved.**

- Add `drive.file` to the existing Google OAuth redirect flow.
- Visible `MercuryPitch/` folder; one portable bundle per song, named by
  `fileHash`.
- Resumable upload via XHR (10 MB chunks; 256 KB minimum).
- New device: *"Found 23 songs in your Drive — restore?"* → per-song,
  resumable, one at a time.
- Sync state driven entirely by the Phase 3 manifest.

### Phase 5 — P2P transport (4–6 days)

Now an optimization for bulk transfer, not the foundation.

- Extract a **data-only** WebRTC path from `jam/service.ts`. Today
  `createRoom()`/`joinRoom()` both call `startLocalStream()`
  (`service.ts:111`, `:139`), which demands microphone permission and hard-fails
  on denial. A file sync must never ask for the mic.
- Reuse the jam worker's room codes as-is; add QR.
- 16 KB chunks with `bufferedAmountLowThreshold` backpressure — the
  cross-browser-safe size; larger chunks stutter or fail on some browser pairs.
- **Detect a relay candidate and refuse**, prompting "put both devices on the
  same Wi-Fi", rather than silently pushing a GB through free public TURN.

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

---

## Recommended sequence

**0 → 1 → 2 → 3 → 4**, then reassess. Roughly **3 weeks** to a genuinely
low-friction cross-device experience, all of it reusable under Capacitor.

Phase 5 (P2P) is the natural next block.

Fastest standalone win: **Phase 3 alone is 2–3 days** and makes the library
appear on any signed-in device instantly. Worth shipping on its own before
committing to the rest.

## Open decisions

| # | Decision | Status |
| --- | --- | --- |
| D1 | Native via Capacitor reusing this codebase | **Locked** — per `mobile-native/README.md` §3 |
| D2 | Portable quality is user-selectable | **Locked** — default AAC 128k, High 192k, Lossless opt-in |
| D3 | Drive before P2P | Proposed |
| D4 | `drive.file` (visible folder) over `drive.appdata` (hidden) | Proposed |
| D5 | Audio to filesystem, metadata to IndexedDB/SQLite — refines §B6 | Proposed, needs Phase 0 data |
| D6 | Whether Phase 3 ships standalone first | Open |

## Sources

Storage and quota figures marked as reported could not be verified at the
primary source during research (WebKit and Google developer docs both returned
403 to automated fetch) — Phase 0 exists to replace them with measurements.

- Eskola, *Performance Evaluation of WebRTC Data Channels* — <https://tuhat.helsinki.fi/ws/portalfiles/portal/167373638/Eskola_webrtc.pdf>
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
