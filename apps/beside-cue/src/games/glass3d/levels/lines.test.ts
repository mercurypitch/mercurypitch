// Can every room be finished, by every voice?
// ============================================================

import { describe, expect, it } from 'vitest'
import { bandFor, inBand, REST_WIDTH, restTFor, silhouetteFor, workingRange, } from '../sim/tension3d'
import { VOICE_PRESETS } from '../voice-range'
import { admits, crossed, furnitureOf, LINE_2, LINES, meshLayout, overGaps, PLATE_STANDOFF, sizeFor, SLAT, } from './lines'

const startOf = (gate: (typeof LINES)[number]['gates'][number]): number =>
  gate.kind === 'mesh' ? gate.from : gate.x
const endOf = (gate: (typeof LINES)[number]['gates'][number]): number =>
  gate.kind === 'mesh' ? gate.to : gate.x

describe('the rooms', () => {
  it('have distinct ids and a sentence each', () => {
    const ids = LINES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const room of LINES) expect(room.teaches.length).toBeGreaterThan(8)
  })

  it('put the start before every gate, gates in order, and the exit last', () => {
    for (const room of LINES) {
      let last = room.startX + PLATE_STANDOFF
      for (const gate of room.gates) {
        expect(startOf(gate)).toBeGreaterThan(last)
        expect(endOf(gate)).toBeLessThan(room.exitX)
        last = endOf(gate)
      }
      expect(room.exitX).toBeLessThan(room.length)
    }
  })

  // A drop that put him back past a gate would be a shortcut, and one
  // that put him back at the door would be the punishment §5 forbids.
  it('returns a dropped body to the lip of the grate, and nowhere else', () => {
    for (const room of LINES) {
      const grate = room.gates.find((g) => g.kind === 'mesh')
      if (grate === undefined) {
        expect(room.returnX).toBeUndefined()
        continue
      }
      expect(room.returnX).toBeDefined()
      expect(room.returnX!).toBeLessThan(grate.from)
      expect(grate.from - room.returnX!).toBeLessThan(0.5)
      for (const g of room.gates) {
        if (g !== grate) expect(startOf(g)).toBeGreaterThan(room.returnX!)
      }
    }
  })

  // Every preset must be able to make each shape a room asks for, and
  // none may be handed a room it clears by standing still.
  it('give every preset a way through, and no way through by resting', () => {
    const rest = silhouetteFor(restTFor())
    for (const preset of VOICE_PRESETS) {
      const range = workingRange(preset)
      for (const room of LINES) {
        for (const gate of room.gates) {
          const band = bandFor(gate.gate, range)
          const size = sizeFor(gate, band)
          expect(inBand(restTFor(), band)).toBe(false)
          // The band's edge is the shape the furniture is drawn from,
          // so the edge itself always passes.
          const edge = gate.gate.end === 'flat' ? band.hi : band.lo
          expect(admits(gate, silhouetteFor(edge), size)).toBe(true)
          if (gate.kind === 'mesh') {
            // A grate holds a body wider than its gap; at rest he is
            // narrower, and pours through.
            expect(size).toBeGreaterThan(REST_WIDTH)
            expect(admits(gate, rest, size)).toBe(false)
            expect(admits(gate, silhouetteFor(0), size)).toBe(true)
          } else if (gate.gate.end === 'flat') {
            // A torso, not a whole box: 0.376 to 0.434 across the presets.
            expect(size).toBeGreaterThan(0.3)
            expect(size).toBeLessThan(0.5)
            expect(admits(gate, rest, size)).toBe(false)
          } else {
            expect(admits(gate, rest, size)).toBe(false)
            expect(admits(gate, silhouetteFor(1), size)).toBe(true)
          }
        }
      }
    }
  })
})

describe('room 2, the trade', () => {
  const range = { lowMidi: 48, highMidi: 65 } // 17 semitones, the plan's span
  const [grate, slot] = LINE_2.gates
  const gap = sizeFor(grate!, bandFor(grate!.gate, range))
  const width = sizeFor(slot!, bandFor(slot!.gate, range))

  // The plan's numbers (§5): a 0.42 m gap and a 0.33 m slot, before
  // the torso and the rest margin moved them. What matters is that the
  // body the grate holds cannot fit the slot, and the one the slot
  // admits cannot be held -- the opposition is the room.
  it('asks for two shapes that cannot both be true', () => {
    expect(gap).toBeGreaterThan(0.34)
    expect(gap).toBeLessThan(0.44)
    expect(width).toBeGreaterThan(0.28)
    expect(width).toBeLessThan(0.36)
    const held = silhouetteFor(0.1)
    const thin = silhouetteFor(0.9)
    expect(admits(grate!, held, gap)).toBe(true)
    expect(admits(slot!, held, width)).toBe(false)
    expect(admits(slot!, thin, width)).toBe(true)
    expect(admits(grate!, thin, gap)).toBe(false)
  })

  it('has the slot band start where the plan says, not where the rest margin lands', () => {
    expect(bandFor(slot!.gate, range).lo).toBeCloseTo(0.634, 3)
  })
})

describe('what is drawn is what is judged', () => {
  const grate = { from: 1.6, to: 3.6 }

  it('cuts every gap to exactly the judged size, and lips take the rest', () => {
    for (const size of [0.3, 0.377, 0.42, 0.5]) {
      const { gaps, lip } = meshLayout(grate, size)
      expect(gaps).toBeGreaterThanOrEqual(1)
      expect(lip).toBeGreaterThanOrEqual(SLAT / 2)
      const laid = 2 * lip + gaps * size + (gaps - 1) * SLAT
      expect(laid).toBeCloseTo(grate.to - grate.from, 9)
    }
  })

  it('drops only over the gaps, never on a lip', () => {
    const size = 0.377
    const { lip } = meshLayout(grate, size)
    expect(overGaps(grate, grate.from + lip / 2, size)).toBe(false)
    expect(overGaps(grate, grate.from + lip + 0.01, size)).toBe(true)
    expect(overGaps(grate, grate.to - lip / 2, size)).toBe(false)
    expect(overGaps(grate, grate.from - 0.1, size)).toBe(false)
    expect(overGaps(grate, grate.to + 0.1, size)).toBe(false)
  })

  it('counts a plate crossed a hand past it and a grate at its far lip', () => {
    expect(crossed(slot(4.9), 4.9)).toBe(false)
    expect(crossed(slot(4.9), 4.96)).toBe(true)
    expect(crossed(LINE_2.gates[0]!, 3.59)).toBe(false)
    expect(crossed(LINE_2.gates[0]!, 3.6)).toBe(true)
  })

  it('stands a flat gate up as a horizontal slot and a tall one as a vertical', () => {
    expect(furnitureOf(LINES[0]!.gates[0]!)).toEqual({
      kind: 'slot',
      axis: 'h',
      x: 1.5,
    })
    expect(furnitureOf(LINE_2.gates[1]!)).toEqual({
      kind: 'slot',
      axis: 'v',
      x: 4.9,
    })
    expect(furnitureOf(LINE_2.gates[0]!)).toEqual({
      kind: 'mesh',
      from: 1.6,
      to: 3.6,
    })
  })

  const slot = (x: number) =>
    ({ kind: 'slot', x, gate: LINE_2.gates[1]!.gate }) as const
})
