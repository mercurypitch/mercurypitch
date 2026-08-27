// ============================================================
// ChooseBSideScreen tests — Lock frozen copy and route-entry focus.
// ============================================================
import { render, screen } from '@solidjs/testing-library'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChooseBSideScreen } from './ChooseBSideScreen'

function noop(): void {}

const base = {
  headerLabel: 'Your first plan',
  pullText: 'Endless scrolling',
  suggestions: [
    { key: 'bside.phone-away', label: 'Put the phone in another room.' },
  ],
  customText: '',
  customSelected: false,
  pending: false,
  onSelect: noop,
  onSelectCustom: noop,
  onCustomInput: noop,
  onBack: noop,
  onContinue: noop,
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('choose Side B screen', () => {
  it('uses the frozen question and supplied setup label', () => {
    render(() => <ChooseBSideScreen {...base} headerLabel="Change plan" />)

    expect(screen.getByText('Change plan')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', {
        name: 'What small action would you rather begin?',
      }),
    ).toBeInTheDocument()
  })

  it('resets route entry to the top and focuses the decision heading', async () => {
    const scrollTo = vi.mocked(window.scrollTo)
    render(() => <ChooseBSideScreen {...base} />)

    await Promise.resolve()

    expect(scrollTo).toHaveBeenCalledOnce()
    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    })
    expect(
      screen.getByRole('heading', {
        name: 'What small action would you rather begin?',
      }),
    ).toHaveFocus()
  })
})
