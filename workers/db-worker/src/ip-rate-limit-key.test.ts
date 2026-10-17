// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { ipRateLimitKey } from './auth'

describe('ipRateLimitKey', () => {
  it('leaves IPv4 and the fallback untouched', () => {
    expect(ipRateLimitKey('203.0.113.7')).toBe('203.0.113.7')
    expect(ipRateLimitKey(null)).toBe('127.0.0.1')
    expect(ipRateLimitKey('')).toBe('127.0.0.1')
  })

  it('buckets every address in one /64 to a single key', () => {
    const a = ipRateLimitKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd')
    const b = ipRateLimitKey('2001:db8:1:2:0:0:0:1')
    const c = ipRateLimitKey('2001:db8:1:2::ffff')
    expect(a).toBe(b)
    expect(a).toBe(c)
  })

  it('keeps different /64s apart', () => {
    expect(ipRateLimitKey('2001:db8:1:2::1')).not.toBe(
      ipRateLimitKey('2001:db8:1:3::1'),
    )
  })

  it('handles compressed and zone-id forms', () => {
    // "::" at the front, and a trailing zone id, still resolve to a /64.
    expect(ipRateLimitKey('::1')).toBe(ipRateLimitKey('0:0:0:0::9'))
    expect(ipRateLimitKey('fe80::1%eth0')).toBe(ipRateLimitKey('fe80::2'))
  })
})
