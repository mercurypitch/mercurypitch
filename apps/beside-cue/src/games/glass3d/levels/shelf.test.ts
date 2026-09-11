// Can every room be climbed, by every voice, and only by singing?
// ============================================================

import { describe, expect, it } from 'vitest'
import type { LocomotionState } from '../sim/locomotion3d'
import { createLocomotion, stepLocomotion } from '../sim/locomotion3d'
import { closeWalls, createClimb, launch, stepShelf } from '../sim/shelf-step'
import { workingRange } from '../sim/tension3d'
import { VOICE_PRESETS } from '../voice-range'
import { WORLD3D_CONFIG } from '../world3d-config'
import type { ShelfLevel } from './shelf'
import { CATCH, groundFor, LEAP_CARRY_MAX, LEAP_REACH, leapCarry, leapHeight, MAX_LEAP, MITT_SPAN, RISE_PER_SEMI, riserWallAt, SHELF_1, SHELF_2, SHELF_3, SHELVES, topsOf, } from './shelf'

// The game's own body and loop, not a test's: the catch is 5 cm, and a
// different gravity or step would be testing some other game.
const CFG = WORLD3D_CONFIG.locomotion
const DT = WORLD3D_CONFIG.loop.stepSeconds
const HALF = MITT_SPAN / 2
/** Any note will do: the rooms are intervals, the same for every voice. */
const REFERENCE = 57

const asksOf = (room: ShelfLevel): number[] =>
  room.shelves.slice(1).map((shelf) => shelf.rise)

const stand = (x: number, y: number): LocomotionState => {
  const s = createLocomotion(x)
  s.y = y
  return s
}

/**
 * The stage's step, as 6b runs it: the nearest riser he cannot catch is
 * the wall, then he moves, at `pace` when he is carried (§3.2).
 */
const stepIn = (
  room: ShelfLevel,
  s: LocomotionState,
  move: number,
  pace = CFG.walkSpeed,
): void => {
  const wall = riserWallAt(room, s.x, s.y, HALF)
  const walls = {
    ...CFG,
    walkSpeed: pace,
    minX: 0,
    maxX: Math.min(room.length, wall),
  }
  stepLocomotion(s, { move, jump: false }, groundFor(room, HALF), DT, walls)
}

/** Where a leap came down, and how it was carried there. */
interface Landing {
  /** The top he comes to rest on. */
  y: number
  /** What `leapCarry` aimed it at: null for a hop. */
  carry: number | null
  /** The fastest he went along the room while in the air. */
  fastest: number
}

/**
 * Stand him on the shelf below riser `k` with his front `short` of it,
 * sing `semis` above the reference, and return where he comes to rest.
 * Launched and stepped by the stage's own step (`sim/shelf-step`), so
 * carried as the stage carries him, forward throughout (§3.2).
 */
const leapFrom = (
  room: ShelfLevel,
  k: number,
  short: number,
  semis: number,
): Landing => {
  const climb = createClimb(room, CFG)
  const s = climb.loco
  s.x = room.shelves[k]!.from - HALF - short
  s.y = topsOf(room)[k - 1]!
  climb.standingOn = k - 1
  closeWalls(climb)
  const height = leapHeight(REFERENCE, REFERENCE + semis)
  if (height === null) return { y: s.y, carry: null, fastest: 0 }
  launch(climb, { height, interval: semis }, DT)
  const carry = climb.flight!.carry
  let fastest = Math.abs(s.vx)
  for (let i = 0; i < Math.round(3 / DT); i++) {
    stepShelf(climb, null, 0, DT)
    fastest = Math.max(fastest, Math.abs(s.vx))
    if (s.grounded) break
  }
  expect(s.grounded).toBe(true)
  return { y: s.y, carry, fastest }
}

/** A leap from his mitt against riser `k`: the top he comes to rest on. */
const leapAt = (room: ShelfLevel, k: number, semis: number): number =>
  leapFrom(room, k, 0, semis).y

/** Every riser in every room, with what it is named by in a failure. */
const RISERS = SHELVES.flatMap((room) =>
  room.shelves.slice(1).map((shelf, i) => ({
    room,
    k: i + 1,
    ask: shelf.rise,
    name: `${room.id} riser ${i + 1}`,
  })),
)

/** How far short of riser `k` his front can stand on the shelf below
 * it: that shelf's depth, and on the floor all of him less, since the
 * room's back wall keeps him his half width in. */
