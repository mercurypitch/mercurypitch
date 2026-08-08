// ============================================================
// Funnel event allowlist — client/Worker activation contract
// ============================================================
//
// The regression this file exists to prevent: the ingest allowlist and the
// client vocabularies were maintained separately and drifted. Five events the
// client emitted (`donate_view`, `donate_start`, `onboarding_prints`,
// `onboarding_track_gallery`, `onboarding_another_voiceprint`) were answered
// 400 and dropped, and because `beacon()` never inspects the response the
// donation funnel and the returning-visitor onboarding track simply recorded
// nothing. Both sides now derive from src/lib/funnel-event-catalog.ts; these
// tests pin that they still do.

import { describe, expect, it } from 'vitest'
import { APP_FUNNEL_EVENTS, FUNNEL_EVENT_NAMES, GLASS_FUNNEL_EVENTS, KARAOKE_FUNNEL_EVENTS, MIRROR_FUNNEL_EVENTS, ONBOARDING_FUNNEL_EVENTS, RESERVED_FUNNEL_EVENTS, } from '../../../src/lib/funnel-event-catalog'
import { FUNNEL_EVENTS } from './index'

/** Every surface whose events the worker must accept. */
const CLIENT_SURFACES = {
  mirror: MIRROR_FUNNEL_EVENTS,
  app: APP_FUNNEL_EVENTS,
  karaoke: KARAOKE_FUNNEL_EVENTS,
  glass: GLASS_FUNNEL_EVENTS,
  onboarding: ONBOARDING_FUNNEL_EVENTS,
} as const

describe('ingest allowlist covers every client surface', () => {
  for (const [surface, events] of Object.entries(CLIENT_SURFACES)) {
    it(`accepts all ${events.length} ${surface} events`, () => {
      const rejected = events.filter((event) => !FUNNEL_EVENTS.has(event))
      expect(rejected).toEqual([])
    })
  }

  it('accepts nothing the catalog does not list', () => {
    expect([...FUNNEL_EVENTS].sort()).toEqual([...FUNNEL_EVENT_NAMES].sort())
  })

  it('does not accept an unregistered lookalike event', () => {
    expect(FUNNEL_EVENTS.has('karaoke_scorecard_viewed')).toBe(false)
    expect(FUNNEL_EVENTS.has('donate_completed')).toBe(false)
  })
})

describe('the catalog itself stays coherent', () => {
  it('names no event twice, in one surface or across two', () => {
    const seen = new Map<string, string>()
    const duplicates: string[] = []
    for (const [surface, events] of Object.entries({
      ...CLIENT_SURFACES,
      reserved: RESERVED_FUNNEL_EVENTS,
    })) {
      for (const event of events) {
        const previous = seen.get(event)
        if (previous !== undefined) {
          duplicates.push(`${event} (${previous} + ${surface})`)
          continue
        }
        seen.set(event, surface)
      }
    }
    expect(duplicates).toEqual([])
  })

  it('registers the events whose absence broke the donation funnel', () => {
    // Named explicitly rather than trusting the arrays: these five are the
    // actual regression, and a future refactor that drops one should fail
    // here with a recognisable message.
    for (const event of [
      'donate_view',
      'donate_start',
      'onboarding_prints',
      'onboarding_track_gallery',
      'onboarding_another_voiceprint',
    ]) {
      expect(FUNNEL_EVENTS.has(event)).toBe(true)
    }
  })
})
