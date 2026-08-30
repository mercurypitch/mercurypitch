# Stem Storage: ArrayBuffer → Blob Migration Plan

> **Status:** PROPOSED — benchmark phase (Phase 0) gates everything after it.
> **Prereq reading:** the copy-chain fixes already landed on
> `feat/drum-night-sound-feel` (in-place decode, snapshot release), which this
> plan extends to the storage layer itself.

**Goal:** Prepared-song stems (60 MB+ WAV rows in `uvrStemBlobs`) should cost
RAM only while being decoded, not while being *read*, *held by a lease*, or
*written*. That makes the decoded-PCM budget the only budget that matters,
shrinks phone ceilings to a non-problem, and unlocks windowed (chunked) WAV
playback later.

---

## 1. What "materialize" means, concretely

IndexedDB stores values via **structured clone**. What a read costs depends on
the stored *type*:

- **`data: ArrayBuffer` (today):** `repo.findAll(...)` deserializes the full
  payload into a fresh JS-heap allocation. Reading a 60 MB stem row puts 60 MB
  into renderer RAM *before any code touches the audio* — that is
  "materializing" the stem. There is no lazy option: the row IS the bytes.
- **`data: Blob` (proposed):** the read returns a **handle** — size, MIME type,
  and a reference into the browser's blob storage. Near-zero RAM. Bytes enter
  RAM only when explicitly read (`blob.arrayBuffer()`, `fetch(objectURL)`),
  and `blob.slice(a, b)` is lazy — a windowed reader touches only the window.

So it is not "ArrayBuffer has metadata overhead" — both store the same bytes
on disk. The difference is entirely on the **read side**: payload-in-RAM
versus reference-in-RAM.

Two engine facts sharpen this (sources in §6):

- Chromium's IndexedDB keeps large values **outside LevelDB as separate files
  on disk** either way. So storage location is similar for both types; what
  differs is what deserialization hands back to JS.
- Gecko and Chromium store Blobs **by reference** — writing a Blob does not
  re-copy its bytes into the record. Writing an ArrayBuffer serializes the
  payload into the value.

## 2. Today's copy chain (after this branch's fixes)

Write path — [uvr-service.ts:56](../../src/db/services/uvr-service.ts):
the separation pipeline already produces a `Blob`
([uvr-processing-pipeline.ts:113](../../src/lib/uvr-processing-pipeline.ts)),
and the save step does `await blob.arrayBuffer()` — a full-copy
materialization **at write time** — purely because the column type says so.

Read/play path per stem (60 MB WAV example):

| # | Copy | Lifetime | Removable by |
|---|------|----------|--------------|
| 1 | IDB row → ArrayBuffer (snapshot) | until `snapshot = []` after lease mint | **Blob storage (this plan)** |
| 2 | `new Blob([entry.data])` for the object URL | lease lifetime | **Blob storage** — `createObjectURL(storedBlob)` is copy-free; the spec explicitly rejected letting `new Blob([ab])` take ownership (W3C bug 28496), so this copy is unavoidable while rows are ArrayBuffers |
| 3 | `fetch(blobUrl)` → ArrayBuffer in the player | until decode | stays (one transient working copy is fine) |
| 4 | ~~`encoded.slice(0)`~~ | — | **FIXED on this branch** — decode now detaches in place |
| 5 | Decoded PCM | playback lifetime | the actual product; bounded by the decoded budget + fidelity ladder |

End state with Blob rows: **disk → handle → one transient ArrayBuffer →
decoded PCM.** Resident RAM during playback = PCM only.

## 3. Tradeoffs — is Blob actually the right type? (researched 2026-08-30)

