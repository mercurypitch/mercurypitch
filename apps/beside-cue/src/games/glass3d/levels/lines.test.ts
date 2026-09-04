// Can every room be finished, by every voice?
// ============================================================

import { describe, expect, it } from 'vitest'
import { bandFor, inBand, REST_WIDTH, restTFor, silhouetteFor, torsoHeight, workingRange, } from '../sim/tension3d'
import { VOICE_PRESETS } from '../voice-range'
import { admits, bandsFor, crossed, fitFor, furnitureOf, LINE_2, LINE_3, LINES, meshLayout, overGaps, PLATE_STANDOFF, sizeFor, SLAT, wedgeCeiling, wedgeStop, } from './lines'

type AnyGate = (typeof LINES)[number]['gates'][number]
const startOf = (gate: AnyGate): number =>
  gate.kind === 'slot' ? gate.x : gate.from
const endOf = (gate: AnyGate): number =>
  gate.kind === 'slot' ? gate.x : gate.to

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
          const bands = bandsFor(gate, range)
          const fit = fitFor(gate, bands)
          expect(inBand(restTFor(), bands.band)).toBe(false)
          expect(inBand(restTFor(), bands.entry)).toBe(false)
          if (gate.kind === 'mesh') {
            // A grate holds a body wider than its gap; at rest he is
            // narrower, and pours through.
            expect(fit.size).toBeGreaterThan(REST_WIDTH)
            expect(admits(gate, rest, fit, gate.from)).toBe(false)
            expect(
              admits(gate, silhouetteFor(bands.band.hi), fit, gate.from),
            ).toBe(true)
            expect(admits(gate, silhouetteFor(0), fit, gate.from)).toBe(true)
          } else if (gate.kind === 'wedge') {
            // The band's edge fits its own end of the wedge and no
            // further: the mouth admits the entry edge, the far end the
            // exit edge, and the far end is the tighter of the two.
            expect(fit.sizeOut).toBeLessThan(fit.size)
            // Judged at his front edge: the entry edge fits with his
            // front at the mouth, not a step further in.
            const entry = silhouetteFor(bands.entry.hi)
            const out = silhouetteFor(bands.band.hi)
            expect(admits(gate, entry, fit, gate.from - entry.width / 2)).toBe(
              true,
            )
            expect(admits(gate, entry, fit, gate.from + 0.05)).toBe(false)
            expect(admits(gate, out, fit, gate.to)).toBe(true)
            expect(admits(gate, out, fit, gate.from)).toBe(true)
            expect(admits(gate, rest, fit, gate.from - rest.width / 2)).toBe(
              false,
            )
          } else if (gate.gate.end === 'flat') {
            // A torso, not a whole box: 0.376 to 0.434 across the presets.
            expect(fit.size).toBeGreaterThan(0.3)
            expect(fit.size).toBeLessThan(0.5)
            expect(admits(gate, rest, fit, gate.x)).toBe(false)
            expect(
              admits(gate, silhouetteFor(bands.band.hi), fit, gate.x),
            ).toBe(true)
          } else {
            expect(admits(gate, rest, fit, gate.x)).toBe(false)
            expect(
              admits(gate, silhouetteFor(bands.band.lo), fit, gate.x),
            ).toBe(true)
            expect(admits(gate, silhouetteFor(1), fit, gate.x)).toBe(true)
          }
        }
      }
    }
  })
})

