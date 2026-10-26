# Studio FX investigation for Studio Night

Inspected 2026-10-26 at `c90e1a87c6b2a273334efd08192cce2c25e95295`, PR #1219, `feat/studio-fx-chain`. Repository root: `.`.

This is source inspection plus one executed pure-DSP reproduction. The checkout has no `node_modules`; no dependencies were installed, no Vitest/browser suites were rerun, and no repository files were changed. The PR's stated 213 unit tests and 22 Chromium probes remain its author's evidence, not fresh verification by this audit. No physical-device or subjective listening acceptance is established.

## Integration surface verified in source

| Capability                                                                                                  | Source                                                | Consequence for Studio                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plain serializable chain specs; known effects, finite/clamped parameters, unique IDs; 16-effect cap         | `src/lib/studio-fx/chain-spec.ts:15-32,49-63,104-122` | Store specs in a versioned project document. Project migrations must be separate: this normalizer silently discards unknown effects and rewrites version to 1.       |
| Ten roles, including lead/backing vocal, acoustic/electric guitar, bass, piano, keys, drums, backing, other | `role-chains.ts:44-96`                                | Suggest role from source metadata, but allow correction. Already-mastered stereo uploads need the backing role, not a vocal chain.                                   |
| Normalize each source toward -18 LUFS, bounded gain; role balance and measured post-chain trim              | `auto-mix.ts:39-56,72-112,123-178`                    | Useful default preparation, not autonomous arrangement. A cached processed buffer is already effected; do not feed it through the same chain again.                  |
| Five global macros plus per-track Space offset, seven sound flavours                                        | `mix-macros.ts:35-77,135-165,177-227`                 | The default UI can offer a named sound and five sliders with a dry/processed comparison. Derive every change from the voiced base, never from the last macro result. |
| Live chain input/output, spec update, bypass, parameter update, reduction meter, disposal                   | `chain.ts:38-50,88-207`                               | Studio owns source scheduling, transport envelopes, destination ownership and disposal. Structural edits duck/repatch; value changes preserve graphs and tails.      |
| Offline mixdown aligns different chain latencies and sums stereo                                            | `mixdown.ts:25-32,38-61,65-129`                       | Current item = one complete AudioBuffer + one chain + fader + start time. It does not represent a lane with multiple edited clips.                                   |
| Master bus and final render, targets -16/-14/-11 LUFS, bounded limiting, measured before/after              | `master.ts:26-55,63-116,146-167,193-223`              | A target may not be reached if the limiting cap wins. Show measured output separately from selected target.                                                          |
| Integrated LUFS, sample peak and estimated true peak                                                        | `loudness.ts:21-35,153-214`                           | No live momentary LUFS, short-term LUFS, LRA, per-channel peak-hold UI or streaming meter accumulator is provided.                                                   |

All shortened paths in the table refer to `src/lib/studio-fx/`. Searching for `studio-fx`, `renderMixdown`, `renderMasteredMix`, and `autoMixTrack` outside that directory found no application callers at this revision.

## Confirmed issue: true peak is understated for a valid input

`loudness.ts:191-195` skips an interpolation interval when both adjacent samples are more than 3 dB below the global sample maximum. That bound is invalid: sinc reconstruction depends on surrounding samples too. A remote full-scale sample can cause a different region's larger intersample peak to be skipped.

Executed with Node v25.8.2 directly importing the TypeScript module, without dependencies. Result:

```json
{
  "samplePeakDb": 0,
  "reportedTruePeakDb": 0,
  "uncheckedHalfSamplePeakDb": 3.1291198810644945,
  "nearbyMaxSample": 0.7
}
```

The reference value uses the implementation's exact Hann-windowed sinc formula at the skipped half-sample position, so this proves a shortcut error independently of any claim about standards conformance.

Reproduction from the repository root:

```js
import { measureLoudness } from './src/lib/studio-fx/loudness.ts'
const data = new Float32Array(48000)
data[100] = 1
const index = 1000
for (let k = -7; k <= 8; k++) {
  const t = k - 0.5
  const weight =
    (Math.sin(Math.PI * t) / (Math.PI * t)) *
    (0.5 + 0.5 * Math.cos((Math.PI * t) / 8))
  data[index + k] = 0.7 * Math.sign(weight)
}
let reconstructed = 0
for (let k = -7; k <= 8; k++) {
  const t = k - 0.5
  reconstructed +=
    ((data[index + k] * Math.sin(Math.PI * t)) / (Math.PI * t)) *
    (0.5 + 0.5 * Math.cos((Math.PI * t) / 8))
}
const measurement = measureLoudness({
  sampleRate: 48000,
  numberOfChannels: 1,
  getChannelData: () => data,
})
console.log(measurement.truePeakDb, 20 * Math.log10(Math.abs(reconstructed)))
```

