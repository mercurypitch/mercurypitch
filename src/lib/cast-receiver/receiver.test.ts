// ============================================================
// Cast receiver tests — REQ-TV-110, REQ-TV-111 and REQ-TV-116
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import type { CastCapabilities } from '@/lib/cast-receiver/capabilities'
import { CAST_IDLE_CLOSE_MS } from '@/lib/cast-receiver/cast-config'
import { DEMO_TITLE } from '@/lib/cast-receiver/demo-song'
import type { FrameMeterReading } from '@/lib/cast-receiver/frame-meter'
import { createLocalHost } from '@/lib/cast-receiver/local-host'
import type { CastReceiverDeps } from '@/lib/cast-receiver/receiver'
import { DEMO_FRAME_MS, runCastReceiver } from '@/lib/cast-receiver/receiver'
import type { TvStageFrame, TvStageMessage, TvStageSong, } from '@/lib/tv-stage/protocol'
import { TV_STAGE_IDLE, TV_STAGE_PROTOCOL } from '@/lib/tv-stage/protocol'

const SONG: TvStageSong = {
  v: TV_STAGE_PROTOCOL,
  kind: 'song',
  title: 'A song',
  duration: 30,
  notes: [{ t0: 1, t1: 2, midi: 60 }],
  lyrics: [],
}

const frame = (at: number): TvStageFrame => ({
  v: TV_STAGE_PROTOCOL,
  kind: 'frame',
  at,
  position: 1.5,
  playing: true,
  rate: 1,
  singer: [[1.5, 60.1]],
  score: null,
})

const CAPABILITIES = {
  userAgent: 'CrKey',
  screen: { width: 1920, height: 1080, pixelRatio: 1 },
  cores: 4,
  deviceMemoryGb: 2,
  audio: {
    context: true,
    sampleRate: 48_000,
    baseLatencyMs: 10,
    outputLatencyMs: 40,
    latencySource: 'measured',
  },
  network: { webSocket: true, dataChannel: true },
} as const satisfies CastCapabilities

const METER: FrameMeterReading = {
  fps: 60,
  medianMs: 16.7,
  p95Ms: 17.2,
  late: 0,
  frames: 240,
  heapMb: 40,
  heapLimitMb: 512,
}

/** Timers the test runs by hand, on a clock it moves. */
function manualTime(start = 50_000) {
  let now = start
  let timers: {
    id: number
    at: number
    every: number | null
    task: () => void
  }[] = []
  let ids = 0
  const add = (task: () => void, ms: number, every: number | null) => {
    const id = (ids += 1)
    timers.push({ id, at: now + ms, every, task })
    return () => {
      timers = timers.filter((timer) => timer.id !== id)
    }
  }
  return {
    now: () => now,
    every: (task: () => void, ms: number) => add(task, ms, ms),
    after: (task: () => void, ms: number) => add(task, ms, null),
    advance(ms: number) {
      const end = now + ms
      for (;;) {
        const next = timers
          .filter((timer) => timer.at <= end)
          .sort((a, b) => a.at - b.at)[0]
        if (next === undefined) break
        now = next.at
        if (next.every === null)
          timers = timers.filter((timer) => timer.id !== next.id)
        else next.at += next.every
        next.task()
      }
      now = end
    },
    pending: () => timers.length,
  }
}

function setup() {
  const { host, controls } = createLocalHost()
  const time = manualTime()
  const received: TvStageMessage[] = []
  const setDiagnostics = vi.fn()
  const deps: CastReceiverDeps = {
    stage: { receive: (message) => received.push(message) },
    now: time.now,
    probe: () => Promise.resolve(CAPABILITIES),
    meter: { reading: () => METER },
    setDiagnostics,
    every: time.every,
    after: time.after,
  }
  const receiver = runCastReceiver(host, deps)
  return { controls, time, received, setDiagnostics, receiver }
}

