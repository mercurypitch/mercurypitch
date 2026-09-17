// Recorded drummer replay tests keep accompaniment synchronized and separately mutable.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRoomDrumPlayerPort, LazyGuitarRoomDrumPlayerOptions, } from '@/features/guitar/backing/guitar-room-drum-player'
import type { GuitarRecordingDrumTrack } from '@/lib/guitar/recording-types'
import { createRecordedDrumTrackPlayer } from './recorded-drum-track-player'

function fixture() {
  vi.useFakeTimers()
  let contextTime = 0
  let position = 0
  const gains: Array<{
    value: number
    cancelAndHoldAtTime: ReturnType<typeof vi.fn>
    cancelScheduledValues: ReturnType<typeof vi.fn>
    setValueAtTime: ReturnType<typeof vi.fn>
    setTargetAtTime: ReturnType<typeof vi.fn>
  }> = []
  const outputs: GainNode[] = []
  const context = {
    get currentTime() {
      return contextTime
    },
    createGain() {
      const gain = {
        value: 1,
        cancelAndHoldAtTime: vi.fn(),
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn(),
      }
      gains.push(gain)
      const output = {
        gain,
        connect: vi.fn(),
        disconnect: vi.fn(),
      } as unknown as GainNode
      outputs.push(output)
      return output
    },
  } as AudioContext
  const players: Array<{
    options: LazyGuitarRoomDrumPlayerOptions
    port: GuitarRoomDrumPlayerPort
    trigger: ReturnType<typeof vi.fn>
    panic: ReturnType<typeof vi.fn>
    prewarm: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
  }> = []
  const createPlayer = (options: LazyGuitarRoomDrumPlayerOptions) => {
    const trigger = vi.fn(() => 'sampled' as const)
    const panic = vi.fn()
    const prewarm = vi.fn(async () => undefined)
    const dispose = vi.fn(async () => undefined)
    const port = {
      activate: vi.fn(async () => true),
      setKit: vi.fn(),
      trigger,
      panic,
      prewarm,
      dispose,
    } satisfies GuitarRoomDrumPlayerPort
    players.push({ options, port, trigger, panic, prewarm, dispose })
    return port
  }
  const track: GuitarRecordingDrumTrack = {
    version: 1,
    hits: [
      {
        offsetSeconds: 0.1,
        gmKey: 36,
        velocity: 118,
        kitId: 'muldjord',
        level: 1.1,
      },
      {
        offsetSeconds: 0.16,
        gmKey: 38,
        velocity: 105,
        kitId: 'muldjord',
        level: 1.1,
      },
      {
        offsetSeconds: 0.2,
        gmKey: 42,
        velocity: 90,
        kitId: 'crocell',
        level: 0.8,
      },
    ],
  }
  const player = createRecordedDrumTrackPlayer({
    context,
    destination: {} as AudioNode,
    track,
    getPosition: () => position,
    createPlayer,
  })
  return {
    player,
    players,
    gains,
    outputs,
    context,
    setClock(next: number) {
      contextTime = next
      position = next
    },
  }
}

afterEach(() => vi.useRealTimers())

describe('recorded drummer track replay', () => {
  it('prewarms per kit, schedules from take time and follows seek and pause', async () => {
    const f = fixture()
    expect(await f.player.play(0)).toBe(true)
    expect(f.players).toHaveLength(2)
    expect(f.players[0]!.prewarm.mock.calls[0]![0]).toEqual([
      { gmKey: 36, velocity: 118 },
      { gmKey: 38, velocity: 105 },
    ])
    expect(f.players[1]!.prewarm.mock.calls[0]![0]).toEqual([
      { gmKey: 42, velocity: 90 },
    ])
    expect(f.players[0]!.trigger).toHaveBeenCalledOnce()
    expect(f.players[0]!.trigger.mock.calls[0]![0]).toMatchObject({
      gmKey: 36,
      atContextTime: 0.1,
    })

    f.setClock(0.09)
    await vi.advanceTimersByTimeAsync(25)
    expect(
      f.players.reduce(
        (sum, entry) => sum + entry.trigger.mock.calls.length,
        0,
      ),
    ).toBe(3)

    f.player.seek(0.15)
    expect(f.players.every((entry) => entry.panic.mock.calls.length > 0)).toBe(
      true,
    )
    f.player.pause()
    expect(vi.getTimerCount()).toBe(0)
    await f.player.dispose()
    expect(
      f.players.every((entry) => entry.dispose.mock.calls.length === 1),
    ).toBe(true)
  })

  it('changes only the separate bus gain when muted or leveled', async () => {
    const f = fixture()
    f.player.setLevel(1.5)
    expect(await f.player.play(0)).toBe(true)
    expect(f.outputs).toHaveLength(2)
    expect(f.gains[0]!.value).toBeCloseTo(1.65)
    expect(f.gains[1]!.value).toBeCloseTo(1.2)
    f.player.setMuted(true)
    expect(
      f.gains.map((gain) => gain.setTargetAtTime.mock.calls.at(-1)?.[0]),
    ).toEqual([0, 0])
    f.player.setMuted(false)
    expect(f.gains[0]!.setTargetAtTime.mock.calls.at(-1)?.[0]).toBeCloseTo(1.65)
    expect(f.gains[1]!.setTargetAtTime.mock.calls.at(-1)?.[0]).toBeCloseTo(1.2)
    await f.player.dispose()
  })

  it('degrades silently when a recorded kit cannot be prepared', async () => {
    const f = fixture()
    const failing = createRecordedDrumTrackPlayer({
      context: f.context,
      destination: {} as AudioNode,
      track: {
        version: 1,
        hits: [
          {
            offsetSeconds: 0.1,
            gmKey: 36,
            velocity: 100,
            kitId: 'muldjord',
            level: 1,
          },
        ],
      },
      getPosition: () => 0,
      createPlayer: () => ({
        activate: vi.fn(async () => {
          throw new Error('sample pack unavailable')
        }),
        setKit: vi.fn(),
        trigger: vi.fn(() => 'dropped' as const),
        panic: vi.fn(),
        dispose: vi.fn(async () => undefined),
      }),
    })
    await expect(failing.prepare()).resolves.toBe(false)
    await expect(failing.play(0)).resolves.toBe(false)
    await failing.dispose()
  })
})
