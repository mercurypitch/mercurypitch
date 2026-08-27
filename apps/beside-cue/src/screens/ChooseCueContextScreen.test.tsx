// ============================================================
// ChooseCueContextScreen tests — Lock optional semantics, native selection, and route focus.
// ============================================================
import { fireEvent, render, screen, within } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CueContextSelection } from './ChooseCueContextScreen'
import { ChooseCueContextScreen } from './ChooseCueContextScreen'

const suggestions = [
  {
    id: 'anchor.scrolling.open-feed',
    label: 'When I open the feed without deciding to.',
  },
  {
    id: 'anchor.scrolling.in-bed',
    label: 'When I get into bed with my phone.',
  },
  {
    id: 'anchor.scrolling.post-to-post',
    label: 'When one post turns into another.',
  },
] as const

function noop(): void {}

const base = {
  headerLabel: 'Your first plan',
  pullLabel: 'Endless scrolling',
  suggestions,
  customText: '',
  onSelect: noop,
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

describe('choose cue context screen', () => {
  it('offers the profile examples, custom words, and an explicit optional path', () => {
    render(() => <ChooseCueContextScreen {...base} />)

    const group = screen.getByRole('group', {
      name: /when does this Pull usually show up/iu,
    })
    expect(within(group).getAllByRole('radio')).toHaveLength(5)
    for (const suggestion of suggestions) {
      expect(
        within(group).getByRole('radio', { name: suggestion.label }),
      ).toBeInTheDocument()
    }
    expect(
      within(group).getByRole('radio', { name: /write my own/iu }),
    ).toBeInTheDocument()
    expect(
      within(group).getByRole('radio', { name: /not sure yet/iu }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/will not detect it automatically/iu),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose Side B' })).toBeDisabled()
  })

  it('selects a suggestion without advancing until the separate action', () => {
    const [selection, setSelection] = createSignal<CueContextSelection>()
    const onSelect = vi.fn((next: CueContextSelection) => setSelection(next))
    const onContinue = vi.fn()
    render(() => (
      <ChooseCueContextScreen
        {...base}
        selection={selection()}
        onSelect={onSelect}
        onContinue={onContinue}
      />
    ))

    const choice = screen.getByRole('radio', {
      name: suggestions[1].label,
    })
    fireEvent.click(choice)

    expect(onSelect).toHaveBeenCalledWith({
      kind: 'suggested',
      id: suggestions[1].id,
    })
    expect(choice).toBeChecked()
    expect(onContinue).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Choose Side B' }))
    expect(onContinue).toHaveBeenCalledOnce()
  })

  it('keeps custom context private, bounded, and associated with its error', () => {
    const onCustomInput = vi.fn()
    render(() => (
      <ChooseCueContextScreen
        {...base}
        selection={{ kind: 'custom' }}
        customText="When I put my phone by the bed"
        error="Your cue needs between 1 and 120 characters."
        onCustomInput={onCustomInput}
      />
    ))

    const input = screen.getByRole('textbox', { name: 'Your cue' })
    expect(input).toHaveValue('When I put my phone by the bed')
    expect(input).toHaveAttribute('maxlength', '120')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(
      'Stored only on this device. Your cue needs between 1 and 120 characters.',
    )

    fireEvent.input(input, { target: { value: 'When one post becomes two' } })
    expect(onCustomInput).toHaveBeenCalledWith('When one post becomes two')
  })

  it('treats Not sure yet as a complete optional choice', () => {
    const onSelect = vi.fn()
    render(() => (
      <ChooseCueContextScreen
        {...base}
        selection={{ kind: 'not-sure' }}
        onSelect={onSelect}
      />
    ))

    expect(screen.getByRole('radio', { name: /not sure yet/iu })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Choose Side B' })).toBeEnabled()

    fireEvent.click(screen.getByRole('radio', { name: /write my own/iu }))
    expect(onSelect).toHaveBeenCalledWith({ kind: 'custom' })
  })

  it('resets route entry to the top and focuses the decision heading', async () => {
    const scrollTo = vi.mocked(window.scrollTo)
    render(() => <ChooseCueContextScreen {...base} />)

    await Promise.resolve()

    expect(scrollTo).toHaveBeenCalledOnce()
    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    })
    expect(
      screen.getByRole('heading', {
        name: /when does this Pull usually show up/iu,
      }),
    ).toHaveFocus()
  })

  it('uses the supplied setup label', () => {
    render(() => <ChooseCueContextScreen {...base} headerLabel="Change plan" />)

    expect(screen.getByText('Change plan')).toBeInTheDocument()
  })
})
