import { describe, expect, it } from 'vitest'
import type { Chamber } from './chamber3d'
import { belliesFor, groundIn, isExciting, isFloorSafe, modeMidi, nearestMode, nodesFor, rangeSlackSemis, standingAmplitude, tuneChamber, } from './chamber3d'

describe('the standing wave', () => {
  it('is still at both walls, whatever the mode', () => {
    for (const mode of [1, 2, 3, 5, 8]) {
      expect(standingAmplitude(0, mode)).toBeCloseTo(0, 10)
      expect(standingAmplitude(1, mode)).toBeCloseTo(0, 10)
    }
  })

  it('divides the room into n equal parts', () => {
    expect(nodesFor(1)).toEqual([0, 1])
    expect(nodesFor(2)).toEqual([0, 0.5, 1])
    expect(nodesFor(4)).toEqual([0, 0.25, 0.5, 0.75, 1])
  })

  it('puts a belly in the middle of every part', () => {
    expect(belliesFor(1)).toEqual([0.5])
    expect(belliesFor(2)).toEqual([0.25, 0.75])
    expect(belliesFor(3).map((b) => Number(b.toFixed(6)))).toEqual([
      0.166667, 0.5, 0.833333,
    ])
  })

  it('is exactly still at every node and exactly loudest at every belly', () => {
    for (const mode of [1, 2, 3, 4, 6]) {
      for (const n of nodesFor(mode)) {
        expect(standingAmplitude(n, mode)).toBeCloseTo(0, 10)
      }
      for (const b of belliesFor(mode)) {
        expect(standingAmplitude(b, mode)).toBeCloseTo(1, 10)
      }
    }
  })

  // The reason the mechanic reads at all: what is safe for one mode is
  // the most dangerous place in the room for another.
  it('makes one mode a node where its neighbour is a belly', () => {
    // The centre is a node for mode 2 and a belly for modes 1 and 3.
    expect(standingAmplitude(0.5, 2)).toBeCloseTo(0, 10)
    expect(standingAmplitude(0.5, 1)).toBeCloseTo(1, 10)
    expect(standingAmplitude(0.5, 3)).toBeCloseTo(1, 10)
  })
})

describe('the ladder', () => {
  it('sounds a mode at n times the fundamental', () => {
    // Doubling the frequency is twelve semitones, whatever the room.
    expect(modeMidi(48, 1)).toBeCloseTo(48, 10)
    expect(modeMidi(48, 2)).toBeCloseTo(60, 10)
    expect(modeMidi(48, 4)).toBeCloseTo(72, 10)
    // And a fifth from mode 2 to mode 3.
    expect(modeMidi(48, 3) - modeMidi(48, 2)).toBeCloseTo(7.02, 2)
  })

  // The design fact the whole difficulty curve rests on.
  it('has rungs that get closer as it climbs', () => {
    const gap = (a: number, b: number) => modeMidi(0, b) - modeMidi(0, a)
    expect(gap(1, 2)).toBeCloseTo(12, 5)
    expect(gap(2, 3)).toBeCloseTo(7.02, 2)
    expect(gap(4, 5)).toBeCloseTo(3.86, 2)
    expect(gap(5, 6)).toBeCloseTo(3.16, 2)
    expect(gap(5, 6)).toBeLessThan(gap(1, 2))
  })

  it('names the nearest mode, and says which way it is off', () => {
    const modes = [4, 5, 6]
    const onFive = modeMidi(50, 5)
    expect(nearestMode(onFive, 50, modes)).toEqual({ mode: 5, semisOff: 0 })

    const flat = nearestMode(onFive - 0.8, 50, modes)
    expect(flat.mode).toBe(5)
    expect(flat.semisOff).toBeCloseTo(-0.8, 5)
  })

  it('holds the mode through a miss, and hands it over past halfway', () => {
    const modes = [4, 5, 6]
    const five = modeMidi(50, 5)
    // Mode 4 sits 3.86 semitones below mode 5, so the handover is at
    // 1.93. A singer a semitone flat is still on 5, and out of tune:
    const near = nearestMode(five - 1, 50, modes)
    expect(near.mode).toBe(5)
    expect(isExciting(near.semisOff, 0.6)).toBe(false)
    // A singer two semitones flat is nearer mode 4, and the room is
    // right to say so -- they have sung a different note.
    expect(nearestMode(five - 2, 50, modes).mode).toBe(4)
  })

  // The concern the plan flagged, pinned as a number rather than a
  // worry: with rungs 3.2 semitones apart, a tolerance anywhere near
  // the Hallway's 1.5 leaves almost no dead ground between modes 5 and
  // 6 -- two bands 1.5 wide inside a 3.16 gap touch at 3.0. A chamber
  // has to hold a tighter band than a single-note room does.
  it('leaves barely any room between the top rungs at the Hallway band', () => {
    const gap = modeMidi(0, 6) - modeMidi(0, 5)
    expect(gap).toBeCloseTo(3.16, 2)
    expect(gap - 2 * 1.5).toBeLessThan(0.2)
    // Half a semitone each way leaves a real gap to be wrong in.
    expect(gap - 2 * 0.5).toBeGreaterThan(2)
  })

  it('has no mode for silence', () => {
    expect(nearestMode(null, 50, [4, 5, 6]).mode).toBeNull()
  })
})

