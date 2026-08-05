// ============================================================
// Jam background session tests
// ============================================================

import { describe, expect, it } from 'vitest'
import { applyNewerJamBackground, classifyJamBackgroundCapability, isCurrentJamBackgroundCapability, jamBackgroundCapabilityNeedsRefresh, mayRenderJamPremiumBackground, } from './background-session'
import type { JamBackgroundCapabilityMessage } from './types'

const NOW = Date.parse('2026-08-05T20:00:00.000Z')

function capability(
  overrides: Partial<JamBackgroundCapabilityMessage> = {},
): JamBackgroundCapabilityMessage {
  return {
    type: 'background-capability',
    backgroundId: 'golden-stage',
    version: 3,
    token: 'a'.repeat(48),
    expiresAt: '2026-08-05T20:05:00.000Z',
    ...overrides,
  }
}

describe('Jam background capability acceptance', () => {
  it('requires live entitlement for hosts but accepts a guest room pass', () => {
    expect(
      mayRenderJamPremiumBackground({
        access: 'unlocked',
        hasGuestCapability: false,
        isHost: true,
      }),
    ).toBe(true)
    expect(
      mayRenderJamPremiumBackground({
        access: 'locked',
        hasGuestCapability: false,
        isHost: true,
      }),
    ).toBe(false)
    expect(
      mayRenderJamPremiumBackground({
        access: 'locked',
        hasGuestCapability: true,
        isHost: false,
      }),
    ).toBe(true)
  })

  it('accepts a current capability only from the Durable Object named host', () => {
    expect(
      isCurrentJamBackgroundCapability(capability(), {
        background: { backgroundId: 'golden-stage', revision: 2 },
        fromPeerId: 'host-peer',
        hostPeerId: 'host-peer',
        now: NOW,
      }),
    ).toBe(true)
  })

  it('holds a trusted early capability until matching room state arrives', () => {
    const options = {
      background: { backgroundId: 'room-stage', revision: 1 },
      fromPeerId: 'host-peer',
      hostPeerId: 'host-peer',
      now: NOW,
    }
    expect(classifyJamBackgroundCapability(capability(), options)).toBe(
      'pending-background',
    )
    expect(
      classifyJamBackgroundCapability(capability(), {
        ...options,
        background: { backgroundId: 'golden-stage', revision: 2 },
      }),
    ).toBe('current')
  })

  it('rejects another peer, another background, malformed tokens, and expiry', () => {
    const base = {
      background: { backgroundId: 'golden-stage', revision: 2 },
      fromPeerId: 'guest-peer',
      hostPeerId: 'host-peer',
      now: NOW,
    }
    expect(isCurrentJamBackgroundCapability(capability(), base)).toBe(false)
    expect(classifyJamBackgroundCapability(capability(), base)).toBe('rejected')
    expect(
      isCurrentJamBackgroundCapability(
        capability({ backgroundId: 'aurora-loft' }),
        { ...base, fromPeerId: 'host-peer' },
      ),
    ).toBe(false)
    expect(
      isCurrentJamBackgroundCapability(capability({ token: 'short' }), {
        ...base,
        fromPeerId: 'host-peer',
      }),
    ).toBe(false)
    expect(
      isCurrentJamBackgroundCapability(
        capability({ expiresAt: '2026-08-05T19:59:59.000Z' }),
        { ...base, fromPeerId: 'host-peer' },
      ),
    ).toBe(false)
  })

  it('refreshes before expiry and rejects malformed timestamps', () => {
    expect(jamBackgroundCapabilityNeedsRefresh(capability(), NOW)).toBe(false)
    expect(
      jamBackgroundCapabilityNeedsRefresh(
        capability({ expiresAt: '2026-08-05T20:01:00.000Z' }),
        NOW,
      ),
    ).toBe(true)
    expect(
      jamBackgroundCapabilityNeedsRefresh(
        capability({ expiresAt: 'invalid' }),
        NOW,
      ),
    ).toBe(true)
  })
})

describe('Jam background revisions', () => {
  it('ignores stale room-state messages', () => {
    const current = { backgroundId: 'golden-stage', revision: 4 }
    expect(
      applyNewerJamBackground(current, {
        backgroundId: 'room-stage',
        revision: 3,
      }),
    ).toBe(current)
    expect(
      applyNewerJamBackground(current, {
        backgroundId: 'room-stage',
        revision: 5,
      }),
    ).toEqual({ backgroundId: 'room-stage', revision: 5 })
  })
})
