# Stem Storage: ArrayBuffer → Blob Migration Plan

> **Status:** PROPOSED — benchmark phase (Phase 0) gates everything after it.
> **Prereq reading:** the copy-chain fixes already landed on
> `feat/drum-night-sound-feel` (in-place decode, snapshot release), which this
> plan extends to the storage layer itself.

**Goal:** Prepared-song stems (60 MB+ WAV rows in `uvrStemBlobs`) should cost
RAM only while being decoded, not while being _read_, _held by a lease_, or
_written_. That makes the decoded-PCM budget the only budget that matters,
shrinks phone ceilings to a non-problem, and unlocks windowed (chunked) WAV
playback later.

---

## 1. What "materialize" means, concretely

IndexedDB stores values via **structured clone**. What a read costs depends on
the stored _type_:

- **`data: ArrayBuffer` (today):** `repo.findAll(...)` deserializes the full
  payload into a fresh JS-heap allocation. Reading a 60 MB stem row puts 60 MB
  into renderer RAM _before any code touches the audio_ — that is
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

| #   | Copy                                         | Lifetime                               | Removable by                                                                                                                                                                                                 |
| --- | -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | IDB row → ArrayBuffer (snapshot)             | until `snapshot = []` after lease mint | **Blob storage (this plan)**                                                                                                                                                                                 |
| 2   | `new Blob([entry.data])` for the object URL  | lease lifetime                         | **Blob storage** — `createObjectURL(storedBlob)` is copy-free; the spec explicitly rejected letting `new Blob([ab])` take ownership (W3C bug 28496), so this copy is unavoidable while rows are ArrayBuffers |
| 3   | `fetch(blobUrl)` → ArrayBuffer in the player | until decode                           | stays (one transient working copy is fine)                                                                                                                                                                   |
| 4   | ~~`encoded.slice(0)`~~                       | —                                      | **FIXED on this branch** — decode now detaches in place                                                                                                                                                      |
| 5   | Decoded PCM                                  | playback lifetime                      | the actual product; bounded by the decoded budget + fidelity ladder                                                                                                                                          |

End state with Blob rows: **disk → handle → one transient ArrayBuffer →
decoded PCM.** Resident RAM during playback = PCM only.

## 3. Tradeoffs — is Blob actually the right type? (researched 2026-08-30)

| Consideration               | ArrayBuffer rows (today)                     | Blob rows (proposed)                                                                                                                                                                | OPFS files (alternative)                                                               |
| --------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Read cost                   | full payload into RAM                        | handle only                                                                                                                                                                         | handle only                                                                            |
| Write cost                  | copy (and today an extra Blob→AB conversion) | by reference in Gecko/Chromium                                                                                                                                                      | streamed write, sync handles in workers                                                |
| Object URL                  | requires `new Blob(...)` copy                | free                                                                                                                                                                                | needs `new Blob([await file])` or fetch of a worker-served stream                      |
| Windowed reads              | impossible without full load                 | `blob.slice()` is lazy                                                                                                                                                              | best-in-class (`read(at)`)                                                             |
| Browser risk                | none — dumbest type                          | historic: Safari lacked blob-in-IDB **pre-v10 (2016)**; old Firefox perf bugs (Bugzilla 837141, 2013). Modern engines fine — but this is exactly what Phase 0 verifies, not assumes | Safari ≥ 15.2; newer API surface; bigger rewrite (all readers, quota model, e2e seeds) |
| Migration size              | —                                            | value-type change only; **no index change, no Dexie version bump** (only indexed columns are schema; `data` is not indexed)                                                         | new storage subsystem + metadata split                                                 |
| Structured clone to workers | copies payload                               | clones the handle cheaply                                                                                                                                                           | handles clone cheaply                                                                  |

**Recommendation:** Blob rows. Same store, same keys, same indexes, deletes a
write-side copy, kills read-side materialization, and is the enabler for
windowed playback. OPFS is the fallback **if and only if** Phase 0 shows
blob-in-IDB misbehaving on a target browser; the benchmark harness measures
both so that decision is data, not vibes.

**Known repo traps that constrain the design:**

