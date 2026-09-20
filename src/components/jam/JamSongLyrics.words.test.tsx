// ── JamSongLyrics: the line being sung lights up word by word ────────
// Owner request (2026-09-20): highlight the word in a jam room's lyrics the
// way Karaoke Night and the mixer do. The arithmetic is shared with them
// (lib/jam/jam-line-words asks `computeActiveWord`); what is pinned here is
// what the SHEET does with the answer -- and what it must not do, which is
// split every line of a song into spans to be repainted every frame.

import { cleanup, render } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamSongLyrics } from '@/components/jam/JamSongLyrics'
import type { LyricsLineTiming } from '@/lib/jam/types'

vi.mock('@/stores/jam-store', () => ({
  assignJamSongLines: vi.fn(),
  jamAssignBrush: () => null,
  jamIsHost: () => true,
  jamLineIsMine: () => false,
  jamPeerId: () => 'me',
  jamPeers: () => [],
  jamSong: () => null,
  jamSongParts: () => ({}),
}))
vi.mock('@/components/jam/JamAssignBar', () => ({
  JamAssignBar: () => <div data-testid="stub-assign-bar" />,
}))
vi.mock('@/components/jam/JamLyricsFinder', () => ({
  JamLyricsFinder: () => <div data-testid="stub-finder" />,
}))

const MAPPED: LyricsLineTiming[] = [
  {
    text: 'sing it out loud',
    startSec: 10,
    endSec: 16,
    words: ['sing', 'it', 'out', 'loud'],
    wordStartsSec: [10, 11, 12, 13],
    wordEndsSec: [null, null, null, 15.5],
  },
  { text: 'and once again', startSec: 16, endSec: 20 },
  { text: 'the last line', startSec: 20 },
]

function renderSheet(lines = MAPPED) {
  const [position, setPosition] = createSignal(0)
  const utils = render(() => (
    <JamSongLyrics lines={lines} positionSec={position} showNotes={false} />
  ))
  const row = (index: number): HTMLElement =>
    utils.container.querySelector(`[data-line="${index}"]`) as HTMLElement
  const words = (index: number): HTMLElement[] =>
    Array.from(row(index).querySelectorAll<HTMLElement>('[data-word]'))
  const states = (index: number): (string | undefined)[] =>
    words(index).map((w) => w.dataset.word)
  return { ...utils, row, words, states, setPosition }
}

beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollTo = vi.fn() as typeof Element.prototype.scrollTo
})

afterEach(cleanup)

describe('the line being sung', () => {
  it('is the only one split into words', () => {
    const { words, setPosition } = renderSheet()
    expect(words(0)).toHaveLength(0)
    setPosition(10.2)
    expect(words(0).map((w) => w.textContent?.trim())).toEqual([
      'sing',
      'it',
      'out',
      'loud',
    ])
    expect(words(1)).toHaveLength(0)
    expect(words(2)).toHaveLength(0)
  })

  it('reads exactly as it did before it was split', () => {
    // Same characters, same spaces: a line must not reflow as it lights.
    const { row, setPosition } = renderSheet()
    const textOf = () => row(0).querySelector('span')?.textContent
    const before = textOf()
    setPosition(10.2)
    expect(textOf()).toBe(before)
    expect(before).toBe('sing it out loud')
  })

  it('goes back to one text node when the song moves on', () => {
    const { words, setPosition } = renderSheet()
    setPosition(10.2)
    setPosition(16.5)
    expect(words(0)).toHaveLength(0)
    expect(words(1)).toHaveLength(3)
  })

  it('lights the words behind the song and fills the one it is on', () => {
    const { states, words, setPosition } = renderSheet()
    setPosition(12.1)
    expect(states(0)).toEqual(['sung', 'sung', 'active', 'ahead'])
    const sweep = words(0)[2]!.style.getPropertyValue('--word-sweep')
    expect(Number.parseFloat(sweep)).toBeGreaterThan(0)
    expect(Number.parseFloat(sweep)).toBeLessThan(100)
    // Only the word being sung carries a fill.
    expect(words(0)[0]!.style.getPropertyValue('--word-sweep')).toBe('')
    expect(words(0)[3]!.style.getPropertyValue('--word-sweep')).toBe('')
  })

  it('fills a held word for as long as it was marked, not as long as it looks', () => {
    // "loud" is marked from 13 to 15.5. By its spelling it is a fifth of a
    // second long; by the mapping, two and a half.
    const { states, words, setPosition } = renderSheet()
    setPosition(15)
    expect(states(0)).toEqual(['sung', 'sung', 'sung', 'active'])
    expect(words(0)[3]!.style.getPropertyValue('--word-sweep')).toBe('80.0%')
    setPosition(15.6)
    expect(states(0)).toEqual(['sung', 'sung', 'sung', 'sung'])
  })

  it('lights a line nobody mapped too, shared out evenly', () => {
    const { states, setPosition } = renderSheet()
    setPosition(16.05)
    expect(states(1)[0]).toBe('active')
    expect(states(1).slice(1)).toEqual(['ahead', 'ahead'])
    setPosition(19.9)
    expect(states(1)).toEqual(['sung', 'sung', 'active'])
  })

  it('falls back to the text when a peer sends words that are not the line', () => {
    const { words, setPosition } = renderSheet([
      {
        text: 'sing it out loud',
        startSec: 10,
        endSec: 16,
        words: ['something', 'else'],
        wordStartsSec: [10, 11],
      },
    ])
    setPosition(10.2)
    expect(words(0).map((w) => w.textContent?.trim())).toEqual([
      'sing',
      'it',
      'out',
      'loud',
    ])
  })
})

// ── The stylesheet's half ───────────────────────────────────────────

const sheet = readFileSync(
  resolve(__dirname, 'JamLineWords.module.css'),
  'utf8',
)

const block = (selector: string, from = sheet): string => {
  const at = from.indexOf(`${selector} {`)
  if (at === -1) throw new Error(`${selector} is not in the stylesheet`)
  return from.slice(at, from.indexOf('}', at))
}

describe('the word styles', () => {
  it('never animate the swap between a colour and a clipped gradient', () => {
    // Animating `color` across it leaves the glyphs transparent for the
    // length of the transition: a black flash on every word.
    expect(block('.word')).toContain('transition: none')
  })

  it('fill the word being sung from the custom property the sheet writes', () => {
    const active = block('.wordActive')
    expect(active).toContain('var(--word-sweep, 0%)')
    expect(active).toContain('background-clip: text')
    expect(active).toContain('-webkit-background-clip: text')
  })

  it('light the word whole for anyone who asked for less movement', () => {
    const reduced = sheet.slice(
      sheet.indexOf('@media (prefers-reduced-motion: reduce)'),
    )
    expect(block('.wordActive', reduced)).toContain('background: none')
  })
})
