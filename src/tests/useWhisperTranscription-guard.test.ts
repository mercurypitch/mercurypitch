// ============================================================
// useWhisperTranscription — wiring tests for the hallucination
// guard, the abort contract, error channel, cache purge and log
// labelling.
//
// WhisperService / resampleTo16kHz and the IndexedDB persistence
// are mocked; the flow under test is the hook's own chunk run,
// offsetting, guard and status/error reporting.
// ============================================================

import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeWhisperChunkPlan, runWhisperChunkPlan, useWhisperTranscription, WHISPER_HALLUCINATION_USER_MESSAGE, } from '@/lib/useWhisperTranscription'
import type { WhisperSegment } from '@/lib/whisper-service'

const mocks = vi.hoisted(() => ({
  transcribe:
    vi.fn<
      (
        audio: Float32Array,
        language?: string,
      ) => Promise<{ text: string; chunks: unknown[] }>
    >(),
  resample: vi.fn<(buffer: AudioBuffer) => Promise<Float32Array>>(),
  saveTranscriptionToDb: vi.fn<
    (sessionId: string, segments: unknown[]) => Promise<void>
  >(() => Promise.resolve()),
  loadTranscriptionFromDb: vi.fn<
    (sessionId: string) => Promise<unknown[] | null>
  >(() => Promise.resolve(null)),
  deleteTranscriptionFromDb: vi.fn<(sessionId: string) => Promise<void>>(() =>
    Promise.resolve(),
  ),
}))

vi.mock('@/lib/whisper-service', () => {
  class FakeWhisperService {
    onStatusChange?: (s: string) => void
    onProgressChange?: (p: number) => void
    init = vi.fn(() => Promise.resolve())
    transcribe = mocks.transcribe
    destroy = vi.fn()
  }
  return {
    WhisperService: FakeWhisperService,
    resampleTo16kHz: mocks.resample,
  }
})

vi.mock('@/db/services/whisper-transcription-db-service', () => ({
  saveTranscriptionToDb: mocks.saveTranscriptionToDb,
  loadTranscriptionFromDb: mocks.loadTranscriptionFromDb,
  deleteTranscriptionFromDb: mocks.deleteTranscriptionFromDb,
}))

/** 70s at 16 kHz — plans into 3 chunks (0-30s, 25-55s, 50-70s). */
const SEVENTY_SEC_SAMPLES = 70 * 16000

/** A ramp buffer so chunk content encodes its own sample offsets. */
function rampAudio(length: number): Float32Array {
  const audio = new Float32Array(length)
  for (let i = 0; i < length; i++) audio[i] = i
  return audio
}

/** Whisper junk: the same word over and over in ~20ms spans. */
function junkChunks(count = 12): WhisperSegment[] {
  return Array.from({ length: count }, (_, i) => ({
    text: ' idea.',
    timestamp: [i * 0.05, i * 0.05 + 0.02] as [number, number],
  }))
}

/** Distinct plausible words with healthy durations, unique per call. */
function healthyChunks(call: number, count = 6): WhisperSegment[] {
  return Array.from({ length: count }, (_, i) => ({
    text: ` word${String(call)}x${String(i)}`,
    timestamp: [i * 2, i * 2 + 0.4] as [number, number],
  }))
}

function createHook(overrides?: {
  label?: string
  sessionId?: string
  onTranscriptionComplete?: (segments: WhisperSegment[]) => void
  getAudioBuffer?: () => AudioBuffer | null
}) {
  return useWhisperTranscription({
    getAudioBuffer: overrides?.getAudioBuffer ?? (() => ({}) as AudioBuffer),
    logTag: 'GuardTest',
    label: overrides?.label,
    sessionId: overrides?.sessionId,
    onTranscriptionComplete: overrides?.onTranscriptionComplete,
  })
}

