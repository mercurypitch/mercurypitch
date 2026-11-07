// ============================================================
// The empty stage's hero, landing by landing
// ============================================================

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { karaokeEntryIntent } from './entry-intent'
import { KaraokeHero } from './KaraokeHero'

afterEach(cleanup)

/** Each landing's heading and the words its promise starts with. */
const LANDINGS = [
  {
    path: '/karaoke-night',
    h1: 'Your stage is set',
    lede: /^Start with our ready-to-sing song/,
  },
  {
    path: '/vocal-remover',
    h1: 'Vocal remover: take the voice out, keep the song',
    lede: /^Add a song you already own and it separates into a vocal track and an instrumental one\./,
  },
  {
    path: '/karaoke-app',
    h1: 'A free karaoke app with lyrics and live scoring',
    lede: /^It runs in your browser on a phone, a tablet or a computer/,
  },
] as const

describe('KaraokeHero', () => {
  it.each(LANDINGS)(
    '$path leads with its own heading and promise',
    ({ path, h1, lede }) => {
      const { container } = render(() => (
        <KaraokeHero
          intent={karaokeEntryIntent(path)}
          demoPlayable
          onSingDemo={vi.fn()}
        />
      ))

      expect(
        screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent),
      ).toEqual([h1])
      expect(container.querySelector('.kn-hero > p')?.textContent).toMatch(lede)
    },
  )

  it('keeps the one call to action the tour rings, on every landing', () => {
    const onSingDemo = vi.fn()
    render(() => (
      <KaraokeHero
        intent="vocal-remover"
        demoPlayable
        onSingDemo={onSingDemo}
      />
    ))

    const sing = screen.getByRole('button', { name: 'Sing this song' })
    expect(sing.getAttribute('data-tour')).toBe('karaoke.demo')
    fireEvent.click(sing)
    expect(onSingDemo).toHaveBeenCalledTimes(1)
  })

  it('keeps its heading and offers no song while the example cannot be played', () => {
    render(() => (
      <KaraokeHero
        intent="karaoke-app"
        demoPlayable={false}
        onSingDemo={vi.fn()}
      />
    ))

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'A free karaoke app with lyrics and live scoring',
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})
