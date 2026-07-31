// ============================================================
// Survey timing — when it is fair to ask for feedback
// ============================================================

import { describe, expect, it } from 'vitest'
import { skipArmSecondsLeft, SURVEY_MIN_COMPLETIONS, SURVEY_MIN_USAGE_MS, SURVEY_SKIP_ARM_MS, surveyHasContent, surveyMomentOk, surveyUsageEarned, } from '@/lib/survey-timing'

const earned = {
  usageMs: SURVEY_MIN_USAGE_MS,
  completions: SURVEY_MIN_COMPLETIONS,
}
const goodMoment = { practicing: false, tourOpen: false, modalOpen: false }

describe('surveyUsageEarned', () => {
  it('asks once both time and finished runs are there', () => {
    expect(surveyUsageEarned(earned)).toBe(true)
  })

  // Pressing play twice and wandering off is not an opinion.
  it('needs finished runs, not just time in the app', () => {
    expect(
      surveyUsageEarned({ usageMs: SURVEY_MIN_USAGE_MS, completions: 0 }),
    ).toBe(false)
    expect(
      surveyUsageEarned({
        usageMs: SURVEY_MIN_USAGE_MS,
        completions: SURVEY_MIN_COMPLETIONS - 1,
      }),
    ).toBe(false)
  })

  it('needs time, not just a burst of quick runs', () => {
    expect(surveyUsageEarned({ usageMs: 0, completions: 99 })).toBe(false)
  })

  it('the dev force flag skips the usage bar', () => {
    expect(
      surveyUsageEarned({ usageMs: 0, completions: 0, forced: true }),
    ).toBe(true)
  })
})

describe('surveyMomentOk', () => {
  it('allows a quiet moment', () => {
    expect(surveyMomentOk(goodMoment)).toBe(true)
  })

  // The whole point: singing at a modal you cannot read is how a survey gets
  // "answered" with nothing, and it is once per browser.
  it('never interrupts a run in progress', () => {
    expect(surveyMomentOk({ ...goodMoment, practicing: true })).toBe(false)
  })

  it('waits behind tours and result modals', () => {
    expect(surveyMomentOk({ ...goodMoment, tourOpen: true })).toBe(false)
    expect(surveyMomentOk({ ...goodMoment, modalOpen: true })).toBe(false)
  })
})

describe('skipArmSecondsLeft', () => {
  it('counts whole seconds down to zero', () => {
    expect(skipArmSecondsLeft(SURVEY_SKIP_ARM_MS)).toBe(3)
    expect(skipArmSecondsLeft(2400)).toBe(3)
    expect(skipArmSecondsLeft(1200)).toBe(2)
    expect(skipArmSecondsLeft(200)).toBe(1)
    expect(skipArmSecondsLeft(0)).toBe(0)
  })

  it('never shows a negative countdown', () => {
    expect(skipArmSecondsLeft(-500)).toBe(0)
  })
})

describe('surveyHasContent', () => {
  it('accepts any one answered question', () => {
    expect(surveyHasContent({ background: ['singer'] })).toBe(true)
    expect(surveyHasContent({ usage: ['karaoke'] })).toBe(true)
    expect(surveyHasContent({ featureRequest: 'offline mode' })).toBe(true)
  })

  // An empty response is indistinguishable from a mis-click.
  it('rejects an empty response', () => {
    expect(surveyHasContent({})).toBe(false)
    expect(
      surveyHasContent({ background: [], usage: [], featureRequest: '' }),
    ).toBe(false)
  })

  it('rejects whitespace-only text', () => {
    expect(surveyHasContent({ featureRequest: '   \n  ' })).toBe(false)
  })
})