const deepest = (room: ShelfLevel, k: number): number =>
  room.shelves[k]!.from - (k === 1 ? MITT_SPAN : room.shelves[k - 1]!.from)

/** Every centimetre from `near` to `far`, and `far` itself. */
const spots = (near: number, far: number): number[] => {
  const out: number[] = []
  for (let i = 0; near + i * 0.01 < far - 1e-9; i++) out.push(near + i * 0.01)
  return [...out, far]
}

/** Every standing spot with his front in reach of the riser ahead: each
 * centimetre from his mitt on it back to `LEAP_REACH`, or to the back of
 * the shelf he stands on where that is nearer. */
const IN_REACH = RISERS.flatMap((r) =>
  spots(0, Math.min(LEAP_REACH, deepest(r.room, r.k))).map((short) => ({
    ...r,
    short,
    name: `${r.name}, ${short.toFixed(3)} m short`,
  })),
)

/** And every one beyond it, from a millimetre past the reach. Only the
 * floors are deeper than it. */
const OUT_OF_REACH = RISERS.filter(
  (r) => deepest(r.room, r.k) > LEAP_REACH,
).flatMap((r) =>
  spots(LEAP_REACH + 0.001, deepest(r.room, r.k)).map((short) => ({
    ...r,
    short,
    name: `${r.name}, ${short.toFixed(3)} m short`,
  })),
)

describe('the rooms', () => {
  it('teach the sentences §4 wrote, with its hints, two sentences each', () => {
    expect(SHELVES.map((r) => r.id)).toEqual(['shelf-1', 'shelf-2', 'shelf-3'])
    expect(SHELF_1.teaches).toBe('Sing a note, then a fifth above it.')
    expect(SHELF_2.teaches).toBe('Thirds and fifths, each from where you are.')
    expect(SHELF_3.teaches).toBe('An octave is two leaps.')
    expect(SHELF_1.hint).toBe(
      'Hold any note, then sing a higher one: the gap between them is how high he leaps. A fifth gets him onto the shelf.',
    )
    expect(SHELF_2.hint).toBe(
      'Each leap is measured from the note you last held. Come back down to a comfortable note before the next one; going down never moves him.',
    )
    expect(SHELF_3.hint).toBe(
      'The top shelf is an octave up, and no leap is that big. Stop on the ledge a fifth up, then leap the rest.',
    )
    for (const room of SHELVES) {
      expect(room.hint.split(/[.!?]\s/).length).toBeLessThanOrEqual(2)
    }
  })

  it('rise as §4 says, and a top is the sum of the rises below it', () => {
    expect(SHELVES.map(asksOf)).toEqual([[7], [4, 7, 3, 7], [7, 5, 7, 5]])
    const tops = [
      [0, 0.7],
      [0, 0.4, 1.1, 1.4, 2.1],
      [0, 0.7, 1.2, 1.9, 2.4],
    ]
    SHELVES.forEach((room, r) => {
      topsOf(room).forEach((top, i) => expect(top).toBeCloseTo(tops[r]![i]!, 9))
    })
  })

  it('are as deep as §4 says', () => {
    const depths = [
      [2.0, 2.4],
      [1.6, 1.0, 1.0, 1.0, 1.6],
      [1.6, 0.7, 1.0, 0.7, 1.6],
    ]
    SHELVES.forEach((room, r) => {
      room.shelves.forEach((shelf, i) =>
        expect(shelf.to - shelf.from).toBeCloseTo(depths[r]![i]!, 9),
      )
    })
  })

  // T1, and the whole reason the proposal closed (§2): a staircase has
  // no underside to hit, so nothing needs a head test.
  it('are staircases: each shelf starts where the last one ends, and none overhangs another', () => {
    for (const room of SHELVES) {
      const tops = topsOf(room)
      expect(room.shelves[0]!.from).toBe(0)
      expect(room.shelves[0]!.rise).toBe(0)
      room.shelves.forEach((shelf, i) => {
        expect(shelf.to).toBeGreaterThan(shelf.from)
        if (i === 0) return
        expect(shelf.from).toBe(room.shelves[i - 1]!.to)
        expect(tops[i]!).toBeGreaterThan(tops[i - 1]!)
      })
      expect(room.shelves.at(-1)!.to).toBe(room.length)
    }
  })

  // §5: 0.53 m of him on a 0.7 m ledge leaves 0.085 m either side.
  it('leave room for all of him, and 8 cm either side, on every shelf', () => {
    for (const room of SHELVES) {
      for (const shelf of room.shelves) {
        expect(shelf.to - shelf.from).toBeGreaterThanOrEqual(
          MITT_SPAN + 2 * 0.08,
        )
      }
    }
  })

  it('start him on the floor and finish him on the top shelf, all of him', () => {
    for (const room of SHELVES) {
      const floor = room.shelves[0]!
      const top = room.shelves.at(-1)!
      expect(room.startX - HALF).toBeGreaterThanOrEqual(floor.from)
      expect(room.startX + HALF).toBeLessThanOrEqual(floor.to)
      expect(room.exitX - HALF).toBeGreaterThanOrEqual(top.from)
      expect(room.exitX + HALF).toBeLessThanOrEqual(top.to)
    }
  })

  // §11: from 1.34 m out, room 1's first fifth was a hop that landed
  // 0.3 m short. Rooms 2 and 3 start him 0.935 m out.
  it('start him in reach of the first riser, so the first leap sung there lands', () => {
    expect(SHELF_1.shelves[1]!.from - SHELF_1.startX - HALF).toBeCloseTo(0.9, 9)
    for (const room of SHELVES) {
      const short = room.shelves[1]!.from - room.startX - HALF
      expect(short, room.id).toBeLessThanOrEqual(LEAP_REACH)
      expect(
        leapFrom(room, 1, short, room.shelves[1]!.rise).y,
        room.id,
      ).toBeCloseTo(topsOf(room)[1]!, 9)
    }
  })
})

