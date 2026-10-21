// Course search regressions — failed branches and exhausted budgets cannot produce partial lessons.
import { describe, expect, it } from 'vitest'
import { searchCompleteCourse } from './course-search.ts'

describe('complete course search', () => {
  it('backtracks to a complete lesson instead of returning the first valid prefix', () => {
    const result = searchCompleteCourse({
      initial: '',
      steps: 3,
      candidates: (prefix) => [`${prefix}a`, `${prefix}b`],
      isValid: (prefix, step) => step !== 2 || prefix === 'ba',
    })
    expect(result).toBe('baa')
  })

  it('fails explicitly if every complete route is blocked', () => {
    expect(() =>
      searchCompleteCourse({
        initial: '',
        steps: 7,
        candidates: (prefix) => [`${prefix}a`],
        isValid: (_prefix, step) => step < 4,
      }),
    ).toThrow('No complete course')
  })

  it('bounds work even for an unending candidate stream', () => {
    let tested = 0
    expect(() =>
      searchCompleteCourse({
        initial: 0,
        steps: 1,
        candidateLimit: 5,
        candidates: function* () {
          for (let i = 0; ; i++) yield i
        },
        isValid: () => {
          tested++
          return false
        },
      }),
    ).toThrow('search limit')
    expect(tested).toBe(5)
  })
})