describe('room 2, the trade', () => {
  const range = { lowMidi: 48, highMidi: 65 } // 17 semitones, the plan's span
  const [grate, slot] = LINE_2.gates
  const gap = fitFor(grate!, bandsFor(grate!, range))
  const width = fitFor(slot!, bandsFor(slot!, range))

  // The plan's numbers (§5): a 0.42 m gap and a 0.33 m slot, before
  // the torso and the rest margin moved them. What matters is that the
  // body the grate holds cannot fit the slot, and the one the slot
  // admits cannot be held -- the opposition is the room.
  it('asks for two shapes that cannot both be true', () => {
    expect(gap.size).toBeGreaterThan(0.34)
    expect(gap.size).toBeLessThan(0.44)
    expect(width.size).toBeGreaterThan(0.28)
    expect(width.size).toBeLessThan(0.36)
    const held = silhouetteFor(0.1)
    const thin = silhouetteFor(0.9)
    expect(admits(grate!, held, gap, 2)).toBe(true)
    expect(admits(slot!, held, width, 4.9)).toBe(false)
    expect(admits(slot!, thin, width, 4.9)).toBe(true)
    expect(admits(grate!, thin, gap, 2)).toBe(false)
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

  const slot = (x: number) =>
    ({ kind: 'slot', x, gate: LINE_2.gates[1]!.gate }) as const

  it('counts a plate crossed a hand past it and a grate at its far lip', () => {
    expect(crossed(slot(4.9), 4.9)).toBe(false)
    expect(crossed(slot(4.9), 4.96)).toBe(true)
    expect(crossed(LINE_2.gates[0]!, 3.59)).toBe(false)
    expect(crossed(LINE_2.gates[0]!, 3.6)).toBe(true)
  })

  it('sizes a one-number piece the same way whichever door it comes in by', () => {
    for (const gate of [...LINE_2.gates, ...LINES[0]!.gates]) {
      const bands = bandsFor(gate, { lowMidi: 48, highMidi: 70 })
      expect(sizeFor(gate, bands.band)).toBe(fitFor(gate, bands).size)
    }
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
    expect(furnitureOf(LINE_3.gates[0]!)).toEqual({
      kind: 'wedge',
      from: 1.8,
      to: 2.8,
    })
  })
})

describe('room 3, the wedge', () => {
  const range = { lowMidi: 48, highMidi: 70 } // 22 semitones
  const wedge = LINE_3.gates[0]!
  if (wedge.kind !== 'wedge') throw new Error('room 3 starts with its wedge')
  const bands = bandsFor(wedge, range)
  const fit = fitFor(wedge, bands)
  const walk = 1.15

  it('has a ceiling that is the mouth before it, the far end after, a line between', () => {
    expect(wedgeCeiling(wedge, fit, 0)).toBeCloseTo(fit.size, 9)
    expect(wedgeCeiling(wedge, fit, wedge.from)).toBeCloseTo(fit.size, 9)
    expect(wedgeCeiling(wedge, fit, (wedge.from + wedge.to) / 2)).toBeCloseTo(
      (fit.size + fit.sizeOut) / 2,
      9,
    )
    expect(wedgeCeiling(wedge, fit, wedge.to)).toBeCloseTo(fit.sizeOut, 9)
    expect(wedgeCeiling(wedge, fit, 9)).toBeCloseTo(fit.sizeOut, 9)
  })

  // The gate §8 asked for, as far as one degree of freedom allows: no
  // single shape gets through. Hold the shape that fits the mouth and
  // the wedge stops him inside; hold anything taller and it stops him
  // at the mouth; only the far end's shape is no wall at all.
  it('stops every held shape somewhere, except the one that fits its far end', () => {
    const entry = silhouetteFor(bands.entry.hi)
    const stopEntry = wedgeStop(wedge, fit, torsoHeight(entry), entry.width / 2)
    expect(stopEntry).toBeGreaterThan(wedge.from - entry.width / 2 - 1e-9)
    expect(stopEntry).toBeLessThan(wedge.to)

    const mid = silhouetteFor((bands.entry.hi + bands.band.hi) / 2)
    const stopMid = wedgeStop(wedge, fit, torsoHeight(mid), mid.width / 2)
    expect(stopMid).toBeGreaterThan(stopEntry)
    expect(stopMid).toBeLessThan(wedge.to)

    const rest = silhouetteFor(restTFor())
    expect(
      wedgeStop(wedge, fit, torsoHeight(rest), rest.width / 2),
    ).toBeLessThan(wedge.from)

    const out = silhouetteFor(bands.band.hi)
    expect(wedgeStop(wedge, fit, torsoHeight(out), out.width / 2)).toBe(
      Infinity,
    )
  })

  // A glide gets through: walk the metre at walking pace with the voice
  // going down so that his FRONT is always under the ceiling -- lower
  // than where he stands, a step ahead of himself -- and the wall is
  // never in front of him. Tracking the ceiling at his centre is not
  // enough, which is the room's lesson stated as a test.
  it('lets a glide through at walking pace, and only a glide that leads', () => {
    const dt = 1 / 120
    const glide = (lead: number): boolean => {
      let x = wedge.from - 0.5
      let walled = false
      while (x < wedge.to + 0.1) {
        const at = x + lead
        const along = Math.max(
          0,
          Math.min(1, (at - wedge.from) / (wedge.to - wedge.from)),
        )
        const t = bands.entry.hi + (bands.band.hi - bands.entry.hi) * along
        const body = silhouetteFor(t)
        const stop = wedgeStop(wedge, fit, torsoHeight(body), body.width / 2)
        if (stop < x) walled = true
        x += walk * dt
      }
      return walled
    }
    // He widens as he flattens, so the lead has to cover the widest
    // half-width the glide reaches, not the one it starts at.
    const widest = silhouetteFor(bands.band.hi).width / 2
    expect(glide(widest + 0.02)).toBe(false)
    expect(glide(0)).toBe(true)
  })

  it('is crossed a hand past its far end', () => {
    expect(crossed(wedge, wedge.to)).toBe(false)
    expect(crossed(wedge, wedge.to + 0.06)).toBe(true)
  })
})
