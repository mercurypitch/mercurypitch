// ============================================================
// The audio census: every context and mic track a test build makes
// ============================================================
//
// A window of fakes: an AudioContext class and a getUserMedia whose tracks
// end when stopped, as the platform's do. What the census must not change
// is checked as hard as what it counts: the context is the class's own and
// the stream is the one getUserMedia gave.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomOutputReading } from '@/components/room-kit/room-output'
import { audioDiagnosticEntries, resetAudioDiagnosticsForTests, } from '@/lib/audio-diagnostics'
import type { NativeAudioOutput, NativeAudioOutputReading, } from '@/stores/native-shell-store'
import { censusContexts, censusCounts, censusTracks, installAudioCensus, LEVEL_POLL_MS, OUTPUT_SETTLE_MS, resetAudioCensusForTests, SOUND_GAP_MS, watchRoomLevels, } from './audio-census'

class FakeContext {
  state = 'suspended'
  sampleRate = 48_000
  private readonly listeners: (() => void)[] = []
  addEventListener(_type: string, listener: () => void): void {
    this.listeners.push(listener)
  }
  setState(state: string): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}

class FakeTrack {
  readonly kind = 'audio'
  readonly label = 'iPhone Microphone'
  readyState: 'live' | 'ended' = 'live'
  private readonly ended: (() => void)[] = []
  getSettings() {
    return {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48_000,
      channelCount: 1,
    }
  }
  stop(): void {
    this.readyState = 'ended'
  }
  addEventListener(_type: string, listener: () => void): void {
    this.ended.push(listener)
  }
  /** The platform ending it: a call, the mic taken away. */
  endByPlatform(): void {
    this.readyState = 'ended'
    for (const listener of this.ended) listener()
  }
}

interface FakeWindow {
  AudioContext: typeof FakeContext
  navigator: {
    mediaDevices: { getUserMedia: (c: unknown) => Promise<unknown> }
  }
}

let win: FakeWindow
let tracks: FakeTrack[]
let streams: unknown[]

function events(source: string): string[] {
  return audioDiagnosticEntries()
    .filter((entry) => entry.source === source)
    .map((entry) => entry.event)
}

