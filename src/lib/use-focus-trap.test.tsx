// Modal focus follows visible native disclosures rather than their hidden controls.
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { useFocusTrap } from './use-focus-trap'

function DisclosureDialog() {
  let dialog: HTMLDivElement | undefined
  useFocusTrap(() => dialog, { isOpen: () => true })
  return (
    <div ref={dialog} role="dialog" aria-modal="true" tabindex="-1">
      <button type="button">Close</button>
      <details data-testid="input-details">
        <summary>Input</summary>
        <input aria-label="Device name" />
        <details open>
          <summary>Advanced device</summary>
          <button type="button">Hidden refresh</button>
        </details>
      </details>
      <details data-testid="amp-details">
        <summary>Shape tone</summary>
        <button type="button">Reset amp</button>
      </details>
      <button type="button" disabled>
        Hear my input
      </button>
    </div>
  )
}

describe('useFocusTrap native disclosures', () => {
  afterEach(cleanup)

  it('cycles through visible summaries, excluding all collapsed descendants', async () => {
    render(() => <DisclosureDialog />)
    await Promise.resolve()
    const close = screen.getByRole('button', { name: 'Close' })
    const shape = screen.getByText('Shape tone')
    expect(close).toHaveFocus()
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(shape).toHaveFocus()
    fireEvent.keyDown(shape, { key: 'Tab' })
    expect(close).toHaveFocus()
  })

  it('recomputes the last tab stop as a disclosure opens and closes', async () => {
    render(() => <DisclosureDialog />)
    await Promise.resolve()
    const close = screen.getByRole('button', { name: 'Close' })
    const details = screen.getByTestId('amp-details') as HTMLDetailsElement
    details.open = true
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    const reset = screen.getByRole('button', { name: 'Reset amp' })
    expect(reset).toHaveFocus()
    fireEvent.keyDown(reset, { key: 'Tab' })
    expect(close).toHaveFocus()
    details.open = false
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Shape tone')).toHaveFocus()
  })

  it('respects a summary explicitly removed from keyboard navigation', async () => {
    render(() => <DisclosureDialog />)
    await Promise.resolve()
    const close = screen.getByRole('button', { name: 'Close' })
    screen.getByText('Shape tone').tabIndex = -1
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Input')).toHaveFocus()
  })

  // A press on a dialog's words gives the focus to the dialog itself when it
  // can take it (tabindex -1). The dialog is not one of its own stops: from
  // there Shift+Tab went back to the page behind.
  it('keeps Tab and Shift+Tab inside when the dialog itself has the focus', async () => {
    render(() => <DisclosureDialog />)
    await Promise.resolve()
    const dialog = screen.getByRole('dialog')

    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    const afterShiftTab = document.activeElement?.textContent
    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    const afterTab = document.activeElement?.textContent

    expect([afterShiftTab, afterTab]).toEqual(['Shape tone', 'Close'])
  })
})
