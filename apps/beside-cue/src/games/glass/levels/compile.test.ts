import { describe, expect, it } from 'vitest'
import { JOURNEY_CONFIG } from '../journey-config'
import { compileLevel } from './compile'
import { SONGBOOK } from './index'
import { ODE_TO_JOY } from './ode-to-joy'
import { THE_GLASSWORKS } from './the-glassworks'
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

  it('compiles rhythm as a beat road — adjacent slabs, no held panes', () => {
    const cs = compileLevel(ODE_TO_JOY, { mode: 'rhythm', groundMidi: G })
    expect(cs.panes).toHaveLength(0) // the gate became a two-beat rest
    expect(cs.nodes).toHaveLength(30) // land nodes only
    const gap = cs.platforms[2].x0 - cs.platforms[1].x1
    expect(gap).toBeCloseTo(M.noteGap.rhythm, 5)
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
  const MODES = ['flow', 'platformer', 'rhythm'] as const
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

describe('glass notes (MelodyDef.glassAt)', () => {
  const FRERE = SONGBOOK.find((l) => l.id === 'frere-jacques')
  if (FRERE === undefined) throw new Error('frere-jacques missing')

  const matinesSlabs = (mode: 'flow' | 'platformer' | 'rhythm') => {
    const cs = compileLevel(FRERE, { mode, groundMidi: G })
    // platforms: ground + P1(8) + P2(6), then P3's 12
    return cs.platforms.slice(1 + 8 + 6, 1 + 8 + 6 + 12)
  }

  it('marks the declared notes glass in sung modes', () => {
    for (const mode of ['flow', 'platformer'] as const) {
      const run = matinesSlabs(mode)
      expect(run.map((p) => p.kind)).toEqual([
        'glass',
        'glass',
        'glass',
        'glass',
        'stone',
        'stone',
        'glass',
        'glass',
        'glass',
        'glass',
        'stone',
        'stone',
      ])
    }
  })

  it('compiles everything stone in rhythm mode', () => {
    const cs = compileLevel(FRERE, { mode: 'rhythm', groundMidi: G })
    expect(cs.platforms.every((p) => p.kind === 'stone')).toBe(true)
  })

  describe('the workshop verbs, per mode', () => {
    it('gives flow the beam and the atrium as zones', () => {
      const cs = flow(THE_GLASSWORKS)
      expect(cs.beams).toHaveLength(1)
      expect(cs.atriums).toHaveLength(1)
      const a = cs.atriums[0]
      expect(a.x1).toBeGreaterThan(a.x0)
      // the room offers the whole major scale over its tonic
      expect(a.scaleMidis).toHaveLength(
        JOURNEY_CONFIG.atrium.scaleDegrees.length,
      )
      expect(a.scaleMidis).toContain(a.tonicMidi)
      expect(cs.nodes.some((n) => n.t === 'beam')).toBe(true)
      expect(cs.nodes.some((n) => n.t === 'atrium')).toBe(true)
    })

    it('freezes the beam into a walkable bridge for the platformer', () => {
      const cs = plat(THE_GLASSWORKS)
      expect(cs.beams).toHaveLength(0)
      const beamNode = cs.nodes.find(
        (n) => n.t === 'land' && n.p.kind === 'stone' && n.p.x1 - n.p.x0 > 2,
      )
      expect(beamNode).toBeDefined()
    })

    it('drops the atrium outside flow — every other mode has a floor', () => {
      for (const mode of ['platformer', 'rhythm', 'listen'] as const) {
        const cs = compileLevel(THE_GLASSWORKS, { mode, groundMidi: G })
        expect(cs.atriums).toHaveLength(0)
        expect(cs.nodes.some((n) => n.t === 'atrium')).toBe(false)
      }
    })

    it('keeps the ring pane a pane in every sung mode', () => {
      for (const cs of [flow(THE_GLASSWORKS), plat(THE_GLASSWORKS)]) {
        expect(cs.panes.some((p) => p.kind === 'ring')).toBe(true)
      }
    })

    it('leaves no unchargeable pane where there is no microphone', () => {
      for (const mode of ['rhythm', 'listen'] as const) {
        const cs = compileLevel(THE_GLASSWORKS, { mode, groundMidi: G })
        expect(cs.panes).toHaveLength(0)
        expect(cs.beams).toHaveLength(0)
      }
    })
  })
})