| Consideration | ArrayBuffer rows (today) | Blob rows (proposed) | OPFS files (alternative) |
|---|---|---|---|
| Read cost | full payload into RAM | handle only | handle only |
| Write cost | copy (and today an extra Blob→AB conversion) | by reference in Gecko/Chromium | streamed write, sync handles in workers |
| Object URL | requires `new Blob(...)` copy | free | needs `new Blob([await file])` or fetch of a worker-served stream |
| Windowed reads | impossible without full load | `blob.slice()` is lazy | best-in-class (`read(at)`) |
| Browser risk | none — dumbest type | historic: Safari lacked blob-in-IDB **pre-v10 (2016)**; old Firefox perf bugs (Bugzilla 837141, 2013). Modern engines fine — but this is exactly what Phase 0 verifies, not assumes | Safari ≥ 15.2; newer API surface; bigger rewrite (all readers, quota model, e2e seeds) |
| Migration size | — | value-type change only; **no index change, no Dexie version bump** (only indexed columns are schema; `data` is not indexed) | new storage subsystem + metadata split |
| Structured clone to workers | copies payload | clones the handle cheaply | handles clone cheaply |

**Recommendation:** Blob rows. Same store, same keys, same indexes, deletes a
write-side copy, kills read-side materialization, and is the enabler for
windowed playback. OPFS is the fallback **if and only if** Phase 0 shows
blob-in-IDB misbehaving on a target browser; the benchmark harness measures
both so that decision is data, not vibes.

**Known repo traps that constrain the design:**
- `dexie-index-add-reindexes-blobs`: adding an *index* to a blob-carrying
  store makes existing users pay a minutes-long reindex on first open. This
  plan adds **no index** and **no version bump** for the type change itself.
- Never rewrite all rows eagerly in a version upgrade for the same reason —
  migration must be lazy (Phase 3).

## 4. Phases

### Phase 0 — Benchmark harness (gates everything; nothing ships without it)

The user's requirement, verbatim: *actual data tests, on actual IndexedDB
stems — load time, memory, Blob vs ArrayBuffer — and compare against
published numbers.* Published head-to-heads for this exact case are thin
(most articles compare IDB vs localStorage, not value types), so we measure
ourselves.

- [ ] `src/features/lab/StemStorageBench.tsx` (dev-only lab route, precedent:
      `TranscriptionBench.tsx`). Synthesizes N realistic WAVs (e.g. 6 × 60 MB
      of generated audio — **never real user stems**, and fixture rules apply)
      and runs, per storage type (AB row / Blob row / OPFS where available):
  - write time per stem and total
  - read-row time (`findAll` → value in hand)
  - time-to-object-URL and time-to-first-decoded-second
  - round-trip integrity (hash of bytes in vs bytes out)
  - RAM: `performance.measureUserAgentSpecificMemory()` deltas at each stage.
    Requires COOP/COEP (`crossOriginIsolated`) — add the two headers to the
    Vite dev server for the lab route; if isolation is impractical, the bench
    prints checkpoint markers and the procedure documents reading Chrome Task
    Manager per-tab footprint at each marker (JS-heap-only `performance.memory`
    is NOT sufficient: blob storage and AudioBuffers live outside it).
- [ ] Run on: Linux Chromium, Firefox; Android Chrome; iOS Safari when a
      device is at hand (Safari is the one with a bug history).
- [ ] Record results in this file. **Gate:** Blob read shows no payload-sized
      RAM step and no integrity failure on every tested browser. If a browser
      fails → evaluate the OPFS column before proceeding.

### Phase 1 — Dual-read compatibility

- [ ] `UvrStemBlob.data: ArrayBuffer | Blob` in
      [entities.ts](../../src/db/entities.ts), plus one shared helper module
      (`stem-blob-data.ts`): `stemBytes(data, range?)`, `stemBlob(data, mime)`,
      `stemHeaderBytes(data, n)` — so every reader handles both types through
      one seam.
- [ ] Convert every reader of `.data` (grep-verified list at implementation
      time; known today: `uvr-read-service.ts` snapshot + budget selector —
      budget check moves to `.size`, no bytes read; `uvr-service.ts`
      `getStemBlobEntry`; `uvr-stem-lease.ts` URL mint + WAV header read via
      lazy `slice(0, 4096)`; stem-peaks / fingerprint / export paths).
- [ ] e2e specs that seed `uvrStemBlobs` with ArrayBuffers stay green
      untouched — that *is* the dual-read test.

### Phase 2 — Write Blobs for new stems

