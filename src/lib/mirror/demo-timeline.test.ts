// ============================================================
// Voice Mirror onboarding — demo timeline scripts.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { DemoKind } from './demo-timeline'
import { buildDemoTimeline, demoStateAt } from './demo-timeline'
import { hzToCents } from './metrics'

const KINDS: DemoKind[] = ['glide-up', 'glide-down', 'hold', 'match']

const cents = (f0: number) => hzToCents(f0)

describe('buildDemoTimeline', () => {
  it.each(KINDS)('%s: segments tile the loop exactly', (kind) => {
    const tl = buildDemoTimeline(kind)
    expect(tl.durationSec).toBeGreaterThan(0)
    expect(tl.segments[0].start).toBe(0)
    expect(tl.segments[tl.segments.length - 1].end).toBeCloseTo(
      tl.durationSec,
      6,
    )
    for (let i = 1; i < tl.segments.length; i++) {
      expect(tl.segments[i].start).toBeCloseTo(tl.segments[i - 1].end, 6)
    }
  })

  it.each(KINDS)('%s: voice times increase and stay in the loop', (kind) => {
    const tl = buildDemoTimeline(kind)
    expect(tl.voice.length).toBeGreaterThan(50)
    for (let i = 1; i < tl.voice.length; i++) {
      expect(tl.voice[i].t).toBeGreaterThan(tl.voice[i - 1].t)
    }
    expect(tl.voice[tl.voice.length - 1].t).toBeLessThan(tl.durationSec)
  })

  it.each(KINDS)('%s: frames fit inside the precomputed scale', (kind) => {
    const tl = buildDemoTimeline(kind)
    for (const f of [...tl.voice, ...tl.guide]) {
      const c = cents(f.f0)
      expect(c).toBeGreaterThan(tl.centsMin)
      expect(c).toBeLessThan(tl.centsMax)
    }
  })

  it('glide-up rises and glide-down falls', () => {
    const up = buildDemoTimeline('glide-up')
    expect(cents(up.voice[up.voice.length - 1].f0)).toBeGreaterThan(
      cents(up.voice[0].f0) + 900,
    )
    const down = buildDemoTimeline('glide-down')
    expect(cents(down.voice[down.voice.length - 1].f0)).toBeLessThan(
      cents(down.voice[0].f0) - 900,
    )
  })

  it('hold stays near its guide note', () => {
    const tl = buildDemoTimeline('hold')
    const target = cents(tl.guide[0].f0)
    for (const f of tl.voice) {
      expect(Math.abs(cents(f.f0) - target)).toBeLessThan(60)
    }
  })

  it('match: silent listen, scoop from below, settled landing', () => {
    const tl = buildDemoTimeline('match')
    expect(tl.segments.map((s) => s.kind)).toEqual([
      'listen',
      'ready',
      'sing',
      'rest',
    ])
    const sing = tl.segments[2]
    expect(tl.voice[0].t).toBeGreaterThanOrEqual(sing.start)
    const target = cents(tl.guide[0].f0)
    expect(cents(tl.voice[0].f0)).toBeLessThan(target - 200)
    const lastQuarter = tl.voice.slice(Math.floor(tl.voice.length * 0.75))
    const median = lastQuarter
      .map((f) => cents(f.f0) - target)
      .sort((a, b) => a - b)[Math.floor(lastQuarter.length / 2)]
    expect(Math.abs(median)).toBeLessThan(35)
  })

  it('is deterministic and memoized', () => {
    const a = buildDemoTimeline('glide-up')
    const b = buildDemoTimeline('glide-up')
    expect(b).toBe(a)
  })
})

describe('demoStateAt', () => {
  it('wraps past the loop end', () => {
    const tl = buildDemoTimeline('hold')
    const wrapped = demoStateAt(tl, tl.durationSec + 0.1)
    expect(wrapped.t).toBeCloseTo(0.1, 6)
  })

  it('exposes the sung prefix and head frame', () => {
    // Match voice starts after the listen+ready beats, so t=0 is silent.
    expect(demoStateAt(buildDemoTimeline('match'), 0).headFrame).toBeNull()
    const tl = buildDemoTimeline('glide-up')
    const mid = demoStateAt(tl, 1.5)
    expect(mid.voiceIndex).toBeGreaterThan(0)
    expect(mid.headFrame?.t).toBeLessThanOrEqual(1.5)
    expect(tl.voice[mid.voiceIndex]?.t ?? Infinity).toBeGreaterThan(1.5)
  })

  it('resolves segments at their boundaries', () => {
    const tl = buildDemoTimeline('match')
    expect(demoStateAt(tl, 0).segment.kind).toBe('listen')
    expect(demoStateAt(tl, tl.segments[0].end).segment.kind).toBe('ready')
    expect(demoStateAt(tl, tl.durationSec - 0.01).segment.kind).toBe('rest')
  })
})
