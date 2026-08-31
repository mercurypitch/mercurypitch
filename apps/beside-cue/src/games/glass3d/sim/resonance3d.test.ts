import { describe, expect, it } from 'vitest'
import { WORLD3D_CONFIG } from '../world3d-config'
import type { VoiceInput } from './resonance3d'
import { accuracy, createResonance, isRinging, meanCentsError, stepResonance, } from './resonance3d'

const R = WORLD3D_CONFIG.ring
const STEP = 1 / 120

const held = (midi: number): VoiceInput => ({
  midi,
  vibrato: false,
  vibratoStrength: 0,
})
const waved = (midi: number, strength = 1): VoiceInput => ({
  midi,
  vibrato: true,
  vibratoStrength: strength,
})
const silence: VoiceInput = { midi: null, vibrato: false, vibratoStrength: 0 }

/** Run `seconds` of one input, returning whether it broke. */
const sing = (
  state: ReturnType<typeof createResonance>,
  input: VoiceInput,
  seconds: number,
): boolean => {
  let broke = false
  for (let t = 0; t < seconds; t += STEP) {
    if (stepResonance(state, input, STEP, R)) broke = true
  }
  return broke
}

describe('the resonance verb', () => {
  it('rises to the hold cap on a steady note, and no further', () => {
    const glass = createResonance(60)
    sing(glass, held(60), R.riseSeconds)
    expect(glass.res).toBeCloseTo(R.holdCap, 2)

    // Ten more seconds of the same perfect note buys nothing. This is
    // the whole design: endurance is not the skill.
    sing(glass, held(60), 10)
    expect(glass.res).toBeCloseTo(R.holdCap, 2)
    expect(isRinging(glass, R)).toBe(true)
  })

  it('breaks only once the note wavers', () => {
    const glass = createResonance(60)
    expect(sing(glass, held(60), R.riseSeconds + 5)).toBe(false)
    expect(sing(glass, waved(60), R.pumpSeconds + 0.2)).toBe(true)
    expect(glass.res).toBe(1)
  })

  it('pumps proportionally to how strong the wave is', () => {
    const strong = createResonance(60)
    const weak = createResonance(60)
    sing(strong, held(60), R.riseSeconds)
    sing(weak, held(60), R.riseSeconds)

    sing(strong, waved(60, 1), 0.5)
    sing(weak, waved(60, 0.25), 0.5)
    expect(strong.res).toBeGreaterThan(weak.res)
  })

  it('will not pump a note that is out of tune', () => {
    const glass = createResonance(60)
    sing(glass, held(60), R.riseSeconds)
    // Far outside even the widened band.
    sing(glass, waved(60 + R.tolSemis + R.pumpTolBonus + 1), 2)
    expect(glass.res).toBeLessThan(R.holdCap)
  })

  it('widens the band once ringing, so the wobble cannot betray you', () => {
    const wobbleEdge = 60 + R.tolSemis + 0.5 // outside the narrow band
    const cold = createResonance(60)
    sing(cold, held(wobbleEdge), 1)
    expect(cold.res).toBe(0)

    const ringing = createResonance(60)
    sing(ringing, held(60), R.riseSeconds)
    const before = ringing.res
    sing(ringing, waved(wobbleEdge), 0.5)
    expect(ringing.res).toBeGreaterThan(before)
  })

  it('decays slowly through silence rather than punishing a breath', () => {
    const glass = createResonance(60)
    sing(glass, held(60), R.riseSeconds)
    sing(glass, silence, 0.3) // a breath
    expect(glass.res).toBeGreaterThan(R.holdCap * 0.7)

    sing(glass, silence, R.fallSeconds)
    expect(glass.res).toBe(0)
  })

  it('does not break twice', () => {
    const glass = createResonance(60)
    sing(glass, held(60), R.riseSeconds)
    expect(sing(glass, waved(60), R.pumpSeconds + 0.5)).toBe(true)
    // Already broken: further singing reports nothing.
    expect(sing(glass, waved(60), 1)).toBe(false)
  })
})

describe('how well it was sung', () => {
  it('scores a dead-centre note as perfect', () => {
    const glass = createResonance(60)
    sing(glass, held(60), 1)
    expect(meanCentsError(glass)).toBeCloseTo(0, 5)
    expect(accuracy(glass, R)).toBeCloseTo(1, 5)
  })

  it('scores a note at the edge of the band as nearly nothing', () => {
    const glass = createResonance(60)
    // Just inside the band, not exactly on it: `60 + 1.2` is 1.2000…28
    // semitones away in binary floating point, so a probe placed exactly
    // on the boundary tests the representation rather than the rule. A
    // real detector never lands there either.
    sing(glass, held(60 + R.tolSemis * 0.999), 1)
    expect(meanCentsError(glass)).toBeCloseTo(R.tolSemis * 100, 0)
    expect(accuracy(glass, R)).toBeLessThan(0.01)
  })

  it('averages over the whole run rather than the last frame', () => {
    const glass = createResonance(60)
    sing(glass, held(60), 1) // perfect
    sing(glass, held(60 + 0.6), 1) // half a band off
    expect(accuracy(glass, R)).toBeGreaterThan(0.6)
    expect(accuracy(glass, R)).toBeLessThan(0.85)
  })

  it('counts only the frames that actually charged it', () => {
    const glass = createResonance(60)
    sing(glass, silence, 2)
    expect(glass.chargedFrames).toBe(0)
    // Nothing was sung, so nothing was sung well.
    expect(accuracy(glass, R)).toBe(0)
  })
})
