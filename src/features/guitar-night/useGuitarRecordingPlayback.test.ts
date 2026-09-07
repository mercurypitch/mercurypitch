// Audition ownership, source selection and reversible tone are independent of recording input.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import { DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarPracticeScore } from '@/lib/guitar/recording-types'
import type { PreviewPlayerOptions } from '@/lib/preview-player'
import { useGuitarRecordingPlayback } from './useGuitarRecordingPlayback'

const audio = vi.hoisted(() => ({
  media: vi.fn(),
  notes: vi.fn(),
  amp: vi.fn(),
  play: vi.fn<() => Promise<boolean>>(),
  time: 0,
}))
vi.mock('@/lib/preview-player', () => ({
  createPreviewPlayer: audio.media,
  ENVELOPE_DEFAULTS: { releaseMs: 180 },
}))
vi.mock('@/lib/guitar/recording-note-player', () => ({
  createRecordingNotePlayer: audio.notes,
}))
vi.mock('@/lib/guitar/guitar-amp-stage', () => ({
  createGuitarAmpStage: audio.amp,
}))

const clean = { ...DEFAULT_GUITAR_ELECTRIC_AMP_PARAMETERS, enabled: false }
const graph = { context: {} as AudioContext, destination: {} as AudioNode }
const disposeRoots: (() => void)[] = []
const players: {
  options: PreviewPlayerOptions
  pause: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  seek: ReturnType<typeof vi.fn>
  seekToFraction: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  play: ReturnType<
    typeof vi.fn<
      (url?: string, options?: { startSeconds?: number }) => Promise<boolean>
    >
  >
  readonly currentTime: number
}[] = []

function fakePlayer(options: PreviewPlayerOptions) {
  let madeProcessing = false
  const result = {
    options,
    pause: vi.fn(),
    stop: vi.fn(() => {
      audio.time = 0
    }),
    seek: vi.fn((seconds: number) => {
      audio.time = seconds
    }),
    seekToFraction: vi.fn((fraction: number) => {
      audio.time = fraction * 3
    }),
    dispose: vi.fn(),
    play: vi.fn(async (_url?: string, start?: { startSeconds?: number }) => {
      if (start?.startSeconds !== undefined) audio.time = start.startSeconds
      if (!madeProcessing) {
        options.createProcessing?.(graph.context)
        madeProcessing = true
      }
      return await audio.play()
    }),
    get currentTime() {
      return audio.time
    },
  }
  players.push(result)
  return result
}

function draft(blob: Blob | null = new Blob(['audio'])): GuitarRecordingDraft {
  return {
    recording: {
      id: 'take',
      version: 1,
      detectorVersion: 'test',
      title: 'Idea',
      createdAt: '',
      updatedAt: '',
      state: 'kept',
      sampleRate: 48000,
      inputChannel: 0,
      inputKind: 'interface',
      frames: 144000,
      chunks: 1,
      audioStartFrame: 0,
      clockAnomalies: 0,
      interruption: null,
      amp: { ...clean, enabled: true, drive: 0.22 },
      backing: null,
      takeId: null,
      scoreId: null,
    },
    blob,
    peaks: [],
    notes: [
      {
        id: 'n',
        midi: 28,
        startFrame: 1234,
        endFrame: 48000,
        clarity: 0.9,
        onset: 'attack',
      },
    ],
  }
}