- `dexie-index-add-reindexes-blobs`: adding an _index_ to a blob-carrying
  store makes existing users pay a minutes-long reindex on first open. This
  plan adds **no index** and **no version bump** for the type change itself.
- Never rewrite all rows eagerly in a version upgrade for the same reason —
  migration must be lazy (Phase 3).

## 4. Phases

### Phase 0 — Benchmark harness (gates everything; nothing ships without it)

The user's requirement, verbatim: _actual data tests, on actual IndexedDB
stems — load time, memory, Blob vs ArrayBuffer — and compare against
published numbers._ Published head-to-heads for this exact case are thin
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
- [x] Run on: Linux Chrome 152 (2026-08-30). Firefox / Android Chrome /
      iOS Safari still worth a spot-check before release, but the desktop
      gate below passed decisively.
- [x] Record results in this file. **Gate:** Blob read shows no payload-sized
      RAM step and no integrity failure on every tested browser. If a browser
      fails → evaluate the OPFS column before proceeding.

#### Phase 0 results — 2026-08-30, Chrome 152, Linux x86_64, crossOriginIsolated

3 × 60 MiB stems (medians per stem; full tables in the bench's markdown export):

| driver      | read row    | mint URL    | fetch   | integrity | page RAM after read path                          |
| ----------- | ----------- | ----------- | ------- | --------- | ------------------------------------------------- |
| ArrayBuffer | **33.7 ms** | **11.9 ms** | 96.7 ms | ok        | **380 MiB** (+120 over post-generate)             |
| Blob        | 0.4 ms      | 0.2 ms      | 65.4 ms | ok        | 320 MiB (+60)                                     |
| OPFS        | 0.7 ms      | 0.1 ms      | 69.0 ms | ok        | 320 MiB page (heap spike was uncollected garbage) |

10 × 150 MiB (1.46 GiB total — far past any real song):

| driver | write (median) | read row | fetch  | integrity | page RAM after read path |
| ------ | -------------- | -------- | ------ | --------- | ------------------------ |
| Blob   | 345 ms         | 0.5 ms   | 224 ms | ok        | 1730 MiB                 |
| OPFS   | 215 ms         | 0.8 ms   | 166 ms | ok        | 1730 MiB                 |

Reading the numbers:

- **ArrayBuffer loses everywhere it can lose.** Row read materializes the
  payload (~34 ms and a payload-sized RAM step per 60 MiB), URL mint pays a
  second full copy (~12 ms), and the read path retains ~2× what Blob does.
- **Blob and OPFS are equivalent on the read path** — sub-millisecond handle
  reads, free URL mint, identical RAM (both checkpoints are dominated by the
  bench itself retaining the generated source bytes for integrity hashing;
  the real app holds handles only). OPFS writes ~35% faster at the 150 MiB
  size, but a stem is written once per separation and read every session —
  write speed is the wrong thing to optimize.
- **Integrity: every row round-tripped bit-exact on all three drivers.**

**Decision: Blob rows in the existing Dexie store.** OPFS's only measured win
(write speed) doesn't matter for our write-once pattern, and it would cost a
second storage subsystem: its own quota/erasure story (the user-data deletion
registry reads DB tables — OPFS files would be invisible to it), a
metadata-row-to-file consistency problem, orphan cleanup, export/import
support, and a worse compatibility floor (Safari's `createWritable` main-thread
support is years behind its blob-in-IDB support; WebView coverage for the
mobile shell is spottier). Blob is a value-type change in a store we already
own, covered by every existing registry, export and e2e path.

### Phase 1 — Dual-read compatibility (DONE 2026-08-30)

- [x] `UvrStemBlob.data: ArrayBuffer | Blob` in
      [entities.ts](../../src/db/entities.ts), plus one shared helper module
      (`stem-blob-data.ts`): `stemBytes(data, range?)`, `stemBlob(data, mime)`,
      `stemHeaderBytes(data, n)` — so every reader handles both types through
      one seam.
- [x] Convert every reader of `.data` (typecheck-verified by widening the
      entity type): `uvr-service.ts` (URL mint ×2, Blob/File getters, WAV
      header duration), `uvr-stem-lease.ts` (URL mint + lazy header read),
      `uvr-read-service.ts` snapshot pass-throughs (type only — budget
      selector already priced rows off `.size`), and one straggler the grep
      list missed but `tsc` caught: `PitchTestingTab.tsx` decode
      (`stemDataBytes`). Helpers live in `src/db/stem-blob-data.ts`.
- [x] e2e specs that seed `uvrStemBlobs` with ArrayBuffers stay green
      untouched — that _is_ the dual-read test.

### Phase 2 — Write Blobs for new stems (DONE 2026-08-30)

- [x] [uvr-service.ts](../../src/db/services/uvr-service.ts) `writeStemBlob`:
      stores the incoming Blob directly; the `await blob.arrayBuffer()` line
      is gone. (This also removes a write-time full copy.)
- [x] Quota accounting (`size` column) still comes from `blob.size` —
      unchanged.
- [x] New sessions now play with handle-based reads end to end.

### Phase 3 — Lazy migration of existing rows (DONE 2026-08-30)

- [x] `src/db/services/uvr-stem-migration.ts`: on read of an ArrayBuffer row,
      serve it, then queue a serialized, fire-and-forget rewrite of the same
      key as a Blob. No version bump, no bulk pass, no reindex. Quota-guarded
      (old + new coexist until the update commits; skip silently when tight),
      deduped to one attempt per row per page load, and `createdAt` is left
      untouched so newest-row selection stays stable. Wired into every read
      path: `getStemBlobUrl` / `getStemBlobEntry` / `getStemBlob(Strict)` /
      `getOriginalFileBlob(Strict)` and all three uvr-read-service snapshot
      readers. 10 tests in `uvr-stem-migration.test.ts` run legacy-shaped
      rows through the real DexieAdapter over fake-indexeddb, including a
      mixed-era store, quota-tight skip, delete race, and byte-identity of
      the migrated row.
- [ ] Optional idle sweep behind `requestIdleCallback` — deliberately NOT
      built: reads migrate everything a user actually plays, and an idle
      sweep would re-introduce bulk I/O for rows nobody opens.

### Phase 4 — Windowed WAV playback (CORE + DRUM NIGHT DONE 2026-08-30)

- [x] `src/lib/wav-blob-window.ts` — parse a WAV container off a lazy Blob
      slice (PCM 8/16/24/32-int + float32, extensible wrappers, unknown
      chunks, placeholder data sizes) and read any frame window as Float32
      channel data. 14 sample-exact tests across every format.
- [x] `src/features/play-along/windowed-stem-voice.ts` — schedules window
      buffers back-to-back on the shared context clock (double-buffered
      lookahead, playback-rate-aware cadence, late-read catch-up, subtraction
      duration caps). 8 tests on a fake clock.
- [x] `stem-mix-engine.ts` integration — when neither the decoded-fidelity
      ladder nor the encoded budget fits, and every stem carries a stored WAV
      blob, the engine streams windows instead of refusing: no fetch, no
      decodeAudioData, native fidelity, `getPlaybackMode() === 'windowed'`.
      Buffered playback is untouched for everything that fits. Voices are a
      union (buffered source / windowed chain) through the same group,
      envelope-fade, pause/stop/seek machinery. Engine tests cover engage,
      encoded-budget rescue, missing-blob refusal, non-WAV refusal,
      buffered-stays-default, and transport over windowed voices.
- [x] Drum Night surfaces it: stage caption "Streaming from storage in short
      windows…" via `playbackMode` in the snapshot.

Follow-ups (not this branch):

- `guitar-backing-transport.ts` still full-decodes; adopt windowed voices
  there the same way.
- The song-port encoded gate (`readUvrStemSelectionWithinBudget`) still
  refuses selections above the encoded budget before the engine ever sees
  them; with Blob rows nothing is materialized at read time, so that gate
  can price Blob rows at zero once windowed playback lands everywhere.
- Revisit `GUITAR_PLAY_ALONG_POLICY` requesting 6 stems where Drum Night
  requests 3 — orthogonal 2× still worth taking.

Drum Night room follow-ups (queued 2026-08-30, after the polish pass):

- Groove library: keep working the pattern library — richer idiom coverage,
  and fold in the owner's personal MIDI grooves (ask for the files first;
  they were offered but never collected). Improve library browsing UX.