describe('the asks', () => {
  it('are every one at least a minor third and at most a fifth', () => {
    for (const { name, ask } of RISERS) {
      expect(ask, name).toBeGreaterThanOrEqual(3)
      expect(ask, name).toBeLessThanOrEqual(7)
    }
  })

  // §5's table: intervals are relative, so a preset changes only whether
  // the largest ask fits its voice, and down being free means it can be
  // started anywhere in the lower fifteen semitones of it.
  it('fit every voice preset, with fifteen semitones to start the largest from', () => {
    const largest = Math.max(...RISERS.map((r) => r.ask))
    expect(largest).toBeLessThanOrEqual(MAX_LEAP / RISE_PER_SEMI)
    for (const preset of VOICE_PRESETS) {
      const working = workingRange(preset)
      const span = working.highMidi - working.lowMidi
      expect(span - largest, preset.id).toBeGreaterThanOrEqual(15)
    }
  })

  // D7: the voice is the only way up. Silence makes no stops, so a body
  // that only walks is a body that rests.
  it('cannot be climbed by walking: every riser holds a grounded body', () => {
    for (const { room, k, name } of RISERS) {
      const tops = topsOf(room)
      const below = room.shelves[k - 1]!
      const s = stand(k === 1 ? room.startX : below.from + HALF, tops[k - 1]!)
      for (let i = 0; i < Math.round(4 / DT); i++) stepIn(room, s, 1)
      expect(s.y, name).toBe(tops[k - 1])
      expect(s.grounded, name).toBe(true)
      expect(s.x, name).toBeCloseTo(room.shelves[k]!.from - HALF, 9)
    }
  })
})

describe('a leap, stepped as the game steps it', () => {
  it('of exactly the ask lands, at every riser', () => {
    for (const { room, k, ask, name } of RISERS) {
      expect(leapAt(room, k, ask), name).toBeCloseTo(topsOf(room)[k]!, 9)
    }
  })

  // §3.4: the catch is the mitts' reach, 5 cm, half a semitone at 0.1 m.
  it('half a semitone flat still lands: the catch', () => {
    for (const { room, k, ask, name } of RISERS) {
      expect(leapAt(room, k, ask - 0.5), name).toBeCloseTo(topsOf(room)[k]!, 9)
    }
  })

  // §3.5: short of the catch the riser holds him, and he comes back down
  // on the shelf he left. A hop, not a fall.
  it('0.6 of a semitone flat does not, and he hops back onto the shelf he left', () => {
    for (const { room, k, ask, name } of RISERS) {
      expect(leapAt(room, k, ask - 0.6), name).toBeCloseTo(
        topsOf(room)[k - 1]!,
        9,
      )
    }
  })

  // D5: his whole spring, from any shelf, lands on the next one.
  it('never skips a shelf, however sharp', () => {
    for (const { room, k, name } of RISERS) {
      expect(leapAt(room, k, 12), name).toBeCloseTo(topsOf(room)[k]!, 9)
    }
  })
})

