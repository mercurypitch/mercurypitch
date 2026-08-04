# Per-word LRC: mapper passes, alignment algorithms, and the lyricsfile standard

**Status:** research only — nothing implemented. Follow-up to
[lyrics-word-sync.md](lyrics-word-sync.md), which covers the latency/onset/
forced-alignment groundwork already partly shipped (`src/lib/word-sync.ts`,
`canonical-lrc.ts`, `wordEndTimings` / `wordSweepTimings` in
`src/features/stem-mixer/types.ts`). 2026-08-04.

Five questions, answered in order:

1. Two-pass mapping (line starts, then inner words)
2. Click-a-line → play it with live highlighting
3. What alignment algorithms exist, and how we benchmark against the gold map
4. Should we adopt LRCLib's `lyricsfile` standard
5. Can we host LRCLib's database ourselves and serve it from our API

---

## 1. Two-pass mapping

### Why the current single pass is the wrong shape

`handleNextWord` (`useStemMixerLyricsController.ts:1853`) fuses two jobs into
one gesture. At `wordIdx === 0` it stamps **both** the line time and word 0,
then every subsequent tap stamps a word. So the operator is doing
line-boundary work and inner-word work in the same continuous stream, at
whatever density the song happens to have.

That is the root of the difficulty. Line starts are the timings we usually
*already have* (LRCLib ships line-level LRC), and they are also the ones the
listener can hear most clearly — a line start is preceded by a breath and
usually a gap. Inner words are the hard, dense, unforgiving part. Fusing them
means a flubbed line boundary corrupts the words after it, and a flubbed word
run pushes you into the next line late.

### The design

**Pass 1 — line starts.** Only `handleNextLine` is live. One tap per line.
Skippable in one click when LRCLib line times are already loaded and look
sane, which is the common case. Its real value is *correction*: play through,
tap only the lines that drift, leave the rest. This is close to already
working — `handleNextLine` (`:1782`) exists and does the right thing, and
there's a `LrcGenInputMode = 'marker' | 'tap'` axis in `types.ts` to hang a
mode off. What's missing is a pass concept that suppresses word advancement
and a UI that says "you are placing line starts".

Note the interpolation branch at `:1824` — when you leave a line early it
back-fills the remaining words at a flat 0.25 s spacing. In pass 1 that must
not fire, because pass 2 is going to place those words for real. Guarding it
on the pass is the one behavioural change inside the existing handler.

**Pass 2 — inner words.** Line starts are frozen and treated as ground truth.
For each line the mapper pre-seeds `wordTimings[line][0] = lineTime` and
starts the cursor at **word index 1**. Single-word lines are skipped entirely
(they are fully determined by their line start). The playhead can now do
something it cannot do today: **auto-seek to each line's start minus a
pre-roll** (~1.5 s), so the operator hears the run-in, taps the inner words,
and is teleported to the next line rather than sitting through instrumental
gaps. On a song with long instrumental sections this alone is a large time
saving, and it makes the "3 words in 800 ms" problem tractable because you can
loop a single line at 0.5x until it's right without leaving the pass.

This is also where the existing per-line redo naturally lives: a bad line is
just "stay on this line and re-run it", not a global rewind.

### What it costs

The state to add is small — a `lrcGenPass: 1 | 2` signal, a guard on the
`handleNextLine` back-fill, a cursor initialiser that starts at word 1, and a
line-skip predicate for single-word lines. The bulk of the work is UI: the
pass switcher, the "skip pass 1" affordance, and the per-line pre-roll seek.
The mapper controller is already 97.8 KB and on the oversized list, so this
should land as a new sibling module (`lrc-gen-passes.ts`) holding the pure
pass/cursor logic, with the controller only wiring signals — consistent with
how `lrc-gen-engine.ts` and `overview-mapping.ts` were split out.

### One caveat worth stating

Pass 2 inherits pass 1's line starts as word 0. If a line start is late by the
operator's reaction latency, every word in that line is measured against a
late anchor. So pass 1 quality gates pass 2.

Latency compensation is **already shipped**, contrary to what the earlier plan
implies: `lrcTimingOffsetMs` is a persisted signal
(`pitchperfect_lyrics_timing_offset_ms`, default **180 ms**, clamped 0–500) at
`useStemMixerLyricsController.ts:348`, subtracted by `correctedTime` (`:1777`),
and exposed as a "Reaction" number input in the gen UI
(`StemMixerLyricsPanelBody.tsx:638`). A playback-speed select sits next to it.

