import { describe, expect, it } from 'vitest'
import { JOURNEY_CONFIG } from '../journey-config'
import { compileLevel } from './compile'
import { SONGBOOK } from './index'
import { ODE_TO_JOY } from './ode-to-joy'
import type { LevelDef } from './types'

const G = 57 // A3 as the calibrated ground note
const M = JOURNEY_CONFIG.melody

const flow = (level: LevelDef) =>
  compileLevel(level, { mode: 'flow', groundMidi: G })
const plat = (level: LevelDef) =>
  compileLevel(level, { mode: 'platformer', groundMidi: G })

describe('compileLevel', () => {
  it('lays platforms left to right without overlap, ground first and lit', () => {
    for (const cs of [flow(ODE_TO_JOY), plat(ODE_TO_JOY)]) {
      expect(cs.platforms[0].lit).toBe(true)
      expect(cs.platforms[0].syllable).toBe('start')
      for (let i = 1; i < cs.platforms.length; i++) {
        expect(cs.platforms[i].x0).toBeGreaterThan(
          cs.platforms[i - 1].x1 - 1e-9,
        )
        expect(cs.platforms[i].x1).toBeGreaterThan(cs.platforms[i].x0)
      }
      expect(cs.worldMax).toBeGreaterThan(cs.platforms.at(-1)!.x1)
    }
  })

  it('centers the song range on the calibrated ground note', () => {
    const cs = flow(ODE_TO_JOY)
    // range 0..7 → midpoint 3.5 → shift −4: the tune wraps the voice
    expect(cs.shift).toBe(-4)
    expect(cs.platforms[1].midi).toBe(G + 4 + cs.shift) // first mi
    expect(cs.platforms.at(-1)!.midi).toBe(G + 0 + cs.shift) // last do
    // the start slab sits at the song's first note, ready-lit
    expect(cs.platforms[0].midi).toBe(cs.platforms[1].midi)
  })

  it('applies the range bias on top of centering', () => {
    const base = flow(ODE_TO_JOY)
    const hi = compileLevel(ODE_TO_JOY, {
      mode: 'flow',
      groundMidi: G,
      rangeBias: 3,
    })
    expect(hi.shift).toBe(base.shift + 3)
    for (let i = 0; i < base.platforms.length; i++) {
      expect(hi.platforms[i].midi).toBe(base.platforms[i].midi + 3)
    }
    // the start slab always sits inside the window
    expect(hi.platforms[0].midi - G).toBeGreaterThanOrEqual(hi.windowLo)
    expect(hi.platforms[0].midi - G).toBeLessThanOrEqual(hi.windowHi)
  })

  it('sizes platform width from note duration', () => {
    const cs = flow(ODE_TO_JOY)
    const quarter = cs.platforms[1]
    expect(quarter.x1 - quarter.x0).toBeCloseTo(M.unitsPerBeat.flow, 5)
    const half = cs.platforms.at(-1)! // final do, 2 beats
    expect(half.x1 - half.x0).toBeCloseTo(2 * M.unitsPerBeat.flow, 5)
    // an eighth note never shrinks below the landable minimum
    const eighth = cs.platforms[14] // 0.5-beat "re" in phrase A
    expect(eighth.x1 - eighth.x0).toBeCloseTo(
      Math.max(M.minWidth, 0.5 * M.unitsPerBeat.flow),
      5,
    )
  })

  it('derives the pitch window from the shifted melody range', () => {
    const cs = flow(ODE_TO_JOY) // range 0..7 shifted by −4 → −4..3
    expect(cs.windowLo).toBe(-4 - M.windowLoPad)
    expect(cs.windowHi).toBe(3 + M.windowHiPad)
  })

  it('places the gate reachable in both modes', () => {
    const f = flow(ODE_TO_JOY)
    const p = plat(ODE_TO_JOY)
    expect(f.panes).toHaveLength(1)
    expect(f.panes[0].midi).toBe(G + 7 + f.shift)
    // flow: the approach spot must hover over the previous platform
    const prevF = f.platforms.filter((pl) => pl.x1 <= f.panes[0].wx).at(-1)!
    const approach = f.panes[0].wx - JOURNEY_CONFIG.pane.approachBack
    expect(approach).toBeGreaterThanOrEqual(prevF.x0)
    expect(approach).toBeLessThanOrEqual(prevF.x1)
    // platformer: standing at the previous edge is inside charge range
    const prevP = p.platforms.filter((pl) => pl.x1 <= p.panes[0].wx).at(-1)!
    expect(p.panes[0].wx - prevP.x1).toBeLessThanOrEqual(
      JOURNEY_CONFIG.control.paneChargeUnits,
    )
  })

  it('orders nodes as phrase A, gate, phrase B with one checkpoint', () => {
    const cs = flow(ODE_TO_JOY)
    expect(cs.nodes).toHaveLength(31)
    expect(cs.nodes[15].t).toBe('pane')
    const checkpoints = cs.nodes.filter(
      (n) => n.t === 'land' && n.checkpoint === true,
    )
    expect(checkpoints).toHaveLength(1)
    expect(cs.nodes[16]).toBe(checkpoints[0]) // phrase B starts the checkpoint
  })

  it('carries syllables onto platforms and hints', () => {
    const cs = flow(ODE_TO_JOY)
    expect(cs.platforms[1].syllable).toBe('mi')
    const n = cs.nodes[0]
    expect(n.t).toBe('land')
    expect(n.hint).toContain('mi')
  })

  it('paces the platformer wider than flow', () => {
    const f = flow(ODE_TO_JOY)
    const p = plat(ODE_TO_JOY)
    const gap = (cs: typeof f, i: number) =>
      cs.platforms[i + 1].x0 - cs.platforms[i].x1
    expect(gap(p, 1)).toBeGreaterThan(gap(f, 1))
    expect(p.worldMax).toBeGreaterThan(f.worldMax)
  })

  it('compiles identically from a JSON round-trip (levels are data)', () => {
    const revived = JSON.parse(JSON.stringify(ODE_TO_JOY)) as LevelDef
    expect(flow(revived)).toEqual(flow(ODE_TO_JOY))
  })

  it('honors rest segments as empty road', () => {
    const withRest: LevelDef = {
      id: 't',
      title: 't',
      segments: [
        {
          type: 'melody',
          melody: { id: 'a', name: 'a', degrees: [0], durations: [1] },
        },
        { type: 'rest', beats: 2 },
        {
          type: 'melody',
          melody: { id: 'b', name: 'b', degrees: [2], durations: [1] },
        },
      ],
    }
    const cs = flow(withRest)
    const gap = cs.platforms[2].x0 - cs.platforms[1].x1
    expect(gap).toBeCloseTo(2 * M.restUnit.flow + M.phraseGap.flow, 5)
  })
})

