// Are these rooms finishable?
// ============================================================
//
// Not a snapshot of the numbers -- a proof that the numbers work. Every
// check here is one way a plausible edit ships a level nobody can
// complete, and each one is cheaper to fail here than on a phone.

import { describe, expect, it } from 'vitest'
import { belliesFor, groundIn, isFloorSafe, modeMidi, nodesFor, rangeSlackSemis, standingAmplitude, tuneChamber, } from '../sim/chamber3d'
import { CHAMBER_CONFIG } from '../world3d-config'
import type { ChamberLevel } from './chambers'
import { CHAMBER_1, CHAMBER_2, CHAMBER_3, CHAMBER_4, CHAMBER_5, chamberById, CHAMBERS, } from './chambers'

/** Which of the room's modes shake a pane at `at` apart. */
const breakersOf = (room: ChamberLevel, at: number): number[] =>
  room.modes.filter((m) => standingAmplitude(at, m) >= room.breakAt)

/**
 * How far in front of a pane Merc is stopped, as a fraction of the room.
 * Mirrors `PANE_STANDOFF` in ChamberStage; a pane is a wall until it
 * breaks, so a perch has to be on the near side of that wall and not
 * merely on the near side of the glass.
 */
const standoff = (room: ChamberLevel): number => 0.22 / room.length

/** Somewhere he can stand, singing `mode`, and actually reach. */
const perchesFor = (room: ChamberLevel, mode: number, at: number): number[] =>
  nodesFor(mode).filter(
    (n) =>
      n < at - standoff(room) &&
      n > 0 &&
      isFloorSafe(n, mode, room.floorThreshold),
  )

describe('every chamber', () => {
  it.each(CHAMBERS.map((c) => [c.id, c] as const))(
    '%s: has a mode that breaks each pane',
    (_id, room) => {
      for (const pane of room.panes) {
        expect(breakersOf(room, pane.at).length).toBeGreaterThan(0)
      }
    },
  )

  it.each(CHAMBERS.map((c) => [c.id, c] as const))(
    '%s: has somewhere safe to stand while breaking each pane',
    (_id, room) => {
      for (const pane of room.panes) {
        for (const mode of breakersOf(room, pane.at)) {
          expect(perchesFor(room, mode, pane.at).length).toBeGreaterThan(0)
        }
      }
    },
  )

  // The room must not kill him for walking in.
  it.each(CHAMBERS.map((c) => [c.id, c] as const))(
    '%s: is safe to arrive in, whatever is being sung',
    (_id, room) => {
      for (const mode of room.modes) {
        expect(isFloorSafe(room.startAt, mode, room.floorThreshold)).toBe(true)
      }
    },
  )

  it.each(CHAMBERS.map((c) => [c.id, c] as const))(
    '%s: puts every pane between the start and the exit',
    (_id, room) => {
      for (const pane of room.panes) {
        expect(pane.at).toBeGreaterThan(room.startAt)
        expect(pane.at).toBeLessThan(room.exitAt)
      }
    },
  )

  // A room asking for more than an octave is a room most players cannot
  // sing, however it is transposed.
  it.each(CHAMBERS.map((c) => [c.id, c] as const))(
    '%s: fits inside an octave of range',
    (_id, room) => {
      expect(
        rangeSlackSemis(room.modes, { lowMidi: 60, highMidi: 72 }),
      ).toBeGreaterThanOrEqual(0)
    },
  )
})

// A pane is a WALL until it is broken, so the place you must stand to
// break it has to be on the near side of every pane that is still up.
// The old check only asked whether a node existed to the left of the
// glass, which a chamber with two panes can satisfy while being
// impossible to finish.
describe('every chamber, with the glass actually in the way', () => {
  it.each(CHAMBERS.map((c) => [c.id, c] as const))(
    '%s: can be solved left to right, each pane from behind the one before',
    (_id, room) => {
      // Panes break in the order they stand, because you cannot walk
      // past one that has not.
      const inOrder = [...room.panes].sort((a, b) => a.at - b.at)
      let reachable = room.exitAt
      for (const pane of inOrder) {
        const modes = room.modes.filter(
          (m) => standingAmplitude(pane.at, m) >= room.breakAt,
        )
        expect(modes.length).toBeGreaterThan(0)
        // At least one breaking mode must have a safe node in front of
        // this pane -- and behind it, not past it.
        const perches = modes.flatMap((mode) =>
          perchesFor(room, mode, pane.at).filter((n) => n < reachable),
        )
        expect(perches.length).toBeGreaterThan(0)
        // Once it is gone, everything up to the next pane opens up.
        reachable = room.exitAt
      }
    },
  )

  it.each(CHAMBERS.map((c) => [c.id, c] as const))(
    '%s: starts behind its first pane',
    (_id, room) => {
      const first = Math.min(...room.panes.map((p) => p.at))
      expect(room.startAt).toBeLessThan(first - standoff(room))
    },
  )

  // Nothing can be walked round, and nothing can be jumped: the panes
  // are taller than the jump, so the note is the only way through.
  it.each(CHAMBERS.map((c) => [c.id, c] as const))(
    '%s: has no pane low enough to jump over',
    (_id, room) => {
      for (const pane of room.panes) {
        expect(pane.height).toBeGreaterThan(0.6)
      }
    },
  )
})

