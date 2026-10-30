// The voice session when it closes under its own awaits: a probe or an input
// switch still running when Stop is pressed, or when the page goes away. A
// probe that threw there reached the app's crash screen, and a switch that
// carried on after the close kept the microphone and an AudioContext open
// with nobody left to close them.
//
// The manager, the f0 stream and the AudioContext are faked at their edges;
// the session's sequence is the real one.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VoiceSession } from './voice-session'
import { createVoiceSession } from './voice-session'

const fake = vi.hoisted(() => ({
  stream: null as MediaStream | null,
  consumers: new Set<string>(),
  /** Answers the acquire the session is waiting on. */
  grant: null as (() => void) | null,
  contexts: 0,
  closedContexts: 0,
  streams: 0,
  disposedStreams: 0,
}))

vi.mock('./mic-manager', () => ({
  listAudioInputs: () => Promise.resolve([]),
  micManager: {
    acquire: (id: string) =>
      new Promise((resolve) => {
        fake.grant = () => {
          fake.consumers.add(id)
          fake.stream = {} as MediaStream
          resolve(fake.stream)
        }
      }),
    release: (id: string) => {
      fake.consumers.delete(id)
    },
    getStream: () => fake.stream,
    setPreferredDevice: () => Promise.resolve(),
  },
}))

vi.mock('./pitch-f0-stream', () => ({
  createF0Stream: () => {
    fake.streams++
    return {
      startTask: () => undefined,
      takeFrames: () => [],
      maxLevel: () => 0.1,
      latestLevel: () => 0,
      latest: () => null,
      latestSmoothed: () => null,
      dispose: () => {
        fake.disposedStreams++
      },
    }
  },
}))

class FakeAudioContext {
  state = 'running'
  constructor() {
    fake.contexts++
  }
  resume(): Promise<void> {
    return Promise.resolve()
  }
  close(): Promise<void> {
    fake.closedContexts++
    return Promise.resolve()
  }
}

beforeEach(() => {
  fake.stream = null
  fake.consumers.clear()
  fake.grant = null
  fake.contexts = 0
  fake.closedContexts = 0
  fake.streams = 0
  fake.disposedStreams = 0
  vi.stubGlobal('AudioContext', FakeAudioContext)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

/** A session past open(): the microphone granted and the graph built. */
async function opened(): Promise<VoiceSession> {
  const session = createVoiceSession('mic-check')
  const opening = session.open()
  await vi.advanceTimersByTimeAsync(0)
  fake.grant?.()
  expect((await opening).ok).toBe(true)
  return session
}

/** AudioContexts and f0 streams still running. */
const running = (): { contexts: number; streams: number } => ({
  contexts: fake.contexts - fake.closedContexts,
  streams: fake.streams - fake.disposedStreams,
})

describe('createVoiceSession', () => {
  it('ends a probe quietly when the session closes under it', async () => {
    // Arrange
    const session = await opened()
    const probing = session.probe()
    await vi.advanceTimersByTimeAsync(100)

    // Act
    session.close()
    await vi.advanceTimersByTimeAsync(2_000)

    // Assert
    await expect(probing).resolves.toBe('no-session')
    expect(running()).toEqual({ contexts: 0, streams: 0 })
  })

  it('builds nothing and lets go when it closes during an input switch', async () => {
    // Arrange
    const session = await opened()
    const switching = session.useDevice('usb')
    await vi.advanceTimersByTimeAsync(0)

    // Act: Stop lands while the new input opens.
    session.close()
    fake.grant?.()
    await vi.advanceTimersByTimeAsync(2_000)

    // Assert
    await expect(switching).resolves.toBe('no-session')
    expect(fake.consumers.has('mic-check')).toBe(false)
    expect(running()).toEqual({ contexts: 0, streams: 0 })
  })

  it('opens and probes again after a close', async () => {
    // Arrange
    const session = await opened()
    session.close()

    // Act
    const opening = session.open()
    await vi.advanceTimersByTimeAsync(0)
    fake.grant?.()
    await opening
    const probing = session.probe()
    await vi.advanceTimersByTimeAsync(1_000)

    // Assert
    await expect(probing).resolves.toBe('ok')
    expect(running()).toEqual({ contexts: 1, streams: 1 })
  })
})
