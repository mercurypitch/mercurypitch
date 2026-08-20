// The dialog wrapper. The prose is WhatCountsGuide's problem; this covers
// the ways a reader gets out of it.
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WhatCountsModal } from './WhatCountsModal'

afterEach(cleanup)

describe('WhatCountsModal', () => {
  it('shows the guide', () => {
    render(() => <WhatCountsModal onClose={() => {}} />)
    expect(
      screen.getByRole('heading', { name: 'What counts where' }),
    ).toBeInTheDocument()
  })

  it('is a labelled modal dialog', () => {
    render(() => <WhatCountsModal onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy as string)).toHaveTextContent(
      'What counts where',
    )
  })

  it('closes on the close button', () => {
    const onClose = vi.fn()
    render(() => <WhatCountsModal onClose={onClose} />)

    fireEvent.click(screen.getByTestId('what-counts-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(() => <WhatCountsModal onClose={onClose} />)

    // The trap listens on the dialog, not the document, so a nested modal
    // can own Escape without this one also closing behind it.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on a click on the backdrop', () => {
    const onClose = vi.fn()
    render(() => <WhatCountsModal onClose={onClose} />)

    fireEvent.click(screen.getByTestId('what-counts-modal'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('stays open when the click landed on the card', () => {
    // Selecting a sentence drags the pointer around; losing the page you
    // opened to read is worse than one extra click to dismiss it.
    const onClose = vi.fn()
    render(() => <WhatCountsModal onClose={onClose} />)

    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('puts focus inside the dialog rather than leaving it behind', async () => {
    render(() => <WhatCountsModal onClose={() => {}} />)

    // The trap defers its initial focus a microtask, so the dialog's children
    // are mounted before it looks for something to focus.
    await Promise.resolve()
    expect(document.activeElement).toBe(screen.getByTestId('what-counts-close'))
  })
})
