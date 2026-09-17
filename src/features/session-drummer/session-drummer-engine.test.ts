import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GuitarRoomDrumPlayerPort } from '@/features/guitar/backing/guitar-room-drum-player'
import type { GuitarSessionAudioGraph } from '@/features/guitar/backing/guitar-session-audio-graph'
import type { SessionBeatWindow } from '@/lib/session-beat-clock'
import { createSessionDrummerEngine } from './session-drummer-engine'
import { DEFAULT_DRUMMER_SETTINGS } from './session-drummer-pattern'

function fixture() {
  vi.useFakeTimers()
  const began = Date.now()
  const gain = {
    value: 0,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  }
  const node = { gain, connect: vi.fn(), disconnect: vi.fn() }
  const context = {
    get currentTime() {
      return (Date.now() - began) / 1000
    },
    createGain: () => node,
    close: vi.fn(),
  }
  const graph = {
    context,
    buses: { drums: {} },
    dispose: vi.fn(),
  } as unknown as GuitarSessionAudioGraph
  const player = {
    activate: vi.fn(async () => true),
    setKit: vi.fn(),
    trigger: vi.fn(
      (
        _hit: Parameters<GuitarRoomDrumPlayerPort['trigger']>[0],
      ): ReturnType<GuitarRoomDrumPlayerPort['trigger']> =>
        'synthesized' as const,
    ),
    panic: vi.fn(),
    dispose: vi.fn(),
  } satisfies GuitarRoomDrumPlayerPort
  const onBar = vi.fn()
  const onApplied = vi.fn()
  const onHit = vi.fn()
  const engine = createSessionDrummerEngine({
    activateGraph: async () => graph,
    createPlayer: () => player,
    onBar,
    onApplied,
    onHit,
  })
  const window = (
    beat: number,
    at: number,
    iteration = 0,
  ): SessionBeatWindow => ({
    kind: 'beat',
    startBeat: beat,
    endBeat: beat + 1,
    iteration,
    timeAtBeat: (value) => at + (value - beat) * 0.5,
  })
  return {
    engine,
    player,
    context,
    graph,
    gain,
    node,
    onBar,
    onApplied,
    onHit,
    window,
  }
}
afterEach(() => {
  vi.useRealTimers()
})

