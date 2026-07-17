# Lyrics word-sync: deep dive + improvement plan

Investigation into (a) why our word highlighting feels off, (b) what Apple
Music actually does, (c) whether the vocal stem can auto-generate word-level
LRC via forced alignment, and (d) how to make the manual tap-mapping flow
dramatically easier. 2026-07-17.

## 1. How our pipeline works today

**Data model** (`WordTimingsMap`, `src/features/stem-mixer/types.ts`): per
line, an array of word **start** times only. No end times. This mirrors the
enhanced-LRC (A2) format `<mm:ss.xx>word`, which also carries starts only.

**Manual mapping** (`handleNextWord`,
`useStemMixerLyricsController.ts:1291`): each tap stamps
`elapsed()` as the start of the *current* word and advances. Partial runs are
merged/interpolated/monotonic-clamped by `lrc-gen-engine.ts`
(`buildFinalPartialTimes`), with untouched trailing lines estimated by
`estimateUnmappedTimes`.

**Rendering** (`computeActiveWord`, `src/lib/lyrics-service.ts:510`): the
active word's char-progress interpolates linearly from its start to the
*next word's start* (last word: average gap). Fallback without word timings:
even division of the line duration.

**Existing-but-unused assets** highly relevant here:

- `WhisperService` + `useWhisperTranscription`: in-browser Whisper
  (worker, 30s chunks, 5s overlap, dedup, IndexedDB persistence) — currently
  yields **segment**-level `{text, [t0, t1]}` only.
- `pitch-word-alignment.ts` (`alignPitchToWords`): maps Whisper segments +
  detected vocal notes to words with confidence scores — built for the
  pitch-testing tools.
- The pitch detector already extracts note onsets from the **clean vocal
  stem** during playback.

### Why it "always feels lacking" — concrete defects

1. **Reaction latency bakes into every tap.** Human audio-motor reaction is
   ~180–250 ms; every word start lands late by that amount, uniformly. The
   highlight therefore always trails the singer. Nothing compensates.
2. **No end times.** A held word ("staaaay…" then silence) highlights across
   the whole gap to the next word's start — it sweeps too slowly through the
   hold or finishes early, and rests inside a line smear.
