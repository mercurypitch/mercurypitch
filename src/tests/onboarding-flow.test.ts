import { describe, expect, it } from 'vitest'
import type { Beat, FlowState } from '@/features/onboarding/flow'
import { beatProgress, BEAT_ORDER, firstBeat, isBeatApplicable, nextBeat, } from '@/features/onboarding/flow'

/** Everything renderable — the Phase 4 end state. */
const ALL: ReadonlySet<Beat> = new Set(BEAT_ORDER)
/** What Phase 1 can actually render. */
const PHASE_1: ReadonlySet<Beat> = new Set<Beat>(['sky', 'fork', 'map'])

const state = (over: Partial<FlowState> = {}): FlowState => ({
  track: null,
  hasVoiceprint: false,
  ...over,
})

describe('isBeatApplicable', () => {
  it('keeps the spine beats for everyone', () => {
    for (const beat of ['sky', 'first-light', 'fork', 'map'] as Beat[]) {
      expect(isBeatApplicable(beat, state())).toBe(true)
      expect(isBeatApplicable(beat, state({ track: 'short' }))).toBe(true)
    }
  })

  it('gates the voiceprint pair behind the full track', () => {
    expect(isBeatApplicable('voiceprint', state({ track: 'short' }))).toBe(false)
    expect(isBeatApplicable('twin', state({ track: 'short' }))).toBe(false)
    expect(isBeatApplicable('voiceprint', state({ track: 'full' }))).toBe(true)
    expect(isBeatApplicable('twin', state({ track: 'full' }))).toBe(true)
  })

  it('offers nothing to keep when nothing was measured', () => {
    expect(isBeatApplicable('keep', state({ track: 'full' }))).toBe(false)
    expect(
      isBeatApplicable('keep', state({ track: 'full', hasVoiceprint: true })),
    ).toBe(true)
  })
})

describe('nextBeat', () => {
  it('walks the full track in order once everything is built', () => {
    const full = state({ track: 'full', hasVoiceprint: true })
    expect(nextBeat('sky', full, ALL)).toBe('first-light')
    expect(nextBeat('first-light', full, ALL)).toBe('fork')
    expect(nextBeat('fork', full, ALL)).toBe('voiceprint')
    expect(nextBeat('voiceprint', full, ALL)).toBe('twin')
    expect(nextBeat('twin', full, ALL)).toBe('map')
    expect(nextBeat('map', full, ALL)).toBe('keep')
    expect(nextBeat('keep', full, ALL)).toBeNull()
  })

  it('skips the fork entirely on the short track', () => {
    const short = state({ track: 'short' })
    expect(nextBeat('fork', short, ALL)).toBe('map')
    // Nothing measured → no account ask.
    expect(nextBeat('map', short, ALL)).toBeNull()
  })

  it('skips beats this build cannot render', () => {
    const short = state({ track: 'short' })
    expect(nextBeat('sky', short, PHASE_1)).toBe('fork')
    expect(nextBeat('fork', short, PHASE_1)).toBe('map')
    expect(nextBeat('map', short, PHASE_1)).toBeNull()
  })

  it('still ends the flow when the last beats are unavailable', () => {
    const full = state({ track: 'full', hasVoiceprint: true })
    expect(nextBeat('map', full, PHASE_1)).toBeNull()
  })
})

describe('firstBeat', () => {
  it('opens on the sky', () => {
    expect(firstBeat(state(), ALL)).toBe('sky')
    expect(firstBeat(state(), PHASE_1)).toBe('sky')
  })

  it('falls forward when the sky is unavailable', () => {
    expect(firstBeat(state(), new Set<Beat>(['map']))).toBe('map')
  })

  it('returns null when nothing can be rendered', () => {
    expect(firstBeat(state(), new Set<Beat>())).toBeNull()
  })
})

describe('beatProgress', () => {
  it('reaches 1 at the last beat the visitor will actually see', () => {
    const short = state({ track: 'short' })
    // Short track in Phase 1: sky → fork → map.
    expect(beatProgress('sky', short, PHASE_1)).toBe(0)
    expect(beatProgress('fork', short, PHASE_1)).toBeCloseTo(0.5)
    expect(beatProgress('map', short, PHASE_1)).toBe(1)
  })

  it('does not stall short-track visitors at a fraction of the full flow', () => {
    const short = state({ track: 'short' })
    // The bar must fill even though voiceprint/twin/keep exist.
    expect(beatProgress('map', short, ALL)).toBe(1)
  })

  it('paces the full track across all seven beats', () => {
    const full = state({ track: 'full', hasVoiceprint: true })
    expect(beatProgress('sky', full, ALL)).toBe(0)
    expect(beatProgress('keep', full, ALL)).toBe(1)
    expect(beatProgress('fork', full, ALL)).toBeCloseTo(2 / 6)
  })
})