beforeEach(() => {
  resetAudioDiagnosticsForTests()
  resetAudioCensusForTests()
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  tracks = []
  streams = []
  win = {
    AudioContext: FakeContext,
    navigator: {
      mediaDevices: {
        getUserMedia: vi.fn(async () => {
          const track = new FakeTrack()
          tracks.push(track)
          const stream = { getAudioTracks: () => [track] }
          streams.push(stream)
          return stream
        }),
      },
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

const install = (output?: NativeAudioOutput) =>
  installAudioCensus({ win: win as unknown as Window, output })

describe('contexts', () => {
  it('counts every context made, and hands back the class’s own', () => {
    install()
    const Made = win.AudioContext
    const first = new Made()
    const second = new Made()
    expect(first).toBeInstanceOf(FakeContext)
    expect(Object.getPrototypeOf(first)).toBe(FakeContext.prototype)
    expect(censusContexts().map((c) => [c.n, c.context])).toEqual([
      [1, first],
      [2, second],
    ])
    expect(censusCounts().contexts).toBe(2)
    expect(events('census')).toEqual(['context-made', 'context-made'])
  })

  it('records each change of state, and counts a closed one apart', () => {
    install()
    const context = new win.AudioContext()
    context.setState('running')
    context.setState('closed')
    expect(events('census')).toEqual([
      'context-made',
      'context-state',
      'context-state',
    ])
    expect(censusContexts()).toEqual([])
    expect(censusCounts().closed).toBe(1)
  })

  it('wraps once, however often it is installed', () => {
    install()
    install()
    void new win.AudioContext()
    expect(censusCounts().contexts).toBe(1)
  })
})

describe('mic tracks', () => {
  it('counts a track live from getUserMedia until it is stopped', async () => {
    install()
    const stream = await win.navigator.mediaDevices.getUserMedia({
      audio: true,
    })
    expect(stream).toBe(streams[0])
    expect(censusTracks().map((t) => [t.n, t.track])).toEqual([[1, tracks[0]]])

    tracks[0].stop()
    expect(tracks[0].readyState).toBe('ended')
    expect(censusTracks()).toEqual([])
    expect(censusCounts()).toMatchObject({ tracks: 1, ended: 1 })
    expect(events('census')).toEqual(['mic-opened', 'mic-stopped'])
  })

  it('keeps what the track was opened with, for the report', async () => {
    install()
    await win.navigator.mediaDevices.getUserMedia({ audio: true })
    const opened = audioDiagnosticEntries().find(
      (entry) => entry.event === 'mic-opened',
    )
    expect(opened?.detail).toMatchObject({
      n: 1,
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    })
  })

  it('records a track the platform ended', async () => {
    install()
    await win.navigator.mediaDevices.getUserMedia({ audio: true })
    tracks[0].endByPlatform()
    expect(events('census')).toEqual(['mic-opened', 'mic-ended'])
    expect(censusTracks()).toEqual([])
  })

  it('records a refusal as a failure, and still refuses', async () => {
    win.navigator.mediaDevices.getUserMedia = vi.fn(async () => {
      throw new DOMException('Permission denied', 'NotAllowedError')
    })
    install()
    await expect(
      win.navigator.mediaDevices.getUserMedia({ audio: true }),
    ).rejects.toThrow('Permission denied')
    const failed = audioDiagnosticEntries().find((entry) => entry.failed)
    expect(failed?.event).toBe('mic-failed')
  })
})

describe("the phone's output", () => {
  it('records the first reading and every change, with what moved it', async () => {
    let send: (reading: NativeAudioOutputReading) => void = () => undefined
    const reading = (volume: number, reason: string | null) => ({
      volume,
      step: null,
      steps: null,
      route: 'receiver' as const,
      outputs: [{ type: 'Receiver', name: 'Receiver' }],
      detail: { category: 'AVAudioSessionCategoryPlayAndRecord' },
      reason,
    })
    install({
      read: async () => reading(1, null),
      watch: (handler) => {
        send = handler
        return () => undefined
      },
    })
    await Promise.resolve()
    await Promise.resolve()
    send(reading(0.5, 'volume'))
    const entries = audioDiagnosticEntries().filter(
      (entry) => entry.source === 'output',
    )
    expect(entries.map((entry) => entry.event)).toEqual(['read', 'change'])
    expect(entries[1]?.detail).toMatchObject({
      route: 'receiver',
      volume: 0.5,
      reason: 'volume',
      ports: 'Receiver',
      category: 'AVAudioSessionCategoryPlayAndRecord',
    })
  })
})

// The owner's iPhone (build 880): the volume followed the keys after a fresh
// launch and stopped the moment a room opened. A room's opening is a mic and
// a context starting, so the output is read at each, and again once WebKit
// has had a moment to switch its own session.
describe("the phone's output as the rooms' audio starts and stops", () => {
  const reading = (volume: number): NativeAudioOutputReading => ({
    volume,
    step: null,
    steps: null,
    route: 'speaker',
    outputs: [{ type: 'Speaker', name: 'Speaker' }],
    detail: { category: 'AVAudioSessionCategoryPlayAndRecord' },
    reason: null,
  })

  const reads = (): Record<string, unknown>[] =>
    audioDiagnosticEntries()
      .filter((entry) => entry.source === 'output' && entry.event === 'read')
      .map((entry) => entry.detail ?? {})

  const flush = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) await Promise.resolve()
  }

  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('reads it as a mic opens and stops, and again once it settles', async () => {
    const read = vi.fn(async () => reading(0.5))
    install({ read, watch: () => () => undefined })
    await flush()
    expect(reads().map((detail) => detail.at)).toEqual(['launch'])

    await win.navigator.mediaDevices.getUserMedia({ audio: true })
    await flush()
    expect(reads().map((detail) => detail.at)).toEqual([
      'launch',
      'mic 1 opened',
    ])
    await vi.advanceTimersByTimeAsync(OUTPUT_SETTLE_MS)
    tracks[0].stop()
    await flush()
    expect(reads().map((detail) => detail.at)).toEqual([
      'launch',
      'mic 1 opened',
      'mic 1 opened, settled',
      'mic 1 stopped',
    ])
    expect(reads()[1]).toMatchObject({ volume: 0.5, route: 'speaker' })
  })

  it('reads it as a context starts and stops', async () => {
    install({ read: async () => reading(1), watch: () => () => undefined })
    const context = new win.AudioContext()
    context.setState('running')
    await flush()
    context.setState('suspended')
    await flush()
    await vi.advanceTimersByTimeAsync(OUTPUT_SETTLE_MS)
    expect(reads().map((detail) => detail.at)).toEqual([
      'launch',
      'context 1 running',
      'context 1 suspended',
      'context 1 running, settled',
      'context 1 suspended, settled',
    ])
  })

  it('reads nothing more without the phone’s output', async () => {
    install()
    await win.navigator.mediaDevices.getUserMedia({ audio: true })
    await vi.advanceTimersByTimeAsync(OUTPUT_SETTLE_MS)
    expect(reads()).toEqual([])
  })

  it('names the session type the page asked WebKit for, beside each reading', async () => {
    const page = win as FakeWindow & {
      navigator: { audioSession?: { type: string } }
    }
    page.navigator.audioSession = { type: 'auto' }
    let send: (r: NativeAudioOutputReading) => void = () => undefined
    install({
      read: async () => reading(1),
      watch: (handler) => {
        send = handler
        return () => undefined
      },
    })
    await flush()
    page.navigator.audioSession.type = 'playback'
    send({ ...reading(0.25), reason: 'volume' })
    const entries = audioDiagnosticEntries().filter(
      (entry) => entry.source === 'output',
    )
    expect(entries.map((entry) => entry.detail?.pageSession)).toEqual([
      'auto',
      'playback',
    ])
  })

  it('forgets a reading still to come when it is reset', async () => {
    install({ read: async () => reading(1), watch: () => () => undefined })
    await win.navigator.mediaDevices.getUserMedia({ audio: true })
    await flush()
    resetAudioDiagnosticsForTests()
    resetAudioCensusForTests()
    await vi.advanceTimersByTimeAsync(OUTPUT_SETTLE_MS)
    expect(reads()).toEqual([])
  })
})

describe('what the rooms sent', () => {
  it('records each sound once it ends, with its loudest peak and RMS', () => {
    vi.useFakeTimers()
    try {
      let now: { peakDb: number | null; rmsDb: number | null } = {
        peakDb: null,
        rmsDb: null,
      }
      const stop = watchRoomLevels(() => [
        {
          context: {} as BaseAudioContext,
          gain: 1,
          ...now,
        } as RoomOutputReading,
      ])
      vi.advanceTimersByTime(500)
      expect(events('census')).toEqual([])

      // A note: louder in the middle, 600 ms long.
      now = { peakDb: -14.04, rmsDb: -26 }
      vi.advanceTimersByTime(300)
      now = { peakDb: -9.96, rmsDb: -21.04 }
      vi.advanceTimersByTime(300)
      // Its end: the first reading under the floor, and a second later
      // the record.
      now = { peakDb: null, rmsDb: null }
      vi.advanceTimersByTime(SOUND_GAP_MS)
      expect(events('census')).toEqual([])
      vi.advanceTimersByTime(LEVEL_POLL_MS)

      const sound = audioDiagnosticEntries().find(
        (entry) => entry.event === 'room-sound',
      )
      expect(sound?.detail).toEqual({ peak: -10, rms: -21, ms: 600, gain: 1 })
      stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('counts a quiet tail under the floor as silence', () => {
    vi.useFakeTimers()
    try {
      let peakDb: number | null = -70
      const stop = watchRoomLevels(() => [
        {
          context: {} as BaseAudioContext,
          gain: 1,
          peakDb,
          rmsDb: peakDb,
        } as RoomOutputReading,
      ])
      vi.advanceTimersByTime(2000)
      peakDb = null
      vi.advanceTimersByTime(2000)
      expect(events('census')).toEqual([])
      stop()
    } finally {
      vi.useRealTimers()
    }
  })
})
