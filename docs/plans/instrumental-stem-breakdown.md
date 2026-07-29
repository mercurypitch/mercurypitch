# Instrumental Stem Breakdown (drums / bass / guitar / other)

Research + implementation plan for splitting the existing instrumental stem
into its constituent parts, on demand, after a session already has
vocal + instrumental.

Status: **Phase 1 (server) implemented**; phases 2-5 still proposed.

Decisions taken since the original proposal:
- Six stems is the default, not an opt-in — `demucs-6s` is
  `UVR_DEFAULT_MULTI_STEM_MODEL`. Piano ships marked experimental
  (`experimentalStems`) rather than hidden.
- Both separation paths accept `source_stem: "instrumental"`, so the
  "rerun on the instrumental" flow the mixer needs is a server feature,
  not something the client has to assemble.

---

## 1. Where we are today

Three separation paths, one shared contract (`vocal` + `instrumental`):

| Path | Code | Engine | Model |
| --- | --- | --- | --- |
| In-browser | `src/workers/vocal-separator.worker.ts` | onnxruntime-web (WebGPU→WASM) | UVR-MDX-NET Inst HQ 3 (ONNX) |
| Local server | `uvr-api/api.py` | python-audio-separator 0.44.2 | registry: `roformer` / `mdx` / `karaoke` / `ensemble` |
| Prod GPU | `runpod/handler.py` | python-audio-separator 0.44.2 | same registry, S3/R2 + credit metering |

The "top of class" server model is `roformer` =
`model_bs_roformer_ep_317_sdr_12.9755.ckpt` (BS-RoFormer, vocals SDR ~12.98).
It is a **2-stem** model — vocals vs. everything else. It has no notion of
drums or bass, and no parameter can make it produce them. Splitting the
instrumental therefore needs a *different model*, not different parameters.

### What is already stem-generic (much more than expected)

The server side is mostly ready:

- `runpod/handler.py:198` — `_STEM_KEYS = ["vocal", "instrumental", "drums", "bass", "other"]`
- `runpod/handler.py:519` — `_STEM_MARKER_RE` already matches `drums|bass|other`
- `runpod/handler.py:699` — returns **every** stem the model produced regardless
  of the requested `stems` ("Still return everything the model produced; clients pick")
- `uvr-api/api.py:570` — `/status` classifies `drums`/`bass`/`other` already
- `src/lib/uvr-api.ts` — already sends a `stems: string[]` and an
  `X-UVR-Model` header

So a 4-stem model added to `MODEL_REGISTRY` would flow through the server,
the storage layer and the status payload largely untouched. Gaps: `guitar` and
`piano` are missing from both stem-key lists, and there are no `demucs_params`.

### What is hard-wired to two stems (the actual work)

- `src/db/entities.ts:292` — `UvrStemBlob.stemType: 'vocal' | 'instrumental' | 'original'`
- `src/db/entities.ts:279-281` — `UvrSession.vocalStemId` / `instrumentalStemId`
  as explicit FK columns
- ~15 components carry the literal union `'vocal' | 'instrumental'`
  (`UvrPanel`, `UvrResultViewer`, `UvrSessionResult`, `StemMixer*`, …)
- `useStemMixerAudioController` has named `vocal` / `instrumental` / `midi`
  signals alongside a generic `tracks: Accessor<StemTrack[]>`
- `workers/db-worker/src/billing-core.ts:110` — `UVR_MODEL_CREDIT_MULTIPLIERS`
  is keyed per model

**Good news on storage:** `src/db/adapters/dexie-adapter.ts:28` declares
`uvrStemBlobs: 'id, sessionId, stemType, createdAt'`. `stemType` is a plain,
non-compound index, so **new stem values need no Dexie migration** — widening
the union is a TypeScript-only change.

---

## 2. Which model?

`python-audio-separator` (already our engine, both server paths) ships Demucs v4
out of the box — no new dependency, just a new registry entry:

| File | Stems | Notes |
| --- | --- | --- |
| `htdemucs.yaml` | vocals, drums, bass, other | single model, fastest |
| `htdemucs_ft.yaml` | vocals, drums, bass, other | 4 fine-tuned models bagged → ~4× the compute, best quality |
| `hdemucs_mmi.yaml` | vocals, drums, bass, other | alternative v3-lineage |
| `htdemucs_6s.yaml` | + guitar, piano | guitar is usable; **piano is poor** |

### Recommendation

- **Default: `htdemucs_ft`** — the practical state of the art for 4-stem and
  what nearly every "split my track" tool uses. ~9.0 dB SDR on the standard
  benchmark.
- **Fast tier: `htdemucs`** (shifts=1) for the in-session, "just show me" case.
- **`htdemucs_6s` behind an explicit "experimental" label** for the guitar
  stem the request specifically asks about. Ship guitar, and either hide piano
  or mark it clearly — the bleed is bad enough to read as a bug otherwise.
  Piano/keys/organ/guitar overlap heavily in frequency and the model struggles.

