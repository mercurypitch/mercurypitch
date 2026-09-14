// Deferred arrangement tests — silent browsing, current faders and cancelled ownership.
import { describe, expect, it, vi } from 'vitest'
import { createLazyDrumArrangementBackingPlayer } from './lazy-drum-arrangement-player'

function fixture() {
  const player = {
    activate: vi.fn(() => true),
    setTrackLevel: vi.fn(),
    trigger: vi.fn(() => 'synthesized' as const),
    panic: vi.fn(),
    dispose: vi.fn(),
  }
  const createDrumArrangementBackingPlayer = vi.fn(() => player)
  let finish!: (module: {
    createDrumArrangementBackingPlayer: typeof createDrumArrangementBackingPlayer
  }) => void
  const load = vi.fn(
    () =>
      new Promise<{
        createDrumArrangementBackingPlayer: typeof createDrumArrangementBackingPlayer
      }>((resolve) => {
        finish = resolve
      }),
  )
  const lazy = createLazyDrumArrangementBackingPlayer(
    { getAudioContext: () => null, getOutput: () => null },
    load,
  )
  return {
    lazy,
    player,
    load,
    createDrumArrangementBackingPlayer,
    finish: () => finish({ createDrumArrangementBackingPlayer }),
  }
}

describe('lazy drum backing', () => {
  it('loads once on Play and forwards the latest silent and live faders', async () => {
    const f = fixture()
    f.lazy.setTrackLevel('bass', 0.8)
    f.lazy.panic()
    expect(f.load).not.toHaveBeenCalled()
    const first = f.lazy.activate()
    const second = f.lazy.activate()
    f.lazy.setTrackLevel('bass', 0.3)

    f.finish()
    expect(await first).toBe(true)
    expect(await second).toBe(true)

    expect(f.load).toHaveBeenCalledTimes(1)
    expect(f.player.activate).toHaveBeenCalledTimes(1)
    expect(f.player.setTrackLevel.mock.calls).toEqual([['bass', 0.3]])
    f.lazy.setTrackLevel('bass', 0)
    expect(f.player.setTrackLevel).toHaveBeenLastCalledWith('bass', 0)
    f.lazy.panic()
    expect(f.player.panic).toHaveBeenCalledOnce()
    await f.lazy.dispose()
    expect(f.player.dispose).toHaveBeenCalledOnce()
  })

  it('does not resurrect a player when the room closes during its import', async () => {
    const f = fixture()
    const starting = f.lazy.activate()
    await f.lazy.dispose()

    f.finish()

    expect(await starting).toBe(false)
    expect(f.createDrumArrangementBackingPlayer).not.toHaveBeenCalled()
    expect(f.lazy.activate()).toBe(false)
    expect(
      f.lazy.trigger({
        trackId: 'bass',
        sourceId: 'one',
        midi: 40,
        voice: 'bass',
        atContextTime: 0,
        durationSeconds: 1,
      }),
    ).toBe('dropped')
  })

  it('permits another explicit Play after a failed module download', async () => {
    const f = fixture()
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({
        createDrumArrangementBackingPlayer:
          f.createDrumArrangementBackingPlayer,
      })
    const lazy = createLazyDrumArrangementBackingPlayer(
      { getAudioContext: () => null, getOutput: () => null },
      load,
    )
    expect(await lazy.activate()).toBe(false)

    expect(await lazy.activate()).toBe(true)

    expect(load).toHaveBeenCalledTimes(2)
    expect(f.createDrumArrangementBackingPlayer).toHaveBeenCalledOnce()
    await lazy.dispose()
  })
})