describe('songbook invariants — every level, every mode', () => {
  const MODES = ['flow', 'platformer'] as const
  for (const level of SONGBOOK) {
    for (const m of MODES) {
      it(`${level.id} compiles safely in ${m}`, () => {
        const cs = compileLevel(level, { mode: m, groundMidi: G })
        expect(cs.platforms[0].lit).toBe(true)
        for (let i = 1; i < cs.platforms.length; i++) {
          expect(cs.platforms[i].x0).toBeGreaterThan(
            cs.platforms[i - 1].x1 - 1e-9,
          )
        }
        // every note sits inside the derived pitch window
        for (const pl of cs.platforms) {
          expect(pl.midi - G).toBeGreaterThanOrEqual(cs.windowLo)
          expect(pl.midi - G).toBeLessThanOrEqual(cs.windowHi)
        }
        // every pane is winnable: an approach spot in flow, charge range
        // in the platformer
        for (const pn of cs.panes) {
          const prev = cs.platforms.filter((pl) => pl.x1 <= pn.wx).at(-1)!
          if (m === 'flow') {
            const approach = pn.wx - JOURNEY_CONFIG.pane.approachBack
            expect(approach).toBeGreaterThanOrEqual(prev.x0)
            expect(approach).toBeLessThanOrEqual(prev.x1)
          } else {
            expect(pn.wx - prev.x1).toBeLessThanOrEqual(
              JOURNEY_CONFIG.control.paneChargeUnits,
            )
          }
        }
        expect(cs.worldMax).toBeGreaterThan(cs.platforms.at(-1)!.x1)
      })
    }
  }
})