### What we are giving up, and why that's fine

BS-RoFormer beats HTDemucs by roughly +1.3 dB, and SCNet XL currently leads
the MVSep multisong board for drums and bass. Neither is available as a 4-stem
model inside `python-audio-separator`: its Roformer entries are 2-stem
(vocals/instrumental), and SCNet is not in the registry at all. Using them
would mean vendoring `Music-Source-Separation-Training` inference into the
RunPod image — a much larger change. **Demucs v4 first; treat SCNet XL as a
later quality tier** once the plumbing exists and we can A/B it.

Licensing note to confirm before shipping: Demucs v4 code/weights are
published under MIT by Meta — worth an explicit check against our
distribution story, since we bake weights into the RunPod image.

---

## 3. Second pass on the instrumental, or 4-stem on the original mix?

This was the core question. Both work; they are not equivalent.

**Option B — run Demucs on our instrumental stem (the "obvious" second pass).**
This is what most UVR users do manually and it is a legitimate fallback. But
Demucs was trained on *full mixes*. A vocal-removed instrumental is
out-of-distribution input, and we also pay for a `vocals` output that should be
near-silence — wasted compute and a stem we throw away.

**Option A — run Demucs on the ORIGINAL mix, keep only drums/bass/other.**
In-distribution input, same cost, and it composes with what we already have:
we keep BS-RoFormer's vocal and instrumental as authoritative (they're better
than Demucs's vocals) and take only the rhythm-section stems from Demucs.

### Recommended: Option A + residual reconciliation

Naively adopting Demucs's stems breaks a property the mixer depends on:
`drums + bass + other` will **not** equal our instrumental, so muting every
child track won't silence the parent, and Demucs's `other` will carry vocal
bleed that our RoFormer instrumental doesn't have.

Fix it by deriving `other` rather than using Demucs's:

```
other' = instrumental_roformer − drums_demucs − bass_demucs
```

That guarantees `drums + bass + other' == instrumental` sample-exactly, so the
group fader, solo and mute behave correctly, and all residual (including
whatever bleed exists) lands in `other` where it's least objectionable.

Do the subtraction in the time domain here — unlike the vocal/instrumental
split, both operands come from the same model pass and are already
phase-aligned, so there is no phase-bleed problem to invert around.

Ship A as the default, keep B behind a flag, and A/B them on a handful of real
songs before locking it in. Songs where the vocal is heavily bled into
Demucs's drums/bass are the ones that will discriminate.

---

## 4. Feature design

The requirement: nothing changes for the default flow; the breakdown is opt-in,
in-session, after the fact.

1. **Session completes exactly as today** — vocal + instrumental, same cost,
   same wait. No regression for anyone who doesn't want this.
2. **In the StemMixer, the Instrumental track gains a "Split" affordance** —
   a chevron/"Break into parts" control on the instrumental row.
3. **Choice sheet** on click:
   - *What you get*: Drums, Bass, Other (+ Guitar, experimental)
   - *Where*: **This device** (free, slower, no upload) vs **Server**
     (1 credit, ~1 min, better) — mirroring the existing local/server split
   - Quality caveat for guitar/piano stated up front
4. **Result renders as a collapsible group**: the Instrumental row becomes a
   parent with child rows Drums / Bass / Other / Guitar. Parent fader = group
   gain; children get their own volume/mute/solo. The residual trick above is
   what makes "mute all children == silent instrumental" true.
5. **Persisted** as ordinary `UvrStemBlob` rows, so a reload restores the
   breakdown without re-running anything.

---

## 5. Data model

Deliberately additive — no Dexie migration (see §1).

```ts
// src/db/entities.ts
export type UvrStemType =
  | 'vocal' | 'instrumental' | 'original'   // existing
  | 'drums' | 'bass' | 'other'              // demucs 4-stem
  | 'guitar' | 'piano'                      // demucs 6-stem (experimental)

export interface UvrStemBlob extends DbEntity {
  stemType: UvrStemType
  /** Which stem this was derived from — 'instrumental' for the breakdown. */
  derivedFrom?: UvrStemType
  /** Registry model that produced it, for provenance/debugging. */
  producedBy?: string
}
```

- **Do not** add `drumsStemId` / `bassStemId` / … FK columns to `UvrSession`.
  Query `uvrStemBlobs` by `sessionId` (already indexed) and group by
  `stemType`. Keep `vocalStemId` / `instrumentalStemId` as-is for back-compat.
- Breakdown job state (status, model, error) goes in the existing
  `UvrSession.stemMetaJson` rather than new columns.

---

## 6. Phased plan

**Phase 1 — server registry — DONE**

Shipped: `demucs` / `demucs-ft` / `demucs-6s` in both registries with declared
`stems`; `demucs_params` with `UVR_DEMUCS_SHIFTS` as the cost dial;
guitar/piano in the stem keys and marker regex; `api.py` switched to
marker-first classification (it had the substring bug the handler already
fixed); weights baked into the Dockerfile; provisional credit multipliers;
`source_stem` / `drop_stems` / `reconcile_residual` / `residual_stem` on both
servers; `/registry` on the FastAPI path; `runpod/test_stem_contract.py`
covering classification, registry invariants, reconciliation across
WAV/FLAC and 16/24-bit/float, the clipping guard, and handler↔api parity.

