<!-- Research + implementation plan. Status: proposal (not yet implemented). -->

# Automatic Musical Key Detection for PitchPerfect

Research + implementation plan for global and per-region key detection, feeding the cleanup snapper and a per-part key recommendation in the UI.

Status: proposal. Author: MIR engineering. Target: `src/lib/key-detection/`, integrating with `src/lib/scale-data.ts` and `src/lib/pitch-pipeline/`.

---

## 1. TL;DR

We want PitchPerfect to figure out the song's key by itself — both a single global key and, where the song modulates, a key per region — so we can (a) auto-fill / recommend the key+scale that the cleanup "amount" slider snaps notes to, and (b) show a per-part key recommendation in the UI. Today the user picks key+scale by hand, and that choice is fed straight into `snapMidiToScale` in `offline-segment.ts` step 3.

**How mathematically hard is it? Cheap.** The core of key detection is the Krumhansl-Schmuckler algorithm, which is nothing more than a correlation:

1. Build a 12-bin pitch-class histogram (how much of each of C, C#, ... B is present), weighted by duration.
2. Correlate that 12-vector (Pearson `r`, or cosine) against 24 key "templates" — one major and one minor profile, each rotated through all 12 tonics.
3. Take the argmax. The winning template names both the tonic and the mode.

That is ~24 dot-products over length-12 vectors — a few hundred FLOPs, a few dozen lines of TypeScript, no dependency, no FFT, no WASM. The expensive part of *audio* key detection is building a clean chroma vector from the spectrum; we sidestep that for the first phase because **the denoise pipeline already hands us a clean monophonic note list** (pitch + duration), which is exactly the symbolic input the algorithm was originally designed for.

The honest caveats: a melody alone *under-determines* the key (the relative major/minor share every diatonic note), so vocal-only detection is more prone to the classic relative/dominant/parallel confusions than full-mix harmony would be. The plan therefore (1) ships note-histogram global detection first as a *recommendation, not a silent transform*, (2) gates auto-apply on a confidence margin, (3) adds a full-mix audio-chroma path as a higher-accuracy tie-breaker, and (4) treats per-region/modulation as an explicit, smoothed, opt-in stage rather than something that silently re-snaps whole phrases.

Expected accuracy ballpark for a good template method: ~75-85% exact on tonal material, ~90%+ under MIREX-weighted scoring (which gives partial credit for near-misses). Vocal-only will sit at the low end of that; full-mix chroma raises it.

---

## 2. The algorithm in detail

### 2.1 Pitch-class profile (PCP)

A 12-element vector `x[0..11]`, where index 0 = C, 1 = C#, ..., 11 = B. Each bin holds the accumulated *salience* of that pitch class — for us, total sounding **duration in seconds**, octave-folded (`pc = midi mod 12`). Octave equivalence is automatic.

### 2.2 The 24 templates

There are only **two** base profiles, one major and one minor, each a 12-vector of scale-degree weights starting at the tonic. The other 22 templates are produced by **cyclically rotating** (transposing) those two base profiles through all 12 chromatic offsets. So the C-major template is the major base profile as-is; C#-major is it rotated by one semitone; and so on. This is why the whole model is just two vectors of 12 numbers plus a rotate loop.

### 2.3 Matching: Pearson correlation (or cosine)

For each of the 24 rotated templates `y`, compute the Pearson correlation against the observed profile `x`:

```
r = Σ (xᵢ − x̄)(yᵢ − ȳ) / sqrt( Σ (xᵢ − x̄)² · Σ (yᵢ − ȳ)² )
```

over the 12 bins, `r ∈ [−1, +1]`. Pearson centers and normalizes both vectors, so it is invariant to overall loudness and to a constant histogram offset. **argmax over the 24 templates gives key AND mode in one shot** — no separate mode classifier. The template means/variances can be precomputed once, reducing each comparison to a normalized dot product.

Cosine similarity `s = (x·y) / (‖x‖‖y‖)` is the cheaper alternative used by libKeyFinder/Mixxx (drops the mean-centering); we keep both behind a flag and default to Pearson for the symbolic path.

### 2.4 Which profile set, and why

All variants use the identical rotate-24-and-correlate machinery; only the two base vectors change. Ship several as named constants and let us A/B them:

| Profile | Source | Major base (from tonic) | Best for |
|---|---|---|---|
| **Krumhansl-Kessler (KK)** | probe-tone perception (1982) | `6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88` | the classic baseline |
| **Aarden-Essen** | folksong pitch-class counts | `17.7661, 0.145624, 14.9265, 0.160186, 19.8049, 11.3587, 0.291248, 22.062, 0.145624, 8.15494, 0.232998, 4.95122` | folk / pop melody |
| **Temperley / Kostka-Payne** | textbook corpus | `5, 2, 3.5, 2, 4.5, 4, 2, 4.5, 2, 3.5, 1.5, 4` | common-practice tonal |
| **Sapp "simple"** | hand-set 2/1/0 | `2,0,1,0,1,1,0,2,0,1,0,1` | didactic / very stable |
| **Sha'ath** | audio-tuned KK | pull exact numbers from libKeyFinder source | audio chroma path |

Corresponding minors:
- KK minor: `6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17`
- Aarden-Essen minor: `18.2648, 0.737619, 14.0499, 16.8599, 0.702494, 14.4362, 0.702494, 18.6161, 4.56621, 1.93186, 7.37619, 1.75623`
- Temperley minor: Humdrum probability form `0.712, 0.084, 0.474, 0.618, 0.049, 0.460, 0.105, 0.747, 0.404, 0.067, 0.133, 0.330`

**Recommendation:** default to a corpus-derived profile (Aarden-Essen or Temperley) over the perception-derived KK for the **symbolic note-histogram path** — corpus profiles generally beat KK on real Western tonal repertoire. For the **audio-chroma path**, default to Sha'ath + cosine (the KeyFinder recipe, tuned for audio). Normalize all profiles before mixing/comparing, because the same author's numbers appear at different scales across sources.

> **Note on PitchPerfect's scale model.** The algorithm natively classifies only **major vs minor** (24 templates). Our app already supports a richer `SCALE_DEFINITIONS` set (dorian, mixolydian, blues, pentatonic, etc.). The detector returns a `(tonic, mode∈{major,minor})` plus a confidence; a thin **mapping layer** translates that into the app's `key` string + `scaleType`. We do *not* try to detect all 13 scale types via correlation — instead we (a) map detected major→`'major'`, minor→`'natural-minor'` by default, and (b) optionally run a small second-stage refinement that checks the few characteristic degrees (e.g. ♭7 ⇒ mixolydian/dorian, ♭2 ⇒ phrygian) against the histogram before committing. Mode refinement is a Phase-2 nicety; ship major/minor first.

### 2.5 The three characteristic confusions

These are exactly the cases MIREX gives partial credit for, because related keys share most pitch classes:

- **Relative major/minor** (C major vs A minor): share all 7 diatonic pitch classes; histograms nearly identical, distinguished only by tonic-vs-submediant weighting. *The* dominant error for melody-only input.
- **Dominant / subdominant** (C vs G or C vs F): differ in one pitch class; high cross-correlation. Hard to fix from marginal stats alone.
- **Parallel major/minor** (C major vs C minor): differ mainly in 3rd/6th/7th. Caused by weak/ambiguous thirds; *don't over-smooth those bins.*

Mitigations baked into the plan: weight by **duration** (sharpens tonic-vs-other, which breaks the relative tie); report **confidence as the top-vs-second-best margin** and surface "C major (or A minor?)" instead of committing silently; when ambiguous, fall back to chromatic snapping rather than imposing a maybe-wrong scale.

---

## 3. INPUT options for THIS app

Both paths end at the same 12-vector → 24-template correlation. They differ only in how the 12-vector is built.

### Option B — Pitch-class histogram from our already-detected notes (duration-weighted)

We already have a denoised monophonic note list with MIDI + duration (the output of the pitch pipeline / what `offline-segment.ts` produces). Building the input is an O(N) loop:

```
for each note: hist[note.midi mod 12] += note.durationSeconds
```

- **Pros:** near-zero cost, no FFT/WASM/per-frame DSP; inherits the pipeline's denoising for free; this is precisely the symbolic input Krumhansl-Schmuckler was designed for; runs instantly on the main thread.
- **Cons:** melody only — no harmony. A melody under-determines the key; most prone to relative-key and tonic ambiguity. Sparse per-window histograms (few distinct pitch classes) make per-region estimates noisier.
- **Hygiene:** weight by **duration in seconds, not note count**; apply a mild **sqrt or log compression** so one long held note doesn't saturate; **drop sub-~50 ms notes** (likely glitches); account for tuning offset — our note `center` is already fractional MIDI / cents-space, so fold to pitch class from `center`, not a possibly-mistuned rounded value.

### Option A — Audio chromagram from the vocal stem and/or the full mix

STFT (or CQT) → map bins to pitch classes → fold octaves into 12 bins → accumulate over the clip → correlate. The stem-mixer already decodes both a **vocal stem** and the **full mix**, so the buffers are in hand.

- **Full mix:** captures chords + bass + V-I cadences — the harmonic content that actually *defines* the key and disambiguates relative/dominant. Polluted by percussion broadband energy and effects smearing, but more reliable for key than melody alone.
- **Vocal stem:** cleaner to pitch-track (monophonic, no percussion) but harmonically under-determined — same weakness as Option B, plus a WASM/DSP cost. Little benefit over B if that's all we have.
- **Implementation choices:** `essentia.js` `KeyExtractor` (turnkey audio→`{key, scale, strength}`, heavier WASM, run in a Worker, `profileType` swappable e.g. `'temperley'`/`'edma'`); or `Meyda` `'chroma'` (lighter, 12 bins, but **we** run the correlation); or a hand-rolled `OfflineAudioContext` STFT chromagram (zero deps, most code). Typical STFT: fftSize 4096, hop 1024 @ 44.1 kHz.

### Recommendation

> **Ship B first** (default): reuses the existing denoised note list at near-zero cost, no new deps, gives a usable global key recommendation immediately.
>
> **Then add A on the FULL MIX** as a higher-accuracy path / tie-breaker, run in a Web Worker, reconciled with B. Full-mix harmonic chroma is more reliable than vocal-melody-only; this is exactly where B fails (relative/dominant).
>
> **Do NOT bother with A on the vocal stem alone** — it inherits B's harmonic weakness while adding a WASM dependency. The vocal stem's value is the note contour we already have for free.

A shared `correlateProfiles(x12)` function serves both, so swapping the input source is a one-line change and we can A/B them on the same clip.

---

## 4. Per-region key + modulation

Songs modulate. Global key is one number; per-region key is a joint **estimation + segmentation** problem: partition the timeline into contiguous key regions and label each, balancing per-region fit against the number of boundaries.

### 4.1 Sliding-window emissions

Slide a window over time; in each window build a duration-weighted PCP (from notes, Option B) or accumulate chroma (Option A); correlate against the 24 templates to get a **per-frame emission** = a 24-vector of match scores. This is what the QM Vamp Key Detector does, exposing a *Window Length* parameter: "the shorter the window, the more likely it is to detect a new key change."

### 4.2 Window-size guidance (the central tension)

- **Too short:** PCP dominated by a few local notes (one chord, a passing tonicization, an arpeggio) → noisy, jittery, spurious "modulations."
- **Too long:** PCP averages across real key changes → boundaries smeared, short modulations missed, biased toward the globally dominant key.

This is the classic bias/variance, time-vs-frequency-resolution tradeoff. Set the window to a **musically meaningful tonal span — a phrase / several measures**, not a few frames. For a sparse monophonic vocal, lean **longer** (more smoothing) so each window collects enough distinct pitch classes to break the relative-key tie. Crucially, **decouple estimation from smoothing**: keep the window short-ish and control jitter downstream.

### 4.3 HMM + Viterbi smoothing over the 24 keys (the principled smoother + segmenter)

Model the song as an HMM with **24 hidden states** (the keys):

- **Emission** of state `k` at frame `n` = the per-window correlation of key `k` (Section 4.1), mapped to a (log) probability.
- **Transition matrix**: high **self-transition** probability (cheap to stay), lower for changing key, and **key-aware** off-diagonals — musically near keys (relative major/minor, dominant, subdominant; neighbours on the circle of fifths) cheaper than distant keys. This is what stops the path flickering between a key and its relative — the single most common local-key error, and worse for vocal-only input.
- **Decode** with Viterbi in the log domain, `O(N · 24²)` — milliseconds in JS for a whole song. The decoded **state changes are the modulation boundaries**.

The **self-transition penalty** is the one knob that converts jitter into stable contiguous regions. Add a **min-segment-length** post-rule (only commit a key change if the new key persists past a minimum duration) to absorb brief **tonicizations** (secondary dominants) into the prevailing key instead of reporting them as modulations.

Cheaper alternative for an MVP: run a per-frame argmax and **median/mode-filter** the label stream (median preserves sharp modulation edges where mean would blur them). Good first pass; upgrade to Viterbi for the key-proximity prior.

Explicit-segmentation alternative (non-causal, looks before *and* after a boundary): minimize `Σ(section misfit) + λ·(over-segmentation penalty)`; raising λ ⇒ fewer, longer regions. Heavier than one Viterbi pass; defer.

### 4.4 Reality check

Local-key ground truth has genuine **inter-annotator disagreement** (experts disagree on where modulations occur). Don't chase 100%. On a single sparse monophonic vocal, sliding-window boundaries are imprecise and short windows over-detect — which is exactly why per-region key must be **opt-in and never silently re-snap whole phrases** (Section 5).

---

## 5. Does it help the denoiser?

Short answer: **yes, but only as a confidence-gated smart default + a non-destructive flag — not a silent always-on transform.**

The snap machinery already exists and already takes key+scale as explicit inputs. In `offline-segment.ts` step 3:

```ts
const guardBandCents = amount * 100
n.midi = guardBandCents > 0
  ? snapMidiToScale(n.center, opts.key, opts.scaleType, guardBandCents).midi
  : Math.round(n.center)
```

and `snapMidiToScale` already returns `{ midi, snapped, flagged }` where `flagged = !inScale`. So:

- **Auto-set the cleanup key+scale** = *compute* `opts.key` / `opts.scaleType` from the detector instead of receiving them by hand. No new DSP.
- **Per-region key feeds per-region snapping** = when per-region detection is on, choose the key for each note from the region it falls in. This must be opt-in: a wrong local key mis-snaps an entire phrase.
- **Surface out-of-key notes** = expose the existing `flagged` bit in the UI as a *hint* (highlight in the piano roll), not a forced correction. Out-of-key ≠ wrong; it may be a blue note or passing tone.

**Guard-band guard (blue-note protection).** `guardBandCents = amount*100` reaches ~100 cents at full cleanup, which at the E-F and B-C semitone boundaries can pull a deliberately bent note onto the wrong neighbour. Mitigations:

- Cap the effective band lower near a scale boundary (e.g. ≤50 cents) and/or only snap when the note is already within a tight tolerance — Auto-Tune's Flex-Tune/Tolerance lesson.
- **Confidence gating:** only auto-apply the detected key when the top-vs-second-best correlation margin is high. On a low margin (pentatonic/blues vocal, relative-key tie) **fall back to chromatic snap** — the code path already exists (`Math.round(n.center)` when `guardBandCents <= 0`). So "no confident key" routes to chromatic, and cleanup still helps without imposing a wrong scale.
- **Don't ship per-region in the auto path initially.** On a sparse monophonic vocal it's over-eager and boundaries are imprecise; mis-snapping a whole phrase outweighs the upside. Treat modulation as a manual, user-confirmed key-change region first.

Bottom line: the marginal *DSP* benefit of auto-detect is small (it auto-fills a parameter the user could set in two clicks). Its real value is **better defaults** + the **out-of-key flag** for review. The safe framing is "smart default + flag," mostly a UI recommendation with a thin denoiser hook.

---

## 6. UI

Mirror how Auto-Key and Melodyne work: **detection is a separate, user-confirmable pre-stage that recommends — it never silently overrides.**

- **Cleanup "auto key" toggle.** Next to the key/scale pickers in take-review, an **Auto** toggle. When on, the detected key+scale pre-fills the pickers and drives `opts.key`/`opts.scaleType`; the user can override at any time (override turns Auto off). When confidence is low, show the recommendation but **don't auto-apply** — keep chromatic snap and label the suggestion as tentative.
- **Confidence + ambiguity surfacing.** Show the winning key with a confidence indicator (the top-vs-second margin). On a near-tie, present both: "C major (or A minor?)" rather than a single hard label.
- **Per-part key labels.** For each detected key region, a label/marker on the timeline at each boundary ("verse: A minor → chorus: C major"), Sonic-Visualiser-style. Optionally an expandable 24-key **strength heat-strip** showing the competing candidates per frame so relative/dominant ambiguity is legible.
- **Per-region recommendation, not auto-snap.** The per-part labels are a *recommendation* the user can accept (to drive per-region snapping) or ignore. Boundaries are user-confirmable/movable.
- **Icons:** reuse the project's SVG icon set (no emoji) for the auto-toggle, confidence, and flag indicators; add a new SVG component if none fits.

---

## 7. Proposed module layout + TS signatures

New directory `src/lib/key-detection/`, reusing `scale-data.ts` for MIDI/pitch-class/scale mapping. No new runtime deps for Phase 1.

```
src/lib/key-detection/
  profiles.ts          // the 2-vector base profiles + names, normalized
  pcp.ts               // build pitch-class profiles from notes (and from chroma)
  correlate.ts         // the shared 24-template correlation core
  detect-global.ts     // whole-clip key from a PCP
  detect-regions.ts    // sliding window + Viterbi smoothing -> key regions
  audio-chroma.ts      // (Phase 2) full-mix chromagram -> PCP, Worker-friendly
  map-to-scale.ts      // (tonic, mode) -> app key string + scaleType
  index.ts
  *.test.ts
```

### Types and signatures

```ts
// profiles.ts
export type Mode = 'major' | 'minor'
export type ProfileName =
  | 'krumhansl' | 'aarden-essen' | 'temperley' | 'sapp' | 'shaath'
export interface KeyProfile { major: number[]; minor: number[] }  // length-12, tonic-rooted
export const PROFILES: Record<ProfileName, KeyProfile>
export const DEFAULT_SYMBOLIC_PROFILE: ProfileName  // 'aarden-essen'
export const DEFAULT_AUDIO_PROFILE: ProfileName      // 'shaath'

// pcp.ts
export type Pcp = readonly number[]  // length 12, index 0 = C
/** Duration-weighted, octave-folded, optionally compressed. */
export function pcpFromNotes(
  notes: { midi: number; durationSeconds: number }[],
  opts?: { compress?: 'none' | 'sqrt' | 'log'; minDurationSec?: number },
): number[]
/** Fractional-MIDI variant: fold from `center` (cents-aware), not rounded midi. */
export function pcpFromCenters(
  notes: { center: number; durationSeconds: number }[],
  opts?: { compress?: 'none' | 'sqrt' | 'log'; minDurationSec?: number },
): number[]

// correlate.ts
export interface KeyScore { tonic: number; mode: Mode; score: number }  // tonic 0..11
/** All 24 templates, sorted best-first. */
export function correlateProfiles(
  pcp: Pcp,
  profile?: ProfileName,
  metric?: 'pearson' | 'cosine',
): KeyScore[]

// detect-global.ts
export interface KeyEstimate {
  tonic: number            // 0..11 (0 = C)
  mode: Mode
  confidence: number       // top score, 0..1-ish
  margin: number           // top minus runner-up — the ambiguity signal
  runnerUp: KeyScore | null
}
export function detectGlobalKey(pcp: Pcp, profile?: ProfileName): KeyEstimate

// detect-regions.ts
export interface KeyRegion {
  startBeat: number
  endBeat: number
  tonic: number
  mode: Mode
  confidence: number
}
export interface RegionOptions {
  windowBeats: number          // ~a phrase; default several measures
  selfTransitionPenalty: number // jitter knob
  minSegmentBeats: number       // absorbs tonicizations
  profile?: ProfileName
}
export function detectKeyRegions(
  notes: { startBeat: number; endBeat: number; center: number }[],
  opts: RegionOptions,
): KeyRegion[]

// map-to-scale.ts  — bridges detector output to scale-data's vocabulary
import { NOTE_NAMES } from '@/lib/scale-data'
export function keyEstimateToScale(
  est: { tonic: number; mode: Mode },
): { key: string; scaleType: string }   // e.g. {key:'A', scaleType:'natural-minor'}
```

`keyEstimateToScale` returns strings that drop straight into `OfflineSegmentOptions.key` / `.scaleType`, which flow into `snapMidiToScale`/`scaleDegreeSet` unchanged.

### Phased rollout

1. **Phase 1 — Global key from detected notes.** `profiles.ts`, `pcp.ts`, `correlate.ts`, `detect-global.ts`, `map-to-scale.ts`. Wire an **Auto** toggle that pre-fills the key/scale pickers (recommend-only, confidence-gated). No change to snapping math yet beyond reading the auto-chosen key.
2. **Phase 2 — Audio chroma (full mix).** `audio-chroma.ts` in a Web Worker (essentia.js KeyExtractor or Meyda+our `correlateProfiles`). Reconcile with the note-histogram estimate; use as tie-breaker on low-margin clips.
3. **Phase 3 — Per-region key.** `detect-regions.ts` (sliding window → Viterbi). Surface per-part labels + heat-strip in the UI as recommendations.
4. **Phase 4 — Wire into cleanup.** Confidence-gated auto-set of `opts.key`/`opts.scaleType`; optional per-region snapping (opt-in); narrow/cap the guard band near scale boundaries; expose the existing `flagged` bit as an out-of-key hint.

---

## 8. Testing

Pure functions → unit-test the math directly; the existing pipeline tests (`*.test.ts` under `pitch-pipeline/`) are the pattern to follow.

- **Synthetic PCPs with known keys.** Construct a histogram from a C-major scale (or a I-IV-V-I note sequence) and assert `detectGlobalKey` returns tonic 0, mode `'major'`. Repeat for several tonics by rotating the input; assert the tonic rotates with it (validates the rotate-and-correlate symmetry).
- **The relative-minor confusion case (the important one).** Build a histogram diatonic to C major / A minor and verify that **tonic/dominant emphasis** (extra duration on C-E-G) selects C major while **submediant/tonic-minor emphasis** (extra duration on A-C-E) selects A minor — and that with a flat, scale-only histogram the `margin` is small (so the UI would show the ambiguity rather than committing). This directly tests the duration-weighting mitigation.
- **Dominant/parallel near-misses.** Confirm a one-pitch-class shift toward G major raises G's score (expected partial-credit confusion); confirm a strong vs weak third flips major/minor as expected (parallel).
- **Confidence/margin semantics.** Assert `margin` is large for an unambiguous tonal histogram and small for a pentatonic/whole-tone one.
- **`pcpFromNotes` hygiene.** Sub-`minDurationSec` notes dropped; long-note saturation reduced under `sqrt`/`log`; tuning offset (fold from `center`) lands in the right bin when the singer is consistently sharp/flat.
- **`keyEstimateToScale` mapping.** `(9, 'minor')` → `{ key: 'A', scaleType: 'natural-minor' }`, `(0, 'major')` → `{ key: 'C', scaleType: 'major' }`; output keys are valid `KEY_OFFSETS` entries.
- **Region smoothing.** A synthetic two-key contour (8 bars C major then 8 bars G major) yields exactly two regions with a boundary near bar 8 under the default knobs; a single brief tonicization yields **one** region (min-segment-length absorbs it). A flat single-key contour yields one region (no spurious flips).
- **MIREX-weighted scoring helper** (test-only): score exact=1, fifth=0.5, relative=0.3, parallel=0.2, else 0, so detector changes are measured against the literature convention, not plain exact-match.

`pnpm check` must pass (TypeScript + ESLint + format) after each phase per `CLAUDE.md`.

---

## 9. Reading list

- **Robert Hart — Key-finding algorithm** — http://rnhart.net/articles/key-finding/ — cleanest concrete KS walkthrough with the exact KK profile numbers and the Pearson formula; the reference for the shared correlation step.
- **Sha'ath (2011) — Estimation of key in digital music recordings (KeyFinder thesis)** — https://www.ibrahimshaath.co.uk/keyfinder/KeyFinder.pdf — the definitive audio-key reference: profile variants, correlation vs cosine, MIREX scoring, accuracy tables.
- **Humdrum `keycor` manpage** — https://extras.humdrum.org/man/keycor/ — copy-paste-ready 12-value major+minor vectors for KK, Aarden-Essen, Bellman-Budge, Temperley, Simple.
- **MIREX Audio Key Detection** — https://music-ir.org/mirex/wiki/2025:Audio_Key_Detection — authoritative weighted scoring (1 / 0.5 / 0.3 / 0.2 / 0).
- **Temperley (2004) — What's Key for Key?** — https://davidtemperley.com/wp-content/uploads/2015/12/temperley-ms04.pdf — critiques KK, motivates corpus/Bayesian profiles; explains the confusions.
- **QM Vamp Plugins — Key Detector docs** — https://www.vamp-plugins.org/plugin-doc/qm-vamp-plugins.html — a shipping sliding-window local detector; the Window-Length / modulation-sensitivity tradeoff in concrete terms.
- **qm-vamp-plugins `KeyDetect.cpp`** — https://github.com/c4dm/qm-vamp-plugins/blob/master/plugins/KeyDetect.cpp — readable reference implementation of windowed chroma-vs-profile correlation.
- **Key-Finding Based on a Hidden Markov Model and Key Profiles** — https://www.researchgate.net/publication/336838958 — the canonical HMM-over-24-keys design (neighbouring-key transitions + profile emissions, local then global).
- **Viterbi (Audiolabs FMP, Müller)** — https://www.audiolabs-erlangen.de/resources/MIR/FMP/C5/C5S3_Viterbi.html — recursion, `O(N·I²)`, backtracking, log-domain trick.
- **Temporal Smoothing and Downsampling (FMP)** — https://www.audiolabs-erlangen.de/resources/MIR/FMP/C3/C3S1_FeatureSmoothing.html — why median preserves edges vs mean (cheap label smoothing).
- **Gedizlioglu & Erol (2024) — A regularization algorithm for local key detection** — https://journals.sagepub.com/doi/full/10.1177/10298649241245075 — the explicit fit + boundary-penalty segmentation framing.
- **Schreiber & Weiss (ICASSP 2020) — Local key on Schubert's Winterreise** — https://ieeexplore.ieee.org/document/9054642/ — HMM vs CNN, cover-song effect, key confusions.
- **Local Key Estimation: Case Study Across Songs, Versions, Annotators** — https://www.researchgate.net/publication/347172749 — inter-annotator disagreement; the realistic accuracy ceiling.
- **On Local Keys, Modulations, and Tonicizations (HAL)** — https://hal.science/hal-02934937v1/document — modulation-vs-tonicization distinction motivating min-segment-length.
- **essentia.js — KeyExtractor reference** — https://essentia.upf.edu/reference/std_KeyExtractor.html — turnkey audio→`{key,scale,strength}`, params, all `profileType` options (Phase 2 A1).
- **Meyda — Audio Features (chroma)** — https://meyda.js.org/audio-features.html — lightweight Web Audio chroma; we add the correlation (Phase 2 A2).
- **Harmonic Analysis: Key Detection (mixanalytic)** — https://mixanalytic.com/guides/harmonic-analysis — why a clean melody is easy to track but the full mix carries the key-defining harmony.

---

## 10. Open questions

1. **Default profile.** Aarden-Essen vs Temperley for the symbolic path — decide empirically on our repertoire (pop/vocal). Which to expose to users vs auto-pick by genre?
2. **Confidence threshold for auto-apply.** What top-vs-second **margin** is "confident enough" to auto-set the cleanup key (vs recommend-only / chromatic fallback)? Needs tuning against real takes.
3. **Mode → scaleType mapping depth.** Ship major/`natural-minor` only, or add the small second-stage modal refinement (♭7 ⇒ mixolydian/dorian, ♭2 ⇒ phrygian, pentatonic/blues detection)? The app supports the scales; the detector doesn't classify them natively.
4. **Tuning reference.** Should we estimate A=Hz offset (a global cents bias) like Auto-Key, to improve snap targets for tracks not at A440? The contour is already in cents-space, so it's low-effort — worth it?
5. **Audio path dependency.** essentia.js (turnkey, ~MBs WASM) vs Meyda+our correlation (lighter, more code) vs hand-rolled `OfflineAudioContext` chromagram (zero deps). Bundle-size budget decides.
6. **Reconciliation rule (B vs A).** When the note-histogram key and the full-mix chroma key disagree, which wins, and how does the margin factor in? Proposed: full-mix wins when its strength is high; otherwise weight by each path's margin.
7. **Per-region defaults.** Concrete `windowBeats`, `selfTransitionPenalty`, `minSegmentBeats` for typical pop on a sparse vocal — repertoire-dependent, must be tuned, and the literature offers no single optimal window.
8. **Region snapping UX.** If per-region snapping ships, how are user-moved boundaries persisted, and how does region key interact with a manual override on one note?
9. **Where in the pipeline does detection run?** On the `offline-segment` output at amount=0 (faithful notes) so the histogram isn't polluted by snapping — confirm the call site and that re-running on slider drag is cheap enough (it is: O(N)).

---

Plan body is above; it is intended to be written verbatim to `docs/plans/`. Key repo references confirmed against the working tree:
- `/home/maff/foss/mercurypitch-agent/.claude/worktrees/strange-hermann-5da734/src/lib/scale-data.ts` — `scaleDegreeSet`, `snapMidiToScale` (returns `{midi, snapped, flagged}`), `KEY_OFFSETS`, `NOTE_NAMES`, `SCALE_DEFINITIONS`.
- `/home/maff/foss/mercurypitch-agent/.claude/worktrees/strange-hermann-5da734/src/lib/pitch-pipeline/offline-segment.ts` — step 3 key-snap with `guardBandCents = amount * 100`.