describe('chamber 1, the teaching room', () => {
  it('has one mode, so there is nothing to choose yet', () => {
    expect(CHAMBER_1.modes).toEqual([3])
  })

  it('puts its pane on the belly the eye already goes to', () => {
    expect(belliesFor(3)).toContain(0.5)
    expect(CHAMBER_1.panes[0]!.at).toBe(0.5)
  })

  // The flagless way to turn failure off: amplitude never exceeds 1.
  it('cannot drop him anywhere, at any amplitude', () => {
    expect(CHAMBER_1.floorThreshold).toBeGreaterThanOrEqual(1)
    for (const belly of belliesFor(3)) {
      expect(isFloorSafe(belly, 3, CHAMBER_1.floorThreshold)).toBe(true)
    }
  })
})

describe('chamber 2, where the note starts to matter', () => {
  it('hinges on the one point where its two modes disagree completely', () => {
    // The centre is a belly of mode 3 and a node of mode 4.
    expect(standingAmplitude(0.5, 3)).toBeCloseTo(1, 10)
    expect(standingAmplitude(0.5, 4)).toBeCloseTo(0, 10)
  })

  it('gives each pane exactly one mode that opens it', () => {
    expect(breakersOf(CHAMBER_2, 0.5)).toEqual([3])
    expect(breakersOf(CHAMBER_2, 0.625)).toEqual([4])
  })

  // The margin that makes "which note?" a real question rather than a
  // matter of holding the wrong one for long enough.
  it('leaves the wrong note well short of breaking either pane', () => {
    expect(standingAmplitude(0.5, 4)).toBeLessThan(CHAMBER_2.breakAt - 0.4)
    expect(standingAmplitude(0.625, 3)).toBeLessThan(CHAMBER_2.breakAt - 0.4)
  })

  it('can be finished, in this order and no other', () => {
    // Break the centre pane from the node of 3 at a third along...
    expect(perchesFor(CHAMBER_2, 3, 0.5)).toContainEqual(
      expect.closeTo(1 / 3, 10),
    )
    // ...then from the node of 4 at the centre, which the first break
    // just made walkable.
    expect(perchesFor(CHAMBER_2, 4, 0.625)).toContain(0.5)
    // And that second perch is not available while singing mode 3: it
    // is that mode's belly, and this floor is live.
    expect(isFloorSafe(0.5, 3, CHAMBER_2.floorThreshold)).toBe(false)
  })

  it('has a node wide enough to stand in without aiming', () => {
    // The safe half-width around the node of mode 4 at 0.5, in metres.
    const half =
      (Math.asin(CHAMBER_2.floorThreshold) / (4 * Math.PI)) * CHAMBER_2.length
    expect(half).toBeGreaterThan(0.25)
  })
})

describe('chamber 3, where it becomes a sequence', () => {
  it('climbs the ladder, so the singing gets easier as the room gets harder', () => {
    const gap = (m: readonly number[]): number =>
      modeMidi(0, Math.max(...m)) - modeMidi(0, Math.min(...m))
    expect(gap(CHAMBER_3.modes)).toBeLessThan(gap(CHAMBER_2.modes))
    expect(gap(CHAMBER_3.modes)).toBeCloseTo(3.86, 2)
  })

  it('gives each pane exactly one mode that opens it', () => {
    expect(breakersOf(CHAMBER_3, 0.375)).toEqual([4])
    expect(breakersOf(CHAMBER_3, 0.7)).toEqual([5])
  })

  // The silence in the middle of the level: the note that opened the
  // first pane is the note that makes the ground past it lethal.
  it('makes him stop singing to cross to the second pane', () => {
    const perch = 0.6
    expect(isFloorSafe(perch, 5, CHAMBER_3.floorThreshold)).toBe(true)
    // Walking there on mode 4 crosses that mode's own belly at 0.375.
    expect(isFloorSafe(0.375, 4, CHAMBER_3.floorThreshold)).toBe(false)
    // Silence is safe everywhere, which is what makes it a choice.
    expect(isFloorSafe(0.375, null, CHAMBER_3.floorThreshold)).toBe(true)
  })

  it('has a ledge to hold a note on, over live floor', () => {
    const [ledge] = CHAMBER_3.platforms
    expect(ledge).toBeDefined()
    // It sits over ground that mode 5 will not let him stand on.
    expect(isFloorSafe(ledge!.at, 5, CHAMBER_3.floorThreshold)).toBe(false)
  })
})

