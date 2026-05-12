# Client-Side Vocal Separation — Browser ONNX Runtime

**Date**: 2026-05-06
**Issue**: https://github.com/Komediruzecki/pitch-perfect/issues/256
**Model**: `UVR-MDX-NET-Inst_HQ_3.onnx` (63.6 MB)
**Source**: `https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_3.onnx`

---

## Key Discovery: Models Are Already ONNX

The server-side UVR setup on `feat/uvr-improvements` already uses ONNX models via `python-audio-separator`. The Dockerfile installs `onnxruntime-rocm` — meaning the same ONNX Runtime that `onnxruntime-web` wraps, just with a different execution provider.

```
Current server (Docker):  audio_separator → onnxruntime-rocm → AMD GPU (ROCm)
Proposed browser:         onnxruntime-web → WebGPU / WASM     → User's GPU/CPU
                                 ↑
                          SAME .onnx model file
```

**No PyTorch → ONNX conversion needed.** The models are already in the right format. We serve the same `.onnx` files to the browser and implement the STFT spectrogram preprocessing that `audio-separator` currently handles in Python.

---

## Architecture Overview

```
Browser                                          Docker (unchanged)
┌──────────────────────────────────┐         ┌─────────────────────────┐
│  User selects .mp3/.wav          │         │  uvr-api/api.py          │
│         ↓                        │         │  existing, stays as      │
│  AudioContext.decodeAudioData()  │         │  server-side fallback    │
│         ↓                        │         └─────────────────────────┘
│  STFT → spectrogram              │
│         ↓                        │
│  onnxruntime-web (WebGPU/WASM)   │
│  loads same .onnx from CDN       │
│         ↓                        │
│  iSTFT → AudioBuffer (vocals)    │
│  iSTFT → AudioBuffer (instr)     │
│         ↓                        │
│  Play / Download in browser      │
└──────────────────────────────────┘
```

### Data Flow (Detailed)

```
MIDI Keyboard → navigator.requestMIDIAccess() → MIDIInput
                                                    ↓
heldNote = { midi, freq, noteName, octave, cents: 0 }
                                                    ↓
setCurrentPitch(heldNote)  ← same signal mic uses
```

---

## Confirmed ONNX Model Specs

| Property | Value |
|---|---|
| File | `UVR-MDX-NET-Inst_HQ_3.onnx` |
| Size | 63.6 MB (66,715,588 bytes) |
| Opset | 13 (ai.onnx v13) |
| IR version | 8 |
| Producer | pytorch v2.8.0 |
| Input name | `"input"` |
| Input shape | `[batch, 4, 3072, 256]` float32 |
| Output name | `"output"` |
| Output shape | `[batch, 4, 3072, 256]` float32 |
| Total ops | 178 |

### Operator Inventory (all WebGPU-compatible)

| Operator | Count | Notes |
|---|---|---|
| Conv | 84 | 1x1 (53) and 3x3 (31) kernels |
| Relu | 14 | |
| BatchNormalization | 28 | |
| MatMul | 6 | Transformer self-attention layers |
| ConvTranspose | 10 | 2x2 stride-2 upsampling |
| Add | 18 | Skip connections + bias adds |
| Mul | 12 | Scaling/gating |
| Transpose | 6 | Tensor reshaping for attention |

**Architecture**: Hybrid Transformer/TCN (Temporal Convolutional Network) — Conv encoder/decoder with MatMul-based self-attention bottlenecks. All ops are standard and exist in ONNX Runtime Web's WebGPU EP.

---

## STFT / iSTFT Pipeline

This is the most complex part. The model operates on spectrograms, not raw audio. We must replicate PyTorch's `torch.stft` / `torch.istft` in the browser.

### Parameters (from audio-separator `mdx_separator.py`)

