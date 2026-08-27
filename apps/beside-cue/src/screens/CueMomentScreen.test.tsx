import { fireEvent, render, screen } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { CueMomentScreen } from './CueMomentScreen'

function sources(container: HTMLElement): string[] {
  return [...container.querySelectorAll('img')].map(
    (element) => element.getAttribute('src') ?? '',
  )
}

function noop(): void {}

const base = {
  pullText: 'Scrolling in bed',
  bSideText: 'Read one page',
  phrase: 'A small turn is still a turn.',
  pending: false,
  onChooseBSide: noop,
  onNotNow: noop,
  onClose: noop,
}

describe('cue moment screen', () => {
  it('uses current Corky with the pull-specific creature, not the generic token', () => {
    // The notice render deliberately carries no cue, and MascotStage only draws
    // one when it is told which pull the beat is about. This screen is the only
    // place in the app that knows, so if it stops passing the id the seven
    // registered overlays go quietly unused and every cue looks the same.
    const { container } = render(() => (
      <CueMomentScreen {...base} pullId="snacking" />
    ))

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-home-rest-v0_23/u) as unknown as string,
      expect.stringMatching(/notice-cue-snacking/u) as unknown as string,
    ])
  })

  it('falls back to the canon cue when the pull is self-named', () => {
    const { container } = render(() => <CueMomentScreen {...base} />)

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-home-rest-v0_23/u) as unknown as string,
      expect.stringMatching(/notice-cue-generic/u) as unknown as string,
    ])
  })

  it('keeps an optional named cue visible without implying detection', () => {
    render(() => (
      <CueMomentScreen
        {...base}
        cueContextText="When I get into bed with my phone."
      />
    ))

    expect(screen.getByText('Your cue')).toBeInTheDocument()
    expect(
      screen.getByText('When I get into bed with my phone.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/detected|noticed for you/iu),
    ).not.toBeInTheDocument()
  })

  it('locks every competing choice while the durable outcome is saving', () => {
    const onChooseBSide = vi.fn()
    const onNotNow = vi.fn()
    const onClose = vi.fn()
    render(() => (
      <CueMomentScreen
        {...base}
        pending
        onChooseBSide={onChooseBSide}
        onNotNow={onNotNow}
        onClose={onClose}
      />
    ))

    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Saving your choice on this device…',
    )
    const choose = screen.getByRole('button', {
      name: 'Saving your choice…',
    })
    const notNow = screen.getByRole('button', { name: 'Saving…' })
    const close = screen.getByRole('button', { name: 'Close cue' })
    expect(choose).toBeDisabled()
    expect(notNow).toBeDisabled()
    expect(close).toBeDisabled()

    fireEvent.click(choose)
    fireEvent.click(notNow)
    fireEvent.click(close)
    expect(onChooseBSide).not.toHaveBeenCalled()
    expect(onNotNow).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