// A ledge is only a ledge if a jump reaches it. This shipped asserting
// the OPPOSITE -- chamber 3's was 0.62 against a jump of 0.5 -- and went
// unnoticed because walking into a ledge's shadow used to lift him onto
// it, so the one platform in the game was reached by a bug for the whole
// of slice 2.
describe('every ledge', () => {
  const { jumpHeight } = CHAMBER_CONFIG.locomotion

  it.each(
    CHAMBERS.flatMap((room) =>
      room.platforms.map((p, i) => [`${room.id} ledge ${i}`, room, p] as const),
    ),
  )('%s: is high enough to matter and low enough to reach', (_id, _room, p) => {
    expect(p.height).toBeGreaterThan(0.2)
    // Clearance, not equality: landing exactly at the apex means
    // landing with no margin at all.
    expect(p.height).toBeLessThanOrEqual(jumpHeight - 0.05)
  })

  it.each(CHAMBERS.map((c) => [c.id, c] as const))(
    '%s: does not stand him on anything he has not got above',
    (_id, room) => {
      const ground = groundIn(room)
      for (const p of room.platforms) {
        const x = p.at * room.length
        expect(ground(x, 0)).toBe(0)
        expect(ground(x, p.height)).toBe(p.height)
      }
    },
  )
})

describe('chamber 4, where the jump gets a job', () => {
  it('gives each pane exactly one mode that opens it', () => {
    expect(breakersOf(CHAMBER_4, 5 / 12)).toEqual([6])
    expect(breakersOf(CHAMBER_4, 0.5)).toEqual([5])
  })

  it('hinges on the centre, one rung up from chamber 2', () => {
    expect(standingAmplitude(0.5, 5)).toBeCloseTo(1, 10)
    expect(standingAmplitude(0.5, 6)).toBeCloseTo(0, 10)
  })

  it('asks a tighter interval than the room before it', () => {
    const gap = (m: readonly number[]): number =>
      modeMidi(0, Math.max(...m)) - modeMidi(0, Math.min(...m))
    expect(gap(CHAMBER_4.modes)).toBeLessThan(gap(CHAMBER_3.modes))
  })

  // The point of the room: the exit is off the floor, so it cannot be
  // walked to.
  it('puts its exit on a ledge, and the ledge under the exit', () => {
    const ledge = CHAMBER_4.platforms[0]
    expect(ledge).toBeDefined()
    const ground = groundIn(CHAMBER_4)
    const x = CHAMBER_4.exitAt * CHAMBER_4.length
    expect(ground(x, Number.POSITIVE_INFINITY)).toBe(ledge!.height)
    // And walking up to it on the floor is not arriving.
    expect(ground(x, 0)).toBe(0)
  })

  it('is the only room whose exit is off the floor', () => {
    const raised = CHAMBERS.filter(
      (room) =>
        (groundIn(room)(room.exitAt * room.length, Number.POSITIVE_INFINITY) ??
          0) > 0,
    )
    expect(raised.map((r) => r.id)).toEqual([CHAMBER_4.id])
  })
})

describe('chamber 5, where three notes go out of order', () => {
  it('gives each pane exactly one mode that opens it', () => {
    expect(breakersOf(CHAMBER_5, 0.3)).toEqual([5])
    expect(breakersOf(CHAMBER_5, 0.625)).toEqual([4])
    expect(breakersOf(CHAMBER_5, 0.75)).toEqual([6])
  })

  // The whole reason the room exists: left to right the answer is 5, 4,
  // 6, which is neither up the ladder nor down it. A player who tries
  // the modes in turn is not reading the floor, and this room is the
  // one that makes them.
  it('wants its modes in an order that is not an order', () => {
    const wanted = [...CHAMBER_5.panes]
      .sort((a, b) => a.at - b.at)
      .map((pane) => breakersOf(CHAMBER_5, pane.at)[0])
    expect(wanted).toEqual([5, 4, 6])
    const ascending = [...wanted].sort((a, b) => a! - b!)
    expect(wanted).not.toEqual(ascending)
    expect(wanted).not.toEqual([...ascending].reverse())
  })

  it('puts its ledge over the spot the last note makes lethal', () => {
    const ledge = CHAMBER_5.platforms[0]
    expect(ledge).toBeDefined()
    // The perch for the second pane is the centre: safe on mode 4,
    // which opens it, and the belly of mode 5, which opened the first.
    expect(isFloorSafe(0.5, 4, CHAMBER_5.floorThreshold)).toBe(true)
    expect(isFloorSafe(0.5, 5, CHAMBER_5.floorThreshold)).toBe(false)
    expect(ledge!.at).toBe(0.5)
  })
})

describe('tuning a chamber to the singer', () => {
  it('puts every room inside a modest range', () => {
    const range = { lowMidi: 57, highMidi: 69 }
    for (const room of CHAMBERS) {
      const f0 = tuneChamber(room.modes, range)
      for (const mode of room.modes) {
        expect(modeMidi(f0, mode)).toBeGreaterThanOrEqual(range.lowMidi)
        expect(modeMidi(f0, mode)).toBeLessThanOrEqual(range.highMidi)
      }
    }
  })
})

describe('the list', () => {
  it('finds a room by name, and admits when there is none', () => {
    expect(chamberById('chamber-2')).toBe(CHAMBER_2)
    expect(chamberById('chamber-9')).toBeNull()
  })

  it('has no two rooms sharing an id', () => {
    expect(new Set(CHAMBERS.map((c) => c.id)).size).toBe(CHAMBERS.length)
  })
})