Suggested fix: measure every polyphase interval, or derive a mathematically valid conservative candidate bound. Add this adversarial regression, independent reference vectors and multiple sample rates. Do not display this as a validated true-peak safety result before that work.

## Separate confirmed limitation: the limiter is sample bounded

`effects/limiter.ts:5-17` explicitly describes a sample limiter, not a true-peak mastering limiter. The comment at `master.ts:8` calls the ceiling true-peak safe, but the implementation only bounds samples. `renderMasteredMix` retries for loudness at `master.ts:213-220`; it never corrects a delivered true-peak overshoot. The browser master probe records `samplePeakDb` and checks that, at `scripts/studio-fx-mix-probes.mjs:384-400`.

Required before a ready-for-demo export claim: repair and validate the meter, then verify the final rendered file and attenuate/re-render if it exceeds the chosen true-peak ceiling. Keep the distinction between dBFS and dBTP visible. Lossy output needs post-encoding measurement or an explicit policy because encoding can change peaks. Calling a target preset Streaming is a product label, not proof of a universal delivery standard.

## Missing Studio responsibilities

- A versioned project, immutable owned source blobs, source provenance, lanes, clips, selection, undo/redo and autosave. Referencing a take that another page can delete is not sufficient project persistence.
- A render/schedule plan for source offsets, trimmed duration, split clips, overlap policy, fades, track pan, mute/solo, loops and seeking. `MixdownTrack` has none of these except start time and gain.
- One lane FX graph receiving all that lane's clips. Calling current `renderMixdown` with one entry per clip creates independent FX graphs and independent dynamics/tails, which will differ from a persistent live lane graph. Freeze lane-versus-clip semantics before implementation.
- Snapshot/version tokens for rendering and auto-mix. Old async results must not replace a newer project or mark changed audio as freshly measured.
- Cancellable preparation and export, meaningful progress, bounded decode/render memory, storage quota/error states and recovery. Current render options have no cancellation/progress contract; full source/output buffers and loudness Float64 arrays are materialized.
- Explicit playback start/unlock and ownership of the app's shared audio lifecycle. The FX chain never starts a source or connects itself to a destination (`chain.ts:18-26`). Do not autoplay after reload or page return.
- Encoding/downloading WAV or MP3 is outside this module. `renderMasteredMix` returns an AudioBuffer plus measurements, not a downloadable file.
- Real-time metering with separate reset/measurement windows; no playback-frame loop should rescan a song-sized buffer. `integratedLoudness` allocates full-length Float64 filter/energy arrays (`loudness.ts:84-113,123-126`).

## Phase boundaries recommended

1. **Design:** define importing existing takes, duplicate ownership, clip/track selection, transport, editing affordances, phone limitations, save/error states and exact export flow. Mock meter figures are illustrative, never evidence. Review one complete create-to-export storyboard before implementation.
2. **Data and engine contracts:** project/blob schema, import adapters, source snapshots, pure edit commands, autosave/undo, migration and recovery; define a single render plan shared by live/offline playback. Reserve role/FX data without exposing dense controls.
3. **Integrated UI:** app navigation and `/studio-night` entry share the existing application shell and browser storage; build approved layout against the actual project model. Include transport and useful empty/loading/error states.
4. **Usable song assembly:** mouse/touch/keyboard edits, real red-to-green pointer tests, audio-clock scheduling, reload recovery and a full Playwright create-song scenario. Validate listen/seek/loop boundaries, overlap semantics, fades, navigation and interrupted audio.
5. **Sound/export:** wire role preparation, named sounds, five macros, A/B, corrected meters and mastered WAV pipeline. Prove live/offline parity, source alignment, tails, safe final true peak, stale-result rejection, cancellation and memory limits. Add MP3 only with a verified encoder and post-encode policy.
6. **Manual acceptance:** inspect PR preview on desktop and physical iPad/iPhone; listen on headphones and speakers, test actual import formats, large projects, browser restart/storage denial and downloaded output in an independent player/DAW. Chromium probes are useful evidence but do not establish WebKit or device behavior.