| Parameter | Value | Source |
|---|---|---|
| n_fft | 7680 | `mdx_n_fft_scale_set` from model data |
| hop_length | 1024 | Hardcoded in MDX arch |
| dim_f | 3072 | `mdx_dim_f_set` from model data |
| dim_t | 256 | `2 ** mdx_dim_t_set` (set=8 → 256) |
| window | Hann (periodic) | `torch.hann_window(n_fft, periodic=True)` |
| center | True | PyTorch default |
| return_complex | False | Returns real/imag as separate channels |
| First 3 bins | Zeroed before inference | `spek[:, :, :3, :] *= 0` |

### STFT Forward Pass (mirrors `stft.py` `__call__`)

```
Audio input: [batch, channels, samples]  e.g. [1, 2, 261120]
  │
  ├─ Reshape to [-1, samples]            merge batch+channel: [2, 261120]
  ├─ torch.stft(..., return_complex=False)
  │    Output: [batch*ch, n_fft//2+1, frames, 2]   e.g. [2, 3841, 256, 2]
  ├─ Permute dims: [0,3,1,2] → [batch*ch, 2, n_fft//2+1, frames]
  ├─ Reshape to [batch, ch*2, n_fft//2+1, frames]  e.g. [1, 4, 3841, 256]
  └─ Slice to [:dim_f]                   → [1, 4, 3072, 256]
```

The `ch*2` dimension is stereo (2 channels) × complex (real+imag = 2) = 4. This is the model input.

### iSTFT Inverse Pass (mirrors `stft.py` `inverse`)

```
Model output: [batch, 4, 3072, 256]
  │
  ├─ Pad freq dim: [batch, 4, 3072, 256] → [batch, 4, n_fft//2+1, 256]   (pad to 3841)
  ├─ Reshape to [batch, ch//2, 2, n_fft//2+1, frames]  → [1, 2, 2, 3841, 256]
  ├─ Reshape to [-1, 2, n_fft//2+1, frames]            → [2, 2, 3841, 256]
  ├─ Permute to [-1, n_fft//2+1, frames, 2]            → [2, 3841, 256, 2]
  ├─ Form complex: real + imag*1j                       → [2, 3841, 256] complex
  ├─ torch.istft(complex, n_fft, hop_length, window=hann, center=True)
  └─ Reshape to [batch, channels, samples]              → [1, 2, samples]
```

### Frame Count Verification

For input length L=261120 with center=True and n_fft=7680:
- Center pads n_fft//2 = 3840 on each side → padded length = 261120 + 7680 = 268800
- Frames = `⌊(padded_length - n_fft) / hop_length⌋ + 1`
- = `⌊(268800 - 7680) / 1024⌋ + 1`
- = `⌊261120 / 1024⌋ + 1`
- = `255 + 1 = 256`

**256 frames** — exactly matching the model's `dim_t`.

### Browser STFT Implementation Options

| Approach | FFT Library | Pros | Cons |
|---|---|---|---|
| A | Custom C FFT compiled to WASM (KissFFT/pffft) | Fast, controllable, no external deps | Complex build setup, ~3-5KB WASM |
| B | JS FFT library (fft.js, fft-windowing) | Pure JS, no build step | Slower than WASM, ~10KB bundle |
| C | Web Audio API OfflineAudioContext | Built-in, optimized | No direct STFT control, hard to match torch.stft exactly |

**Recommendation: Approach A** — KissFFT compiled to WASM. We need exact control over the STFT parameters (Hann window shape, centering, hop length). Web Audio API's built-in FFT doesn't expose the raw STFT pipeline. Pure JS FFT is too slow for n_fft=7680 on real audio. KissFFT is ~3KB compiled, MIT licensed, and battle-tested.

### Key STFT Details to Match Exactly

1. **Hann window**: `torch.hann_window(7680, periodic=True)` — PyTorch's periodic Hann omits the last sample so the window is truly periodic when repeated. Formula: `0.5 * (1 - cos(2π * n / N))` for n=0..N-1 (periodic means divide by N, not N-1).

