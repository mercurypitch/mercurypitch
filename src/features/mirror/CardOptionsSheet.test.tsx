import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CardOptionsSheetProps } from './CardOptionsSheet'
import { CardOptionsSheet } from './CardOptionsSheet'

afterEach(cleanup)

function renderSheet(
  overrides: Partial<CardOptionsSheetProps> = {},
): CardOptionsSheetProps {
  const props: CardOptionsSheetProps = {
    isOpen: true,
    onClose: vi.fn(),
    twinReady: false,
    includeTrace: false,
    onToggleTrace: vi.fn(),
    cardFormat: 'square',
    onToggleFormat: vi.fn(),
    twinTrace: false,
    onToggleTwinTrace: vi.fn(),
    twinData: false,
    onToggleTwinData: vi.fn(),
    canCopy: true,
    onCopy: vi.fn(),
    onCosmic: vi.fn(),
    ...overrides,
  }
  render(() => <CardOptionsSheet {...props} />)
  return props
}

describe('CardOptionsSheet', () => {
  it('renders nothing while closed', () => {
    renderSheet({ isOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens as a modal dialog with the card settings', () => {
    renderSheet()

    const dialog = screen.getByRole('dialog', { name: 'Card options' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(
      screen.getByRole('button', { name: /Pitch trace/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Story format/ }),
    ).toBeInTheDocument()
  })

  // The twin rows describe a card that does not exist yet. Showing them before
  // the reveal would offer settings for something the person has not seen.
  it('hides the twin rows until the twin is ready', () => {
    renderSheet({ twinReady: false })
    expect(
      screen.queryByRole('button', { name: /Trace on twin/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Data on twin/ }),
    ).not.toBeInTheDocument()
  })

  it('shows the twin rows once the twin is ready', () => {
    renderSheet({ twinReady: true })
    expect(
      screen.getByRole('button', { name: /Trace on twin/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Data on twin/ }),
    ).toBeInTheDocument()
  })

  // State reaches assistive tech through aria-pressed on the row itself; the
  // switch is decorative, so an on/off that only showed in CSS would be silent.
  it('reports each setting state via aria-pressed', () => {
    renderSheet({ includeTrace: true, cardFormat: 'square' })
    expect(screen.getByRole('button', { name: /Pitch trace/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      screen.getByRole('button', { name: /Story format/ }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('toggles a setting without closing the sheet', () => {
    const props = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: /Pitch trace/ }))
    expect(props.onToggleTrace).toHaveBeenCalledTimes(1)
    expect(props.onClose).not.toHaveBeenCalled()
  })

  // A one-shot action has finished the moment it fires — leaving the sheet
  // open would hide the card the action just acted on.
  it('closes after a one-shot action', () => {
    const props = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: /Copy card image/ }))
    expect(props.onCopy).toHaveBeenCalledTimes(1)
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('omits the copy action where the clipboard cannot take an image', () => {
    renderSheet({ canCopy: false })
    expect(
      screen.queryByRole('button', { name: /Copy card image/ }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Sing the Universe/ }),
    ).toBeInTheDocument()
  })

  it('closes from the scrim and the close button', () => {
    const props = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Close card options' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