describe('the Cast receiver', () => {
  // REQ-TV-110: the receiver is the stage, fed on its own namespace.
  it('hands the stage what a sender sends it', () => {
    const { controls, received } = setup()
    controls.message(SONG)
    controls.message(TV_STAGE_IDLE)
    expect(received).toEqual([SONG, TV_STAGE_IDLE])
  })

  it('moves a frame’s moment onto this device’s clock', () => {
    const { controls, received, time } = setup()
    // The phone's clock is 20 s behind this one.
    controls.message(frame(time.now() - 20_000))
    time.advance(50)
    controls.message(frame(time.now() - 20_000))
    const moments = received.map((message) =>
      message.kind === 'frame' ? message.at : null,
    )
    expect(moments).toEqual([50_000, 50_050])
  })

  it('drops what it does not know, and the stage never sees it', () => {
    const { controls, received } = setup()
    controls.message({ v: 1, kind: 'karaoke' })
    controls.message('not even an object')
    controls.message({ ...SONG, v: 2 })
    expect(received).toEqual([])
  })

  it('answers a probe with the device’s capabilities and the meter', async () => {
    const { controls } = setup()
    controls.message({ v: 1, kind: 'probe' }, 'phone')
    await Promise.resolve()
    await Promise.resolve()
    expect(controls.replies).toEqual([
      {
        senderId: 'phone',
        data: {
          v: 1,
          kind: 'capabilities',
          capabilities: CAPABILITIES,
          meter: METER,
        },
      },
    ])
  })

  it('turns the diagnostics on and off', () => {
    const { controls, setDiagnostics } = setup()
    controls.message({ v: 1, kind: 'diagnostics', on: true })
    controls.message({ v: 1, kind: 'diagnostics', on: false })
    expect(setDiagnostics.mock.calls).toEqual([[true], [false]])
  })

  it('plays the demo twenty frames a second until a phone sends a song', () => {
    const { controls, received, time, receiver } = setup()
    controls.message({ v: 1, kind: 'demo' })
    expect(receiver.demoing()).toBe(true)
    expect(received[0]).toMatchObject({ kind: 'song', title: DEMO_TITLE })
    time.advance(1000)
    const frames = received.filter((message) => message.kind === 'frame')
    expect(frames).toHaveLength(1 + 1000 / DEMO_FRAME_MS)
    expect(frames.at(-1)).toMatchObject({ position: 1, at: time.now() })
    controls.message(SONG)
    expect(receiver.demoing()).toBe(false)
    const count = received.length
    time.advance(1000)
    expect(received).toHaveLength(count)
  })

  // REQ-TV-116: the last sender leaving stops the song and shows idle.
  it('stops the song and shows the idle screen when the last sender leaves', () => {
    const { controls, received, receiver } = setup()
    controls.join('phone')
    controls.join('tablet')
    controls.message({ v: 1, kind: 'demo' }, 'phone')
    controls.leave('tablet')
    expect(receiver.demoing()).toBe(true)
    expect(received.at(-1)?.kind).not.toBe('idle')
    controls.leave('phone')
    expect(receiver.demoing()).toBe(false)
    expect(received.at(-1)).toEqual(TV_STAGE_IDLE)
  })

  it('closes once no sender has come back for a while, and stays for one that does', () => {
    const { controls, time } = setup()
    controls.join('phone')
    controls.leave('phone')
    time.advance(CAST_IDLE_CLOSE_MS - 1000)
    controls.join('phone')
    time.advance(CAST_IDLE_CLOSE_MS * 2)
    expect(controls.stopped()).toBe(false)
    controls.leave('phone')
    time.advance(CAST_IDLE_CLOSE_MS)
    expect(controls.stopped()).toBe(true)
  })

  it('closes a receiver no sender ever joined, after the same wait', () => {
    const { controls, time } = setup()
    time.advance(CAST_IDLE_CLOSE_MS - 1)
    expect(controls.stopped()).toBe(false)
    time.advance(1)
    expect(controls.stopped()).toBe(true)
  })

  it('takes a new sender’s clock afresh after the last one left', () => {
    const { controls, received, time } = setup()
    controls.message(frame(time.now() - 20_000), 'phone')
    controls.leave('phone')
    // The next phone's clock is 5 s ahead, not 20 s behind.
    controls.message(frame(time.now() + 5_000), 'next')
    const last = received.at(-1)
    expect(last?.kind === 'frame' ? last.at : null).toBe(time.now())
  })
})

// REQ-TV-111: a reply that would not fit one Cast message is not sent.
describe('replies and the Cast message limit', () => {
  it('does not send a probe answer that would not fit', async () => {
    const { host, controls } = createLocalHost()
    const time = manualTime()
    runCastReceiver(host, {
      stage: { receive: () => undefined },
      now: time.now,
      probe: () =>
        Promise.resolve({ ...CAPABILITIES, userAgent: 'x'.repeat(70_000) }),
      meter: { reading: () => METER },
      setDiagnostics: () => undefined,
      every: time.every,
      after: time.after,
    })
    controls.message({ v: 1, kind: 'probe' })
    await Promise.resolve()
    await Promise.resolve()
    expect(controls.replies).toEqual([])
  })
})