So the gap is **measurement, not the knob**. Today the operator guesses a
number, or accepts a population-average 180 ms that may be 60 ms off their
personal reaction time — which is a large error at word granularity. The
calibration flow is small: play a click track, take ~10 taps, use the
**median** signed error (median, not mean — one distracted tap shouldn't move
it), write it into the existing signal. Everything downstream already consumes
it. Worth doing before the gold map, because a gold map is only gold relative
to a correctly calibrated offset.

---

## 2. Click a line → play it with highlighting

Today the mapper can play from a line but renders the mapper's own list, so
verifying "does this actually look right at runtime?" means leaving the mapper
and loading the song in the normal player. That round trip is why timing bugs
survive the mapping session.

The fix is to render the *real* karaoke highlighter inside the mapper as a
preview strip, driven by the in-progress timings rather than the saved ones.
The renderer is already isolated in the pieces that matter — `lyric-sweep.ts`,
`lyric-sung-end.ts`, and `computeActiveWord` in `lyrics-service.ts` are pure
enough to be fed a candidate timing map instead of the committed one. So the
preview is a data-source swap, not a second renderer.

Behaviour: click a line → seek to `lineStart - preRoll`, play until the line's
last word plus a tail, highlight with the live word timings, then stop (or
loop, which is what you actually want while iterating). Space re-triggers the
same line. Because it's the production renderer, whatever you see is what
ships — including the end-time and sweep behaviour that `wordEndTimings` /
`wordSweepTimings` drive.

This pairs so naturally with pass 2 that they should probably ship together:
pass 2 is "tap the words of this line", preview is "watch that line back". Same
selection, same pre-roll, same loop.

---

## 3. Alignment algorithms, and how to benchmark them

### The task has a name and a standard benchmark

What we want is **automatic lyrics alignment** (ALA) — text is known, find the
timings. The field's standard benchmark is **JamendoLyrics**: 80 Creative
Commons songs across several languages with human word-level start *and end*
times, which is exactly the shape of data your hand-mapped song will be. It
was extended to **Multi-Lang JamendoLyrics** for the multilingual work. The
metrics everyone reports are:

- **MAE / Median AE** — mean and median absolute error of word onsets, in
  seconds. Median matters more than mean for us because a handful of
  catastrophic misalignments shouldn't hide otherwise-good behaviour.
- **PCO (Percentage of Correct Onsets)** — fraction of words whose onset is
  within a tolerance, conventionally 0.3 s. For karaoke feel, 0.3 s is far too
  loose — we should report PCO at 0.3 / 0.15 / 0.08 s and treat **0.08 s** as
  the "feels locked" bar.

Current SOTA on JamendoLyrics sits **below ~0.2 s average absolute error**,
with the contrastive cross-modal embedding approach from Spotify Research
being the notable simple-to-train end-to-end system. A DAFx 2025 paper adds a
masked cross-entropy loss and reports best-in-class median AE.

### The finding that matters most for us

An **ISMIR 2025 late-breaking paper evaluates alignment specifically under
source-separated conditions** — i.e. our exact pipeline, where alignment runs
on a UVR vocal stem rather than a studio stem. Its conclusion is that
alignment accuracy tracks vocal separation quality, and that models degrade
noticeably on separated vocals versus clean stems, because they were tuned on
one particular separation front-end and don't generalise across separators.

Two consequences:

- Our planned **BS-RoFormer upgrade (12.9 SDR, replacing MDX HQ_3)** is not
  just a stem-quality win, it is directly an *alignment accuracy* win. The two
  roadmap items reinforce each other and should be sequenced together.
- Any published accuracy number is an upper bound for us. We must measure on
  **our own separator's output**, which is precisely what the gold map is for.

### The candidate algorithms, cheapest first

| # | Approach | Where it runs | Expected onset error | Cost |
|---|---|---|---|---|
| C | Spectral-flux onset grid + syllable-weighted distribution | Browser, pure DSP | ~150–300 ms | ~0, no download |
| B | Whisper word timestamps (DTW over cross-attention), snapped to onsets | Browser, WASM | ~200–400 ms, worse near pauses | model download |
| A | wav2vec2 phoneme CTC forced alignment (WhisperX-style) or MFA | RunPod GPU, in the UVR job | **<100 ms** | seconds of GPU |
| A+ | Contrastive cross-modal / joint pitch+alignment (research-grade) | RunPod GPU | best published | research effort |

