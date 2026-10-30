// The Field Book's page in the room: while a song is read it says what
// the reading is doing; once read, the song's own timeline, the items
// counted by kind and laid out by time, never by pitch.

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import type { WildBook } from '@/lib/ear/wild'
import { LitFieldBook } from './LitFieldBook'

afterEach(cleanup)

/** A song of `phrases` phrases, each ending on a landing; `shift` moves
 *  every note up or down, and nothing else. */
function song(phrases: number, shift = 0): WildBook {
  const echo: WildBook['echo'] = []
  const home: WildBook['home'] = []
  for (let i = 0; i < phrases; i++) {
    const startS = 8 + i * 10
    const midis = [64 + shift, 67 + shift, 66 + shift]
    echo.push({
      kind: 'echo',
      itemId: `e${i}`,
      startS,
      endS: startS + 2,
      degrees: [1, 3, 2],
      midis,
      onsetsS: [0.3, 0.8, 1.3],
    })
    home.push({
      kind: 'home',
      itemId: `h${i}`,
      startS: startS - 0.5,
      endS: startS + 2.15,
      degree: 2,
      midi: 66 + shift,
    })
  }
  return {
    sessionId: 'song',
    key: { tonicPc: 4, mode: 'minor', keyName: 'E' },
    home,
    echo,
    bassline: [],
  }
}

const read = (book: WildBook): void => {
  render(() => (
    <LitFieldBook
      pct={null}
      keyName="E minor"
      counts={{ home: book.home.length, echo: book.echo.length, bassline: 0 }}
      duration={252}
      book={book}
    />
  ))
}

const part = (name: string): Element[] =>
  Array.from(document.querySelectorAll(`[data-part="${name}"]`))

describe("the Field Book's page in the room", () => {
  it('says what the reading is doing, and counts nothing yet', () => {
    render(() => (
      <LitFieldBook
        pct={12}
        keyName={null}
        counts={null}
        phase="opening the vocal"
        duration={252}
      />
    ))
    expect(part('heading')[0]).toHaveTextContent('Reading: opening the vocal')
    expect(part('pct')[0]).toHaveTextContent('12%')
    expect(part('count')).toHaveLength(0)
    expect(part('timeline')).toHaveLength(0)
    expect(screen.getByRole('img')).toHaveAccessibleName(
      "The song's timeline: reading, 12%",
    )
  })

  it('says a song is not read yet before the reading, or after it failed', () => {
    render(() => (
      <LitFieldBook pct={null} keyName={null} counts={null} duration={252} />
    ))
    expect(part('heading')[0]).toHaveTextContent('Not read yet · 4:12')
    expect(part('count')).toHaveLength(0)
    expect(part('timeline')).toHaveLength(0)
  })

  it('lays a read song out by time, counted by kind, over its minutes', () => {
    read(song(6))
    expect(part('heading')[0]).toHaveTextContent('Read: E minor · 4:12')
    expect(part('count').map((count) => count.textContent)).toEqual([
      '6',
      '6',
      '0',
    ])
    expect(part('landing')).toHaveLength(6)
    expect(part('phrase')).toHaveLength(6)
    expect(document.body.textContent).toContain('none found in this song')
    // Each minute along the axis, the one too near the end left out.
    expect(document.body.textContent).toContain('0:001:002:003:004:12')
  })

  it('draws no pitch: a song moved up a fifth draws the same', () => {
    const places = (): string[] =>
      [...part('landing'), ...part('phrase')].map((mark) =>
        ['cx', 'cy', 'x', 'y', 'width']
          .map((name) => mark.getAttribute(name))
          .join(','),
      )
    read(song(6))
    const low = places()
    cleanup()
    read(song(6, 7))
    expect(places()).toEqual(low)
  })
})
