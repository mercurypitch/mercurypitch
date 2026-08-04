import { describe, expect, it } from 'vitest'
import type { Beat, FlowState } from '@/features/onboarding/flow'
import { BEAT_ORDER, beatProgress, firstBeat, isBeatApplicable, nextBeat, walkedBeats, } from '@/features/onboarding/flow'

/** Everything renderable — the Phase 4 end state. */
const ALL: ReadonlySet<Beat> = new Set(BEAT_ORDER)
/** What Phase 1 can actually render. */
const PHASE_1: ReadonlySet<Beat> = new Set<Beat>(['sky', 'fork', 'map'])

const state = (over: Partial<FlowState> = {}): FlowState => ({
  track: null,
  hasVoiceprint: false,
  micDenied: false,
  savedPrints: 0,
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
    expect(isBeatApplicable('voiceprint', state({ track: 'short' }))).toBe(
      false,
    )
    expect(isBeatApplicable('twin', state({ track: 'short' }))).toBe(false)
    expect(isBeatApplicable('voiceprint', state({ track: 'full' }))).toBe(true)
    expect(isBeatApplicable('twin', state({ track: 'full' }))).toBe(true)
  })

  it('gates the gallery behind choosing it AND having something in it', () => {
    // Never on the way past: the gallery is only ever reached by asking.
    expect(isBeatApplicable('prints', state({ savedPrints: 4 }))).toBe(false)
    expect(isBeatApplicable('prints', state({ track: 'short' }))).toBe(false)
    expect(isBeatApplicable('prints', state({ track: 'full' }))).toBe(false)
    // And an empty gallery is not a beat, whatever was chosen.
    expect(isBeatApplicable('prints', state({ track: 'gallery' }))).toBe(false)
    expect(
      isBeatApplicable('prints', state({ track: 'gallery', savedPrints: 1 })),
    ).toBe(true)
  })

  it('keeps the voiceprint measurement off the gallery track', () => {
    // Someone looking at takes they already have is not re-measured.
    const gallery = state({ track: 'gallery', savedPrints: 2 })
    expect(isBeatApplicable('voiceprint', gallery)).toBe(false)
    expect(isBeatApplicable('twin', gallery)).toBe(false)
  })

  it('offers nothing to keep when nothing was measured', () => {
    expect(isBeatApplicable('keep', state({ track: 'full' }))).toBe(false)
    expect(
      isBeatApplicable('keep', state({ track: 'full', hasVoiceprint: true })),
    ).toBe(true)
  })

  it('leaves only the Map applicable once the mic is refused', () => {
    const denied = state({ micDenied: true })
    for (const beat of BEAT_ORDER) {
      expect(isBeatApplicable(beat, denied)).toBe(beat === 'map')
    }
  })

  it('does not offer the voiceprint fork to someone who refused the mic', () => {
    // Even if a track was somehow already chosen.
    const denied = state({ micDenied: true, track: 'full' })
    expect(isBeatApplicable('fork', denied)).toBe(false)
    expect(isBeatApplicable('voiceprint', denied)).toBe(false)
  })
})

describe('nextBeat', () => {
  it('walks the full track in order once everything is built', () => {
    const full = state({ track: 'full', hasVoiceprint: true })
    expect(nextBeat('sky', full, ALL)).toBe('first-light')
    expect(nextBeat('first-light', full, ALL)).toBe('fork')
    expect(nextBeat('fork', full, ALL)).toBe('voiceprint')
    expect(nextBeat('voiceprint', full, ALL)).toBe('twin')
    expect(nextBeat('twin', full, ALL)).toBe('keep')
    expect(nextBeat('keep', full, ALL)).toBe('map')
    expect(nextBeat('map', full, ALL)).toBeNull()
  })

  it('always ends on the Map, so the last screen is a way into the app', () => {
    // Whatever the track and whether or not the account was asked for.
    for (const s of [
      state({ track: 'short' }),
      state({ track: 'full', hasVoiceprint: true }),
      state({ micDenied: true }),
    ]) {
      expect(nextBeat('map', s, ALL)).toBeNull()
    }
  })

  it('skips the account ask when it is not renderable, landing on the Map', () => {
    // A visitor who declined last week: 'keep' is withheld by the caller.
    const withoutKeep = new Set(BEAT_ORDER.filter((b) => b !== 'keep'))
    const full = state({ track: 'full', hasVoiceprint: true })
    expect(nextBeat('twin', full, withoutKeep)).toBe('map')
  })

  it('sends a returning visitor fork → gallery → map, with no re-measure', () => {
    const gallery = state({ track: 'gallery', savedPrints: 3 })
    expect(nextBeat('fork', gallery, ALL)).toBe('prints')
    // Straight to the Map: no voiceprint, no twin, and nothing to keep
    // because nothing new was measured in this run.
    expect(nextBeat('prints', gallery, ALL)).toBe('map')
    expect(nextBeat('map', gallery, ALL)).toBeNull()
  })

  it('still offers the full measurement to a returning visitor who asks', () => {
    // Having four on file does not take the 90-second path away.
    const full = state({ track: 'full', savedPrints: 4 })
    expect(nextBeat('fork', full, ALL)).toBe('voiceprint')
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

  it('routes a refused mic straight to the Map from wherever it happened', () => {
    const denied = state({ micDenied: true })
    // Denied at the mic ask.
    expect(nextBeat('first-light', denied, ALL)).toBe('map')
    // Denied mid-voiceprint (device unplugged).
    expect(nextBeat('voiceprint', denied, ALL)).toBe('map')
    // And the Map is still the end of the line.
    expect(nextBeat('map', denied, ALL)).toBeNull()
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

describe('walkedBeats', () => {
  it('is exactly the beats this visitor sees — the sky draws one bead each', () => {
    expect(walkedBeats(state({ track: 'short' }), PHASE_1)).toEqual([
      'sky',
      'fork',
      'map',
    ])
    // Every beat except the gallery, which belongs to the other fork.
    expect(
      walkedBeats(state({ track: 'full', hasVoiceprint: true }), ALL),
    ).toEqual(BEAT_ORDER.filter((beat) => beat !== 'prints'))
  })

  it('never leaves the current beat out of its own walk', () => {
    // The bead index is an indexOf into this list; a current beat that
    // is not in it would light nothing and read as a broken arc.
    const short = state({ track: 'short' })
    for (const beat of walkedBeats(short, ALL)) {
      expect(walkedBeats(short, ALL)).toContain(beat)
    }
    expect(walkedBeats(state({ micDenied: true }), ALL)).toEqual(['map'])
  })

  it('agrees with beatProgress about where the end is', () => {
    const full = state({ track: 'full', hasVoiceprint: true })
    const walked = walkedBeats(full, ALL)
    expect(beatProgress(walked[walked.length - 1], full, ALL)).toBe(1)
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
    expect(beatProgress('fork', full, ALL)).toBeCloseTo(2 / 6)
    // The Map is last, so the account ask is not yet the end of the bar.
    expect(beatProgress('keep', full, ALL)).toBeCloseTo(5 / 6)
    expect(beatProgress('map', full, ALL)).toBe(1)
  })
})