The important asymmetry: **forced alignment is a much easier problem than
transcription**, because the text is already known. That is why option A jumps
a whole accuracy tier over option B for a comparable amount of compute, and
why it's the one worth building properly. The half of `word-sync.ts` that
already exists (`countSyllables`, `layoutLineWords`, onset snapping) is the
scaffolding for C and is reusable as the *post-processor* for A and B — snap
whatever the model says to real vocal onsets, clamp monotonic, clamp inside
the line.

### The benchmark harness

This is the concrete reason to finish the gold map, and it should be built as
a checked-in script rather than a one-off:

1. **Gold set** — the hand-mapped demo song, exported with word starts *and*
   ends. One song is enough to catch gross failures but not to rank close
   candidates; budget 3–5 hand-mapped songs across tempo/density before
   trusting a ranking. Fast rap and slow ballad fail differently.
2. **Fixture** — freeze the separated vocal stem alongside the gold JSON so
   runs are reproducible and separator changes are a deliberate variable.
3. **Metrics** — MAE, median AE, PCO@{0.3, 0.15, 0.08}, plus a **latency-bias**
   number (mean *signed* error). Signed bias is the one that predicts "feels
   late" and it's the one a global offset can fix for free.
4. **Perf** — wall-clock and peak memory per algorithm, measured on a
   throttled profile, since "runs fast on slow devices" is a stated
   requirement. Option C must hold a 60 fps budget on mid-range Android; A/B
   are offline so only total job time matters.
5. **Report** — a table per algorithm per song, so a regression in the
   separator or the aligner is visible as a number.

Worth noting for the gold map itself: your taps carry reaction latency, so the
"gold" is only gold after latency compensation is calibrated. Otherwise you
will benchmark algorithms against a systematically late reference and reward
the ones that are also late. Calibrate first, then map.

---

## 4. The `lyricsfile` standard — adopt it

### What it is

A YAML format, version `"1.0"`, from the LRCLib author. Root fields:
`version`, `metadata`, `lines`, `plain`. Metadata carries `title`, `artist`,
`album`, `duration_ms`, `offset_ms`, `language`, `instrumental`. Each line has
`text`, `start_ms`, optional `end_ms`, and an optional `words` array; each word
has `text`, `start_ms`, optional `end_ms`. All times are integer milliseconds
from track start. Concatenating word `text` must reconstruct the line exactly,
so spacing lives inside the word strings.

### It is not hypothetical — it is landing in LRCLib now

Verified against the live API today: `GET /api/get/:id` already returns a
**`lyricsfile`** field in its response body (currently null for old entries).
The server repo carries migration `05-add-lyricsfile-to-lyrics`
(`ALTER TABLE lyrics ADD COLUMN lyricsfile TEXT` + `has_lyricsfile` + index),
and the implementation plan describes an additive Phase 1: `lyricsfile`
becomes an optional field on `POST /api/publish`, takes precedence over
`plainLyrics`/`syncedLyrics` when present, and appears on all read endpoints
with no breaking change to existing fields.

So the ecosystem's word-sync interchange format is being decided right now, by
the source we already fetch from.

### How it compares to our model

| Concept | Ours | lyricsfile | Verdict |
|---|---|---|---|
| Word starts | `WordTimingsMap` = `Record<lineIdx, number[]>`, seconds | `words[].start_ms`, integer ms | equivalent |
| Word ends | `wordEndTimings` (same shape) | `words[].end_ms` | equivalent |
| Line start/end | `CanonicalLrcEntry.time` | `start_ms` / `end_ms` | equivalent |
| Global offset | — | `metadata.offset_ms` | **they have, we don't** |
| Language / duration | — | `language`, `duration_ms` | **they have, we don't** |
| Non-linear sweep | `wordSweepTimings` (time→progress curve) | — | **we have, they don't** |
| Rests / countdown | `~Rest~` + `gapStart`/`gapEnd`/`dotCount` | — | **ours, derivable** |
| Blocks / repeats | `LyricsBlock`, `BlockInstancesMap` | — | **ours, authoring-only** |
| Extensions | — | **none defined** | friction |