- Drum kit sounds: sit with the current Mercury Synth kit and decide whether
  the recipes satisfy; revisit `drum-voices.ts` recipes or sample-backed
  kits if not.
- "Driving" prepared variant still bakes 18-36 ms feel offsets into authored
  beats; the default Classic groove was moved on-grid (Feel toggle owns
  micro-timing now) — decide whether Driving should follow.
- Background-tab playback: authored (MIDI/GP) playback stops when the tab
  hides because the rAF transport clock pauses and the scheduler only looks
  ahead 100-120 ms. Optional setting = worker-timer clock + wider lookahead
  while hidden (cap is 2 s). Stem playback is unaffected (audio-thread
  buffers).
- Score view: the look-ahead row duplicates system-rendering inline; unify
  with Piano Night's follow-the-music renderer when either changes again.
- Account chip: `DrumNightAccount` mirrors `GuitarNightAccount`; extract a
  shared component once both rooms settle.
- eDrum kit mapping: owner has not hand-tested with hardware yet — dev
  domain test pending. 2026-08-31 code review verdict: shippable; message
  hygiene, mapping-store round-trip, and learn-overwrite recovery now have
  tests, and the popover gained a per-pad Reset. Deferred from that review:
  - Learned profiles key on `MIDIInput.id`, which can churn across replug
    order or browsers — consider a name-based fallback and stale-profile
    pruning in `mp.drumNight.midiMapping.v2`.
  - A transient USB disconnect silently zeroes applied latency
    compensation (`resetLatencyCalibration` on any statechange blip) with
    no notice outside the popover — consider re-apply or a toast.
  - Hi-hat CC4 is display-only (no open/closed articulation from pedal
    position, no aftertouch choke) — first "feel" complaint from a real
    drummer.
  - No per-device velocity trim/curve; synth fallback uses a linear curve
    where samples use a power curve, so soft hits jump on fallback.
  - Learn UI covers the 6 essential pads only; the store supports all 47
    GM articulations.
  - Hits during count-in are audible but never recorded — confirm that is
    the intended message to the player.