Original scope, for reference:
- Add `demucs` → `htdemucs.yaml`, `demucs-ft` → `htdemucs_ft.yaml`,
  `demucs-6s` → `htdemucs_6s.yaml` to `MODEL_REGISTRY` in **both**
  `runpod/handler.py` and `uvr-api/api.py` (they are documented mirrors).
- Add `demucs_params` (`segment_size`, `shifts`, `overlap`) alongside the
  existing `mdx_params` / `mdxc_params`.
- Add `guitar` / `piano` to `_STEM_KEYS` and `_STEM_MARKER_RE` in the handler,
  and to the stem loop in `api.py:570`.
- Bake the new weights into `runpod/Dockerfile` (the registry and the
  pre-bake list must stay in sync or cold workers re-download on billable time).
- Credit multipliers in `billing-core.ts`: `demucs: 1`, `demucs-ft: 3`,
  `demucs-6s: 3` — measure real cost with `test_input.json` before fixing these.
- Verifiable on its own: POST a job with `model=demucs`, confirm four stems
  come back classified correctly.

**Phase 2 — data model + client contract**
- Widen `UvrStemType`, add `derivedFrom` / `producedBy`.
- Replace the `'vocal' | 'instrumental'` literal unions with the named type.
  Mostly mechanical; the compiler finds every site.
- Teach `uvr-service.ts` to read/write arbitrary stem types by
  `(sessionId, stemType)`.

**Phase 3 — the breakdown job**
- New pipeline entry: given a completed session, submit the *original* audio
  with `model=demucs-ft`, keep drums/bass/(guitar), compute `other'`.
- Reuse the existing upload-queue / polling / metering / recovery machinery —
  this is another UVR job, not a new subsystem.

**Phase 4 — mixer UI**
- Collapsible stem group under Instrumental; child faders; group gain.
- Update the page tour in the same PR (repo rule: tours cover ≥80% of a page's
  user-visible features).

**Phase 5 — client-side (deliberately last; see risk below)**

---

## 7. Client-side: honest assessment

The existing browser worker cannot be extended to do this. It is MDX-specific
end to end: fixed STFT (n_fft 6144, hop 1024, 3072 bins), a 4-channel
real/imag tensor layout, and a complex-domain subtraction that assumes
*one* predicted stem. Demucs is a hybrid waveform **and** spectrogram model
with four outputs — different input pipeline, different output handling. It's
a new worker, not a parameter change.

Feasibility is real but unattractive:
- `htdemucs` base (single model, 4 outputs) is the only sane browser
  candidate — `htdemucs_ft` is four bagged models, i.e. 4× download and 4×
  inference.
- ONNX exports exist publicly, but WASM inference will be very slow on a
  4-minute song, and WebGPU coverage for Demucs's op set is unproven.

**Recommendation: ship server-side first (Phases 1–4), then evaluate the
browser path as a spike with a hard timebox.** The "free, on-device" option is
genuinely valuable for the no-credit path, so it's worth trying — but it
should not gate the feature. If the spike disappoints, the honest fallback is
to offer the breakdown as server-only and say so in the UI.

---

## 8. Open questions

1. **Guitar**: ship `htdemucs_6s` guitar as experimental, or hold the whole
   6-stem option until a better model exists? The request explicitly asks for
   guitar, but piano quality is bad enough to hurt trust.
2. **Pricing**: is the breakdown 1 credit, or free for users who already paid
   for the session? It's a second GPU pass, so it has real cost.
3. **Re-separation**: if a user replaces the instrumental stem manually
   (`setSessionStem` supports this today), do we invalidate the breakdown?
4. Confirm the Demucs weight licensing against how we distribute the image.

---

## Sources

- [python-audio-separator](https://github.com/nomadkaraoke/python-audio-separator) — supported Demucs models, params
- [facebookresearch/demucs](https://github.com/facebookresearch/demucs) — htdemucs_6s piano/guitar caveats
- [MVSep algorithms + multisong leaderboard](https://mvsep.com/en/algorithms) — SCNet XL, current SDR ranking
- [SCNet: Sparse Compression Network for Music Source Separation](https://arxiv.org/pdf/2401.13276)
- [Music Source Separation with Band-Split RoPE Transformer](https://arxiv.org/pdf/2309.02612) — BS-RoFormer per-stem SDR
- [htdemucs vs BS-RoFormer vs Spleeter: 2026 benchmark](https://dev.to/codesugar_lin_037a57b06a4/htdemucs-vs-bs-roformer-vs-spleeter-a-2026-audio-source-separation-benchmark-2ll8)
- [How to split stems with UVR5](https://s3sound.com/blog/how-to-split-stems-with-uvr5-2026) — two-pass practice