describe('transposing the room to the singer', () => {
  it('centres the mode set on the middle of the measured range', () => {
    const range = { lowMidi: 55, highMidi: 71 }
    const modes = [4, 5, 6]
    const f0 = tuneChamber(modes, range)
    const lowest = modeMidi(f0, Math.min(...modes))
    const highest = modeMidi(f0, Math.max(...modes))
    expect((lowest + highest) / 2).toBeCloseTo(63, 5)
  })

  it('puts every mode inside a range that can hold them', () => {
    const range = { lowMidi: 55, highMidi: 71 }
    const modes = [4, 5, 6]
    const f0 = tuneChamber(modes, range)
    for (const m of modes) {
      expect(modeMidi(f0, m)).toBeGreaterThanOrEqual(range.lowMidi)
      expect(modeMidi(f0, m)).toBeLessThanOrEqual(range.highMidi)
    }
  })

  it('falls back to the Hallway note when nothing has been measured', () => {
    expect(tuneChamber([1], null)).toBeCloseTo(67, 5)
  })

  // The check that decides whether a chamber is buildable for a player,
  // and the reason early rooms live high on the ladder.
  it('reports how much range a mode set needs', () => {
    // Modes 4-6 span 12*log2(6/4) = 7.02 semitones -- a fifth and a
    // little, which is the number to design early chambers against.
    expect(
      rangeSlackSemis([4, 5, 6], { lowMidi: 60, highMidi: 68 }),
    ).toBeCloseTo(0.98, 2)
    // A range of exactly a fifth does NOT hold them, by a fiftieth of a
    // semitone. Worth having pinned: "about seven semitones" is the kind
    // of rounding that ships a level nobody can finish.
    expect(
      rangeSlackSemis([4, 5, 6], { lowMidi: 60, highMidi: 67 }),
    ).toBeLessThan(0)
    // Modes 1-2 span an octave, and no modest range holds them.
    expect(rangeSlackSemis([1, 2], { lowMidi: 60, highMidi: 67 })).toBeLessThan(
      0,
    )
  })
})

describe('the floor', () => {
  const chamber: Chamber = {
    id: 'test',
    modes: [2, 3],
    length: 4,
    panes: [{ at: 0.25, height: 1 }],
    platforms: [{ at: 0.5, width: 1, height: 0.6 }],
    teaches: 'nothing',
  }

  it('is the ground, except where a platform is over it', () => {
    const ground = groundIn(chamber)
    expect(ground(0.2)).toBe(0)
    expect(ground(2)).toBe(0.6)
    // Just outside the platform's width.
    expect(ground(2 - 0.6)).toBe(0)
  })

  it('is safe at a node and not at a belly', () => {
    // Mode 2: nodes at 0, 0.5, 1; bellies at 0.25 and 0.75.
    expect(isFloorSafe(0.5, 2, 0.3)).toBe(true)
    expect(isFloorSafe(0.25, 2, 0.3)).toBe(false)
  })

  it('is safe everywhere when nothing is being sung', () => {
    expect(isFloorSafe(0.25, null, 0.3)).toBe(true)
  })

  // A player who can see the pattern should not also have to aim at it.
  it('gives a node some width to stand in', () => {
    const threshold = 0.3
    // 0.3 amplitude either side of the node at 0.5, for mode 2.
    const halfWidth = Math.asin(threshold) / (2 * Math.PI)
    expect(isFloorSafe(0.5 + halfWidth * 0.9, 2, threshold)).toBe(true)
    expect(isFloorSafe(0.5 + halfWidth * 1.1, 2, threshold)).toBe(false)
    // And that is a real amount of room: several centimetres in a
    // four-metre chamber, not a pixel.
    expect(halfWidth * chamber.length * 2).toBeGreaterThan(0.15)
  })
})