function setup(initial = draft()) {
  const [current, setCurrent] = createSignal<GuitarRecordingDraft | null>(
    initial,
  )
  const [score, setScore] = createSignal<GuitarPracticeScore | null>(null)
  const [blocked, setBlocked] = createSignal(false)
  const [amp, setAmp] = createSignal({ ...clean, enabled: true, drive: 0.91 })
  const activate = vi.fn(async () => graph)
  const before = vi.fn()
  const replay = createRoot((end) => {
    disposeRoots.push(end)
    return useGuitarRecordingPlayback({
      draft: current,
      score,
      blocked,
      currentAmp: amp,
      activate,
      beforePlay: before,
    })
  })
  return {
    replay,
    activate,
    before,
    setCurrent,
    setScore,
    setBlocked,
    amp,
    setAmp,
  }
}
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'performance',
    ],
  })
  vi.resetAllMocks()
  players.length = 0
  audio.time = 0
  audio.play.mockResolvedValue(true)
  audio.media.mockImplementation(fakePlayer)
  audio.notes.mockImplementation(fakePlayer)
  audio.amp.mockImplementation(
    (_context, parameters: GuitarElectricAmpParameters) => ({
      input: {},
      output: {},
      dispose: vi.fn(),
      getStatus: () => (parameters.enabled ? 'ready' : 'bypassed'),
      setParameters: vi.fn(),
    }),
  )
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-take')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
})
afterEach(async () => {
  for (const dispose of disposeRoots.splice(0)) dispose()
  await vi.advanceTimersByTimeAsync(300)
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('recording audition', () => {
  it.each(['recording', 'notes'] as const)(
    'queues an exact pre-Play position without allocating %s audio',
    async (source) => {
      const { replay, activate } = setup()
      replay.setSource(source)
      replay.seek(1.237)
      replay.pause()
      expect(replay.position()).toBe(1.237)
      expect(replay.engaged()).toBe(true)
      expect(activate).not.toHaveBeenCalled()
      expect(players).toHaveLength(0)
      await replay.toggle()
      expect(audio.time).toBe(1.237)
      expect(replay.playing()).toBe(true)
      expect(players).toHaveLength(1)
      if (source === 'recording')
        expect(players[0].play).toHaveBeenLastCalledWith('blob:local-take', {
          startSeconds: 1.237,
        })
      else expect(players[0].seek).toHaveBeenLastCalledWith(1.237)
    },
  )

  it.each(['recording', 'notes'] as const)(
    'seeks %s during playback and pause, with Stop rewinding independently',
    async (source) => {
      const { replay } = setup()
      replay.setSource(source)
      await replay.toggle()
      replay.seek(1.731)
      expect(replay.position()).toBe(1.731)
      expect(replay.playing()).toBe(true)
      replay.pause()
      replay.seek(2.183)
      expect(replay.position()).toBe(2.183)
      expect(replay.playing()).toBe(false)
      await replay.toggle()
      expect(audio.time).toBe(2.183)
      replay.stop()
      expect(players[0].stop).toHaveBeenCalledOnce()
      expect(replay.position()).toBe(0)
      expect(replay.playing()).toBe(false)
      await replay.toggle()
      expect(audio.time).toBe(0)
      expect(players).toHaveLength(1)
    },
  )

  it('takes the latest scrub while output activation is pending', async () => {
    const { replay, activate } = setup()
    let finish!: (value: typeof graph) => void
    activate.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const starting = replay.toggle()
    replay.seek(0.8)
    replay.seek(2.41)
    expect(players).toHaveLength(0)
    finish(graph)
    await starting
    expect(audio.time).toBe(2.41)
    expect(activate).toHaveBeenCalledOnce()
  })

  it.each(['recording', 'notes'] as const)(
    'supersedes a pending %s Play with the latest scrub',
    async (source) => {
      let finish!: (value: boolean) => void
      audio.play.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve
        }),
      )
      const { replay } = setup()
      replay.setSource(source)
      const old = replay.toggle()
      await Promise.resolve()
      replay.seek(1.45)
      await vi.advanceTimersByTimeAsync(0)
      expect(replay.playing()).toBe(true)
      expect(audio.time).toBe(1.45)
      const pauses = players[0].pause.mock.calls.length
      finish(true)
      await old
      expect(replay.playing()).toBe(true)
      expect(players[0].pause).toHaveBeenCalledTimes(pauses)
    },
  )

  it('parks at the end, ignores invalid seeks and starts again from zero', async () => {
    const { replay } = setup()
    await replay.toggle()
    replay.seek(30)
    expect(replay.position()).toBe(3)
    expect(replay.playing()).toBe(false)
    replay.seek(NaN)
    replay.seek(Infinity)
    expect(replay.position()).toBe(3)
    await replay.toggle()
    expect(audio.time).toBe(0)
    replay.seek(-100)
    expect(replay.position()).toBe(0)
  })

  it('discards queued positions when the source or recording is replaced', async () => {
    const { replay, setCurrent } = setup()
    replay.seek(1.5)
    replay.setSource('notes')
    expect(replay.position()).toBe(0)
    replay.seek(2)
    setCurrent({ ...draft(), recording: { ...draft().recording, id: 'next' } })
    expect(replay.position()).toBe(0)
    await replay.toggle()
    expect(players[0].seek).not.toHaveBeenCalled()
  })

  it('refreshes cabinet status while media is paused', async () => {
    let status = 'loading'
    audio.amp.mockImplementation(() => ({
      input: {},
      output: {},
      dispose: vi.fn(),
      getStatus: () => status,
      setParameters: vi.fn(),
    }))
    const { replay } = setup()
    await replay.toggle()
    replay.pause()
    expect(replay.ampStatus()).toBe('loading')
    status = 'ready'
    await vi.advanceTimersByTimeAsync(100)
    expect(replay.ampStatus()).toBe('ready')
    expect(replay.playing()).toBe(false)
  })
  it('does not retune the retired note processor while paused', async () => {
    const { replay } = setup()
    replay.setSource('notes')
    await replay.toggle()
    const stage = audio.amp.mock.results[0].value
    expect(replay.ampStatus()).toBe('ready')
    replay.pause()
    expect(replay.ampStatus()).toBeNull()
    stage.setParameters.mockClear()
    replay.setTone('saved-amp')
    expect(stage.setParameters).not.toHaveBeenCalled()
    expect(replay.parameters()?.drive).toBe(0.22)
    expect(replay.ampStatus()).toBeNull()
  })
  it('is silent/inert until Play, and applies current, clean and saved tone without mutating the room', async () => {
    const { replay, before, activate, setAmp, amp } = setup()
    expect(audio.media).not.toHaveBeenCalled()
    expect(audio.amp).not.toHaveBeenCalled()
    expect(activate).not.toHaveBeenCalled()
    replay.setTone('clean')
    expect(audio.amp).not.toHaveBeenCalled()
    replay.setTone('current-amp')
    await replay.toggle()
    expect(before).toHaveBeenCalledOnce()
    expect(replay.playing()).toBe(true)
    expect(audio.amp).toHaveBeenCalledWith(
      graph.context,
      expect.objectContaining({ enabled: true, drive: 0.91 }),
    )
    expect(audio.media.mock.calls[0][0].audioGraph).toBe(graph)
    const stage = audio.amp.mock.results[0].value
    replay.setTone('clean')
    expect(stage.setParameters).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    )
    replay.setTone('saved-amp')
    expect(stage.setParameters).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true, drive: 0.22 }),
    )
    expect(amp().drive).toBe(0.91)
    setAmp({ ...amp(), enabled: false })
    replay.setTone('current-amp')
    expect(stage.setParameters).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false, drive: 0.91 }),
    )
    expect(audio.play).toHaveBeenCalledTimes(1)
  })

  it('allows retained notes without audio or accepted fingering, but never fabricates saved amp', async () => {
    const row = draft(null)
    row.recording.amp = null
    const { replay } = setup(row)
    expect(replay.available()).toBe(false)
    replay.setSource('notes')
    expect(replay.available()).toBe(true)
    await replay.toggle()
    expect(audio.notes.mock.calls[0][0].notes).toEqual([
      { midi: 28, startSeconds: 1234 / 48000, endSeconds: 1 },
    ])
    expect(audio.media).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    replay.setTone('saved-amp')
    expect(replay.available()).toBe(false)
    expect(replay.playing()).toBe(false)
  })

  it('cancels an output activation before it can create a player', async () => {
    const { replay, activate } = setup()
    let resolve!: (result: typeof graph) => void
    activate.mockReturnValueOnce(
      new Promise((finish) => {
        resolve = finish
      }),
    )
    const started = replay.toggle()
    expect(replay.pending()).toBe(true)
    replay.pause()
    resolve(graph)
    await started
    expect(audio.media).not.toHaveBeenCalled()
    expect(replay.pending()).toBe(false)
  })

  it('does not resurrect a late Play after pause', async () => {
    let finish!: (ok: boolean) => void
    audio.play.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        finish = resolve
      }),
    )
    const { replay } = setup()
    const started = replay.toggle()
    await Promise.resolve()
    expect(replay.pending()).toBe(true)
    replay.pause()
    finish(true)
    await started
    expect(replay.playing()).toBe(false)
    expect(replay.pending()).toBe(false)
    expect(players[0].pause).toHaveBeenCalled()
  })

  it.each(['recording', 'notes'] as const)(
    'handles the end after pause/resume for %s',
    async (source) => {
      const { replay, setBlocked } = setup()
      replay.setSource(source)
      await replay.toggle()
      audio.time = 1.2
      setBlocked(true)
      expect(replay.position()).toBe(1.2)
      expect(replay.playing()).toBe(false)
      setBlocked(false)
      await replay.toggle()
      expect(replay.playing()).toBe(true)
      players[0].options.onEnded?.()
      expect(replay.playing()).toBe(false)
      expect(replay.position()).toBe(3)
    },
  )

  it('retires the old source before a new one starts and ignores its late end', async () => {
    const { replay } = setup()
    await replay.toggle()
    const old = players[0]
    replay.setSource('notes')
    expect(replay.playing()).toBe(false)
    expect(audio.notes).not.toHaveBeenCalled()
    expect(old.dispose).not.toHaveBeenCalled()
    const started = replay.toggle()
    await vi.advanceTimersByTimeAsync(250)
    await started
    expect(old.dispose).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-take')
    expect(audio.notes).toHaveBeenCalledOnce()
    old.options.onEnded?.()
    expect(replay.playing()).toBe(true)
  })

  it('uses corrections in exact seconds and retires note playback when edits change', async () => {
    const { replay, setScore } = setup()
    setScore({
      recordingId: 'take',
      bpm: 80,
      notes: [
        {
          id: 'n',
          midi: 30,
          startBeat: 0.17,
          endBeat: 0.92,
          string: null,
          fret: null,
        },
      ],
    } as GuitarPracticeScore)
    replay.setSource('notes')
    await replay.toggle()
    expect(audio.notes.mock.calls[0][0].notes[0].startSeconds).toBe(
      (0.17 * 60) / 80,
    )
    setScore({
      recordingId: 'take',
      bpm: 80,
      notes: [
        {
          id: 'n',
          midi: 31,
          startBeat: 0.17,
          endBeat: 0.92,
          string: null,
          fret: null,
        },
      ],
    } as GuitarPracticeScore)
    expect(replay.playing()).toBe(false)
  })

  it('shows a note runtime failure and rewinds with a fresh player', async () => {
    const { replay } = setup()
    replay.setSource('notes')
    await replay.toggle()
    audio.notes.mock.calls[0][0].onError(new Error('Too dense'))
    expect(replay.playing()).toBe(false)
    expect(replay.error()).toMatch(/notes could not/)
    replay.restart()
    expect(replay.position()).toBe(0)
    expect(replay.engaged()).toBe(true)
    const started = replay.toggle()
    await vi.advanceTimersByTimeAsync(250)
    await started
    expect(audio.notes).toHaveBeenCalledTimes(2)
  })
})
