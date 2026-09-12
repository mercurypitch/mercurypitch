// ============================================================
// The Keep alert says where a take goes, not what it is spared
// ============================================================
//
// Device round 2, R6: the owner asked for "Nothing uploaded" out of the UI —
// "say it indirectly". Both halves are asserted, because only asserting the
// new sentence would go green against a screen that still carried the old
// one underneath it.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { KeepAlert } from './KeepAlert'
import { renderShell } from './render-for-test'

let unmount: (() => void) | null = null

afterEach(() => {
  unmount?.()
  unmount = null
  vi.clearAllMocks()
})

describe('KeepAlert', () => {
  it('asks once, and says what Keep does with the take', () => {
    const rendered = renderShell(() => (
      <KeepAlert open={() => true} onDiscard={() => {}} onKeep={() => {}} />
    ))
    unmount = rendered.unmount

    const text = rendered.container.textContent ?? ''
    expect(text).toContain('Keep this take?')
    expect(text).toContain('Keep stores it on this phone.')
    expect(text).not.toContain('uploaded')
  })

  it('answers either way, and both answers are the run ending', () => {
    const onKeep = vi.fn()
    const onDiscard = vi.fn()
    const rendered = renderShell(() => (
      <KeepAlert open={() => true} onDiscard={onDiscard} onKeep={onKeep} />
    ))
    unmount = rendered.unmount

    const buttons = rendered.container.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    buttons[0].click()
    buttons[1].click()
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onKeep).toHaveBeenCalledTimes(1)
  })

  it('draws nothing while it is closed', () => {
    const rendered = renderShell(() => (
      <KeepAlert open={() => false} onDiscard={() => {}} onKeep={() => {}} />
    ))
    unmount = rendered.unmount

    expect(
      rendered.container.querySelector('[data-testid="shell-keep-alert"]'),
    ).toBe(null)
  })
})
