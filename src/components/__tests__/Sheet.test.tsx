// The one invariant that cannot be checked by looking at a screenshot:
// the sheet must not live inside the caller's subtree.
//
// It rendered in place until a phone found the flaw. `position: fixed` is
// viewport-relative only while no ancestor creates a containing block or a
// clip for it, and transform / filter / backdrop-filter / will-change /
// contain / overflow all can. JamPanel is blurred glass layers inside
// `overflow: hidden`, so the Jam song picker opened as a squashed band pinned
// to the transport row instead of a bottom sheet.

import { render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Sheet } from '../mobile/Sheet'

describe('Sheet', () => {
  it('renders outside the caller subtree, not inside it', () => {
    const { container } = render(() => (
      <div data-testid="stage">
        <Sheet isOpen close={() => {}} ariaLabel="Choose a song">
          <button type="button">Bohemian Rhapsody</button>
        </Sheet>
      </div>
    ))

    const dialog = document.body.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(dialog?.textContent).toContain('Bohemian Rhapsody')
  })

  it('leaves no content behind in the caller subtree when closed', () => {
    const { container } = render(() => (
      <div>
        <Sheet isOpen={false} close={() => {}} ariaLabel="Choose a song">
          <button type="button">Bohemian Rhapsody</button>
        </Sheet>
      </div>
    ))

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    expect(container.textContent).not.toContain('Bohemian Rhapsody')
  })

  it('closes when the backdrop is clicked', () => {
    let closed = false
    render(() => (
      <Sheet
        isOpen
        close={() => {
          closed = true
        }}
        ariaLabel="Choose a song"
      >
        <button type="button">Bohemian Rhapsody</button>
      </Sheet>
    ))

    const dialog = document.body.querySelector('[role="dialog"]')
    const backdrop = dialog?.parentElement
    expect(backdrop).not.toBeNull()
    backdrop?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(closed).toBe(true)
  })

  it('does not close when the panel itself is clicked', () => {
    let closed = false
    render(() => (
      <Sheet
        isOpen
        close={() => {
          closed = true
        }}
        ariaLabel="Choose a song"
      >
        <button type="button">Bohemian Rhapsody</button>
      </Sheet>
    ))

    const dialog = document.body.querySelector('[role="dialog"]')
    dialog?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(closed).toBe(false)
  })

  it('forwards caller-local theme tokens across the portal', () => {
    render(() => (
      <div
        style={{
          '--sheet-bg': 'rgb(10, 20, 30)',
          '--zen-ink': 'rgb(230, 240, 250)',
          '--pitch-reference': 'rgb(245, 158, 11)',
        }}
      >
        <Sheet isOpen close={() => {}} ariaLabel="Themed guide">
          <div>Guide content</div>
        </Sheet>
      </div>
    ))

    const backdrop = document.body.querySelector('[role="dialog"]')
      ?.parentElement as HTMLElement | null
    expect(backdrop).not.toBeNull()
    expect(backdrop?.style.getPropertyValue('--sheet-bg')).toBe(
      'rgb(10, 20, 30)',
    )
    expect(backdrop?.style.getPropertyValue('--zen-ink')).toBe(
      'rgb(230, 240, 250)',
    )
    expect(backdrop?.style.getPropertyValue('--pitch-reference')).toBe(
      'rgb(245, 158, 11)',
    )
  })
})
