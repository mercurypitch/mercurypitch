// Recorder lifecycle tests keep input ownership, cancellation and recovery separate from playback.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRecordingDraft } from '@/db/services/guitar-recording-service'
import type { GuitarElectricAmpParameters } from '@/lib/guitar/guitar-electric-amp'
import type { GuitarInputProfileKind } from '@/lib/guitar/guitar-input-profile'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import type { GuitarRecordingInput, startGuitarRecordingCapture, } from '@/lib/guitar/recording-capture'
import type { GuitarRecording, GuitarRecordingSummary, } from '@/lib/guitar/recording-types'
import type { GuitarListeningStatus } from './useGuitarListeningController'
import { useGuitarRecordingController } from './useGuitarRecordingController'

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  begin: vi.fn(),
  finish: vi.fn(),
  load: vi.fn(),
  list: vi.fn(),
  checkpoint: vi.fn(),
  started: vi.fn(),
  discard: vi.fn(),
  remove: vi.fn(),
  lock: vi.fn(),
  release: vi.fn(),
}))
vi.mock('@/lib/guitar/recording-capture', () => ({
  startGuitarRecordingCapture: mocks.capture,
}))
vi.mock('@/lib/guitar/recording-lock', () => ({
  acquireGuitarRecordingLock: mocks.lock,
}))
vi.mock('@/db/services/guitar-recording-service', () => ({
  createGuitarRecordingStore: () => mocks,
}))
const disposers: (() => void)[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const summary: GuitarRecordingSummary = {
  frames: 8192,
  notes: [],
  clockAnomalies: 0,
  interruption: null,
}
let captured: Parameters<typeof startGuitarRecordingCapture>[0]
let ending: ReturnType<typeof deferred<GuitarRecordingSummary>>
let row: GuitarRecording
let stopCapture: ReturnType<typeof vi.fn>

function harness(
  open = false,
  profile: GuitarInputProfileKind = 'interface',
  permission?: Promise<boolean>,
) {
  return createRoot((dispose) => {
    disposers.push(dispose)
    const stream = {} as MediaStream
    const [status, setStatus] = createSignal<GuitarListeningStatus>(
      open ? 'listening' : 'off',
    )
    const [channel, setChannel] = createSignal(0)
    const [blocked, setBlocked] = createSignal(false)
    const [playing, setPlaying] = createSignal(false)
    const input = ():
      | (GuitarRecordingInput & { source: MediaStreamAudioSourceNode })
      | null =>
      status() !== 'listening'
        ? null
        : {
            stream,
            channel: channel(),
            channelCount: 2,
            context: { sampleRate: 48000, currentTime: 5 } as AudioContext,
            source: {} as MediaStreamAudioSourceNode,
          }
    const stopInput = vi.fn(() => setStatus('off'))
    const startInput = vi.fn(async () => {
      const okay = permission === undefined ? true : await permission
      if (okay) setStatus('listening')
      return okay
    })
    const clearLoop = vi.fn()
    const controller = useGuitarRecordingController({
      listening: {
        recordingInput: input,
        recordableStream: () => input()?.stream ?? null,
        inputProfile: () => profile,
        error: () => 'Input permission denied',
        stop: stopInput,
        monitorInputChannel: channel,
        status,
      },
      startListening: startInput,
      amp: () => ({}) as GuitarElectricAmpParameters,
      tuning: () => DEFAULT_GUITAR_TUNING,
      backing: () => null,
      playing,
      blocked,
      clearLoop,
    })
    return {
      controller,
      dispose,
      setBlocked,
      setChannel,
      setStatus,
      setPlaying,
      startInput,
      stopInput,
      clearLoop,
      status,
    }
  })
}
beforeEach(() => {
  vi.resetAllMocks()
  ending = deferred<GuitarRecordingSummary>()
  mocks.list.mockResolvedValue([])
  mocks.started.mockResolvedValue(undefined)
  mocks.checkpoint.mockResolvedValue(undefined)
  mocks.discard.mockResolvedValue(undefined)
  mocks.remove.mockResolvedValue(undefined)
  mocks.lock.mockResolvedValue(mocks.release)
  mocks.begin.mockImplementation(async (value: GuitarRecording) => {
    row = value
  })
  mocks.load.mockImplementation(
    async (): Promise<GuitarRecordingDraft> => ({
      recording: row,
      notes: [],
      blob: new Blob(['audio']),
      peaks: [],
    }),
  )
  mocks.finish.mockImplementation(async () => {
    row = { ...row, state: 'draft', frames: summary.frames }
  })
  stopCapture = vi.fn((reason: string | null = null) => {
    ending.resolve({ ...summary, interruption: reason })
    return ending.promise
  })
  mocks.capture.mockImplementation(
    async (options: Parameters<typeof startGuitarRecordingCapture>[0]) => {
      captured = options
      queueMicrotask(() => options.onStart(240000))
      return { done: ending.promise, stop: stopCapture }
    },
  )
})
afterEach(async () => {
  disposers.splice(0).forEach((dispose) => dispose())
  await Promise.resolve()
})

describe('explicit guitar recording lifecycle', () => {
  const savedDraft = (id: string): GuitarRecordingDraft => ({
    recording: {
      id,
      state: 'draft',
      title: id,
      updatedAt: '2026-09-07T10:00:00Z',
    } as GuitarRecording,
    notes: [],
    blob: new Blob(['audio']),
    peaks: [],
  })
  it('quick-switches without review or discarding the previous durable draft, and newest selection wins', async () => {
    const h = harness()
    const first = deferred<GuitarRecordingDraft>()
    mocks.load.mockImplementation((id: string) =>
      id === 'first' ? first.promise : Promise.resolve(savedDraft(id)),
    )
    const old = h.controller.recover('first', { review: false })
    await Promise.resolve()
    await h.controller.recover('second', { review: false })
    first.resolve(savedDraft('first'))
    await old
    expect(h.controller.draft()?.recording.id).toBe('second')
    expect(h.controller.reviewOpen()).toBe(false)
    expect(mocks.discard).not.toHaveBeenCalled()
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(h.startInput).not.toHaveBeenCalled()
  })
  it('quick-switch failure rejects for popup recovery without replacing the current draft', async () => {
    const h = harness()
    h.controller.setDraft(savedDraft('current'))
    mocks.load.mockRejectedValue(new Error('Missing take'))
    await expect(
      h.controller.recover('missing', { review: false }),
    ).rejects.toThrow('Missing take')
    expect(h.controller.draft()?.recording.id).toBe('current')
    expect(h.controller.error()).toBe('Missing take')
    expect(mocks.release).toHaveBeenCalledOnce()
  })
  it('does not clear a different melody when an earlier draft discard finishes', async () => {
    const h = harness()
    const pending = deferred<undefined>()
    h.controller.setDraft(savedDraft('discarded'))
    mocks.discard.mockReturnValue(pending.promise)
    mocks.load.mockResolvedValue(savedDraft('selected-later'))
    const discarding = h.controller.discard('discarded')
    await h.controller.recover('selected-later')
    pending.resolve(undefined)
    await discarding
    expect(h.controller.draft()?.recording.id).toBe('selected-later')
    expect(h.controller.reviewOpen()).toBe(true)
  })
  it('a late quick load cannot replace a new capture and capture blocks deletion', async () => {
    const h = harness(true)
    const pending = deferred<GuitarRecordingDraft>()
    mocks.load.mockImplementation((id: string) =>
      id === 'old' ? pending.promise : Promise.resolve(savedDraft(id)),
    )
    const loading = h.controller.recover('old', { review: false })
    await Promise.resolve()
    await h.controller.start()
    pending.resolve(savedDraft('old'))
    await loading
    expect(h.controller.state()).toBe('recording')
    expect(h.controller.draft()).toBeNull()
    await expect(h.controller.remove('old')).rejects.toThrow('Finish recording')
    expect(mocks.remove).not.toHaveBeenCalled()
    await h.controller.stop()
  })
  it('removes an exact locked row without clearing a different selected melody', async () => {
    const h = harness()
    h.controller.setDraft(savedDraft('current'))
    await h.controller.remove('other')
    expect(mocks.lock).toHaveBeenCalledWith('other')
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('other')
    expect(h.controller.draft()?.recording.id).toBe('current')
    await h.controller.remove('current')
    expect(h.controller.draft()).toBeNull()
    expect(h.controller.reviewOpen()).toBe(false)
    expect(mocks.release).toHaveBeenCalledTimes(2)
  })
  it('retains selection when deletion fails or another tab owns its lock', async () => {
    const h = harness()
    h.controller.setDraft(savedDraft('current'))
    mocks.remove.mockRejectedValueOnce(new Error('Storage failed'))
    await expect(h.controller.remove('current')).rejects.toThrow(
      'Storage failed',
    )
    expect(h.controller.draft()?.recording.id).toBe('current')
    expect(mocks.release).toHaveBeenCalledOnce()
    mocks.lock.mockResolvedValue(null)
    await expect(h.controller.remove('current')).rejects.toThrow('another tab')
    expect(mocks.remove).toHaveBeenCalledOnce()
  })
  it('removes a confirmed deletion from the visible catalogue even if its refresh fails', async () => {
    mocks.list.mockResolvedValue([
      savedDraft('current').recording,
      savedDraft('other').recording,
    ])
    const h = harness()
    await Promise.resolve()
    expect(h.controller.catalogue()).toHaveLength(2)
    mocks.list.mockRejectedValueOnce(new Error('Catalogue unavailable'))
    await h.controller.remove('other')
    expect(h.controller.catalogue().map((entry) => entry.id)).toEqual([
      'current',
    ])
  })
  it('owns input only if Record opened it, and pins the chosen neck', async () => {
    const h = harness()
    await h.controller.start()
    expect(h.startInput).toHaveBeenCalledOnce()
    expect(h.controller.state()).toBe('recording')
    expect(row.tuning).toEqual(DEFAULT_GUITAR_TUNING)
    await h.controller.stop()
    expect(h.stopInput).toHaveBeenCalledOnce()
    expect(h.controller.reviewOpen()).toBe(true)
    expect(mocks.release).toHaveBeenCalledOnce()
    expect(mocks.finish).toHaveBeenCalledWith(row.id, summary, 240000)
  })
  it('never starts or releases already-open Listening/monitoring on Stop recording', async () => {
    const h = harness(true)
    await h.controller.start()
    await h.controller.start()
    expect(mocks.capture).toHaveBeenCalledOnce()
    await h.controller.stop()
    expect(h.startInput).not.toHaveBeenCalled()
    expect(h.stopInput).not.toHaveBeenCalled()
    expect(h.status()).toBe('listening')
  })
  it('does not resume recording state when its first audio acknowledgement follows Stop', async () => {
    mocks.capture.mockImplementation(
      async (options: Parameters<typeof startGuitarRecordingCapture>[0]) => {
        captured = options
        return { done: ending.promise, stop: () => ending.promise }
      },
    )
    const h = harness(true)
    await h.controller.start()
    expect(h.controller.state()).toBe('preparing')
    const stopping = h.controller.stop()
    captured.onStart(240000)
    expect(h.controller.state()).toBe('stopping')
    ending.resolve(summary)
    await stopping
    expect(h.controller.state()).toBe('idle')
    expect(mocks.started).toHaveBeenCalledWith(row.id, 240000, null)
    expect(h.stopInput).not.toHaveBeenCalled()
  })
  it('cancels pending permission without letting a late grant start a take', async () => {
    const permission = deferred<boolean>()
    const h = harness(false, 'interface', permission.promise)
    const starting = h.controller.start()
    expect(h.controller.state()).toBe('preparing')
    await h.controller.stop()
    permission.resolve(true)
    await starting
    expect(h.status()).toBe('off')
    expect(mocks.begin).not.toHaveBeenCalled()
    expect(mocks.capture).not.toHaveBeenCalled()
    expect(h.controller.state()).toBe('idle')
  })
  it('reports denied input and rejects MIDI-only audio recording without opening hardware', async () => {
    const h = harness(false, 'microphone', Promise.resolve(false))
    await h.controller.start()
    expect(h.controller.error()).toContain('permission denied')
    expect(mocks.begin).not.toHaveBeenCalled()
    const midi = harness(false, 'midi')
    await midi.controller.start()
    expect(midi.controller.error()).toContain('MIDI-only')
    expect(midi.startInput).not.toHaveBeenCalled()
  })
  it.each(['channel', 'listening', 'backing', 'blocked'] as const)(
    'finishes a partial take on %s change without reopening input',
    async (change) => {
      const h = harness(true)
      await h.controller.start()
      if (change === 'channel') h.setChannel(1)
      if (change === 'listening') h.setStatus('off')
      if (change === 'backing') h.setPlaying(true)
      if (change === 'blocked') h.setBlocked(true)
      await vi.waitFor(() => expect(h.controller.state()).toBe('idle'))
      expect(stopCapture).toHaveBeenCalledOnce()
      expect(mocks.finish).toHaveBeenCalledOnce()
      expect(h.startInput).not.toHaveBeenCalled()
    },
  )
  it('finishes checkpoint ownership on disposal without opening a review over another page', async () => {
    const h = harness()
    await h.controller.start()
    h.dispose()
    await vi.waitFor(() => expect(mocks.finish).toHaveBeenCalledOnce())
    expect(stopCapture).toHaveBeenCalledWith(
      expect.stringContaining('room was closed'),
    )
    expect(h.controller.reviewOpen()).toBe(false)
    expect(h.status()).toBe('off')
  })
  it('keeps a worker failure recoverable and releases the input it acquired', async () => {
    const h = harness()
    await h.controller.start()
    ending.reject(new Error('Analysis failed'))
    await vi.waitFor(() => expect(h.controller.state()).toBe('idle'))
    expect(h.controller.error()).toBe('Analysis failed')
    expect(mocks.discard).not.toHaveBeenCalled()
    expect(h.stopInput).toHaveBeenCalledOnce()
    expect(mocks.release).toHaveBeenCalledOnce()
  })
  it('does not reopen review if the room closes while the finished draft loads', async () => {
    const h = harness()
    const pending = deferred<GuitarRecordingDraft>()
    mocks.load.mockReturnValue(pending.promise)
    await h.controller.start()
    const stopping = h.controller.stop()
    await vi.waitFor(() => expect(mocks.load).toHaveBeenCalledOnce())
    h.dispose()
    pending.resolve(savedDraft('finished-after-exit'))
    await stopping
    expect(h.controller.reviewOpen()).toBe(false)
    expect(h.controller.draft()).toBeNull()
    expect(mocks.release).toHaveBeenCalledOnce()
  })
  it('blocks recovery while another tab owns the recording', async () => {
    mocks.lock.mockResolvedValue(null)
    const h = harness()
    await h.controller.recover('another-live-draft')
    expect(h.controller.error()).toContain('another tab')
    expect(mocks.load).not.toHaveBeenCalled()
  })
  it('shows evidence before start and audio checkpoints resolve, without starting playback', async () => {
    const h = harness(true)
    const pending = deferred<undefined>()
    mocks.started.mockReturnValue(pending.promise)
    await h.controller.start()
    const chunk = {
      id: 'chunk',
      createdAt: '',
      updatedAt: '',
      kind: 'audio' as const,
      recordingId: row.id,
      sequence: 0,
      firstFrame: 0,
      frames: 8192,
      pcm: new ArrayBuffer(16384),
      notes: [],
      attacks: [],
      pitches: [{ frame: 4096, midi: 57, clarity: 0.9 }],
      peak: 0.5,
    }
    const open = {
      id: 'note-0',
      midi: 57,
      startFrame: 0,
      endFrame: 4096,
      clarity: 0.9,
      onset: 'attack' as const,
    }
    const writing = captured.onChunk(chunk, open)
    captured.onPreview?.({
      sequence: 0,
      frames: 8192,
      notes: [],
      pendingNote: open,
      pitch: chunk.pitches[0],
      ended: false,
    })
    expect(mocks.checkpoint).not.toHaveBeenCalled()
    expect(h.controller.heardNote()).toBe('A3')
    expect(h.controller.duration()).toBeCloseTo(8192 / 48000)
    expect(h.controller.previewNotes()).toEqual([open])
    expect(h.controller.previewRecording()?.tuning).toEqual(
      DEFAULT_GUITAR_TUNING,
    )
    pending.resolve(undefined)
    await writing
    expect(mocks.checkpoint).toHaveBeenCalledWith(chunk)
    await h.controller.stop()
  })
  it('keeps final note evidence visible while saving and ignores previews after room disposal', async () => {
    const h = harness(true)
    const finishing = deferred<undefined>()
    mocks.finish.mockReturnValue(finishing.promise)
    await h.controller.start()
    const note = {
      id: 'note-0',
      midi: 57,
      startFrame: 0,
      endFrame: 8192,
      clarity: 0.9,
      onset: 'attack' as const,
    }
    captured.onPreview?.({
      sequence: 0,
      frames: 8192,
      notes: [],
      pendingNote: note,
      pitch: { frame: 8192, midi: 57, clarity: 0.9 },
      ended: false,
    })
    expect(h.controller.previewNotes()).toEqual([note])
    const finalNote = { ...note, endFrame: 10240 }
    captured.onPreview?.({
      sequence: 1,
      frames: 10240,
      notes: [finalNote],
      pendingNote: null,
      pitch: null,
      ended: true,
    })
    const stopping = h.controller.stop()
    await vi.waitFor(() => expect(mocks.finish).toHaveBeenCalledOnce())
    expect(h.controller.previewNotes()).toEqual([finalNote])
    expect(h.controller.noteCount()).toBe(1)
    expect(h.controller.heardNote()).toBeNull()
    h.dispose()
    captured.onPreview?.({
      sequence: 2,
      frames: 20000,
      notes: [],
      pendingNote: note,
      pitch: null,
      ended: false,
    })
    expect(h.controller.duration()).toBeCloseTo(10240 / 48000)
    finishing.resolve(undefined)
    await stopping
    expect(h.controller.reviewOpen()).toBe(false)
  })
})
