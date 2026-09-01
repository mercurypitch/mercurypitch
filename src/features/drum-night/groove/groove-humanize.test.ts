// ============================================================
// Groove humanizer tests — determinism, swing curve, clamps, noise shape
// ============================================================

import { describe, expect, it } from 'vitest'
import type { HumanizeInputEvent, HumanizeOptions } from './groove-humanize'
import { HUMANIZE_STYLE_PROFILES, humanizeDrumEvents, measuredProfileCell, suggestGhostSteps, swingRatioForTempo, swingShiftMs, } from './groove-humanize'

function options(overrides: Partial<HumanizeOptions> = {}): HumanizeOptions {
  return {
    style: 'rock',
    intensity: 0.6,
    seed: 42,
    tempoBpm: 120,
    ...overrides,
  }
}

function backbeatBar(bar: number): HumanizeInputEvent[] {
  const events: HumanizeInputEvent[] = []
  for (let step = 0; step < 16; step += 2) {
    events.push({ articulation: 'hh-closed', bar, step, velocity: 84 })
  }
  events.push({ articulation: 'kick', bar, step: 0, velocity: 112 })
  events.push({ articulation: 'kick', bar, step: 8, velocity: 108 })
  events.push({
    articulation: 'snare',
    bar,
    step: 4,
    velocity: 112,
    accent: true,
  })
  events.push({
    articulation: 'snare',
    bar,
    step: 12,
    velocity: 112,
    accent: true,
  })
  return events
}

describe('swingRatioForTempo', () => {
  it('follows the Friberg curve: 3.5 slow, 2.0 at 200, 1.0 at 300 BPM', () => {
    expect(swingRatioForTempo(100)).toBeCloseTo(3.5, 5)
    expect(swingRatioForTempo(200)).toBeCloseTo(2.0, 5)
    expect(swingRatioForTempo(300)).toBeCloseTo(1.0, 5)
    expect(swingRatioForTempo(30)).toBeCloseTo(3.5, 5)
    expect(swingRatioForTempo(400)).toBeCloseTo(1.0, 5)
  })
})

describe('swingShiftMs', () => {
  it('delays only subdivision off-beats, never early', () => {
    for (const step of [0, 4, 8, 12]) {
      expect(swingShiftMs('jazz', step, 160)).toBe(0)
      expect(swingShiftMs('funk', step, 100)).toBe(0)
    }
    expect(swingShiftMs('jazz', 2, 160)).toBeGreaterThan(0)
    expect(swingShiftMs('funk', 1, 100)).toBeGreaterThan(0)
    expect(swingShiftMs('funk', 3, 100)).toBeGreaterThan(0)
    expect(swingShiftMs('rock', 2, 120)).toBe(0)
    expect(swingShiftMs('electronic', 1, 120)).toBe(0)
  })

  it('matches the analytic jazz shift at 200 BPM', () => {
    // b = 300 ms, r = 2 => off-8th moves from 150 ms to 200 ms after the beat.
    expect(swingShiftMs('jazz', 2, 200)).toBeCloseTo(50, 3)
  })
})

