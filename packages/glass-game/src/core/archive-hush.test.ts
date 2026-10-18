// Archive Hush tests — protection requires fresh capture; only authored rings challenge it.
import { describe, expect, it } from 'vitest'
import type { PitchObservation } from '../contracts'
import type { ArchiveHush } from './archive-hush'
import { createArchiveHush } from './archive-hush'

const IDS = ['diadem', 'carafe', 'lotus']
const TARGET = 57

function create() {
  return createArchiveHush({ vesselIds: IDS, targetMidi: TARGET })
}

function frame(
  ms: number,
  overrides: Partial<PitchObservation> = {},
): PitchObservation {
  return {
    sequence: ms,
    captureSeconds: ms / 1000,
    capturedAtMs: ms,
    midi: TARGET,
    confidence: 0.95,
    ...overrides,
  }
}

function observe(
  model: ArchiveHush,
  ms: number,
  overrides: Partial<PitchObservation> = {},
) {
  model.observe(frame(ms, overrides), ms)
}

function hold(model: ArchiveHush, start: number, duration = 1000) {
  for (let ms = start; ms <= start + duration; ms += 50) observe(model, ms)
}

function advance(model: ArchiveHush, start: number, duration: number) {
  for (let ms = start + 50; ms <= start + duration; ms += 50) {
    observe(model, ms, { midi: null })
    model.tick(ms, true)
  }
}