// §3.2: within reach of the riser ahead, a leap is carried at the speed
// that brings his front to it at the apex, so where he stood never
// decides whether a leap lands. The catch does, as it does at the riser.
describe('an aimed leap, from every spot in reach', () => {
  it('of exactly the ask lands', () => {
    for (const { room, k, ask, short, name } of IN_REACH) {
      expect(leapFrom(room, k, short, ask).y, name).toBeCloseTo(
        topsOf(room)[k]!,
        9,
      )
    }
  })

  it('half a semitone flat still lands: the catch', () => {
    for (const { room, k, ask, short, name } of IN_REACH) {
      expect(leapFrom(room, k, short, ask - 0.5).y, name).toBeCloseTo(
        topsOf(room)[k]!,
        9,
      )
    }
  })

  it('0.6 of a semitone flat does not, and he hops back onto the shelf he left', () => {
    for (const { room, k, ask, short, name } of IN_REACH) {
      expect(leapFrom(room, k, short, ask - 0.6).y, name).toBeCloseTo(
        topsOf(room)[k - 1]!,
        9,
      )
    }
  })

  // D5 still: the aim is at the riser, and the next one's wall holds him.
  it('never skips a shelf, however sharp', () => {
    for (const { room, k, short, name } of IN_REACH) {
      expect(leapFrom(room, k, short, 12).y, name).toBeCloseTo(
        topsOf(room)[k]!,
        9,
      )
    }
  })

  it('is the distance over the time to the apex: room 1, from the start line', () => {
    const short = SHELF_1.shelves[1]!.from - SHELF_1.startX - HALF
    expect(leapCarry(SHELF_1, SHELF_1.startX, 0, 0.7, CFG.gravity)).toBeCloseTo(
      short / Math.sqrt((2 * 0.7) / CFG.gravity),
      9,
    )
  })

  it('never carries him faster than LEAP_CARRY_MAX, whatever is sung', () => {
    for (const { room, k, ask, short, name } of IN_REACH) {
      const x = room.shelves[k]!.from - HALF - short
      const y = topsOf(room)[k - 1]!
      for (let semis = 0.5; semis <= 12; semis += 0.5) {
        const height = leapHeight(REFERENCE, REFERENCE + semis)!
        const carry = leapCarry(room, x, y, height, CFG.gravity, HALF)
        expect(carry, name).not.toBeNull()
        expect(carry!, name).toBeLessThanOrEqual(LEAP_CARRY_MAX)
      }
      // The flattest leap that lands is the fastest carry that does.
      expect(leapFrom(room, k, short, ask - 0.5).fastest).toBeLessThanOrEqual(
        LEAP_CARRY_MAX,
      )
    }
  })

  it('aims at nothing on the top shelf', () => {
    for (const room of SHELVES) {
      expect(
        leapCarry(room, room.exitX, topsOf(room).at(-1)!, 0.5, CFG.gravity),
      ).toBeNull()
    }
  })
})

describe('a leap beyond reach', () => {
  it('is a hop at walking pace, and never lands, from half a semitone flat to 4.5 sharp', () => {
    expect(OUT_OF_REACH.length).toBeGreaterThan(0)
    for (const { room, k, ask, short, name } of OUT_OF_REACH) {
      for (let semis = ask - 0.5; semis <= ask + 4.5; semis += 0.5) {
        const hop = leapFrom(room, k, short, semis)
        expect(hop.carry, name).toBeNull()
        expect(hop.y, `${name}, ${String(semis)}`).toBeCloseTo(
          topsOf(room)[k - 1]!,
          9,
        )
      }
    }
  })

  // §11: the one place it does not hold. A sharper hop is in the air for
  // longer, and his whole spring over room 2's major third, five
  // semitones sharp, lets walking pace take him to it from past the reach.
  it('but his whole spring still lands on room 2 major third from up to 1.035 m', () => {
    const tops = topsOf(SHELF_2)
    const spring = leapFrom(SHELF_2, 1, 1.035, 9)
    expect(spring.carry).toBeNull()
    expect(spring.y).toBeCloseTo(tops[1]!, 9)
    expect(leapFrom(SHELF_2, 1, 1.036, 9).y).toBe(tops[0])
  })
})