3. **Fast runs are untappable.** 10 words in ~2 s needs 5 taps/second with
   millisecond placement — beyond human ability at 1x. (Slowing playback
   helps and already exists, but isn't the default in gen mode.)
4. **Char-progress is stepped per character** (`Math.floor`), not a smooth
   sweep, so even perfect data renders slightly mechanically.

### Answer to "when do I tap?"

**At the start of the word** — that's what the data model stores and what the
renderer assumes. Never at the end. With latency compensation (below), "tap
when you hear the word begin" becomes exactly right.

## 2. What Apple Music does

- Format: **TTML** (W3C Timed Text), one `<span>` per word (sometimes per
  syllable) with `begin` **and** `end` attributes at ms precision — that's
  why holds and rests render perfectly. iOS 16's Apple Music Sing added the
  per-word karaoke view on top of it.
- Content: predominantly **human-authored** timings from providers
  (Musixmatch / LyricFind — Musixmatch crowdsources word-sync in its app),
  with forced-alignment tooling assisting; not magic ML at play time.
- Rendering: continuous gradient sweep across the active word plus dimmed
  neighbours; duration comes from begin→end, so sustained notes dwell.

Takeaways for us: (1) end times matter as much as start times; (2) even
Apple treats human timing as the gold standard with ML as the assistant —
which validates polishing our manual flow, not just replacing it.

## 3. Auto word-mapping from the vocal stem (forced alignment)

The task "align known text to audio" is **forced alignment**, and it's much
easier than transcription — we already have the lyrics text and a **clean
separated vocal**, which removes the polyphonic-music noise that degrades
speech models. The modern recipe (WhisperX): phoneme wav2vec2 + CTC →
sub-100 ms word timestamps (vs ~1 s drift from raw Whisper). Lyrics-specific
research (DALI dataset; alignment on separated vocals; joint pitch+alignment)
reports word-boundary errors well under 200 ms on separated vocals.

Three implementation options, not mutually exclusive:

### Option A — server-side alignment piggybacked on the UVR GPU job (best quality)
The RunPod worker already holds the freshly separated vocal stem on a GPU.
Add an alignment stage: run a wav2vec2 phoneme CTC forced aligner
(WhisperX's aligner, or MFA) against the user's lyrics text, emit word
`[start, end]` JSON next to the stems. Marginal GPU cost is seconds per
song; delivery rides the existing result payload. Studio-quality separations
would come back with studio-quality word sync — a genuine paid-tier feature.
Requires: lyrics known at separation time OR a separate "align lyrics"
endpoint that reuses the stored stem (R2 keeps it 24h; we'd want an
on-demand re-run for songs whose lyrics arrive later).

### Option B — in-browser Whisper word timestamps (works offline, rougher)
transformers.js supports `return_timestamps: 'word'` (DTW over
cross-attention) on our existing Whisper stack — a modest upgrade to
`WhisperService`. Known caveats: WASM-only for word mode until recently,
and words adjacent to pauses get stretched timestamps. Verdict: good enough
to *pre-fill* a draft that the user then nudges; not release-grade alone.
We then snap Whisper's word boundaries to our own **vocal onsets** (below)
to sharpen them, and fuzzy-match transcript→lyrics text (we already do
segment-level matching in `alignPitchToWords`).

### Option C — onset-assisted taps (no ML, ships first)
Compute a **vocal onset grid** from the stem (spectral-flux/energy onsets —
cheap DSP on the decoded AudioBuffer, no model download). Use it to:
- **snap taps**: any tap within ±120 ms of an onset snaps to it — turns
  sloppy fast-run taps into exact boundaries;
- **estimate ends**: a word's end = the energy dip before the next onset
  (fixes held words without hold-gestures);
- **auto-distribute**: tap only line starts, then distribute the line's words
  across the onsets inside the line span (syllable-count weighted when onsets
  are scarce).

**Recommendation:** ship C into the gen flow now (it upgrades every manual
session and needs no downloads), add B as "Draft with AI" for local users,
and build A as the flagship: paid separations return ready-made word-synced
LRC. All three converge on the same enhanced data model.

## 4. Manual gen-mode UX fixes (cheap, high impact)

1. **Latency compensation**: subtract a calibrated offset from every tap.
   One-time 10-tap metronome calibration (median offset, persisted), default
   200 ms until calibrated. Single biggest "feel" fix.
2. **Slow speed by default in gen mode**: enter word-mapping at 0.75x
   (0.5x for dense lines) and restore speed on finish — the user shouldn't
   have to remember the speed control exists.
3. **Hold-for-sustain**: press = word start, release = word end (only when
   hold > ~350 ms, so normal taps stay taps). Gives real end times for held
   notes; stored in an extended `wordEnds` map alongside `wordTimings`.
4. **Line-taps-only mode**: for dense songs, tap only line starts and let
   onset-based distribution (Option C) place the words. 10x fewer taps.
5. **Instant-redo**: a "re-do last line" button that rewinds playback ~4 s
   and clears just that line's timings — fixing a flub currently means
   finishing and editing afterwards.
6. **Tap anywhere**: in gen mode accept spacebar/any-tap on the lyric area,
   not a small button — halves motor load on phones.

## 5. Highlighter rendering fixes

1. **Respect end times when present** (`computeActiveWord`): sweep start→end,
   then hold the word fully-lit until the next start. With no explicit end,
   cap duration at `min(gap, syllables x 320 ms)` so rests stop smearing.
2. **Continuous sweep**: replace per-char stepping with a CSS gradient fill
   (background-clip: text, animated background-position) — smooth at any
   frame rate, cheaper than re-rendering char spans.
3. **Karaoke dwell**: on sustained words (end - start > 1 s), ease the sweep
   (fast attack, slow tail) — matches how singers actually hold syllables.

## 6. Suggested phasing

- **PR 1 (quick wins)**: latency offset + calibration; gen-mode default slow
  speed; instant-redo; renderer end-time support + gradient sweep.
- **PR 2 (onset engine)**: vocal onset extraction + tap snapping + line-only
  mode + end estimation. Pure client DSP, benefits everyone including free
  local users.
- **PR 3 (AI draft)**: Whisper word-timestamps upgrade + onset snap +
  text fuzzy-match → "Draft word sync" button with confidence colouring;
  user reviews in the existing edit mode.
- **PR 4 (server alignment)**: aligner container stage on the RunPod worker,
  words JSON in the result payload, client imports it as word timings —
  the paid-tier "it just works" path.

## Sources

- [Apple Music lyric sync engineering overview](https://medium.com/@ethchor/how-apple-music-maps-audio-to-lyrics-the-engineering-behind-real-time-lyric-sync-a2485385c9a9)
- [Apple Music Sing / TTML word-by-word support](https://support.apple.com/en-us/105015)
- [WhisperX: time-accurate transcription (arXiv 2303.00747)](https://arxiv.org/html/2303.00747v2)
- [WhisperX repo — wav2vec2 forced alignment](https://github.com/m-bain/whisperX)
- [WhisperX vs MFA timestamp accuracy discussion](https://github.com/m-bain/whisperX/issues/1247)
- [transformers.js word-level timestamps](https://github.com/huggingface/transformers.js/issues/820) and [pause-stretching caveat](https://github.com/huggingface/transformers.js/issues/805)
- [Automatic lyrics alignment in polyphonic music — does background music help? (arXiv 1909.10200)](https://ar5iv.labs.arxiv.org/html/1909.10200)
- [Improving lyrics alignment through joint pitch detection (arXiv 2202.01646)](https://arxiv.org/pdf/2202.01646)