- [ ] [uvr-service.ts:56](../../src/db/services/uvr-service.ts): store the
      incoming Blob directly; delete the `await blob.arrayBuffer()` line.
      (This also removes a write-time full copy.)
- [ ] Verify quota accounting (`size` column) still comes from `blob.size`.
- [ ] New sessions now play with handle-based reads end to end.

### Phase 3 — Lazy migration of existing rows

- [ ] On read of an ArrayBuffer row (`getStemBlobEntry` / snapshot path):
      serve it, then fire-and-forget rewrite of the same key with a Blob of
      the same bytes. No version bump, no bulk pass, no reindex. Guard with a
      quota check (a rewrite transiently needs old+new on disk) and skip
      silently when storage is tight.
- [ ] Optional idle sweep behind `requestIdleCallback`, budgeted to one row
      per idle slice.

### Phase 4 — What this unlocks (separate plans)

- Windowed WAV playback: `blob.slice(headerOffset + windowBytes…)` per
  30-second window → hand-built AudioBuffers on the shared clock →
  song-length-independent RAM (~140 MB for 6 stems double-buffered). Kills
  the decoded budget as a user-visible limit, desktop AND phone.
- Revisit `GUITAR_PLAY_ALONG_POLICY` requesting 6 stems where Drum Night
  requests 3 — orthogonal 2× still worth taking.

## 5. Risks

- **Safari blob-in-IDB regressions** — mitigated by Phase 0 gate + dual-read
  (worst case: keep writing ArrayBuffers on Safari via a capability flag).
- **Blob eviction / private-browsing quirks** on iOS — stems are re-derivable
  (re-separation exists as UVR recovery), so data loss degrades, not breaks.
- **Two copies on disk during Phase 3 rewrites** — quota-guarded, skippable.
- **Reader missed in Phase 1** — the shared helper seam plus a lint-able rule
  (no direct `.data` byte access outside `stem-blob-data.ts`) makes stragglers
  grep-visible.

## 6. Sources

- [W3C webapps: IndexedDB, Blobs and partial Blobs — Large Files](https://lists.w3.org/Archives/Public/public-webapps/2013OctDec/0902.html) — Blobs stored by reference in Gecko/Chromium; ArrayBuffer→Blob conversion copies.
- [W3C bug 28496](https://lists.w3.org/Archives/Public/public-webapps-bugzilla/2015Jun/0015.html) — Blob constructor taking ownership of an ArrayBuffer was proposed and not adopted; the mint-time copy is spec-mandated.
- [Chromium IndexedDB docs](https://chromium.googlesource.com/chromium/src/+/master/content/browser/indexed_db/docs/README.md) and [Chrome IndexedDB storage improvements](https://developer.chrome.com/docs/chromium/indexeddb-storage-improvements) — large values live as separate on-disk files; blob files under `IndexedDB/<origin>.blob/`.
- [Chrome's Blob Storage System Design](https://chromium.googlesource.com/chromium/src/+/HEAD/storage/browser/blob/README.md) — blob memory pages to disk under pressure.
- [Blob support for IndexedDB landed on Chrome Dev](https://developer.chrome.com/blog/blob-support-for-Indexeddb-landed-on-chrome-dev) — the Chrome-side history.
- [nolanlawson/state-of-binary-data-in-the-browser](https://github.com/nolanlawson/state-of-binary-data-in-the-browser) — the 2015 survey behind "Safari can't store Blobs"; **treat as historical**, superseded by Safari 10+; Phase 0 re-verifies empirically.
- [Mozilla Bugzilla 837141](https://bugzilla.mozilla.org/show_bug.cgi?id=837141) — the old Firefox blob-write perf bug; also historical, re-verified by Phase 0.
- [MDN: measureUserAgentSpecificMemory](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory) and [web.dev: monitor total page memory](https://web.dev/articles/monitor-total-page-memory-usage) — the measurement API and its COOP/COEP requirement.
- [OPFS vs IndexedDB for large binary data](https://anirone.com/blog/general/opfs-vs-indexeddb-binary-storage) — the alternative column.
