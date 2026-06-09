# Whisper.cpp + WASM — Lyric Transcription for Shazam Sing

## Goal

Integrate OpenAI Whisper.cpp compiled to WebAssembly to perform client-side speech-to-text on the user's sung/hummed audio. The transcribed lyrics are then matched against song lyrics to add a lyric-matching feature dimension alongside the existing pitch-based DTW matching.

## Motivation

- The Web Speech API is poor for sung vocals (optimized for conversational speech)
- Whisper handles varied audio better, including singing, accents, and noisy environments
- Running fully client-side (WASM) means no API keys, no server costs, no privacy concerns
- Provides word-level timestamps that can be aligned with melody note timings

## Architecture

```
Browser (Web Worker)
├── whisper.cpp compiled to WASM + SIMD
├── ggml model file (tiny = ~75MB, base = ~140MB)
├── AudioBuffer → 16kHz mono PCM → whisper_full()
└── returns { text, segments: [{ text, start, end }] }
```

### Loading Strategy

- **Lazy-loaded**: whisper.js is loaded only when the user opens ShazamListen, via dynamic `import()`
- **Model file**: fetched from CDN or self-hosted, streamed into IndexedDB cache on first use
- **Web Worker**: all inference runs off-main-thread to keep the UI responsive
- **Progressive**: tiny model first (fast), allow user to select base/small for better accuracy

## Files to Create

### 1. `src/lib/whisper/whisper-engine.ts`

Core engine that manages the WASM module lifecycle:

```ts
class WhisperEngine {
  init(modelPath: string): Promise<void>       // Load WASM + model into worker
  transcribe(audio: AudioBuffer): Promise<WhisperResult>
  destroy(): void
  get loadingProgress(): number
}
```

### 2. `src/lib/whisper/whisper-worker.ts`

Web Worker that runs `whisper_full()` on incoming audio data. Communicates with main thread via postMessage.

### 3. `src/lib/whisper/types.ts`

```ts
interface WhisperSegment {
  text: string
  startSec: number
  endSec: number
}

interface WhisperResult {
  fullText: string
  segments: WhisperSegment[]
  language: string
}
```

### 4. `src/lib/shazam/lyric-matcher.ts`

Takes WhisperResult + known song lyrics and produces a similarity score:

```ts
function matchLyrics(transcribed: WhisperResult, referenceLyrics: string): LyricMatchResult
```

Uses Levenshtein distance or token-set ratio (fuzzywuzzy-style) for partial matching.

## Files to Modify

### 5. `src/components/ShazamListen.tsx`

- Lazy-load WhisperEngine on mount (behind debug flag initially)
- Run transcription on the captured audio buffer after user stops singing
- Pass `WhisperResult` alongside `LivePitchContour` to matching

### 6. `src/components/ShazamResults.tsx`

- Display transcribed lyrics in results
- Show lyric match score alongside pitch scores

### 7. `src/lib/shazam/melody-matcher.ts`

- Add optional `WhisperResult` parameter to `matchPitchContour()`
- Blend lyric match score into overall confidence when available

## Model Hosting

- Self-host the ggml-tiny.bin model alongside the app assets
- Model size: ~75MB (tiny), ~140MB (base)
- Use HTTP Range requests for streaming into IndexedDB
- Fallback: CDN URL configurable via env var

## Dependencies

- `whisper.cpp` WASM build (npm: none official, use pre-built from whisper.cpp releases)
- No additional npm packages needed — whisper.cpp ships its own JS bindings

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| 75MB+ model download | IndexedDB cache, streaming fetch, progress indicator |
| Slow inference on mobile | Tiny model, Web Worker, MobileNet-distilled variant |
| WASM SIMD not available everywhere | Feature-detect, fallback to non-SIMD build |
| Lyric transcription accuracy varies | Use as boost signal, not primary match; combine with pitch score |

## Implementation Order

1. Create whisper-engine.ts + whisper-worker.ts with tiny model
2. Wire into ShazamListen behind debug flag
3. Implement lyric-matcher.ts (simple text similarity)
4. Integrate with melody-matcher confidence scoring
5. Add UI to ShazamResults
6. Performance testing on mobile
7. Progressive model selection UI
