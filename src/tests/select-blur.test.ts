// Tests for installSelectBlurOnPointerChange — a focused <select> must lose
// focus after a POINTER-driven change (so Space plays/pauses instead of
// re-opening it), but keep focus after a KEYBOARD-driven change (tab order).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installSelectBlurOnPointerChange } from '@/lib/select-blur'

describe('installSelectBlurOnPointerChange', () => {
  let cleanup: () => void
  let select: HTMLSelectElement

  beforeEach(() => {
    cleanup = installSelectBlurOnPointerChange(document)
    select = document.createElement('select')
    for (const v of ['a', 'b']) {
      const o = document.createElement('option')
      o.value = v
      select.appendChild(o)
    }
    document.body.appendChild(select)
    select.focus()
  })

  afterEach(() => {
    cleanup()
    select.remove()
  })

  it('blurs the select after a pointer-initiated change', () => {
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(document.activeElement).toBe(select)
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.activeElement).not.toBe(select)
  })

  it('keeps focus after a keyboard-initiated change', () => {
    document.dispatchEvent(new Event('keydown', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.activeElement).toBe(select)
  })

  it('does not blur non-select elements on change', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.activeElement).toBe(input)
    input.remove()
  })

  it('stops blurring after cleanup', () => {
    cleanup()
    document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.activeElement).toBe(select)
  })
})
