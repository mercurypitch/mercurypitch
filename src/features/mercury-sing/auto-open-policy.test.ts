import { describe, expect, it } from 'vitest'
import type { ScoredCandidate } from './auto-open-policy'
import { AUTO_OPEN_DEFAULTS, createAutoOpenPolicy } from './auto-open-policy'

// Small round numbers so every sequence reads at a glance.
const OPTS = {
  openThreshold: 0.9,
  minMargin: 0.1,
  sustainMs: 1000,
  minMaterialMs: 3000,
  lapseGraceMs: 200,
}

const one = (score: number): ScoredCandidate[] => [{ id: 'song-a', score }]

const duel = (a: number, b: number): ScoredCandidate[] => [
  { id: 'song-a', score: a },
  { id: 'song-b', score: b },
]

describe('createAutoOpenPolicy', () => {
  it('documents the shipped defaults', () => {
    expect(AUTO_OPEN_DEFAULTS).toEqual({
      openThreshold: 0.8,
      minMargin: 0.1,
      sustainMs: 2000,
      minMaterialMs: 6000,
      lapseGraceMs: 400,
    })
  })

  it('never opens before the minimum material, however perfect the score', () => {
    const policy = createAutoOpenPolicy(OPTS)
    for (let t = 0; t < 3000; t += 250) {
      expect(policy.report(t, one(0.99)).kind).not.toBe('open')
    }
    // Sustain was accumulated during the warm-up, so the first tick at the
    // material gate opens immediately — the band arrives on time, not late.
    const at = policy.report(3000, one(0.99))
    expect(at.kind).toBe('open')
    expect(at.leaderId).toBe('song-a')
  })

  it('requires the full sustain window once material is satisfied', () => {
    const policy = createAutoOpenPolicy(OPTS)
    expect(policy.report(5000, one(0.95)).kind).toBe('arming')
    expect(policy.report(5500, one(0.95)).kind).toBe('arming')
    expect(policy.report(6000, one(0.95)).kind).toBe('open')
  })

  it('a single hot tick does not open', () => {
    const policy = createAutoOpenPolicy(OPTS)
    const snap = policy.report(10_000, one(0.99))
    expect(snap.kind).toBe('arming')
    expect(snap.armedFraction).toBe(0)
  })

  it('a photo finish never arms — the margin must be clear', () => {
    const policy = createAutoOpenPolicy(OPTS)
    expect(policy.report(5000, duel(0.97, 0.93)).kind).toBe('listening')
    expect(policy.report(5500, duel(0.97, 0.93)).kind).toBe('listening')
    // The runner-up falling away lets the leader start its clock — fresh.
    const armed = policy.report(6000, duel(0.97, 0.6))
    expect(armed.kind).toBe('arming')
    expect(armed.armedFraction).toBe(0)
  })

  it('accepts a score exactly at the threshold', () => {
    const policy = createAutoOpenPolicy(OPTS)
    expect(policy.report(5000, one(0.9)).kind).toBe('arming')
  })

  it('a leader change resets the sustain clock immediately', () => {
    const policy = createAutoOpenPolicy(OPTS)
    policy.report(5000, duel(0.95, 0.5))
    policy.report(5600, duel(0.95, 0.5))
    const swapped = policy.report(5800, [
      { id: 'song-a', score: 0.7 },
      { id: 'song-b', score: 0.96 },
    ])
    expect(swapped.kind).toBe('arming')
    expect(swapped.leaderId).toBe('song-b')
    expect(swapped.armedFraction).toBe(0)
    // The old leader coming back also starts from zero.
    const back = policy.report(6000, duel(0.95, 0.5))
    expect(back.leaderId).toBe('song-a')
    expect(back.armedFraction).toBe(0)
  })

  it('forgives a dip shorter than the grace window', () => {
    const policy = createAutoOpenPolicy(OPTS)
    policy.report(5000, one(0.95))
    policy.report(5400, one(0.95))
    expect(policy.report(5500, one(0.5)).kind).toBe('arming')
    expect(policy.report(5600, one(0.95)).kind).toBe('arming')
    // armedSince stayed at 5000 — the dip cost nothing.
    expect(policy.report(6000, one(0.95)).kind).toBe('open')
  })

  it('a lapse longer than the grace window disarms', () => {
    const policy = createAutoOpenPolicy(OPTS)
    policy.report(5000, one(0.95))
    policy.report(5500, one(0.5))
    expect(policy.report(5800, one(0.5)).kind).toBe('listening')
    const rearmed = policy.report(5900, one(0.95))
    expect(rearmed.kind).toBe('arming')
    expect(rearmed.armedFraction).toBe(0)
  })

  it('never opens on a grace-lapse tick, even with sustain and material met', () => {
    const policy = createAutoOpenPolicy(OPTS)
    policy.report(5000, one(0.95))
    policy.report(5900, one(0.95))
    // Sustain completes during a dip: hold the open until quality returns.
    expect(policy.report(6050, one(0.5)).kind).toBe('arming')
    expect(policy.report(6100, one(0.95)).kind).toBe('open')
  })

  it('opens exactly once, then stays latched forever', () => {
    const policy = createAutoOpenPolicy(OPTS)
    policy.report(5000, one(0.95))
    expect(policy.report(6000, one(0.95)).kind).toBe('open')
    const after = policy.report(6100, one(0.99))
    expect(after.kind).toBe('opened')
    expect(after.leaderId).toBe('song-a')
    // Even a stronger different candidate cannot reopen.
    const usurper = policy.report(9000, [{ id: 'song-b', score: 1 }])
    expect(usurper.kind).toBe('opened')
    expect(usurper.leaderId).toBe('song-a')
  })

  it('treats an empty candidate list as a lapse, then disarms', () => {
    const policy = createAutoOpenPolicy(OPTS)
    expect(policy.report(0, []).kind).toBe('listening')
    policy.report(5000, one(0.95))
    expect(policy.report(5500, []).kind).toBe('arming')
    expect(policy.report(5800, []).kind).toBe('listening')
  })

  it('sorts the input itself', () => {
    const policy = createAutoOpenPolicy(OPTS)
    const snap = policy.report(5000, [
      { id: 'weak', score: 0.3 },
      { id: 'strong', score: 0.95 },
    ])
    expect(snap.kind).toBe('arming')
    expect(snap.leaderId).toBe('strong')
  })

  it('fills armedFraction monotonically during a clean hold', () => {
    const policy = createAutoOpenPolicy(OPTS)
    expect(policy.report(5000, one(0.95)).armedFraction).toBe(0)
    expect(policy.report(5500, one(0.95)).armedFraction).toBe(0.5)
    expect(policy.report(6000, one(0.95)).armedFraction).toBe(1)
  })

  it('survives a realistic noisy session with exactly one, correct, open', () => {
    const policy = createAutoOpenPolicy(OPTS)
    // The singer warms up, the matcher wobbles, a rival briefly spikes,
    // then the true song locks in.
    const ticks: [number, ScoredCandidate[]][] = [
      [250, []],
      [500, duel(0.4, 0.35)],
      [1000, duel(0.6, 0.5)],
      [1500, duel(0.85, 0.5)],
      [2000, duel(0.92, 0.87)], // margin too thin — must not arm
      [2500, duel(0.93, 0.6)],
      [3000, duel(0.94, 0.6)],
      [3250, duel(0.5, 0.45)], // decode hiccup inside grace
      [3400, duel(0.95, 0.6)],
      [3900, duel(0.96, 0.6)],
      [4400, duel(0.96, 0.6)],
    ]
    const opens: string[] = []
    for (const [t, candidates] of ticks) {
      const snap = policy.report(t, candidates)
      if (snap.kind === 'open' && snap.leaderId !== null) {
        opens.push(snap.leaderId)
      }
    }
    expect(opens).toEqual(['song-a'])
  })

  it('a qualifying NEW leader mid-grace starts from zero, not the old clock', () => {
    const policy = createAutoOpenPolicy(OPTS)
    policy.report(5000, duel(0.95, 0.5))
    policy.report(5600, duel(0.95, 0.5)) // song-a held 600ms
    policy.report(5700, duel(0.5, 0.45)) // dip — grace window running
    // Inside the grace, song-b arrives qualifying. It must inherit NOTHING.
    const swapped = policy.report(5800, [
      { id: 'song-a', score: 0.6 },
      { id: 'song-b', score: 0.97 },
    ])
    expect(swapped.kind).toBe('arming')
    expect(swapped.leaderId).toBe('song-b')
    expect(swapped.armedFraction).toBe(0)
    // And 600ms later it is at 600/1000 of ITS OWN clock, not open.
    const later = policy.report(6400, [
      { id: 'song-a', score: 0.6 },
      { id: 'song-b', score: 0.97 },
    ])
    expect(later.kind).toBe('arming')
    expect(later.armedFraction).toBeCloseTo(0.6)
  })

  describe('interrupt — the speech-freeze seam', () => {
    it('drops arming: a frozen span cannot count as held evidence', () => {
      const policy = createAutoOpenPolicy(OPTS)
      policy.report(5000, one(0.95))
      expect(policy.report(5500, one(0.95)).armedFraction).toBe(0.5)
      // The engine freezes ranking for a spoken command and tells us.
      expect(policy.interrupt().kind).toBe('listening')
      // Reports resume 4s later — without the interrupt, nowMs deltas
      // would credit those 4 silent seconds and this tick would OPEN.
      const resumed = policy.report(9500, one(0.95))
      expect(resumed.kind).toBe('arming')
      expect(resumed.armedFraction).toBe(0)
      // The full sustain must be re-measured from here.
      expect(policy.report(10_000, one(0.95)).armedFraction).toBe(0.5)
      expect(policy.report(10_500, one(0.95)).kind).toBe('open')
    })

    it('keeps the one-open latch: interrupt after open never re-arms', () => {
      const policy = createAutoOpenPolicy(OPTS)
      policy.report(5000, one(0.95))
      expect(policy.report(6000, one(0.95)).kind).toBe('open')
      expect(policy.interrupt().kind).toBe('opened')
      expect(policy.report(9000, one(0.99)).kind).toBe('opened')
    })

    it('is a no-op while merely listening, and idempotent', () => {
      const policy = createAutoOpenPolicy(OPTS)
      expect(policy.interrupt().kind).toBe('listening')
      expect(policy.interrupt().kind).toBe('listening')
      expect(policy.report(5000, one(0.95)).kind).toBe('arming')
    })
  })
})