describe('the leap rule', () => {
  it('is the interval above the reference, 0.1 m a semitone', () => {
    expect(leapHeight(57, 64)).toBeCloseTo(0.7, 9)
    expect(leapHeight(57, 60.5)).toBeCloseTo(0.35, 9)
  })

  it('stops at his spring, nine semitones', () => {
    expect(leapHeight(57, 66)).toBeCloseTo(MAX_LEAP, 9)
    expect(leapHeight(57, 69)).toBe(MAX_LEAP)
  })

  // §3.3, D1: down is free, and so is the same note again.
  it('does not leap on the reference, below it, or for nonsense', () => {
    expect(leapHeight(57, 57)).toBeNull()
    expect(leapHeight(57, 50)).toBeNull()
    expect(leapHeight(57, Number.NaN)).toBeNull()
  })
})

describe('room 3, the octave', () => {
  const tops = topsOf(SHELF_3)

  it('puts the octave shelf beyond any one leap from the floor', () => {
    expect(tops[2]! / RISE_PER_SEMI).toBeCloseTo(12, 9)
    expect(MAX_LEAP).toBeLessThan(tops[2]! - CATCH)
    expect(leapHeight(REFERENCE, REFERENCE + 12)! + CATCH).toBeLessThan(
      tops[2]!,
    )
  })

  it('and within two: a fifth to the ledge, then a fourth', () => {
    expect(asksOf(SHELF_3).slice(0, 2)).toEqual([7, 5])
    expect(leapAt(SHELF_3, 1, 7)).toBeCloseTo(tops[1]!, 9)
    expect(leapAt(SHELF_3, 2, 5)).toBeCloseTo(tops[2]!, 9)
  })
})

describe('the floor under him', () => {
  const room = SHELF_2
  const tops = topsOf(room)
  const ground = groundFor(room, HALF)
  const pinned = room.shelves[2]!.from - HALF

  it('is the shelf he stands on, not the one whose riser his mitt is against', () => {
    expect(ground(pinned, tops[1]!)).toBe(tops[1])
    expect(ground(pinned, tops[2]! - CATCH - 0.001)).toBe(tops[1])
  })

  it('is the shelf above once his feet are within the catch of its lip', () => {
    expect(ground(pinned, tops[2]! - CATCH)).toBe(tops[2])
    expect(ground(pinned, tops[2]! + 0.2)).toBe(tops[2])
  })

  it('never offers a shelf his mitts have not reached', () => {
    expect(ground(pinned - 0.01, tops[2]!)).toBe(tops[1])
  })

  // §3.7: walking off a shelf's low edge steps him down to the one below.
  it('steps him down off the low edge of a shelf, one shelf', () => {
    const s = stand(room.shelves[2]!.from + HALF + 0.1, tops[2]!)
    while (s.x + HALF >= room.shelves[2]!.from) stepIn(room, s, -1)
    for (let i = 0; i < Math.round(1 / DT) && !s.grounded; i++) {
      stepIn(room, s, 0)
    }
    expect(s.grounded).toBe(true)
    expect(s.y).toBe(tops[1])
  })
})

describe('the wall', () => {
  const room = SHELF_2
  const tops = topsOf(room)
  const pinned = room.shelves[2]!.from - HALF

  it('is the next riser his mitts cannot catch, less his half width', () => {
    expect(riserWallAt(room, 0.4, 0, HALF)).toBeCloseTo(
      room.shelves[1]!.from - HALF,
      9,
    )
    expect(riserWallAt(room, 1.8, tops[1]!, HALF)).toBeCloseTo(pinned, 9)
  })

  it('lifts once his feet are within the catch, and the next riser takes over', () => {
    expect(riserWallAt(room, pinned, tops[2]! - CATCH, HALF)).toBeCloseTo(
      room.shelves[3]!.from - HALF,
      9,
    )
  })

  it('is never behind him: a body past a riser it cannot catch is pinned where it is', () => {
    const past = room.shelves[2]!.from + 0.1
    expect(riserWallAt(room, past, tops[1]!, HALF)).toBe(past)
  })

  it('is no wall at all on the top shelf', () => {
    expect(riserWallAt(room, room.exitX, tops.at(-1)!, HALF)).toBe(Infinity)
  })
})