describe('humanizeDrumEvents', () => {
  it('is deterministic for identical inputs', () => {
    const events = backbeatBar(0)
    const a = humanizeDrumEvents(events, options())
    const b = humanizeDrumEvents(events, options())
    expect(a).toEqual(b)
  })

  it('produces the same offsets for every loop pass when locked', () => {
    const early = humanizeDrumEvents(backbeatBar(0), options({ locked: true }))
    const late = humanizeDrumEvents(backbeatBar(5), options({ locked: true }))
    expect(late.map((event) => event.timeOffsetMs)).toEqual(
      early.map((event) => event.timeOffsetMs),
    )
    const freeEarly = humanizeDrumEvents(backbeatBar(0), options())
    const freeLate = humanizeDrumEvents(backbeatBar(5), options())
    expect(freeLate.map((event) => event.timeOffsetMs)).not.toEqual(
      freeEarly.map((event) => event.timeOffsetMs),
    )
  })

  it('locks flam decisions and grace-note timing across loop passes', () => {
    const accentedSnare = (bar: number): HumanizeInputEvent[] => [
      {
        articulation: 'snare',
        bar,
        step: 4,
        velocity: 112,
        accent: true,
      },
    ]
    let seedWithFlam: number | null = null
    for (let seed = 1; seed <= 500; seed += 1) {
      const [event] = humanizeDrumEvents(
        accentedSnare(0),
        options({ style: 'jazz', intensity: 1, locked: true, seed }),
      )
      if ((event?.ornaments.length ?? 0) > 0) {
        seedWithFlam = seed
        break
      }
    }

    expect(seedWithFlam).not.toBeNull()
    const firstLap = humanizeDrumEvents(
      accentedSnare(0),
      options({
        style: 'jazz',
        intensity: 1,
        locked: true,
        seed: seedWithFlam!,
      }),
    )
    const laterLap = humanizeDrumEvents(
      accentedSnare(7),
      options({
        style: 'jazz',
        intensity: 1,
        locked: true,
        seed: seedWithFlam!,
      }),
    )
    expect(laterLap).toEqual(firstLap)
  })

  it('respects the asymmetric style clamps plus swing', () => {
    const profile = HUMANIZE_STYLE_PROFILES.funk
    for (let seed = 1; seed <= 20; seed += 1) {
      const humanized = humanizeDrumEvents(
        backbeatBar(seed),
        options({ style: 'funk', intensity: 1, seed }),
      )
      humanized.forEach((event, index) => {
        const source = backbeatBar(seed)[index]
        const swing = swingShiftMs('funk', source.step, 120)
        expect(event.timeOffsetMs - swing).toBeGreaterThanOrEqual(
          -profile.earlyCapMs - 1e-9,
        )
        expect(event.timeOffsetMs - swing).toBeLessThanOrEqual(
          profile.lateCapMs + 1e-9,
        )
      })
    }
  })

  it('reduces to pure swing at intensity zero', () => {
    const humanized = humanizeDrumEvents(
      backbeatBar(0),
      options({ style: 'jazz', intensity: 0, tempoBpm: 160 }),
    )
    humanized.forEach((event, index) => {
      const source = backbeatBar(0)[index]
      expect(event.timeOffsetMs).toBeCloseTo(
        swingShiftMs('jazz', source.step, 160),
        6,
      )
      expect(event.velocity).toBe(source.velocity)
      expect(event.ornaments).toEqual([])
    })
  })

  it('keeps electronic style within machine tightness', () => {
    const humanized = humanizeDrumEvents(
      backbeatBar(3),
      options({ style: 'electronic', intensity: 1, seed: 9 }),
    )
    for (const event of humanized) {
      expect(Math.abs(event.timeOffsetMs)).toBeLessThanOrEqual(3)
      expect(event.ornaments).toEqual([])
    }
  })

  it('bounds velocities to 1..127 and varies them with intensity', () => {
    const loud = backbeatBar(0).map((event) => ({ ...event, velocity: 126 }))
    const humanized = humanizeDrumEvents(loud, options({ intensity: 1 }))
    let varied = false
    for (const [index, event] of humanized.entries()) {
      expect(event.velocity).toBeGreaterThanOrEqual(1)
      expect(event.velocity).toBeLessThanOrEqual(127)
      if (event.velocity !== loud[index].velocity) varied = true
    }
    expect(varied).toBe(true)
  })

  it('adds flams only on accented snares, with bounded early grace notes', () => {
    let flams = 0
    for (let seed = 1; seed <= 120; seed += 1) {
      const humanized = humanizeDrumEvents(
        backbeatBar(0),
        options({ style: 'jazz', intensity: 1, seed }),
      )
      for (const [index, event] of humanized.entries()) {
        const source = backbeatBar(0)[index]
        if (event.ornaments.length > 0) {
          flams += event.ornaments.length
          expect(source.articulation).toBe('snare')
          expect(source.accent).toBe(true)
          for (const ornament of event.ornaments) {
            expect(ornament.kind).toBe('flam')
            expect(ornament.leadMs).toBeGreaterThanOrEqual(15)
            expect(ornament.leadMs).toBeLessThanOrEqual(35)
            expect(ornament.velocity).toBeLessThan(event.velocity)
          }
        }
      }
    }
    expect(flams).toBeGreaterThan(0)
  })

  it('shapes timing noise with positive short-lag correlation (pink, not white)', () => {
    const events: HumanizeInputEvent[] = []
    for (let bar = 0; bar < 32; bar += 1) {
      for (let step = 0; step < 16; step += 1) {
        events.push({ articulation: 'hh-closed', bar, step, velocity: 84 })
      }
    }
    const humanized = humanizeDrumEvents(
      events,
      options({ style: 'jazz', intensity: 1, tempoBpm: 500 }),
    )
    // At 500 BPM jazz swing collapses to zero shift, isolating the noise.
    const series = humanized.map((event) => event.timeOffsetMs)
    const mean = series.reduce((sum, value) => sum + value, 0) / series.length
    const centered = series.map((value) => value - mean)
    const variance =
      centered.reduce((sum, value) => sum + value * value, 0) / centered.length
    const lagCorrelation = (lag: number) => {
      let sum = 0
      for (let index = 0; index + lag < centered.length; index += 1) {
        sum += centered[index] * centered[index + lag]
      }
      return sum / (centered.length - lag) / variance
    }
    expect(lagCorrelation(1)).toBeGreaterThan(0.25)
    expect(lagCorrelation(1)).toBeGreaterThan(lagCorrelation(64))
  })
})