2. **Center padding**: `center=True` means the input is padded with `n_fft // 2 = 3840` zeros on both sides before framing. After iSTFT, the padding frames are trimmed off.

3. **First 3 bins zeroed**: After STFT and before ONNX inference, `spek[:, :, :3, :] *= 0` zeros frequency bins 0, 1, 2 (DC and near-DC). This must be replicated exactly.

---

## Chunked Processing Pipeline

### Why chunking is needed

The ONNX model has a fixed time dimension of 256 frames. For a full song at 44.1kHz, we'd have far more frames. The solution: split audio into overlapping chunks, process each, and crossfade them back together.

### Chunk Parameters

| Parameter | Value | Formula |
|---|---|---|
| segment_size | 256 | `dim_t` |
| chunk_size (samples) | 261,120 | `hop_length * (segment_size - 1)` = 1024 × 255 |
| trim | 3,840 | `n_fft // 2` |
| gen_size | 253,440 | `chunk_size - 2 * trim` |
| overlap (default) | 25% | Configurable |
| step | 196,080 | `int((1 - overlap) * chunk_size)` at 25% overlap |
| Crossfade window | Hanning | `np.hanning(chunk_size)` |

### Processing Flow

```
Audio file (WAV/MP3/FLAC)
  │
  ├─ decodeAudioData() → AudioBuffer [2, totalSamples] @ 44100Hz
  ├─ Convert to Float32Array, normalize peak
  │
  ├─ Pad: prepend trim zeros, append pad+trim zeros
  │    (pad = gen_size - totalSamples % gen_size)
  │
  ├─ Slice into chunks of chunk_size, stepping by gen_size
  │    Each chunk: [2, 261120] float32
  │
  ├─ For each chunk:
  │    ├─ STFT → [1, 4, 3072, 256] float32
  │    ├─ Zero bins 0-2
  │    ├─ ONNX inference → [1, 4, 3072, 256] float32
  │    ├─ iSTFT → [1, 2, 261120] float32
  │    └─ Apply Hanning window, accumulate into result buffer
  │
  ├─ Divide accumulated result by divider (overlap normalization)
  ├─ Trim padding → final separated stereo audio
  └─ Normalize, convert to WAV blob
```

### Overlap-Add Detail

```typescript
// For each chunk at position 'start':
const chunk = audioSlice(start, start + chunkSize)  // [2, 261120]
const separated = processChunk(chunk)                 // [2, 261120]

// Apply Hanning window
const window = hanningWindow(chunkSize)               // [261120]
for (let ch = 0; ch < 2; ch++) {
  for (let i = 0; i < chunkSize; i++) {
    result[ch][start + i] += separated[ch][i] * window[i]
    divider[ch][start + i] += window[i]
  }
}

// After all chunks:
for (let ch = 0; ch < 2; ch++) {
  for (let i = 0; i < totalSamples; i++) {
    if (divider[ch][i] > 0) {
      result[ch][i] /= divider[ch][i]
    }
  }
}
```

### Secondary Stem (Inversion)

When processing for "Instrumental" primary stem, the vocal stem is derived by time-domain subtraction:
```
vocal = original_mix - instrumental * compensate
```
where `compensate` = model_data compensator value (1.0 for Inst_HQ_3). This avoids running inference twice.

---

## Model Download & Caching

### Serving Strategy

The model (63.6 MB) is served from the app's own `/public/models/` directory — NOT fetched from GitHub at runtime:
- No CORS issues
- No external dependency at runtime
- Browser caching via HTTP `Cache-Control` headers
- Versioned with `?v=` query param for cache busting

**Placement**: `public/models/UVR-MDX-NET-Inst_HQ_3.onnx`, served as static asset by Vite.

### IndexedDB Caching Layer

For persistent caching across page reloads (beyond HTTP cache):

