// ============================================================
// The phone stage's header, and the lyrics options in its More
// ============================================================
//
// The header had seven controls on a 360 px phone and the song's title got
// 48 px of it. Text size and the notes over the lyrics moved into More (owner,
// 2 October 2026), grouped the way the room's options group them, so the
// header keeps Back, the song, the stage picture, More and the song list.
// The notes row is there only for a song that has its notes, as in the
// room: absent, never dead.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { KaraokeMobileStageProps } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'
import styles from '@/components/KaraokeMobileStage.module.css'
import { ZEN_LYRICS_SCALE } from '@/features/stem-mixer/zen-navigation'
import type { AlignedWord } from '@/lib/pitch-word-alignment'

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => localStorage.clear())
afterEach(cleanup)

/** The notes a pitch analysis lands on the line "Goodbye to spring", one in
    each third of the line (a line with no word times splits it evenly). */
const NOTES: AlignedWord[] = [
  {
    word: 'Goodbye',
    startSec: 12,
    endSec: 13.3,
    midi: 62,
    noteName: 'D4',
    confidence: 1,
  },
  {
    word: 'to',
    startSec: 13.4,
    endSec: 14.6,
    midi: 64,
    noteName: 'E4',
    confidence: 1,
  },
  {
    word: 'spring',
    startSec: 14.7,
    endSec: 16,
    midi: 66,
    noteName: 'F#4',
    confidence: 1,
  },
]

function makeProps(
  over: Partial<KaraokeMobileStageProps> = {},
): KaraokeMobileStageProps {
  return {
    songTitle: 'Goodbye to Spring',
    playing: () => false,
    loading: () => false,
    loadError: () => '',
    elapsed: () => 13,
    duration: () => 246,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSeekToStart: vi.fn(),
    seekTo: vi.fn(),
    hasPrevItem: () => false,
    hasNextItem: () => true,
    onPrevItem: vi.fn(),
    onNextItem: vi.fn(),
    autoplayEnabled: () => false,
    onToggleAutoplay: vi.fn(),
    vocal: () => ({ muted: false, volume: 0.8 }),
    onToggleVocal: vi.fn(),
    onVocalVolume: vi.fn(),
    parsedLyrics: () =>
      new Map([
        [
          0,
          {
            time: 12,
            endTime: 16,
            words: ['Goodbye', 'to', 'spring'],
            key: 'l0',
          },
        ],
      ]),
    currentLineIdx: () => 0,
    lyricsLoading: () => false,
    computeActiveWord: () => ({ activeUpTo: -1, charProgress: 0, fraction: 0 }),
    onLineClick: vi.fn(),
    playlistOverlayActive: () => false,
    onPlaylistStart: vi.fn(),
    onPlaylistSkip: vi.fn(),
    onPickSession: vi.fn(),
    alignedWords: () => [],
    onBack: vi.fn(),
    ...over,
  }
}

const header = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`.${styles.header}`)
  if (el === null) throw new Error('the stage has no header')
  return el
}

const openMore = (): HTMLElement => {
  fireEvent.click(within(header()).getByRole('button', { name: 'More' }))
  return screen.getByRole('dialog', { name: 'More' })
}

describe("the phone stage's header", () => {
  it('keeps Back, the stage picture, More and the song list, and room for the song', () => {
    render(() => KaraokeMobileStage(makeProps({ alignedWords: () => NOTES })))

    expect(
      within(header())
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([
      'Back',
      'Choose karaoke stage background',
      'More',
      'Open the song list',
    ])
    expect(header().textContent).toContain('Goodbye to Spring')
  })
})

describe('the lyrics options, in More', () => {
  it('set the text size the lyrics are drawn at', () => {
    render(() => KaraokeMobileStage(makeProps()))
    const lyrics = document.querySelector<HTMLElement>(`.${styles.lyrics}`)!
    const before = lyrics.style.getPropertyValue('--lyrics-scale')

    const sizes = within(
      within(openMore()).getByRole('group', { name: 'Text size' }),
    )
    fireEvent.click(sizes.getByRole('button', { name: 'Large' }))

    expect([before, lyrics.style.getPropertyValue('--lyrics-scale')]).toEqual([
      String(ZEN_LYRICS_SCALE.current),
      String(ZEN_LYRICS_SCALE.bigger),
    ])
    expect(
      sizes.getByRole('button', { name: 'Large' }).getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('offer the notes only once the song has them, and draw them over the words', () => {
    const [aligned, setAligned] = createSignal<AlignedWord[]>([])
    render(() => KaraokeMobileStage(makeProps({ alignedWords: aligned })))
    const sheet = openMore()
    const switches = () =>
      within(sheet)
        .queryAllByRole('switch')
        .map((s) => s.getAttribute('aria-label'))
    const glyphs = () =>
      [...document.querySelectorAll(`.${styles.noteGlyph}`)].map(
        (glyph) => glyph.textContent,
      )
    const without = switches()

    setAligned(NOTES)
    const withNotes = switches()
    fireEvent.click(
      within(sheet).getByRole('switch', { name: 'Show notes over the lyrics' }),
    )

    expect([without, withNotes, glyphs()]).toEqual([
      ['Play the next song automatically'],
      ['Show notes over the lyrics', 'Play the next song automatically'],
      ['D4', 'E4', 'F#4'],
    ])
  })
})
