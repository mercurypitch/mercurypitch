// ============================================================
// Tests: hud-placement — a narrow viewport never loses the HUD.
// ============================================================

import { describe, expect, it } from 'vitest'
import { bottomHudVisible } from './hud-placement'

const phone = { labOpen: false, narrow: true, headerHidden: false }

describe('bottomHudVisible', () => {
  it('leaves the pill to the header on a phone', () => {
    expect(bottomHudVisible({ ...phone, voiceEnabled: true })).toBe(false)
  })

  it('carries the pill when the header is gone', () => {
    // Focus mode, Zen and the challenge stage unmount the header; the
    // controller kept listening with nothing on screen.
    expect(
      bottomHudVisible({ ...phone, headerHidden: true, voiceEnabled: true }),
    ).toBe(true)
    expect(
      bottomHudVisible({ ...phone, headerHidden: true, voiceEnabled: false }),
    ).toBe(true)
  })

  it('always shows on a wide viewport', () => {
    expect(
      bottomHudVisible({ ...phone, narrow: false, voiceEnabled: false }),
    ).toBe(true)
  })

  it('follows the switch in the lab, which has no header on any width', () => {
    expect(
      bottomHudVisible({ ...phone, labOpen: true, voiceEnabled: true }),
    ).toBe(true)
    expect(
      bottomHudVisible({ ...phone, labOpen: true, voiceEnabled: false }),
    ).toBe(false)
  })
})
