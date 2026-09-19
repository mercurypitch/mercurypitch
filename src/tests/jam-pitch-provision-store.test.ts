// ── Jam pitch provisioning, end to end in the store ──────────────────
// The orchestration: one run at a time, aborted when the song changes,
// persisted before it is announced, never retried by itself, and never
// applied to a song that is no longer loaded.
//
// Decoding and detection are seams here. Both are exercised for real
// elsewhere -- analyze-vocal.test.ts sings actual tones through actual
// detectors -- and jsdom has neither Web Audio nor a network, so mocking
// them is the only way to reach the part this file is about.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JamSong } from '@/lib/jam/jam-song'
import type { JamSongNote } from '@/lib/jam/types'
import type { VocalAnalysis } from '@/lib/pitch-pipeline'
import { abandonJamSongPitch, jamPitchProvision, provideJamSongPitch, retryJamSongPitch, setJamPitchProvisionSeams, } from '@/stores/jam-pitch-provision-store'

vi.mock('@/stores/notifications-store', () => ({
  showNotification: vi.fn(),
}))

const { showNotification } = await import('@/stores/notifications-store')

function song(over: Partial<JamSong> = {}): JamSong {
  return {
    id: 'session:abc123',
    title: 'A Song',
    stems: { instrumental: 'blob:inst', vocal: 'blob:vox' },
    lines: [],
    notes: [],
    durationSec: 120,
    origin: 'local',
    ...over,
  }
}

function analysis(midis: number[]): VocalAnalysis {
  return {
    algo: 'yin',
    rawDetections: [],
    contour: [],
    mergedNotes: [],
    segmentedNotes: midis.map((midi, i) => ({
      midi,
      noteName: 'C4',
      startSec: i,
      endSec: i + 0.5,
    })),
  }
}

/** A promise plus the handles to settle it from the test body. */
function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const SAMPLES = { samples: new Float32Array(16), sampleRate: 16000 }

/** A run that settles when the test says so. */
function stallingAnalyze() {
  const gate = deferred<VocalAnalysis>()
  let report: ((pct: number) => void) | undefined
  let aborted = false
  const analyze = vi.fn(
    async (
      _samples: Float32Array,
      _rate: number,
      _opts?: unknown,
      run?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
    ) => {
      report = run?.onProgress
      run?.signal?.addEventListener('abort', () => {
        aborted = true
        const error = new Error('cancelled')
        error.name = 'AbortError'
        gate.reject(error)
      })
      return gate.promise
    },
  )
  return {
    analyze,
    finish: (result: VocalAnalysis) => gate.resolve(result),
    progress: (pct: number) => report?.(pct),
    wasAborted: () => aborted,
  }
}