describe('useWhisperTranscription guard wiring', () => {
  let logSpy: MockInstance<typeof console.log>
  let warnSpy: MockInstance<typeof console.warn>
  let errorSpy: MockInstance<typeof console.error>

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resample.mockResolvedValue(rampAudio(SEVENTY_SEC_SAMPLES))
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('feeds each chunk a distinct window of the resampled buffer', async () => {
    mocks.transcribe.mockImplementation(() =>
      Promise.resolve({
        text: 'ok',
        chunks: healthyChunks(mocks.transcribe.mock.calls.length),
      }),
    )
    const hook = createHook()
    hook.startTranscription()
    await vi.waitFor(() => {
      expect(hook.status()).toBe('done')
    })

    expect(mocks.transcribe).toHaveBeenCalledTimes(3)
    const audios = mocks.transcribe.mock.calls.map(
      (call) => call[0] as Float32Array,
    )
    // Chunk lengths: 30s, 30s, 20s tail
    expect(audios.map((a) => a.length)).toEqual([480_000, 480_000, 320_000])
    // The ramp content proves each chunk starts at its planned sample
    expect(audios[0][0]).toBe(0)
    expect(audios[1][0]).toBe(400_000)
    expect(audios[2][0]).toBe(800_000)

    hook.destroy()
  })

  it('offsets each chunk by its absolute start time', async () => {
    mocks.transcribe.mockImplementation(() =>
      Promise.resolve({
        text: 'ok',
        chunks: healthyChunks(mocks.transcribe.mock.calls.length),
      }),
    )
    const hook = createHook()
    hook.startTranscription()
    await vi.waitFor(() => {
      expect(hook.status()).toBe('done')
    })

    const segments = hook.segments()
    expect(segments).toHaveLength(18)
    // First word of chunk 2 (base 25s) and chunk 3 (base 50s)
    expect(segments[6].timestamp[0]).toBe(25)
    expect(segments[12].timestamp[0]).toBe(50)
    expect(hook.errorMessage()).toBeNull()
    expect(mocks.saveTranscriptionToDb).not.toHaveBeenCalled() // no sessionId

    hook.destroy()
  })

  it('rejects a hallucinated result: error status, message, no save, no callback', async () => {
    mocks.transcribe.mockImplementation(() =>
      Promise.resolve({ text: ' idea.', chunks: junkChunks() }),
    )
    const onComplete = vi.fn()
    const hook = createHook({
      sessionId: 's1',
      onTranscriptionComplete: onComplete,
    })
    hook.startTranscription()
    await vi.waitFor(() => {
      expect(hook.status()).toBe('error')
    })

    expect(hook.errorMessage()).toBe(WHISPER_HALLUCINATION_USER_MESSAGE)
    expect(hook.segments()).toEqual([])
    expect(onComplete).not.toHaveBeenCalled()
    expect(mocks.saveTranscriptionToDb).not.toHaveBeenCalled()
    // The poisoned cache entry for this session is purged
    expect(mocks.deleteTranscriptionFromDb).toHaveBeenCalledWith('s1')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('hallucination detected'),
    )

    hook.destroy()
  })

  it('reports success and persists when the transcription is healthy', async () => {
    mocks.transcribe.mockImplementation(() =>
      Promise.resolve({
        text: 'ok',
        chunks: healthyChunks(mocks.transcribe.mock.calls.length),
      }),
    )
    const onComplete = vi.fn()
    const hook = createHook({
      sessionId: 's1',
      onTranscriptionComplete: onComplete,
    })
    hook.startTranscription()
    await vi.waitFor(() => {
      expect(hook.status()).toBe('done')
    })

    expect(hook.errorMessage()).toBeNull()
    expect(hook.segments().length).toBeGreaterThan(0)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(mocks.saveTranscriptionToDb).toHaveBeenCalledWith(
      's1',
      hook.segments(),
    )
    expect(mocks.deleteTranscriptionFromDb).not.toHaveBeenCalled()

    hook.destroy()
  })

  it('an aborted partial run leaves the cache alone', async () => {
    // Destroying the service while chunk 1 is in flight aborts the loop at the
    // top of iteration 2, leaving a 1-of-3 partial merge. That prefix looks
    // exactly like Whisper junk to the guard (12 identical ~20ms words), so
    // before the abort check it wiped the session cache and reported a model
    // failure that never happened.
    let hookRef: ReturnType<typeof createHook> | null = null
    mocks.transcribe.mockImplementation(() => {
      hookRef?.destroy()
      return Promise.resolve({ text: ' idea.', chunks: junkChunks() })
    })
    const onComplete = vi.fn()
    const hook = createHook({
      sessionId: 's1',
      onTranscriptionComplete: onComplete,
    })
    hookRef = hook
    hook.startTranscription()

    // elapsed is set to 0 synchronously before the first chunk and back to -1
    // when the run settles, so this waits for the real end of the run.
    await vi.waitFor(() => {
      expect(mocks.transcribe).toHaveBeenCalledTimes(1)
    })
    await vi.waitFor(() => {
      expect(hook.elapsed()).toBe(-1)
    })

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('aborted'))
    // An abort is not a result: no cache write, no cache purge, no error
    expect(mocks.deleteTranscriptionFromDb).not.toHaveBeenCalled()
    expect(mocks.saveTranscriptionToDb).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
    expect(hook.status()).not.toBe('error')
    expect(hook.errorMessage()).toBeNull()
    expect(hook.segments()).toEqual([])
    // ...and the partial run is never judged as a transcription
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('hallucination detected'),
    )

    hook.destroy()
  })

  it('an abort before the first chunk saves nothing and claims nothing', async () => {
    // Teardown during resampling: the loop aborts at chunk 1, so the run has
    // no segments at all. That used to report 'done' and cache an empty
    // transcription for the session.
    mocks.transcribe.mockImplementation(() =>
      Promise.resolve({ text: 'ok', chunks: healthyChunks(0) }),
    )
    const onComplete = vi.fn()
    const hook = createHook({
      sessionId: 's1',
      onTranscriptionComplete: onComplete,
    })
    mocks.resample.mockImplementation(() => {
      hook.destroy()
      return Promise.resolve(rampAudio(SEVENTY_SEC_SAMPLES))
    })
    hook.startTranscription()

    await vi.waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('aborted'))
    })

    expect(mocks.transcribe).not.toHaveBeenCalled()
    expect(mocks.saveTranscriptionToDb).not.toHaveBeenCalled()
    expect(mocks.deleteTranscriptionFromDb).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
    expect(hook.status()).not.toBe('done')

    hook.destroy()
  })

  it('errors out with a message when every chunk fails', async () => {
    mocks.transcribe.mockImplementation(() =>
      Promise.reject(new Error('inference exploded')),
    )
    const hook = createHook()
    hook.startTranscription()
    await vi.waitFor(() => {
      expect(hook.status()).toBe('error')
    })

    expect(hook.errorMessage()).toContain('every chunk')
    hook.destroy()
  })

  it('clears a previous error message when a new transcription starts', async () => {
    mocks.transcribe.mockImplementation(() =>
      Promise.resolve({ text: ' idea.', chunks: junkChunks() }),
    )
    const hook = createHook()
    hook.startTranscription()
    await vi.waitFor(() => {
      expect(hook.status()).toBe('error')
    })
    expect(hook.errorMessage()).toBe(WHISPER_HALLUCINATION_USER_MESSAGE)

    // Retry with healthy output: message resets, run succeeds.
    // (status 'error' with a live service re-inits on demand)
    mocks.transcribe.mockImplementation(() =>
      Promise.resolve({
        text: 'ok',
        chunks: healthyChunks(mocks.transcribe.mock.calls.length),
      }),
    )
    hook.startTranscription()
    await vi.waitFor(() => {
      expect(hook.status()).toBe('done')
    })
    expect(hook.errorMessage()).toBeNull()

    hook.destroy()
  })

  it('treats a hallucinated cached transcription as a miss and purges it', async () => {
    mocks.loadTranscriptionFromDb.mockResolvedValue(
      junkChunks(410) as unknown as null,
    )
    const hook = createHook({ sessionId: 's1' })

    await expect(hook.loadCachedTranscription()).resolves.toBe(false)
    expect(hook.status()).toBe('idle')
    expect(hook.segments()).toEqual([])
    expect(mocks.deleteTranscriptionFromDb).toHaveBeenCalledWith('s1')

    hook.destroy()
  })

  it('still loads a healthy cached transcription', async () => {
    const cached = healthyChunks(0, 10)
    mocks.loadTranscriptionFromDb.mockResolvedValue(cached as unknown as null)
    const onComplete = vi.fn()
    const hook = createHook({
      sessionId: 's1',
      onTranscriptionComplete: onComplete,
    })

    await expect(hook.loadCachedTranscription()).resolves.toBe(true)
    expect(hook.status()).toBe('done')
    expect(hook.segments()).toEqual(cached)
    expect(onComplete).toHaveBeenCalledWith(cached)

    hook.destroy()
  })

  it('prefixes every log line with logTag:label when a label is set', () => {
    const hook = createHook({
      label: 'MoonSong',
      getAudioBuffer: () => null,
    })
    hook.startTranscription() // logs diagnostics + "no audio buffer" warning

    const logged = logSpy.mock.calls.map((call) => String(call[0]))
    const warned = warnSpy.mock.calls.map((call) => String(call[0]))
    expect(logged.length + warned.length).toBeGreaterThan(0)
    for (const line of [...logged, ...warned]) {
      expect(line.startsWith('[GuardTest:MoonSong]')).toBe(true)
    }

    hook.destroy()
  })

  it('keeps the plain logTag prefix when no label is given', () => {
    const hook = createHook({ getAudioBuffer: () => null })
    hook.startTranscription()

    const lines = [...logSpy.mock.calls, ...warnSpy.mock.calls].map((call) =>
      String(call[0]),
    )
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(line.startsWith('[GuardTest]')).toBe(true)
    }

    hook.destroy()
  })
})