describe('session drummer clock ownership', () => {
  it('does not lose the downbeat in a fractional window crossing a phrase seam', async () => {
    const f = fixture()
    await f.engine.start(DEFAULT_DRUMMER_SETTINGS, true)
    f.engine.accept(f.window(31.5, 0.1))
    const kicks = f.player.trigger.mock.calls
      .map(([hit]) => hit)
      .filter((hit) => hit.gmKey === 36)
    expect(kicks).toHaveLength(2)
    expect(kicks[0].atContextTime).toBeCloseTo(0.1, 5)
    expect(kicks[1].atContextTime).toBeCloseTo(0.35, 5)
    await f.engine.dispose()
  })
  it('stays inert until Start and never closes the borrowed context', async () => {
    const f = fixture()
    expect(f.player.activate).not.toHaveBeenCalled()
    await f.engine.start(DEFAULT_DRUMMER_SETTINGS, true)
    expect(f.player.trigger).not.toHaveBeenCalled()
    f.engine.accept(f.window(0, 0.2))
    expect(f.player.trigger.mock.calls.length).toBeGreaterThan(0)
    expect(f.node.connect).toHaveBeenCalledWith(f.graph.buses.drums)
    await f.engine.dispose()
    expect(f.context.close).not.toHaveBeenCalled()
    expect(f.graph.dispose).not.toHaveBeenCalled()
    expect(f.node.disconnect).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(80)
    expect(f.node.disconnect).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('reports only hits accepted by the audible player with their exact scheduled identity', async () => {
    const f = fixture()
    await f.engine.start(DEFAULT_DRUMMER_SETTINGS, true)
    f.engine.accept(f.window(0, 0.2))
    const first = f.player.trigger.mock.calls[0]![0]
    expect(f.onHit).toHaveBeenCalledWith({
      contextTime: first.atContextTime,
      gmKey: first.gmKey,
      velocity: first.velocity,
      kitId: DEFAULT_DRUMMER_SETTINGS.kitId,
      level: DEFAULT_DRUMMER_SETTINGS.level,
    })
    const accepted = f.onHit.mock.calls.length
    f.player.trigger.mockReturnValue('dropped')
    f.engine.accept(f.window(1, 0.7))
    expect(f.onHit).toHaveBeenCalledTimes(accepted)
    await f.engine.dispose()
  })
  it('uses exact host times, including fractional seeks, and stays silent through host pauses', async () => {
    const f = fixture()
    await f.engine.start(DEFAULT_DRUMMER_SETTINGS, true)
    f.engine.accept({ ...f.window(0, 1), startBeat: 0.5 })
    expect(
      f.player.trigger.mock.calls.every(
        ([hit]) => (hit.atContextTime ?? 0) >= 1.25,
      ),
    ).toBe(true)
    f.engine.accept({ kind: 'stop' })
    const count = f.player.trigger.mock.calls.length
    await vi.advanceTimersByTimeAsync(500)
    expect(f.player.trigger).toHaveBeenCalledTimes(count)
    expect(f.gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      0,
      expect.any(Number),
    )
    f.engine.accept(f.window(2, 1.5))
    expect(f.player.trigger.mock.calls.length).toBeGreaterThan(count)
    await f.engine.dispose()
  })
  it('applies pending choices at a bar or short A/B boundary, not mid-beat', async () => {
    const f = fixture()
    await f.engine.start(DEFAULT_DRUMMER_SETTINGS, true)
    f.engine.accept(f.window(5, 0.1))
    f.engine.update({ ...DEFAULT_DRUMMER_SETTINGS, kitId: 'crocell' })
    f.engine.accept(f.window(6, 0.6))
    expect(f.player.setKit).not.toHaveBeenCalledWith('crocell')
    f.engine.accept(f.window(5, 1.1, 1))
    expect(f.player.setKit).toHaveBeenLastCalledWith('crocell')
    f.engine.stop()
    const count = f.player.trigger.mock.calls.length
    f.engine.accept(f.window(6, 1.6, 1))
    expect(f.player.trigger).toHaveBeenCalledTimes(count)
    await f.engine.dispose()
  })
  it('runs its own clock only for manual jamming and cancels every scheduled callback on Stop', async () => {
    const f = fixture()
    await f.engine.start(DEFAULT_DRUMMER_SETTINGS, false)
    await vi.advanceTimersByTimeAsync(1300)
    expect(f.onBar).toHaveBeenCalled()
    const count = f.player.trigger.mock.calls.length
    expect(count).toBeGreaterThan(4)
    f.engine.stop()
    await vi.advanceTimersByTimeAsync(2000)
    expect(f.player.trigger).toHaveBeenCalledTimes(count)
    expect(vi.getTimerCount()).toBe(0)
    await f.engine.dispose()
  })
  it('coalesces live edits until the next bar and discards pending edits on Stop', async () => {
    const f = fixture()
    await f.engine.start(DEFAULT_DRUMMER_SETTINGS, true)
    f.engine.accept(f.window(0, 0.1))
    f.engine.update({ ...DEFAULT_DRUMMER_SETTINGS, kitId: 'crocell' })
    const latest = {
      ...DEFAULT_DRUMMER_SETTINGS,
      kitId: 'muldjord' as const,
      bars: 16,
    }
    f.engine.update(latest)
    f.engine.accept(f.window(3, 0.5))
    expect(f.onApplied).toHaveBeenCalledTimes(1)
    f.engine.accept(f.window(4, 1))
    expect(f.onApplied).toHaveBeenLastCalledWith(latest)
    expect(f.player.setKit).not.toHaveBeenCalledWith('crocell')
    f.engine.update({ ...latest, kitId: 'crocell' })
    f.engine.stop()
    f.engine.accept(f.window(8, 1.5))
    expect(f.onApplied).toHaveBeenCalledTimes(2)
    await f.engine.dispose()
  })
  it('cannot resurrect playback when kit activation resolves after Stop', async () => {
    const f = fixture()
    let resolve!: (ready: boolean) => void
    f.player.activate.mockImplementationOnce(
      () =>
        new Promise<boolean>((done) => {
          resolve = done
        }),
    )
    const starting = f.engine.start(DEFAULT_DRUMMER_SETTINGS, false)
    await Promise.resolve()
    f.engine.stop()
    resolve(true)
    expect(await starting).toBe(false)
    expect(f.player.trigger).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    await f.engine.dispose()
  })
})
