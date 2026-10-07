// ============================================================
// The phone stage's header, and the lyrics options in its More
// ============================================================
//
// The header had seven controls on a 360 px phone and the song's title got
// 48 px of it. Text size and the notes over the lyrics moved into More (owner,
// 2 October 2026), grouped the way the room's options group them, so the
// header keeps Back, the song, the stage picture, More and the song list.
// The notes row is there for a song that has its notes and for a song whose
// notes the stage can find (the host gives it onEnsureNotes): the header's
// toggle ran that analysis, and moving the toggle here kept it (owner, 7
// October 2026). With neither it is absent, never dead.

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

  it('offer the notes to a stage that cannot find them only once the song has them, and draw them over the words', () => {
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

describe('the notes row, where the stage can find the notes', () => {
  const NOTES_ROW = 'Show notes over the lyrics'
  const FINDS_FIRST = "Finds this song's notes first"
  const FINDING = 'Finding the notes'
  const HAS_NOTES = 'This song has its notes'

  /** A host that runs the analysis when asked: finding from the call on. */
  function mountFinder(over: Partial<KaraokeMobileStageProps> = {}) {
    const [aligned, setAligned] = createSignal<AlignedWord[]>([])
    const [finding, setFinding] = createSignal(false)
    const onEnsureNotes = vi.fn(() => setFinding(true))
    render(() =>
      KaraokeMobileStage(
        makeProps({
          alignedWords: aligned,
          onEnsureNotes,
          notesAnalyzing: finding,
          notesProgress: () => 40,
          ...over,
        }),
      ),
    )
    const sheet = openMore()
    return {
      onEnsureNotes,
      setAligned,
      setFinding,
      notes: () => within(sheet).getByRole('switch', { name: NOTES_ROW }),
      subLabels: () =>
        [HAS_NOTES, FINDING, FINDS_FIRST].filter(
          (line) => within(sheet).queryByText(line) !== null,
        ),
    }
  }
  const glyphs = () =>
    [...document.querySelectorAll(`.${styles.noteGlyph}`)].map(
      (glyph) => glyph.textContent,
    )
  const readingStatus = () =>
    screen.queryByText(/Reading the vocal to find the notes/) !== null

  it('offers a song with no notes the finding of them, and asks the host once when they are turned on', () => {
    const { notes, subLabels, onEnsureNotes } = mountFinder()
    const before = [
      notes().getAttribute('aria-checked'),
      subLabels(),
      onEnsureNotes.mock.calls.length,
    ]

    fireEvent.click(notes())

    expect(before).toEqual(['false', [FINDS_FIRST], 0])
    expect(onEnsureNotes).toHaveBeenCalledTimes(1)
  })

  it('reads on and says it is finding while the analysis runs, then draws the notes as they land', () => {
    const { notes, subLabels, setAligned, setFinding } = mountFinder()

    fireEvent.click(notes())
    const finding = [
      notes().getAttribute('aria-checked'),
      subLabels(),
      readingStatus(),
      glyphs(),
    ]
    setAligned(NOTES)
    setFinding(false)

    expect(finding).toEqual(['true', [FINDING], true, []])
    expect([
      notes().getAttribute('aria-checked'),
      subLabels(),
      readingStatus(),
      glyphs(),
    ]).toEqual(['true', [HAS_NOTES], false, ['D4', 'E4', 'F#4']])
  })

  it('does not ask the host for notes the song already has', () => {
    const { notes, subLabels, onEnsureNotes, setAligned } = mountFinder()
    setAligned(NOTES)
    const before = subLabels()

    fireEvent.click(notes())

    expect(before).toEqual([HAS_NOTES])
    expect(onEnsureNotes).not.toHaveBeenCalled()
    expect([notes().getAttribute('aria-checked'), glyphs()]).toEqual([
      'true',
      ['D4', 'E4', 'F#4'],
    ])
  })

  it('reads off again when the analysis ends with no notes, and a tap asks again', () => {
    const { notes, subLabels, onEnsureNotes, setFinding } = mountFinder()
    fireEvent.click(notes())

    // The analysis failed: nothing finding, and nothing found.
    setFinding(false)
    const failed = [notes().getAttribute('aria-checked'), subLabels()]
    fireEvent.click(notes())

    expect(failed).toEqual(['false', [FINDS_FIRST]])
    expect(onEnsureNotes).toHaveBeenCalledTimes(2)
    expect(notes().getAttribute('aria-checked')).toBe('true')
  })

  it('reads off for a saved "on" with no notes, finds nothing by itself, and a tap asks', () => {
    localStorage.setItem('sm-zen-note-glyphs', 'true')
    const { notes, subLabels, onEnsureNotes } = mountFinder()
    const opened = [notes().getAttribute('aria-checked'), subLabels()]
    const askedOnOpening = onEnsureNotes.mock.calls.length

    fireEvent.click(notes())

    expect([opened, askedOnOpening]).toEqual([['false', [FINDS_FIRST]], 0])
    expect(onEnsureNotes).toHaveBeenCalledTimes(1)
    expect(notes().getAttribute('aria-checked')).toBe('true')
  })

  it('turns the notes off with a tap while they show, and asks for nothing', () => {
    const { notes, onEnsureNotes, setAligned } = mountFinder()
    setAligned(NOTES)
    fireEvent.click(notes())
    const shown = glyphs()

    fireEvent.click(notes())

    expect(shown).toEqual(['D4', 'E4', 'F#4'])
    expect([notes().getAttribute('aria-checked'), glyphs()]).toEqual([
      'false',
      [],
    ])
    expect(onEnsureNotes).not.toHaveBeenCalled()
  })

  it('turns the notes off with a tap while they are being found, and the status goes with it', () => {
    const { notes, onEnsureNotes } = mountFinder()
    fireEvent.click(notes())
    const finding = readingStatus()

    fireEvent.click(notes())

    expect([
      finding,
      readingStatus(),
      notes().getAttribute('aria-checked'),
    ]).toEqual([true, false, 'false'])
    expect(onEnsureNotes).toHaveBeenCalledTimes(1)
  })
})
