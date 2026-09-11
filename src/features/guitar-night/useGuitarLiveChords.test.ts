// Solid lifecycle tests isolate the browser tap while exercising live chord stage projection and cancellation.
import { createRoot, createSignal } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_GUITAR_TUNING } from '@/lib/guitar/instrument-tuning'
import type { startLiveChordCapture } from '@/lib/guitar/live-chord-capture'
import { useGuitarLiveChords } from './useGuitarLiveChords'

const disposers: (() => void)[] = []
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})

function setup() {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
  const calls: Parameters<typeof startLiveChordCapture>[0][] = []
  const context = { currentTime: 11.2 } as AudioContext
  const stream = {} as MediaStream
  const source = { mediaStream: stream } as MediaStreamAudioSourceNode
  const result = createRoot((dispose) => {
    disposers.push(dispose)
    const [enabled, setEnabled] = createSignal(false)
    const [channel, setChannel] = createSignal(0)
    const [status, setStatus] = createSignal<'listening' | 'off'>('listening')
    const hook = useGuitarLiveChords({
      enabled,
      recording: () => false,
      tuning: () => DEFAULT_GUITAR_TUNING,
      listening: {
        status,
        inputProfile: () => 'interface',
        recordingInput: () => ({
          context,
          source,
          stream,
          channel: channel(),
          channelCount: 2,
        }),
      },
      startCapture: async (options) => {
        calls.push(options)
        return { dispose: () => {} }
      },
    })
    return { hook, setEnabled, setChannel, setStatus, dispose }
  })
  return { ...result, calls }
}

it('defaults to no worker and keeps a stable source across settings, routes and visibility', async () => {
  const h = setup()
  expect(h.calls).toHaveLength(0)
  const stage = h.hook.source
  h.setEnabled(true)
  expect(h.calls).toHaveLength(1)
  h.calls[0].onReady()
  expect(h.hook.status()).toBe('listening')
  h.calls[0].onResult({
    audioStartSeconds: 10,
    analysedSeconds: 0.8,
    processingMs: 35,
    notes: [40, 47, 52].map((midi) => ({
      midi,
      startSeconds: 0.1,
      endSeconds: 0.7,
      confidence: 0.9,
    })),
  })
  expect(h.hook.active()).toBe(true)
  expect(stage.notes().map((note) => note.midi)).toEqual([40, 47, 52])
  expect(new Set(stage.notes().map((note) => note.stringIndex)).size).toBe(3)
  expect(
    stage
      .notes()
      .every((note) => note.stringIndex >= 0 && note.stringIndex < 6),
  ).toBe(true)
  h.setChannel(1)
  expect(h.calls[0].signal.aborted).toBe(true)
  expect(h.calls).toHaveLength(2)
  expect(h.hook.active()).toBe(false)
  h.calls[0].onResult({
    audioStartSeconds: 0,
    analysedSeconds: 9,
    processingMs: 35,
    notes: [],
  })
  expect(h.hook.active()).toBe(false)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  document.dispatchEvent(new Event('visibilitychange'))
  expect(h.calls[1].signal.aborted).toBe(true)
  expect(h.hook.source).toBe(stage)
  h.dispose()
})

it('retains an actionable overload state, retries only on a new intent, and cancels on Listening off', () => {
  const h = setup()
  h.setEnabled(true)
  h.calls[0].onError('Too slow; refine after Stop.')
  expect(h.calls[0].signal.aborted).toBe(true)
  expect(h.hook.status()).toBe('paused')
  expect(h.hook.error()).toContain('Too slow')
  expect(h.calls).toHaveLength(1)
  h.setEnabled(false)
  h.setEnabled(true)
  expect(h.calls).toHaveLength(2)
  h.setStatus('off')
  expect(h.calls[1].signal.aborted).toBe(true)
  expect(h.hook.status()).toBe('standby')
})
