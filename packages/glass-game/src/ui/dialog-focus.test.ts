// @vitest-environment jsdom
// Dialog focus regressions — closed overflow content must not become a modal's tab boundary.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { trapDialogKeys } from './dialog-focus'

function mountDialog(contents: string): HTMLElement {
  document.body.innerHTML = `<section role="dialog">${contents}</section>`
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
  dialog.addEventListener('keydown', trapDialogKeys)
  return dialog
}

function tabFrom(id: string, shiftKey = false): KeyboardEvent {
  const control = document.getElementById(id)!
  control.focus()
  const event = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  })
  control.dispatchEvent(event)
  return event
}

describe('dialog tab boundaries', () => {
  beforeEach(() => {
    // Chromium retains layout rectangles for content inside closed details.
    // JSDOM has no layout, so preserve that browser behavior at the DOM edge.
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
      new DOMRect(0, 0, 44, 44),
    ] as unknown as DOMRectList)
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('wraps between Back and More when the replay overflow is closed', () => {
    mountDialog(`
      <button id="back">Back</button>
      <details>
        <summary id="more" tabindex="0">More</summary>
        <button id="replay">Replay</button>
      </details>
    `)

    expect(tabFrom('back', true).defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('more')
    expect(tabFrom('more').defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('back')
  })

  it('includes Replay again when the overflow opens', () => {
    const dialog = mountDialog(`
      <button id="back">Back</button>
      <details>
        <summary id="more" tabindex="0">More</summary>
        <button id="replay">Replay</button>
      </details>
    `)
    dialog.querySelector('details')!.open = true

    expect(tabFrom('back', true).defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('replay')
    expect(tabFrom('replay').defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('back')
  })

  it.each([false, true])(
    'excludes an inner summary behind a closed outer details (inner open: %s)',
    (innerOpen) => {
      mountDialog(`
        <button id="back">Back</button>
        <details>
          <summary id="more" tabindex="0">More</summary>
          <details ${innerOpen ? 'open' : ''}>
            <summary id="nested" tabindex="0">Nested actions</summary>
            <button id="replay">Replay</button>
          </details>
        </details>
      `)

      tabFrom('back', true)
      expect(document.activeElement?.id).toBe('more')
      expect(tabFrom('more').defaultPrevented).toBe(true)
      expect(document.activeElement?.id).toBe('back')
    },
  )

  it('keeps a control within the visible first summary in the tab order', () => {
    mountDialog(`
      <button id="back">Back</button>
      <details>
        <summary tabindex="0"><button id="more">More</button></summary>
        <summary id="extra" tabindex="0">Hidden extra summary</summary>
        <button id="replay">Replay</button>
      </details>
    `)

    tabFrom('back', true)
    expect(document.activeElement?.id).toBe('more')
    expect(tabFrom('more').defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('back')
  })
})
