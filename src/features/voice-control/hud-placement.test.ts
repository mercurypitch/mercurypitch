// ============================================================
// Tests: hud-placement — a narrow viewport never loses the HUD.
// ============================================================

import { describe, expect, it } from 'vitest'
import { bottomHudVisible } from './hud-placement'

const phone = {
  native: false,
  labOpen: false,
  narrow: true,
  headerHidden: false,
}

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

  it('never floats in the native app, on any width and in any mode', () => {
    // The native shell draws no web header, and on a phone on its side the
    // width test mounted the pill here: wholly under the rail's first item,
    // where no tap could reach it (device round 4). Voice control has no
    // place in the native chrome yet, so the owner's call is no pill there.
    for (const narrow of [true, false]) {
      for (const labOpen of [true, false]) {
        for (const headerHidden of [true, false]) {
          for (const voiceEnabled of [true, false]) {
            const shell = { native: true, narrow, labOpen, headerHidden }
            expect(
              bottomHudVisible({ ...shell, voiceEnabled }),
              JSON.stringify(shell),
            ).toBe(false)
          }
        }
      }
    }
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
