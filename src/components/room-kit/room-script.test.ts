// ============================================================
// Room script: when a room lets its demo in, and its moves through
// ============================================================

import { createComputed, createRoot, createSignal } from 'solid-js'
import { describe, expect, it } from 'vitest'
import type { RoomScriptMoves } from './room-script'
import { createRoomScript } from './room-script'

interface Room {
  readonly moves: RoomScriptMoves<string>
  readonly log: string[]
  setPhase: (phase: string) => void
  setActive: (on: boolean) => void
}

/** A room that logs each move, its switch turned by its enter and leave. */
function roomAt(
  phase: string,
  extra: Partial<RoomScriptMoves<string>> = {},
): Room {
  const log: string[] = []
  const [active, setActive] = createSignal(false)
  let current = phase
  const moves: RoomScriptMoves<string> = {
    active,
    phase: () => current,
    audio: () => Promise.resolve(null),
    note: () => 57,
    enter: (line) => {
      log.push(`enter ${line}`)
      setActive(true)
    },
    play: (take) => log.push(`play ${take}`),
    rest: () => log.push('rest'),
    leave: () => {
      log.push('leave')
      setActive(false)
    },
    playing: (on) => log.push(`playing ${on}`),
    ...extra,
  }
  return {
    moves,
    log,
    setPhase: (next) => {
      current = next
    },
    setActive,
  }
}

describe('createRoomScript: the way in', () => {
  it('lets the demo in at the intro and on a result', () => {
    const intro = roomAt('intro')
    const result = roomAt('result')

    const tookIntro = createRoomScript(intro.moves).enter('Watch me first.')
    const tookResult = createRoomScript(result.moves).enter('Watch me first.')

    expect([tookIntro, tookResult]).toEqual([true, true])
    expect([intro.log, result.log]).toEqual([
      ['enter Watch me first.'],
      ['enter Watch me first.'],
    ])
  })

  it('keeps it out mid-take and while the mic opens, and changes nothing', () => {
    for (const phase of ['starting', 'listen', 'hold', 'run', 'blocked']) {
      const room = roomAt(phase)

      const took = createRoomScript(room.moves).enter('Watch me first.')

      expect([phase, took, room.log]).toEqual([phase, false, []])
    }
  })

  it('lets it in again while it is on, whatever the phase (Watch again)', () => {
    const room = roomAt('intro')
    const script = createRoomScript(room.moves)
    script.enter('Watch me first.')
    room.setPhase('listen')

    const took = script.enter('Watch me first.')

    expect(took).toBe(true)
    expect(room.log).toEqual(['enter Watch me first.', 'enter Watch me first.'])
  })

  it('reads the phase, then the switch, on every way in', () => {
    const reads: string[] = []
    const room = roomAt('intro')
    const [active, setActive] = createSignal(false)
    const script = createRoomScript({
      ...room.moves,
      active: () => {
        reads.push('active')
        return active()
      },
      phase: () => {
        reads.push('phase')
        return 'listen'
      },
    })

    script.enter('Watch me first.')
    setActive(true)
    script.enter('Watch me first.')

    expect(reads).toEqual(['phase', 'active', 'phase', 'active'])
  })
})

describe('createRoomScript: the moves through', () => {
  it('plays, rests and leaves only while the demo is on', () => {
    const room = roomAt('intro')
    const script = createRoomScript(room.moves)

    script.play('off')
    script.rest()
    script.leave()
    const before = [...room.log]
    script.enter('Watch me first.')
    script.play('off')
    script.rest()
    script.play('on')
    script.leave()
    script.play('late')
    script.rest()
    script.leave()

    expect(before).toEqual([])
    expect(room.log).toEqual([
      'enter Watch me first.',
      'play off',
      'rest',
      'play on',
      'leave',
    ])
  })

  it("hands the demo the room's own switch, clock, note and playing", () => {
    const ready = (): Promise<unknown> => Promise.resolve('voice')
    const room = roomAt('intro', { ready })

    const script = createRoomScript(room.moves)
    script.playing(true)

    expect(script.active).toBe(room.moves.active)
    expect(script.audio).toBe(room.moves.audio)
    expect(script.ready).toBe(ready)
    expect(script.note).toBe(room.moves.note)
    expect(room.log).toEqual(['playing true'])
  })

  it('has no ready of its own when the room has nothing to load', () => {
    const script = createRoomScript(roomAt('intro').moves)

    expect(script.ready).toBeUndefined()
  })

  it('reads the switch untracked: a move made in a tracked scope does not rerun', () => {
    const room = roomAt('intro')
    const script = createRoomScript(room.moves)
    let runs = 0
    const dispose = createRoot((d) => {
      createComputed(() => {
        runs += 1
        script.rest()
        script.enter('Watch me first.')
      })
      return d
    })

    room.setActive(false)
    room.setActive(true)
    dispose()

    expect(runs).toBe(1)
  })
})