/** Let every already-queued microtask run. */
const settle = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('provideJamSongPitch', () => {
  beforeEach(() => {
    abandonJamSongPitch()
    setJamPitchProvisionSeams(null)
    vi.mocked(showNotification).mockClear()
  })

  it('works the line out, saves it, and hands it to the room', async () => {
    const save = vi.fn(
      async (_sessionId: string, _result: VocalAnalysis) => undefined,
    )
    const analyze = vi.fn(async () => analysis([60, 62]))
    const loadVocalSamples = vi.fn(async () => SAMPLES)
    setJamPitchProvisionSeams({ loadVocalSamples, analyze, save })
    const onNotes = vi.fn()

    provideJamSongPitch({ song: song(), isHost: true, onNotes })
    expect(jamPitchProvision().phase).toBe('working')
    await settle()

    expect(loadVocalSamples).toHaveBeenCalledWith(
      'blob:vox',
      expect.any(AbortSignal),
    )
    // Persisted under the SESSION id, not the song id: that is the key
    // the mixer and Karaoke Night read back.
    expect(save.mock.calls[0]?.[0]).toBe('abc123')
    const notes = onNotes.mock.calls[0]?.[1] as JamSongNote[]
    expect(onNotes).toHaveBeenCalledWith('session:abc123', expect.any(Array))
    expect(notes).toEqual([
      { midi: 60, startSec: 0, endSec: 0.5 },
      { midi: 62, startSec: 1, endSec: 1.5 },
    ])
    expect(jamPitchProvision().phase).toBe('idle')
    expect(vi.mocked(showNotification)).toHaveBeenCalledWith(
      'Pitch guide ready',
      'success',
      expect.anything(),
    )
  })

  it('reports progress for the song it is actually analysing', async () => {
    const stall = stallingAnalyze()
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: stall.analyze,
      save: async () => undefined,
    })
    provideJamSongPitch({ song: song(), isHost: true, onNotes: vi.fn() })
    await settle()

    stall.progress(37)
    expect(jamPitchProvision()).toMatchObject({
      phase: 'working',
      progress: 37,
      songId: 'session:abc123',
    })
    stall.finish(analysis([60]))
    await settle()
  })

  it('never starts a second run for the song it is already on', async () => {
    const stall = stallingAnalyze()
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: stall.analyze,
      save: async () => undefined,
    })
    const request = { song: song(), isHost: true, onNotes: vi.fn() }

    provideJamSongPitch(request)
    await settle()
    provideJamSongPitch(request)
    provideJamSongPitch(request)
    await settle()

    expect(stall.analyze).toHaveBeenCalledTimes(1)
    stall.finish(analysis([60]))
    await settle()
  })

  it('abandons the old song the moment a new one is picked', async () => {
    const stall = stallingAnalyze()
    const onNotes = vi.fn()
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: stall.analyze,
      save: async () => undefined,
    })

    provideJamSongPitch({ song: song(), isHost: true, onNotes })
    await settle()
    provideJamSongPitch({
      song: song({ id: 'session:other', notes: [] }),
      isHost: true,
      onNotes,
    })
    await settle()

    expect(stall.wasAborted()).toBe(true)
    // An abort is the app's own doing. Nothing is said, and no failure
    // state is left behind to caption the song that just loaded.
    expect(jamPitchProvision().phase).not.toBe('unavailable')
    expect(vi.mocked(showNotification)).not.toHaveBeenCalledWith(
      expect.anything(),
      'warning',
      expect.anything(),
    )
  })

  it('does not hand a finished line to a song that has moved on', async () => {
    const stall = stallingAnalyze()
    const onNotes = vi.fn()
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: stall.analyze,
      save: async () => undefined,
    })

    provideJamSongPitch({ song: song(), isHost: true, onNotes })
    await settle()
    abandonJamSongPitch()
    stall.finish(analysis([60]))
    await settle()

    expect(onNotes).not.toHaveBeenCalled()
    expect(jamPitchProvision()).toMatchObject({ phase: 'idle', songId: '' })
  })

  it('says a song with nothing to analyse cannot be analysed, and offers no retry', () => {
    provideJamSongPitch({
      song: song({ id: 'exercise:scale' }),
      isHost: true,
      onNotes: vi.fn(),
    })
    expect(jamPitchProvision()).toMatchObject({
      phase: 'unavailable',
      retryable: false,
    })
  })

  it('leaves a guest idle rather than analysing for the host', () => {
    const analyze = vi.fn(async () => analysis([60]))
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze,
      save: async () => undefined,
    })
    provideJamSongPitch({ song: song(), isHost: false, onNotes: vi.fn() })
    expect(analyze).not.toHaveBeenCalled()
    expect(jamPitchProvision().phase).toBe('idle')
  })

  it('surfaces a failure, once, and waits to be asked again', async () => {
    const analyze = vi.fn(async () => {
      throw new Error('decode exploded')
    })
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze,
      save: async () => undefined,
    })
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    provideJamSongPitch({ song: song(), isHost: true, onNotes: vi.fn() })
    await settle()

    expect(jamPitchProvision()).toMatchObject({
      phase: 'unavailable',
      retryable: true,
      songId: 'session:abc123',
    })
    expect(vi.mocked(showNotification)).toHaveBeenCalledWith(
      expect.stringContaining('did not finish'),
      'warning',
      expect.anything(),
    )
    // Nothing retries itself. A stem that fails to decode fails every
    // time, and a loop would flatten the battery of whoever picked it.
    await settle()
    expect(analyze).toHaveBeenCalledTimes(1)
    errors.mockRestore()
  })

  it('treats an empty result as unavailable rather than as a silent zero', async () => {
    const analyze = vi.fn(async () => analysis([]))
    const onNotes = vi.fn()
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze,
      save: async () => undefined,
    })

    provideJamSongPitch({ song: song(), isHost: true, onNotes })
    await settle()

    expect(onNotes).not.toHaveBeenCalled()
    expect(jamPitchProvision()).toMatchObject({ phase: 'unavailable' })
    expect(analyze).toHaveBeenCalledTimes(1)
  })

  it('keeps the line when saving it fails', async () => {
    // A full disk is not a reason to leave the singer without a target.
    const save = vi.fn(async () => {
      throw new Error('quota exceeded')
    })
    const onNotes = vi.fn()
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: async () => analysis([60]),
      save,
    })

    provideJamSongPitch({ song: song(), isHost: true, onNotes })
    await settle()

    expect(onNotes).toHaveBeenCalledTimes(1)
    expect(jamPitchProvision().phase).toBe('idle')
  })
})

describe('retryJamSongPitch', () => {
  beforeEach(() => {
    abandonJamSongPitch()
    setJamPitchProvisionSeams(null)
    vi.mocked(showNotification).mockClear()
  })

  it('runs the same request again when the singer asks', async () => {
    let attempt = 0
    const analyze = vi.fn(async () => {
      attempt++
      if (attempt === 1) throw new Error('first try failed')
      return analysis([64])
    })
    const onNotes = vi.fn()
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze,
      save: async () => undefined,
    })
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    provideJamSongPitch({ song: song(), isHost: true, onNotes })
    await settle()
    expect(jamPitchProvision().phase).toBe('unavailable')

    retryJamSongPitch()
    await settle()

    expect(analyze).toHaveBeenCalledTimes(2)
    expect(onNotes).toHaveBeenCalledWith('session:abc123', [
      { midi: 64, startSec: 0, endSec: 0.5 },
    ])
    errors.mockRestore()
  })

  it('does nothing when there is nothing to retry', () => {
    expect(() => retryJamSongPitch()).not.toThrow()
    expect(jamPitchProvision().phase).toBe('idle')
  })

  it('does not stack a second run on top of one already going', async () => {
    const stall = stallingAnalyze()
    setJamPitchProvisionSeams({
      loadVocalSamples: async () => SAMPLES,
      analyze: stall.analyze,
      save: async () => undefined,
    })

    provideJamSongPitch({ song: song(), isHost: true, onNotes: vi.fn() })
    await settle()
    retryJamSongPitch()
    retryJamSongPitch()
    await settle()

    expect(stall.analyze).toHaveBeenCalledTimes(1)
    stall.finish(analysis([60]))
    await settle()
  })
})
