import { describe, expect, it } from 'vitest'
import { maskEmail } from './email'

describe('maskEmail', () => {
  it('keeps the first letter and the top-level domain, and nothing else', () => {
    const masked = maskEmail('maria.k@example.com')

    expect(masked).toBe('m***@***.com')
    expect(masked).not.toContain('aria')
    expect(masked).not.toContain('example')
  })

  it('masks a domain with no dot whole', () => {
    expect(maskEmail('ops@localhost')).toBe('o***@***')
  })

  it('shows nothing of a string that is not an address', () => {
    expect(maskEmail('not-an-address')).toBe('***')
    expect(maskEmail('@example.com')).toBe('***')
    expect(maskEmail('')).toBe('***')
  })
})
