import { describe, expect, it } from 'vitest'
import { addLocalDays } from './dates'
import { CueDomainError } from './errors'

function expectDomainErrorCode(
  operation: () => unknown,
  code: CueDomainError['code'],
): void {
  try {
    operation()
  } catch (error) {
    expect(error).toBeInstanceOf(CueDomainError)
    expect((error as CueDomainError).code).toBe(code)
    return
  }
  throw new Error(`Expected CueDomainError with code ${code}.`)
}

describe('addLocalDays', () => {
  it('crosses month and leap-day boundaries without a timezone', () => {
    expect(addLocalDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addLocalDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addLocalDays('2024-03-01', -1)).toBe('2024-02-29')
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    'rejects a non-integer day offset: %s',
    (days) => {
      expectDomainErrorCode(
        () => addLocalDays('2026-08-06', days),
        'invalid_day_offset',
      )
    },
  )

  it('rejects results outside the four-digit local-date range', () => {
    expectDomainErrorCode(
      () => addLocalDays('0001-01-01', -1),
      'invalid_local_date',
    )
    expectDomainErrorCode(
      () => addLocalDays('9999-12-31', 1),
      'invalid_local_date',
    )
  })
})