describe('suggestGhostSteps', () => {
  it('proposes snare ghosts only on free sixteenths, deterministically', () => {
    const occupied = new Set([0, 4, 8, 12])
    const first = suggestGhostSteps(
      occupied,
      0,
      options({ style: 'funk', intensity: 1 }),
    )
    const second = suggestGhostSteps(
      occupied,
      0,
      options({ style: 'funk', intensity: 1 }),
    )
    expect(first).toEqual(second)
    for (const ghost of first) {
      expect(occupied.has(ghost.step)).toBe(false)
      expect(ghost.velocity).toBeGreaterThanOrEqual(15)
      expect(ghost.velocity).toBeLessThanOrEqual(40)
    }
    expect(
      suggestGhostSteps(
        occupied,
        0,
        options({ style: 'electronic', intensity: 1 }),
      ),
    ).toEqual([])
  })

  it('produces ghosts at funk rates over many bars', () => {
    const occupied = new Set([0, 4, 8, 12])
    let total = 0
    for (let bar = 0; bar < 60; bar += 1) {
      total += suggestGhostSteps(
        occupied,
        bar,
        options({ style: 'funk', intensity: 1 }),
      ).length
    }
    expect(total).toBeGreaterThan(30)
  })
})

describe('measured Groove MIDI profiles', () => {
  it('exposes cells for sampled articulations and nothing for unmeasured ones', () => {
    const rockHat = measuredProfileCell('rock', 'hh-closed', 1)
    expect(rockHat).not.toBeNull()
    expect(rockHat?.offSdScale).toBeGreaterThan(0)
    expect(rockHat?.velScale).toBeGreaterThan(0)
    // The dataset has no clap, and electronic is hand-authored on purpose.
    expect(measuredProfileCell('rock', 'clap', 0)).toBeNull()
    expect(measuredProfileCell('electronic', 'hh-closed', 0)).toBeNull()
  })

  it('keeps every measured mean inside the bound', () => {
    const styles = ['rock', 'funk', 'jazz', 'latin'] as const
    const articulations = ['kick', 'snare', 'hh-closed', 'ride'] as const
    for (const style of styles) {
      for (const articulation of articulations) {
        for (let step = 0; step < 16; step += 1) {
          const cell = measuredProfileCell(style, articulation, step)
          if (cell === null) continue
          expect(Math.abs(cell.offMeanMs)).toBeLessThanOrEqual(12)
          expect(cell.offSdScale).toBeGreaterThanOrEqual(0.4)
          expect(cell.offSdScale).toBeLessThanOrEqual(2)
        }
      }
    }
  })

  it('pushes positions the dataset plays late later than ones it plays early', () => {
    const late = measuredProfileCell('rock', 'hh-closed', 1)
    const early = measuredProfileCell('rock', 'hh-closed', 3)
    expect(late).not.toBeNull()
    expect(early).not.toBeNull()
    expect((late as { offMeanMs: number }).offMeanMs).toBeGreaterThan(
      (early as { offMeanMs: number }).offMeanMs,
    )

    const meanOffsetAtStep = (step: number): number => {
      let total = 0
      const seeds = 200
      for (let seed = 1; seed <= seeds; seed += 1) {
        const [event] = humanizeDrumEvents(
          [{ articulation: 'hh-closed', bar: 0, step, velocity: 84 }],
          options({ intensity: 1, seed }),
        )
        total += event.timeOffsetMs
      }
      return total / seeds
    }
    expect(meanOffsetAtStep(1)).toBeGreaterThan(meanOffsetAtStep(3))
  })

  it('nudges authored velocity toward the measured accent without taking over', () => {
    const authored = 100
    for (let seed = 1; seed <= 40; seed += 1) {
      const [event] = humanizeDrumEvents(
        [{ articulation: 'snare', bar: 0, step: 1, velocity: authored }],
        options({ style: 'rock', intensity: 1, seed }),
      )
      // 25 accent nudge + velocity noise; intent survives either way.
      expect(Math.abs(event.velocity - authored)).toBeLessThanOrEqual(60)
    }
  })

  it('takes ghost and flam rates from the dataset when it measured them', () => {
    const occupied = new Set([0, 4, 8, 12])
    let ghosts = 0
    for (let bar = 0; bar < 200; bar += 1) {
      ghosts += suggestGhostSteps(
        occupied,
        bar,
        options({ style: 'rock', intensity: 1 }),
      ).length
    }
    // Measured rock ghost rate is ~0.10 per eligible sixteenth.
    const perBar = ghosts / 200
    expect(perBar).toBeGreaterThan(0.4)
    expect(perBar).toBeLessThan(2.5)
  })
})