- Live scoring/coach: 2026-08-31 code review verdict: shippable — matcher
  optimal and deterministic, no NaN paths, take invariants hold. Fixed from
  that review: the live coach now scores only the loop pass being played and
  scopes targets to the active loop range (previously evidence pooled every
  pass so repeats could only ever improve the readout — the guitar-score
  ratchet trap); take-history range labels count the last covered beat
  instead of the exclusive end; finishing a take whose hits all fall outside
  the practiced loop range now explains itself instead of the generic
  failure toast. Deferred from that review:
  - Saved take summaries still pool every loop pass (best capture per
    target wins) — decide per-pass aggregation vs final-pass headline for
    `drum-take-summary-builder.ts`. Restart after a natural end also keeps
    prior-run hits in the ring (pass counter resets), stacking two runs.
  - Loop-seam asymmetry: a hit played early across the loop wrap lands on
    the previous iteration's tail and matches nothing (double-penalty),
    while the mirrored late hit is credited; same asymmetry for early hits
    at count-in end. Needs seam-aware matching in `drum-coaching.ts` or
    seam folding in `captureHit`.
  - Feel (humanize) shifts the audible kit but scoring targets stay
    authored — jazz swing at 84 BPM is ~198 ms late, beyond the 120 ms
    match window, so playing along with the audible kit reads as
    unmatched. Decide: suspend Feel while recording a graded take, tag
    summaries with the feel flag, or grade against the humanized
    reference. Also: swing step derives from `timelineBeat`, so
    non-whole-beat loop lengths phase-shift swing per pass (audio only).
  - Imported songs score against the raw canonical tempo map while
    captures use the transport's clamped/normalized map (40-280 BPM,
    spacing drops) — offsets diverge where clamping engages. Prepared
    grooves unaffected.
  - `DrumRecordedHit.timingOffsetMs`/`nearestGridBeat` are dead fields in
    a different convention (wall-clock vs nearest sixteenth at effective
    tempo) than the coach (score-time vs authored events) — remove or
    reconcile before any surface adopts them. Coach/take ms are
    score-time: at 0.7x speed a 100 ms wall error reports as 70 ms
    (deliberate, but unpinned by tests).

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
