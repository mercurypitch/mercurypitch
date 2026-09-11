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

/** Each free Pull and the approved cast render the cue moment must show. */
const FREE_PULL_RENDERS = [
  ['scrolling', 'pull-the-scroll-nanobanana-v0_1-512.webp'],
  ['snacking', 'pull-sugarlump-nanobanana-v0_1-512.webp'],
  ['familiar-ritual', 'pull-the-usual-nanobanana-v0_1-512.webp'],
  ['two-minute-pause', 'pull-ember-nanobanana-v0_1-512.webp'],
  ['one-tap-convenience', 'pull-dinger-nanobanana-v0_1-512.webp'],
  ['avoidance', 'pull-the-fog-nanobanana-v0_1-512.webp'],
] as const

describe('cue moment screen', () => {
  it.each(FREE_PULL_RENDERS)(
    'shows the %s Pull as its approved render beside the notice Corky',
    (pullId, file) => {
      // The notice render deliberately carries no Pull, and MascotStage only
      // draws one when it is told which Pull the beat is about. This screen is
      // the only place in the app that knows, so if it stops passing the id
      // every cue looks the same.
      const { container } = render(() => (
        <CueMomentScreen {...base} pullId={pullId} />
      ))

      expect(sources(container)).toEqual([
        expect.stringMatching(/corky-notice-approved/u) as unknown as string,
        expect.stringMatching(
          new RegExp(`/art/pulls/${file.replace(/[.]/gu, '[.]')}$`, 'u'),
        ) as unknown as string,
      ])
    },
  )

  it('shows no creature for a self-named Pull, only the neutral mark', () => {
    // A custom Pull has no authored character and is not lent one. The old
    // placeholder marks are gone for good, so nothing may point at them.
    const { container } = render(() => (
      <CueMomentScreen {...base} pullText="Checking the news again" />
    ))

    expect(sources(container)).toEqual([
      expect.stringMatching(/corky-notice-approved/u) as unknown as string,
    ])
    expect(container.querySelector('.mascot-stage__pull--mark')).not.toBeNull()
    expect(sources(container).join('\n')).not.toMatch(/notice-cue|cue-generic/u)
    expect(screen.getByText('Checking the news again')).toBeInTheDocument()
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