We are a near-superset. Three of our concepts have no home in the spec:

- **`wordSweepTimings`** is genuinely novel — a per-word time→progress curve
  for held and segmented vowels. Nothing in the spec expresses it, and the
  spec explicitly puts animation out of scope. This is the piece worth
  proposing upstream.
- **Rests** are pure presentation and fully derivable from line gaps, so they
  should stay a render-time concept and never be serialised. `canonical-lrc.ts`
  already computes them from gaps, so nothing is lost.
- **Blocks/repeats** are authoring state, not lyrics data. They belong in our
  project format, not in an interchange file.

### The one real friction

The spec defines **no extension mechanism** and does not say what a reader
should do with unknown fields. So carrying `wordSweepTimings` in-band is
formally undefined behaviour, even if in practice YAML parsers ignore extra
keys. Options, in order of preference: (a) propose a namespaced extension
block upstream — the format is at 1.0 draft and the author is actively
iterating, so this is a genuinely open door; (b) keep sweeps in a sidecar we
own and treat lyricsfile as the lossy-but-standard export; (c) carry an
`x-`-prefixed key and accept the risk.

**Recommendation: adopt lyricsfile as the interchange format** — import and
export — and keep our richer internal model. Concretely that means a
`src/lib/lyricsfile.ts` with parse/serialise plus round-trip tests, wired into
the existing upload path (`LyricsUploadResult` already carries an optional
`wordTimings`, so word-synced import has a seat waiting) and into export
alongside enhanced LRC. Adding `offset_ms`, `language` and `duration_ms` to our
model is cheap and useful independently — a global offset control is the
single fix for "the whole song is 200 ms late", which is currently unfixable
without remapping.

The upside beyond file compatibility: once `POST /api/publish` accepts
`lyricsfile`, our hand-mapped songs can be **contributed back**. We'd be one
of the first sources of high-quality word-synced data in the ecosystem we
already depend on, which is worth more to us as goodwill and as a data
flywheel than keeping the maps private.

---

## 5. Hosting LRCLib ourselves — the numbers say no, and the timing says wait

### Hard numbers

- The dump at the URL you gave is **31,697,733,535 bytes ≈ 30 GiB compressed**
  (`content-length`, verified; `last-modified` 2026-07-20). Text-heavy SQLite
  typically compresses 3–5x, so decompressed it is plausibly **90–150 GB**.
- **Cloudflare D1 caps a database at 10 GB** (paid; 500 MB free), 1 TB per
  account across databases, and **bulk import is capped at 5 GB**.

So the full database is roughly **3x over the D1 per-database limit while still
compressed**, and 10–15x over once expanded. Serving all of LRCLib from a
single D1 is not possible. It isn't a tuning problem, it's an architecture
mismatch: D1's 10 GB ceiling is a property of its design, and Cloudflare's
own guidance for exceeding it is to shard across databases.

There is also a **local disk problem**: 118 GB free on `/home`. The 30 GB
download fits, but decompressing it very likely does not, and `sqlite3` needs a
seekable file so you cannot stream-decompress into it. Archiving the `.gz`
untouched is fine; *processing* it needs a machine with ~150 GB of scratch.

### Why the dump is so large — and how much of it we'd actually want

From the schema: `lyrics` is **append-only revision history**. Every
submission for a track is a row, and `tracks.last_lyrics_id` points at the
current one. On top of that sits an **FTS5 index** (`tracks_fts`) and nine
secondary indexes. So the 30 GB is history + indexes + both `plain_lyrics` and
`synced_lyrics` for every revision.

A serving copy needs almost none of that. The shrink levers, roughly in order
of payoff:

1. **Latest revision only** — join `tracks.last_lyrics_id`, drop the history.
2. **Drop `plain_lyrics`** where `synced_lyrics` exists — we want timings.
3. **Drop instrumentals** and rows with no lyrics at all.
4. **Rebuild FTS** at the end rather than importing it, or drop it in favour of
   an artist/title normalised index.
5. **Restrict to the languages we serve**, if we ever want a hard cap.

Whether that lands under 10 GB is genuinely unknown until measured — I'd guess
it gets close but not comfortably under, and "close to the ceiling" is a bad
place for a database that only grows. Measure before designing around it.

### The three real options

