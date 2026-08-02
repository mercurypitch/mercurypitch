// ── ICE server fetch tests ────────────────────────────────────────────
// This endpoint must never be able to stop people jamming. Every failure
// has to land on STUN rather than throw, because a direct-only room works
// for most people and no room works for nobody.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FALLBACK_ICE_SERVERS, getIceServers, resetIceServers, } from '@/lib/jam/ice-servers'

const ok = (body: unknown) =>
  ({ ok: true, json: async () => body }) as unknown as Response

describe('getIceServers', () => {
  beforeEach(() => resetIceServers())

  it('passes the whole array through, not just the first entry', async () => {
    // The real response carries a STUN group AND a TURN group. Taking [0]
    // would drop every TURN URL and look exactly like TURN not working.
    const minted = [
      { urls: ['stun:stun.cloudflare.com:3478'] },
      {
        urls: ['turn:turn.cloudflare.com:3478?transport=udp'],
        username: 'u',
        credential: 'c',
      },
    ]
    const servers = await getIceServers(
      vi.fn().mockResolvedValue(ok({ iceServers: minted })),
    )
    expect(servers).toHaveLength(2)
    expect(servers).toEqual(minted)
  })

  it('falls back to STUN on a non-200', async () => {
    const servers = await getIceServers(
      vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response),
    )
    expect(servers).toEqual(FALLBACK_ICE_SERVERS)
  })

  it('falls back to STUN when the fetch rejects', async () => {
    // Offline, DNS failure, or the abort timeout firing.
    const servers = await getIceServers(
      vi.fn().mockRejectedValue(new Error('offline')),
    )
    expect(servers).toEqual(FALLBACK_ICE_SERVERS)
  })

  it('falls back to STUN on a body that is not what we expect', async () => {
    for (const body of [{}, { iceServers: [] }, { iceServers: 'nope' }, null]) {
      resetIceServers()
      const servers = await getIceServers(vi.fn().mockResolvedValue(ok(body)))
      expect(servers).toEqual(FALLBACK_ICE_SERVERS)
    }
  })

  it('falls back to STUN when the body will not parse', async () => {
    const servers = await getIceServers(
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('unexpected token')
        },
      } as unknown as Response),
    )
    expect(servers).toEqual(FALLBACK_ICE_SERVERS)
  })

  it('ships no TURN of its own in the fallback', async () => {
    // There is no free relay worth trusting: a direct-only room is a better
    // failure than one that half-works unpredictably.
    const urls = FALLBACK_ICE_SERVERS.flatMap((s) =>
      typeof s.urls === 'string' ? [s.urls] : s.urls,
    )
    expect(urls.every((u) => u.startsWith('stun:'))).toBe(true)
    expect(urls.some((u) => u.includes('openrelay'))).toBe(false)
  })

  it('fetches once per session and reuses the result', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ iceServers: [{ urls: ['stun:x'] }] }))
    await getIceServers(fetchImpl)
    await getIceServers(fetchImpl)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('does not cache a fallback, so a later attempt can still get TURN', async () => {
    // A failed mint at join time must not condemn the whole session to STUN.
    await getIceServers(vi.fn().mockRejectedValue(new Error('offline')))
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(ok({ iceServers: [{ urls: ['turn:y'] }] }))
    const servers = await getIceServers(fetchImpl)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(servers).toEqual([{ urls: ['turn:y'] }])
  })
})
