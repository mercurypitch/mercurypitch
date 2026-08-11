// ============================================================
// Guided Voice claim safety tests — bounded copy stays descriptive
// ============================================================

import { describe, expect, it } from 'vitest'
import { isGuidedReviewedDisclaimerId, validateGuidedDynamicClaim, } from './claims'

describe('validateGuidedDynamicClaim', () => {
  it.each([
    ['Your breath support score is 82', 'breath-support-rating'],
    [
      'Your voice is healthy and safe to continue',
      'health-or-safety-clearance',
    ],
    ['We found possible vocal fold closure', 'medical-or-tissue-inference'],
    [
      'This shows efficient subglottal pressure',
      'respiratory-or-laryngeal-inference',
    ],
    ['The gap suggests a passaggio problem', 'register-disorder-inference'],
    ['Your tone has professional tonal quality', 'prestige-tonal-quality'],
    ['This was a healthy onset', 'onset-classification'],
    ['Your overall voice score is 74', 'composite-voice-score'],
  ] as const)('rejects %s', (text, expectedId) => {
    const result = validateGuidedDynamicClaim({
      surface: 'finding',
      text,
    })

    expect(result.valid).toBe(false)
    expect(result.violations).toContainEqual({ id: expectedId })
  })

  it.each([
    ['Breath-support quality was strong', 'breath-support-rating'],
    ['Your breath support needs work', 'breath-support-rating'],
    ['This waveform measures breath support', 'breath-support-rating'],
    ['Your breath support needs more work', 'breath-support-rating'],
    ['Your breath support is lacking', 'breath-support-rating'],
    ['Your breath support could use work', 'breath-support-rating'],
    ['Work on your breath support', 'breath-support-rating'],
    ['This is a vocal health clearance', 'health-or-safety-clearance'],
    ['This is a vocal-health clearance', 'health-or-safety-clearance'],
    ['This is inside your safe range', 'health-or-safety-clearance'],
    ['That note is in your unsafe vocal range', 'health-or-safety-clearance'],
    ['The audio indicates an injury', 'medical-or-tissue-inference'],
    ['The audio indicates pathology', 'medical-or-tissue-inference'],
    ['The sound suggests damage', 'medical-or-tissue-inference'],
    ['This shows vocal strain', 'medical-or-tissue-inference'],
    ['This suggests swelling', 'medical-or-tissue-inference'],
    ['The take reveals fatigue', 'medical-or-tissue-inference'],
    ['This indicates paresis', 'medical-or-tissue-inference'],
    ['The waveform shows fold closure', 'medical-or-tissue-inference'],
    ['The waveform shows vocal-fold closure', 'medical-or-tissue-inference'],
    ['Your voice is healing', 'medical-or-tissue-inference'],
    ['This measures lung capacity', 'respiratory-or-laryngeal-inference'],
    ['This measures airflow efficiency', 'respiratory-or-laryngeal-inference'],
    ['This measures subglottal pressure', 'respiratory-or-laryngeal-inference'],
    ['This measures laryngeal tension', 'respiratory-or-laryngeal-inference'],
    ['This shows muscle tension', 'respiratory-or-laryngeal-inference'],
    ['This shows muscle-tension', 'respiratory-or-laryngeal-inference'],
    ['This is a register disorder', 'register-disorder-inference'],
    ['This is a passaggio disorder', 'register-disorder-inference'],
    ['The tone has professional tonal quality', 'prestige-tonal-quality'],
    ['The tone has excellent tonal quality', 'prestige-tonal-quality'],
    ['This was a breathy onset', 'onset-classification'],
    ['This was a balanced onset', 'onset-classification'],
    ['This was a pressed onset', 'onset-classification'],
    ['This was a hard onset', 'onset-classification'],
    ['This was a healthy onset', 'onset-classification'],
    ['This was a damaging onset', 'onset-classification'],
    ['Your composite score is 70', 'composite-voice-score'],
    ['Your overall voice score is 70', 'composite-voice-score'],
    ['Your voice-score is 70', 'composite-voice-score'],
  ] as const)('blocks policy vocabulary in %s', (text, expectedId) => {
    const result = validateGuidedDynamicClaim({
      surface: 'recommendation',
      text,
    })

    expect(result.violations).toContainEqual({ id: expectedId })
  })

  it('reports every applicable violation in deterministic policy order', () => {
    const result = validateGuidedDynamicClaim({
      surface: 'finding',
      text: 'An excellent breath support score proves a healthy voice.',
    })

    expect(result.violations).toEqual([
      { id: 'breath-support-rating' },
      { id: 'health-or-safety-clearance' },
    ])
  })

  it('cannot be bypassed with a line break or Unicode hyphen', () => {
    const result = validateGuidedDynamicClaim({
      surface: 'finding',
      text: 'Your breath‑support\nscore is 82.',
    })

    expect(result.violations).toContainEqual({
      id: 'breath-support-rating',
    })
  })

  it.each([
    'The first landing was 18 cents above the target.',
    'Try three comfortable lip trills, then return to the same check.',
    'The later take stayed near the target for 6 of 8 measured frames.',
    'No reliable focus was found in this recording today.',
    'The glide moved through the selected register without a long gap.',
    'Keep the next attempt comfortable and stop if it feels uncomfortable.',
  ])('accepts neutral evidence-bounded copy: %s', (text) => {
    expect(
      validateGuidedDynamicClaim({ surface: 'recommendation', text }),
    ).toMatchObject({ valid: true, violations: [] })
  })

  it('returns the exact source text and never a sanitised replacement', () => {
    const text = '  Your overall voice score is excellent.  '
    const result = validateGuidedDynamicClaim({ surface: 'finding', text })

    expect(result.sourceText).toBe(text)
    expect(Object.hasOwn(result, 'sanitizedText')).toBe(false)
    expect(Object.hasOwn(result, 'replacementText')).toBe(false)
  })

  it('rejects blank dynamic copy', () => {
    expect(
      validateGuidedDynamicClaim({ surface: 'finding', text: '   ' }),
    ).toMatchObject({
      valid: false,
      violations: [{ id: 'empty-copy' }],
    })
  })

  it('keeps reviewed disclaimer IDs on a separate allowlist', () => {
    expect(isGuidedReviewedDisclaimerId('guided-stop-on-discomfort-v1')).toBe(
      true,
    )
    expect(isGuidedReviewedDisclaimerId('dynamic-model-copy')).toBe(false)
  })
})
