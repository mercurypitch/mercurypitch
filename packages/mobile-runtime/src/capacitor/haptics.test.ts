// ============================================================
// Capacitor haptics adapter tests — semantic mapping and native failures
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCapacitorHapticsPort } from './haptics'

const haptics = vi.hoisted(() => ({
  impact: vi.fn(),
  notification: vi.fn(),
}))

vi.mock('@capacitor/haptics', () => ({
  Haptics: haptics,
  ImpactStyle: {
    Light: 'LIGHT',
    Medium: 'MEDIUM',
    Heavy: 'HEAVY',
  },
  NotificationType: {
    Success: 'SUCCESS',
    Warning: 'WARNING',
    Error: 'ERROR',
  },
}))

describe('Capacitor haptics', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it.each([
    ['light', 'LIGHT'],
    ['medium', 'MEDIUM'],
    ['heavy', 'HEAVY'],
  ] as const)('maps the %s impact style', async (style, nativeStyle) => {
    const port = createCapacitorHapticsPort()

    await port.impact(style)

    expect(haptics.impact).toHaveBeenCalledWith({ style: nativeStyle })
  })

  it.each([
    ['success', 'SUCCESS'],
    ['warning', 'WARNING'],
    ['error', 'ERROR'],
  ] as const)('maps the %s notification type', async (type, nativeType) => {
    const port = createCapacitorHapticsPort()

    await port.notification(type)

    expect(haptics.notification).toHaveBeenCalledWith({ type: nativeType })
  })

  it('keeps native haptics failures visible to the caller', async () => {
    const failure = new Error('Native haptics failed')
    haptics.impact.mockRejectedValueOnce(failure)
    const port = createCapacitorHapticsPort()

    await expect(port.impact('light')).rejects.toBe(failure)
  })
})