describe('runWhisperChunkPlan', () => {
  const plan = computeWhisperChunkPlan(SEVENTY_SEC_SAMPLES) // 3 chunks

  it('reports aborted with whatever it had when the transcriber goes away', async () => {
    let calls = 0
    const outcome = await runWhisperChunkPlan({
      plan,
      audioData: rampAudio(SEVENTY_SEC_SAMPLES),
      language: 'en',
      // Alive for chunk 1, gone from chunk 2 on -- what destroy() does.
      getTranscriber: () =>
        calls++ === 0
          ? {
              transcribe: () =>
                Promise.resolve({ chunks: healthyChunks(0, 4) }),
            }
          : null,
    })

    expect(outcome.aborted).toBe(true)
    expect(outcome.successes).toBe(1)
    expect(outcome.failures).toBe(0)
    // The partial prefix is still returned -- callers discard it because of
    // the flag, not because it is empty.
    expect(outcome.segments).toHaveLength(4)
  })

  it('is not aborted when chunks merely fail', async () => {
    const outcome = await runWhisperChunkPlan({
      plan,
      audioData: rampAudio(SEVENTY_SEC_SAMPLES),
      language: 'en',
      getTranscriber: () => ({
        transcribe: () => Promise.reject(new Error('inference exploded')),
      }),
    })

    expect(outcome.aborted).toBe(false)
    expect(outcome.failures).toBe(3)
    expect(outcome.successes).toBe(0)
    expect(outcome.segments).toEqual([])
  })

  it('offsets each chunk into absolute song time and reports progress', async () => {
    const progress: number[] = []
    const outcome = await runWhisperChunkPlan({
      plan,
      audioData: rampAudio(SEVENTY_SEC_SAMPLES),
      language: 'en',
      getTranscriber: () => ({
        transcribe: () => Promise.resolve({ chunks: healthyChunks(0, 2) }),
      }),
      onProgress: (percent) => progress.push(percent),
    })

    expect(outcome.aborted).toBe(false)
    expect(outcome.successes).toBe(3)
    expect(progress).toEqual([0, 33, 67])
    // healthyChunks starts each chunk at 0s; chunk 2 is based at 25s, 3 at 50s
    expect(outcome.segments.map((s) => s.timestamp[0])).toEqual([
      0, 2, 25, 27, 50, 52,
    ])
  })
})