Commit each coherent phase on the existing PR branch. Keep the draft until the complete assembly/export flow and manual acceptance pass. Source review found no reason to replace the role-chain architecture; extend it through a shared Studio render plan and fix the two peak-safety gaps before making mastering guarantees.

## Reproducible evidence and render-budget addendum

The executable reproduction is `true-peak-repro.mjs`, beside this report. It accepts the absolute source-module path as argument 1 and an optional new JSON output path as argument 2. Run with native TypeScript-capable Node (verified v25.8.2):

```sh
rtk proxy node docs/plans/studio-v1/evidence/true-peak-repro.mjs
```

`true-peak-repro-result.json` records the initial measured output. The current algorithm calls true peak an estimate, which is appropriate for finite 4x interpolation. However, the candidate shortcut is a distinct correctness error: it fails to return even the highest peak produced by its own chosen kernel. The reproduction establishes that shortcut error, not the kernel's standards conformance. Repair and reference-vector validation belong in Phase 5; Phase 2 must avoid baking meter results or guaranteed peak compliance into import acceptance, and must persist source/render revision metadata so repaired analyses can be recomputed.

### Memory budget is decoded audio, not upload size

For Float32 stereo PCM, `bytes = durationSeconds * sampleRate * 2 * 4`. At 48 kHz, one five-minute buffer occupies about 109.9 MiB. Eight distinct five-minute stereo source buffers alone occupy about 878.9 MiB. Retaining eight equally sized auto-mix processed buffers would roughly double that before the mix, master passes, filter arrays, waveforms, file decode/encode and browser overhead. Trimming a clip in the UI does not reduce its decoded source allocation unless decoding/windowing is bounded separately. Repeated clips should share one decoded asset, not duplicate it. At 96 kHz these PCM figures double.

`renderMixdown` allocates an OfflineAudioContext for the whole song plus pre-roll, latency and tails, then copies a new stereo output (`mixdown.ts:83-93,116-124`). `renderMasteredMix` adds a bus render and up to three finish passes (`master.ts:199-220`). A single loudness analysis allocates full-length Float64 intermediate/filter/energy arrays (`loudness.ts:84-113,123-126`), so its working set can exceed the PCM buffer size several times. Garbage collection timing and native audio allocations make these lower-bound PCM figures unsuitable as a claimed maximum process footprint.

Phase 2 must define a decoded-byte budget, bound concurrent decodes/renders, deduplicate assets, release unneeded processed buffers, cache small waveform summaries and schedule expensive work outside pointer interactions. Persist original encoded blobs and metadata, not every rendered Float32 variant. Reject or offer a smaller workload before allocating beyond the supported budget. Do not infer memory safety from browser storage quota.

Use eight lanes and five minutes as a proposed benchmark workload, not a shipped limit or a proven tablet capability. Measure smaller and larger workloads on target desktop browsers and a physical iPad before choosing duration/lane limits. Budget the sum of distinct decoded-source durations as well as timeline length; a short arrangement made from long originals can still exhaust memory. Measure 44.1 and 48 kHz and mixed-rate imports, and explicitly decide whether higher-rate source decoding is resampled.

Current render APIs expose neither progress nor abort. A wrapper can cancel pending preparation, stop scheduling later passes and reject stale results; an already-running native offline pass may continue until it finishes. Do not label cancellation immediate until a tested implementation supports that behavior. These orchestration and memory contracts are Phase 2 dependencies even though the finished FX/export controls land in Phase 5.

## Independent peak cross-check

The parent reran the Node reproduction, then encoded the same adversarial samples as a mono 48 kHz Float32 WAV and measured them with the installed FFmpeg `ebur128=peak=true` filter. FFmpeg reported a true peak of **+4.1 dB relative to full scale**, while the current Studio estimator reported 0 dBTP. Its reconstruction filter differs from the Studio Hann-sinc kernel, so +4.1 and +3.129 are separate reference results, not interchangeable expected values. Both expose an overshoot that the current shortcut misses. This single synthetic case does not certify general meter compliance. The version and measurement log are preserved in `true-peak-ffmpeg.txt`; fixture creation is reproducible from the Node sample definition.