describe('Archive Hush protection', () => {
  it('waits for an explicit ring regardless of time or ambient pitch', () => {
    const model = create()
    advance(model, 0, 60_000)
    expect(model.snapshot()).toMatchObject({
      phase: 'preparing',
      missedIds: [],
      protectedIds: [],
      telegraphRemainingSeconds: 3,
      coveredId: 'lotus',
    })
  })

  it('protects the aimed display only after a full second of consecutive capture', () => {
    const model = create()
    hold(model, 0, 950)
    expect(model.snapshot().holdProgress).toBeCloseTo(0.95)
    expect(model.snapshot().protectedIds).toEqual([])
    observe(model, 1000)
    expect(model.snapshot().protectedIds).toEqual(['diadem'])
    expect(model.snapshot().holdProgress).toBe(0)
  })

  it('requires two hum shields and the cover for one successful authored chime', () => {
    const model = create()
    hold(model, 0)
    model.aim('carafe')
    hold(model, 1050)
    expect(model.ring(2050)).toBe(true)
    advance(model, 2050, 2950)
    expect(model.snapshot().phase).toBe('telegraph')
    advance(model, 5000, 50)
    expect(model.snapshot()).toMatchObject({
      phase: 'complete',
      missedIds: [],
      protectedIds: ['diadem', 'carafe'],
      coveredId: 'lotus',
    })
    expect(model.ring(5050)).toBe(false)
    advance(model, 5050, 10_000)
    expect(model.snapshot().phase).toBe('complete')
  })

  it('never replaces a required cover with a third hum shield', () => {
    const model = create()
    model.moveCover(null)
    hold(model, 0)
    model.aim('carafe')
    hold(model, 1050)
    model.aim('lotus')
    hold(model, 2100, 2000)
    expect(model.snapshot().protectedIds).toEqual(['diadem', 'carafe'])
    expect(model.ring(4100)).toBe(true)
    advance(model, 4100, 3000)
    expect(model.snapshot()).toMatchObject({
      phase: 'retry',
      missedIds: ['lotus'],
    })
  })

  it('locks the cover position at the ring and never transfers an earned shield', () => {
    const model = create()
    hold(model, 0)
    model.aim('carafe')
    hold(model, 1050)
    model.ring(2050)
    advance(model, 2050, 2500)
    model.moveCover('diadem')
    advance(model, 4550, 500)
    expect(model.snapshot()).toMatchObject({
      phase: 'complete',
      missedIds: [],
      coveredId: 'lotus',
      protectedIds: ['diadem', 'carafe'],
    })
  })

  it('does not collect hum protection on the covered display', () => {
    const model = create()
    model.aim('lotus')
    hold(model, 0, 2000)
    expect(model.snapshot()).toMatchObject({
      protectedIds: [],
      holdProgress: 0,
    })
    model.moveCover('carafe')
    hold(model, 2050)
    expect(model.snapshot().protectedIds).toEqual(['lotus'])
  })

  it('discards partial hold when aim changes, the cover moves or calibration changes', () => {
    const model = create()
    hold(model, 0, 600)
    model.aim('carafe')
    expect(model.snapshot().holdProgress).toBe(0)
    hold(model, 650, 600)
    model.moveCover('diadem')
    expect(model.snapshot().holdProgress).toBe(0)
    hold(model, 1300, 600)
    model.setTargetMidi(60)
    expect(model.snapshot().holdProgress).toBe(0)
    hold(model, 1950, 1200)
    expect(model.snapshot().protectedIds).toEqual([])
    for (let ms = 3200; ms <= 4200; ms += 50) observe(model, ms, { midi: 60 })
    expect(model.snapshot().protectedIds).toEqual(['carafe'])
    model.setTargetMidi(62)
    expect(model.snapshot().protectedIds).toEqual(['carafe'])
  })

  it.each([
    ['silence', { midi: null }],
    ['off-target pitch', { midi: TARGET + 1 }],
    ['low confidence', { confidence: 0.79 }],
    ['nonfinite confidence', { confidence: NaN }],
    ['nonfinite pitch', { midi: NaN }],
  ])(
    'gives no credit to %s and requires a new consecutive hold',
    (_reason, invalid) => {
      const model = create()
      hold(model, 0, 600)
      observe(model, 650, invalid)
      expect(model.snapshot().holdProgress).toBe(0)
      hold(model, 700, 950)
      expect(model.snapshot().protectedIds).toEqual([])
      observe(model, 1700)
      expect(model.snapshot().protectedIds).toEqual(['diadem'])
    },
  )

  it('rejects repeated or out-of-order capture even when receipt time advances', () => {
    const model = create()
    hold(model, 0, 500)
    for (let ms = 550; ms <= 1550; ms += 50) {
      model.observe(frame(500), ms)
      model.observe(frame(450), ms)
    }
    expect(model.snapshot().protectedIds).toEqual([])
    observe(model, 1600)
    expect(model.snapshot().holdProgress).toBe(0)
    hold(model, 1650, 900)
    expect(model.snapshot().protectedIds).toEqual([])
    observe(model, 2600)
    expect(model.snapshot().protectedIds).toEqual(['diadem'])
  })

  it('rejects stale observations and gaps rather than awarding their elapsed time', () => {
    const model = create()
    hold(model, 0, 500)
    model.observe(frame(550), 800)
    expect(model.snapshot()).toMatchObject({
      holdProgress: 0,
      captureReady: false,
    })
    observe(model, 850)
    expect(model.snapshot().holdProgress).toBe(0)
    hold(model, 900, 950)
    expect(model.snapshot().protectedIds).toEqual(['diadem'])
  })

  it('does not let the audio clock manufacture credit beyond the mapped capture clock', () => {
    const model = create()
    for (let index = 0; index <= 10; index++) {
      observe(model, index * 10, { captureSeconds: index * 0.1 })
    }
    expect(model.snapshot().holdProgress).toBeCloseTo(0.1)
    expect(model.snapshot().protectedIds).toEqual([])
  })

  it('rejects a future clock without preventing later legitimate capture', () => {
    const model = create()
    hold(model, 0, 500)
    model.observe(frame(50_000), 550)
    expect(model.snapshot()).toMatchObject({
      holdProgress: 0,
      captureReady: false,
    })
    hold(model, 600)
    expect(model.snapshot().protectedIds).toEqual(['diadem'])
  })

  it('rejects backwards receipt clocks and malformed sequence without earning protection', () => {
    const model = create()
    hold(model, 0, 500)
    model.observe(frame(550), 499)
    model.observe(frame(550, { sequence: NaN }), 550)
    model.observe(frame(550, { sequence: 1.5 }), 550)
    model.observe(frame(550, { captureSeconds: Infinity }), 550)
    expect(model.snapshot().holdProgress).toBeCloseTo(0.5)
    expect(model.ring(499)).toBe(false)
    expect(model.snapshot().protectedIds).toEqual([])
  })

  it('rejects app-audio captures through the fence and starts a fresh hold afterward', () => {
    const model = create()
    hold(model, 0, 600)
    model.fenceAudio(1800)
    model.fenceAudio(700)
    hold(model, 650, 1150)
    expect(model.snapshot()).toMatchObject({
      protectedIds: [],
      holdProgress: 0,
    })
    hold(model, 1850, 950)
    expect(model.snapshot().protectedIds).toEqual([])
    observe(model, 2850)
    expect(model.snapshot().protectedIds).toEqual(['diadem'])
  })

  it('rejects ring without a fresh live capture but does not require continuous pitch', () => {
    const model = create()
    expect(model.ring(0)).toBe(false)
    observe(model, 10, { midi: null })
    expect(model.ring(200)).toBe(false)
    observe(model, 210, { midi: null })
    expect(model.ring(210)).toBe(true)
    advance(model, 210, 3000)
    expect(model.snapshot()).toMatchObject({
      phase: 'retry',
      missedIds: ['diadem', 'carafe'],
    })
  })

  it.each(['dead capture', 'stale capture', '500ms frame stall'])(
    'pauses on %s and restarts a complete telegraph after fresh resume',
    (reason) => {
      const model = create()
      hold(model, 0)
      model.ring(1000)
      advance(model, 1000, 500)
      if (reason === 'dead capture') model.tick(1550, false)
      if (reason === 'stale capture') model.tick(1700, true)
      if (reason === '500ms frame stall') {
        observe(model, 2000, { midi: null })
        model.tick(2000, true)
      }
      expect(model.snapshot()).toMatchObject({
        phase: 'paused',
        protectedIds: ['diadem'],
        holdProgress: 0,
        pausedFrom: 'telegraph',
        telegraphRemainingSeconds: 3,
      })
      model.tick(10_000, true)
      expect(model.snapshot().phase).toBe('paused')
      model.resume(10_000)
      model.observe(frame(9999), 10_000)
      model.tick(10_100, false)
      expect(model.snapshot()).toMatchObject({
        phase: 'telegraph',
        captureReady: false,
        telegraphRemainingSeconds: 3,
      })
      observe(model, 10_200, { sequence: 0, captureSeconds: 0, midi: null })
      model.tick(10_200, true)
      expect(model.snapshot().telegraphRemainingSeconds).toBe(3)
      advance(model, 10_200, 3000)
      expect(model.snapshot()).toMatchObject({
        phase: 'retry',
        missedIds: ['carafe'],
      })
    },
  )

  it('keeps earned protection but discards partial humming across a deliberate pause', () => {
    const model = create()
    hold(model, 0)
    model.aim('carafe')
    hold(model, 1050, 500)
    model.pause()
    hold(model, 1600, 2000)
    expect(model.snapshot()).toMatchObject({
      phase: 'paused',
      protectedIds: ['diadem'],
      holdProgress: 0,
    })
    model.resume(4000)
    hold(model, 4050, 950)
    expect(model.snapshot().protectedIds).toEqual(['diadem'])
    observe(model, 5050)
    expect(model.snapshot().protectedIds).toEqual(['diadem', 'carafe'])
  })

  it('resets only this room attempt and returns defensive serializable snapshots', () => {
    const model = create()
    hold(model, 0)
    const leaked = model.snapshot()
    leaked.protectedIds.push('carafe')
    leaked.missedIds.push('lotus')
    expect(model.snapshot().protectedIds).toEqual(['diadem'])
    model.reset(2000)
    expect(JSON.parse(JSON.stringify(model.snapshot()))).toEqual({
      phase: 'preparing',
      aimedId: 'diadem',
      coveredId: 'lotus',
      curtainVesselIds: [],
      curtainClosed: false,
      protectedIds: [],
      holdProgress: 0,
      telegraphRemainingSeconds: 3,
      missedIds: [],
      attempt: 2,
      pausedFrom: null,
      captureReady: false,
    })
  })

  it('rejects old captures after a reset without an explicit clock argument', () => {
    const model = create()
    hold(model, 0)
    model.reset()
    model.observe(frame(1000), 1100)
    expect(model.snapshot()).toMatchObject({
      captureReady: false,
      protectedIds: [],
    })
    hold(model, 1150)
    expect(model.snapshot().protectedIds).toEqual(['diadem'])
  })

  it('ignores unknown control targets without clearing useful progress', () => {
    const model = create()
    hold(model, 0, 500)
    model.aim('unknown')
    model.moveCover('unknown')
    model.setTargetMidi(NaN)
    model.setTargetMidi(200)
    expect(model.snapshot()).toMatchObject({
      aimedId: 'diadem',
      coveredId: 'lotus',
    })
    expect(model.snapshot().holdProgress).toBeCloseTo(0.5)
  })

  it('rejects unusable content before a room can start', () => {
    expect(() =>
      createArchiveHush({ vesselIds: ['a', 'a', 'b'], targetMidi: 57 }),
    ).toThrow()
    expect(() =>
      createArchiveHush({ vesselIds: IDS, targetMidi: NaN }),
    ).toThrow()
    expect(() =>
      createArchiveHush({ vesselIds: IDS, targetMidi: 57, holdSeconds: 0 }),
    ).toThrow()
    expect(() =>
      createArchiveHush({
        vesselIds: IDS,
        targetMidi: 57,
        telegraphSeconds: Infinity,
      }),
    ).toThrow()
  })
})