```
First load:
  ├─ Check IndexedDB for model (by filename)
  ├─ NOT found → fetch from /models/UVR-MDX-NET-Inst_HQ_3.onnx
  ├─ Store ArrayBuffer in IndexedDB
  └─ Create InferenceSession from ArrayBuffer

Subsequent loads:
  ├─ Check IndexedDB → FOUND
  └─ Use cached ArrayBuffer directly
```

**Implementation**: `ModelCache` class using IndexedDB database `pitchperfect-models` with object store `models` keyed by filename.

---

## Web Worker Architecture

Model inference runs in a dedicated Web Worker to keep the main thread responsive.

### Worker: `src/workers/vocal-separator.worker.ts`

```
Main Thread                          Worker Thread
─────────                           ─────────────
send({ type: 'init' })  ──────→    Initialize ONNX session
                                    (load model from IndexedDB or fetch)
                         ←──────    { type: 'ready' }

send({ type: 'separate',           Receive audio buffer
       audio,                            │
       options })         ──────→    Chunk audio
                                         │
                                    For each chunk:
                                      ├─ STFT forward
                                      ├─ Zero bins 0-2
                                      ├─ ONNX inference
                                      ├─ iSTFT inverse
                                      └─ Overlap-add
                                         │
                         ←──────    { type: 'progress',
                                      progress: 0-100 }

                         ←──────    { type: 'complete',
                                      vocals: Float32Array,
                                      instrumental: Float32Array,
                                      duration: number }
```

### Message Protocol

```typescript
// Main → Worker
type WorkerRequest =
  | { type: 'init'; modelPath: string }
  | { type: 'separate'; audio: Float32Array; sampleRate: number; options: SeparateOptions }
  | { type: 'cancel' }

// Worker → Main
type WorkerResponse =
  | { type: 'ready' }
  | { type: 'progress'; progress: number; currentChunk: number; totalChunks: number }
  | { type: 'complete'; vocals: Float32Array; instrumental: Float32Array; metadata: StemMetadata }
  | { type: 'error'; message: string }

interface SeparateOptions {
  overlap?: number        // 0-1, default 0.25
  primaryStem?: 'vocals' | 'instrumental'
  compensate?: number     // default 1.0
}

interface StemMetadata {
  duration: number        // seconds
  sampleRate: number
  channels: number
  processingTimeMs: number
}
```

Float32Array buffers are transferred (not copied) between main thread and worker using the Transferable protocol.

---

## Files to Create

### 1. `src/workers/vocal-separator.worker.ts`
Web Worker owning ONNX runtime session and STFT/iSTFT engine. Communicates solely via `postMessage`.

Responsibilities:
- Initialize ONNX `InferenceSession` with WebGPU EP (fallback to WASM)
- Load model from IndexedDB cache or fetch from `/models/`
- Implement full STFT/iSTFT (Hann window, center padding, bin zeroing)
- Chunk audio, process each chunk, overlap-add
- Report progress back to main thread
- Handle cancellation

### 2. `src/lib/vocal-separator.ts`
Main-thread API wrapping the worker:

```typescript
export class VocalSeparator {
  private worker: Worker
  private ready: Promise<void>
  
  constructor()
  initialize(modelPath: string): Promise<void>
  separate(audio: Float32Array, sampleRate: number, options?: SeparateOptions): Promise<SeparationResult>
  cancel(): void
  destroy(): void
  isReady(): boolean
  onProgress: ((pct: number) => void) | null
}

export interface SeparationResult {
  vocals: Float32Array
  instrumental: Float32Array
  metadata: StemMetadata
}
```

### 3. `src/lib/stft-engine.ts`
Pure-function STFT/iSTFT implementation (runs in worker context). Matches PyTorch's STFT exactly.