**Option 1 — proxy + cache (recommended now).** Keep fetching from
`lrclib.net`, but route through our Worker with a KV or R2 cache keyed on the
normalised artist/title/duration. Solves the actual stated problem — "smoother
when the LRCLib API misbehaves" — at a tiny fraction of the effort, gives us
per-song cache hits that get faster over time, and removes the client's direct
dependency on a third-party host. It also gives us a place to *merge in* our
own word-synced maps, so our hand-mapped songs win over LRCLib's line-only
ones transparently. Note the current client calls `lrclib.net` directly from
the browser (`lyrics-service.ts:158`), so this is also a small privacy and
reliability improvement.

**Option 2 — R2 + HTTP-range SQLite.** Put the (subsetted) SQLite file in R2
and query it with range requests, `sql.js-httpvfs`-style. R2 objects go to 5 TB
and egress is free, so size stops being the constraint. But it's read-only,
page-cache behaviour is awkward, and query latency is multiple round trips.
Reasonable as a *fallback* tier behind the cache; poor as the primary.

**Option 3 — subset into D1.** Only viable after measuring the subset, and it
imports through the 5 GB bulk-import cap so it'd need chunking. It buys real
SQL over the corpus (fuzzy matching, duration-window search) which the proxy
can't do. Worth it only if we discover we need corpus-wide queries — which,
today, we don't.

**Sequence: Option 1 now. Measure the subset while the dump is archived.
Revisit 2 or 3 only if a concrete need for corpus-wide querying appears.**

### And the timing argument

LRCLib is adding `lyricsfile` right now, and the `lyricsfile` column will be
empty in the 2026-07-20 dump for essentially every row. A snapshot taken today
captures the *old* world. If the plan is word-synced lyrics, the valuable data
doesn't exist in this dump yet — it will accumulate over the coming months in
the live API. That's another vote for proxy-and-cache (always current) over
snapshot-and-host (frozen, and frozen on the wrong side of the format change).

Archiving the dump is still worth doing as insurance — LRCLib is one person's
project, MIT-licensed, and a corpus that disappears would be painful. Just
treat it as a backup, not as the foundation of a feature.

---

## Suggested order

1. **Latency calibration** — measure the offset instead of guessing it; the
   signal, persistence and UI already exist, only the 10-tap measurement is
   missing. Gates the quality of the gold map.
2. **Two-pass mapper + line preview** — they share selection and pre-roll
   machinery, and together they make finishing the gold map realistic.
3. **`lyricsfile` import/export** — small, standards-aligned, unblocks
   contributing back; add `offset_ms`/`language`/`duration_ms` while there.
4. **Benchmark harness + gold set** (3–5 songs) — the measuring stick.
5. **Proxy + cache in front of LRCLib** — independent of all the above, small,
   and fixes a real reliability complaint.
6. **Forced alignment on the RunPod GPU job**, sequenced with the BS-RoFormer
   upgrade, measured against the harness.

## Sources

- [lyricsfile specification](https://github.com/tranxuanthang/lyricsfile/blob/main/SPECIFICATION.md) and [word-synced example](https://github.com/tranxuanthang/lyricsfile/blob/main/examples/word-synced.lyricsfile.yaml)
- [LRCLib server (MIT)](https://github.com/tranxuanthang/lrclib) — `LYRICSFILE_IMPLEMENTATION_PLAN.md`, migration `05-add-lyricsfile-to-lyrics`
- [LRCLib DB dumps](https://lrclib.net/db-dumps)
- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Choosing a data or storage product (Cloudflare)](https://developers.cloudflare.com/workers/platform/storage-options/)
- [JamendoLyrics benchmark](https://github.com/f90/jamendolyrics)
- [Evaluating Lyrics Alignment under Source Separated Conditions (ISMIR 2025)](https://ismir2025program.ismir.net/lbd_412.html)
- [Contrastive Learning-based Audio to Lyrics Alignment (Spotify Research)](https://research.atspotify.com/publications/contrastive-learning-based-audio-to-lyrics-alignment-for-multiple-languages)
- [Improving lyrics-to-audio alignment using frame-wise losses (DAFx 2025)](https://staff.aist.go.jp/m.goto/PAPER/DAFX2025cheng.pdf)
- [Jam-ALT readability-aware lyrics transcription benchmark](https://audioshake.github.io/jam-alt/)
- Prior work: [docs/plans/lyrics-word-sync.md](lyrics-word-sync.md)
