// @vitest-environment jsdom
// Dialog focus regressions — the primary decision and visible tab boundaries remain reachable.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { focusDialog, trapDialogKeys } from './dialog-focus'

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

describe('dialog initial focus', () => {
  afterEach(() => document.body.replaceChildren())

  it('focuses the primary decision ahead of an optional sound control', async () => {
    const dialog = mountDialog(`
      <button id="sound">Sound / tune</button>
      <button id="start" data-dialog-initial-focus>Start course</button>
    `)

    focusDialog(dialog)
    await Promise.resolve()
    expect(document.activeElement?.id).toBe('start')
  })

  it('uses an enabled fallback while preparing and the primary once ready', async () => {
    const dialog = mountDialog(`
      <button id="sound">Sound / tune</button>
      <button id="start" data-dialog-initial-focus disabled>Start course</button>
    `)

    focusDialog(dialog)
    await Promise.resolve()
    expect(document.activeElement?.id).toBe('sound')

    dialog.querySelector<HTMLButtonElement>('#start')!.disabled = false
    focusDialog(dialog)
    await Promise.resolve()
    expect(document.activeElement?.id).toBe('start')
  })

  it('keeps the first enabled action for an unmarked dialog', async () => {
    const dialog = mountDialog(`
      <button id="preparing" disabled>Preparing</button>
      <button id="cancel">Cancel</button>
    `)

    focusDialog(dialog)
    await Promise.resolve()
    expect(document.activeElement?.id).toBe('cancel')
  })

  it('does not move focus after the dialog has been removed', async () => {
    const dialog = mountDialog('<button id="start">Start course</button>')
    focusDialog(dialog)
    document.body.innerHTML = '<button id="current">Current action</button>'
    document.getElementById('current')!.focus()

    await Promise.resolve()
    expect(document.activeElement?.id).toBe('current')
  })
})

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