```typescript
export function stftForward(
  audio: Float32Array,       // [samples] mono
  nFft: number,              // 7680
  hopLength: number,         // 1024
  window: Float32Array,      // Hann window [nFft]
): Float32Array              // [2, nFft//2+1, frames] — real/imag stacked

export function stftInverse(
  stftData: Float32Array,    // [2, nFft//2+1, frames]
  nFft: number,
  hopLength: number,
  window: Float32Array,
): Float32Array              // [samples]
```

### 4. `src/lib/model-cache.ts`
IndexedDB wrapper for ONNX model caching:

```typescript
export class ModelCache {
  static get(key: string): Promise<ArrayBuffer | null>
  static set(key: string, buffer: ArrayBuffer): Promise<void>
  static delete(key: string): Promise<void>
  static clear(): Promise<void>
}
```

### 5. `src/lib/audio-chunker.ts`
Chunked processing orchestrator (runs in worker context):

```typescript
export function chunkAudio(
  audio: Float32Array,  // [2, samples] stereo
  chunkSize: number,     // 261120
  genSize: number,       // 253440
  trim: number,          // 3840
): Generator<{ data: Float32Array; start: number; index: number }>

export function overlapAdd(
  result: Float32Array,
  divider: Float32Array,
  chunk: Float32Array,
  start: number,
  window: Float32Array,
): void
```

### 6. `src/types/uvr-local.ts`
Types for client-side UVR processing:

```typescript
export type UvrInputSource = 'server' | 'local'

export interface LocalProcessOptions {
  overlap: number
  primaryStem: 'vocals' | 'instrumental'
  compensate: number
}

export interface LocalProcessResult {
  vocals: Blob
  instrumental: Blob
  metadata: StemMetadata
}
```

---

## Files to Modify