describe('Archive Hush room curtains', () => {
  const displays = ['diadem', 'carafe', 'bell', 'vase', 'lotus']
  const makeRoom = (count: number) =>
    createArchiveHush({
      vesselIds: displays.slice(0, count),
      curtainVesselIds: displays.slice(2, count - 1),
      targetMidi: TARGET,
    })

  it.each([3, 4, 5])(
    'protects all %s displays with two hums, one cover and the authored curtain',
    (count) => {
      const model = makeRoom(count)
      hold(model, 0)
      model.aim('carafe')
      hold(model, 1050)
      model.setCurtainClosed(true)
      expect(model.snapshot().coveredId).toBe(displays[count - 1])
      expect(model.snapshot().protectedIds).toEqual(['diadem', 'carafe'])
      expect(model.ring(2050)).toBe(true)
      advance(model, 2050, 3000)
      expect(model.snapshot()).toMatchObject({
        phase: 'complete',
        missedIds: [],
      })
    },
  )

  it.each([4, 5])(
    'requires closing the curtain to protect the remaining displays in a %s-display room',
    (count) => {
      const model = makeRoom(count)
      hold(model, 0)
      model.aim('carafe')
      hold(model, 1050)
      model.aim('bell')
      hold(model, 2100, 2000)
      expect(model.snapshot().protectedIds).toEqual(['diadem', 'carafe'])
      model.ring(4100)
      advance(model, 4100, 3000)
      expect(model.snapshot()).toMatchObject({
        phase: 'retry',
        missedIds: displays.slice(2, count - 1),
      })
    },
  )

  it('requires the cover even when the two hum shields and curtain are ready', () => {
    const model = makeRoom(5)
    model.moveCover('bell')
    model.setCurtainClosed(true)
    hold(model, 0)
    model.aim('carafe')
    hold(model, 1050)
    model.ring(2050)
    advance(model, 2050, 3000)
    expect(model.snapshot()).toMatchObject({
      phase: 'retry',
      missedIds: ['lotus'],
    })
  })

  it('locks curtain controls during a chime and interruption, restarting the full telegraph', () => {
    const model = makeRoom(5)
    model.setCurtainClosed(true)
    hold(model, 0)
    model.aim('carafe')
    hold(model, 1050)
    model.ring(2050)
    model.setCurtainClosed(false)
    expect(model.snapshot().curtainClosed).toBe(true)
    advance(model, 2050, 500)
    model.pause()
    model.setCurtainClosed(false)
    expect(model.snapshot()).toMatchObject({
      curtainClosed: true,
      telegraphRemainingSeconds: 3,
    })
    model.resume(4000)
    observe(model, 4050, { midi: null })
    model.tick(4050, true)
    advance(model, 4050, 3000)
    expect(model.snapshot().phase).toBe('complete')
  })

  it('does not spend a hum shield on a closed-curtain display, and clears partial hold when the curtain moves', () => {
    const model = makeRoom(5)
    model.aim('bell')
    hold(model, 0, 600)
    model.setCurtainClosed(true)
    expect(model.snapshot().holdProgress).toBe(0)
    hold(model, 650, 2000)
    expect(model.snapshot().protectedIds).toEqual([])
    model.setCurtainClosed(false)
    hold(model, 2700)
    expect(model.snapshot().protectedIds).toEqual(['bell'])
    model.setCurtainClosed(true)
    expect(model.snapshot().protectedIds).toEqual(['bell'])
  })

  it('restores the room cover and opens the curtain on reset without leaking snapshot arrays', () => {
    const source = ['bell', 'vase']
    const model = createArchiveHush({
      vesselIds: displays,
      curtainVesselIds: source,
      targetMidi: TARGET,
    })
    source.pop()
    model.snapshot().curtainVesselIds.length = 0
    model.setCurtainClosed(true)
    model.moveCover('diadem')
    model.reset(1000)
    expect(model.snapshot()).toMatchObject({
      curtainVesselIds: ['bell', 'vase'],
      curtainClosed: false,
      coveredId: 'lotus',
      protectedIds: [],
      attempt: 2,
    })
  })

  it('rejects excess, duplicate and foreign curtain displays and unsupported room sizes', () => {
    for (const curtainVesselIds of [
      ['bell', 'bell'],
      ['missing'],
      ['diadem', 'carafe', 'bell'],
    ])
      expect(() =>
        createArchiveHush({
          vesselIds: displays,
          curtainVesselIds,
          targetMidi: TARGET,
        }),
      ).toThrow()
    for (const vesselIds of [displays.slice(0, 2), [...displays, 'sixth']])
      expect(() =>
        createArchiveHush({ vesselIds, targetMidi: TARGET }),
      ).toThrow()
  })
})