### 7. `vite.config.ts`
- Add worker bundling configuration
- Ensure cross-origin isolation headers if needed for WASM
- Add `public/models/` to static asset serving (default with Vite's `publicDir`)

### 8. `src/stores/uvr-store.ts` (extend from `feat/uvr-improvements`)
Add client-side UVR state:
```typescript
export type UvrProcessingMode = 'server' | 'local'
export const [uvrMode, setUvrMode] = createSignal<UvrProcessingMode>('local')
export const [localProgress, setLocalProgress] = createSignal(0)
export const [localResult, setLocalResult] = createSignal<SeparationResult | null>(null)
```

### 9. `src/components/UvrPanel.tsx` (from `feat/uvr-improvements`)
Add mode toggle between "Server" and "Browser" processing. In browser mode:
- Show file picker (accepts .wav, .mp3, .flac)
- Decode audio with `AudioContext.decodeAudioData()`
- Call `VocalSeparator.separate()` with progress callback
- Display results identically to server mode (reuse `UvrResultViewer`, `StemMixer`)

### 10. `src/components/UvrProcessControl.tsx` (from `feat/uvr-improvements`)
Add local processing progress UI (progress bar, chunk counter, cancel button, ETA).

### 11. `src/tests/` — New test files
- `stft-engine.test.ts` — verify STFT/iSTFT roundtrip against known signals
- `model-cache.test.ts` — IndexedDB mock tests
- `audio-chunker.test.ts` — chunking + overlap-add correctness
- `vocal-separator.test.ts` — integration tests with a tiny test model

---

## WebGPU Provider Strategy

```typescript
const session = await ort.InferenceSession.create(modelBuffer, {
  executionProviders: ['webgpu', 'wasm'],
  graphOptimizationLevel: 'all',
  enableMemPattern: true,
})
```

The worker detects available EPs and reports which one is active. Fallback chain: WebGPU → WASM.

---

## Performance Estimates

| Device | EP | Per Chunk (261K samples) | Full Song (3 min, ~30 chunks) |
|---|---|---|---|
| Desktop (RTX 3060) | WebGPU | ~50ms | ~1.5s |
| Desktop (no GPU) | WASM | ~300ms | ~9s |
| Laptop (Intel iGPU) | WebGPU | ~150ms | ~4.5s |
| Mobile (A17 Pro) | WebGPU | ~200ms | ~6s |
| Mobile (mid-range) | WASM | ~800ms | ~24s |

---

## Implementation Phases

### Phase 1: STFT/iSTFT Engine (critical path)
1. Create `src/lib/stft-engine.ts` with KissFFT WASM backend
2. Implement `stftForward()` and `stftInverse()` matching PyTorch exactly
3. Verify roundtrip: `istft(stft(x)) ≈ x` for random signals and sine sweeps
4. Verify frame count: 261120 samples → exactly 256 frames
5. Write comprehensive tests comparing against PyTorch reference outputs

### Phase 2: Worker + ONNX Inference
1. Leverage existing `onnxruntime-web` v1.25.1 from `feat/gh234-swiftf0-integration`
2. Create `src/workers/vocal-separator.worker.ts` with ONNX session setup
3. Create `src/lib/model-cache.ts` IndexedDB wrapper
4. Implement `VocalSeparator` main-thread API
5. Test inference on a single chunk with the real model
6. Verify output shape `[1, 4, 3072, 256]` matches

### Phase 3: Chunked Processing
1. Create `src/lib/audio-chunker.ts`
2. Implement overlap-add with Hanning window
3. Wire full pipeline: audio → chunks → STFT → ONNX → iSTFT → overlap-add → result
4. Test on a full song, verify no artifacts at chunk boundaries
5. Add progress reporting

### Phase 4: UvrPanel Integration
1. Merge `feat/uvr-improvements` UI components
2. Add `uvrMode` toggle to `UvrPanel`
3. Connect `VocalSeparator` to the UvrPanel workflow
4. Add local processing progress UI to `UvrProcessControl`
5. Wire results into existing `UvrResultViewer` and `StemMixer`
6. Ensure `localStorage` session persistence works for local sessions

### Phase 5: Polish & Error Handling
1. Comprehensive error states (model load failure, WebGPU unavailable, audio decode error)
2. Cancel and retry UX
3. Memory management (dispose ONNX session, release ArrayBuffers)
4. Mobile/tablet responsiveness
5. Accessibility (progress announcements via aria-live)

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| ONNX Runtime Web WebGPU EP fails on specific GPUs | Medium | Graceful fallback to WASM EP with user notification |
| STFT/iSTFT numerical drift from PyTorch | High | Validate against PyTorch reference outputs; use double precision where needed |
| 63.6MB model download on slow connections | Medium | Show download progress; IndexedDB cache; accept first load is slow |
| WASM FFT is too slow for real-time | Low | WebGPU EP expected for most users; WASM is ~9s for full song, acceptable for offline use |
| Audio decode memory pressure (large files) | Low | 3-min song at 44.1kHz stereo is ~31MB, manageable |
| Browser tab suspended during processing | Low | Document limitation; consider keeping worker alive |

---

## Model Source Reference

From audio-separator v0.44.1 `separator.py`:
```python
public_model_repo_url_prefix = "https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models"
```

MDX-NET Inst HQ 3 model data (from `mdx_model_data.json`):
```json
{
  "md5": "16460b01f44fe6340365e40f2eba1a30",
  "model_filename": "UVR-MDX-NET-Inst_HQ_3.onnx",
  "mdx_dim_f_set": 3072,
  "mdx_dim_t_set": 8,
  "mdx_n_fft_scale_set": 7680,
  "primary_stem": "Instrumental",
  "compensate": 1.0
}
```

The model file should be placed in `public/models/UVR-MDX-NET-Inst_HQ_3.onnx` for direct serving, with Git LFS if needed (>50MB).

### Secondary Model: `UVR_MDXNET_KARA_2.onnx`

The server also uses this karaoke model. Its specs are available in `mdx_model_data.json` under a different MD5. We can add this as a second model option, but `Inst_HQ_3` is the primary target since it's the default in `uvr-api/api.py` line 231 and provides both instrumental and vocal stems via inversion.
