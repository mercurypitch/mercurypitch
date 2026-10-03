// ============================================================
// KaraokeMobileStage — back to the line being sung after a resize
// ============================================================
//
// The sheet follows the line being sung only when the line changes, so a
// resize left it wherever the old size had put it. Back from Android's
// picture-in-picture window the line being sung sat off screen until the
// next one started (owner, 3 Oct). A change of size now centres the current
// line at once, without the glide.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import type { KaraokeMobileStageProps, KaraokeStageHosting, } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'

/** A ResizeObserver the test reports sizes through. */
class FakeResizeObserver {
  static made: FakeResizeObserver[] = []
  readonly observe = vi.fn()
  readonly disconnect = vi.fn()
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.made.push(this)
  }
  report(width: number, height: number): void {
    const entry = { contentRect: { width, height } } as ResizeObserverEntry
    this.callback([entry], this as unknown as ResizeObserver)
  }
}

const scrollIntoView = vi.fn()
const scrollTo = vi.fn()

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
  Element.prototype.scrollIntoView = scrollIntoView
  Element.prototype.scrollTo = scrollTo
})

beforeEach(() => {
  FakeResizeObserver.made = []
  vi.stubGlobal('ResizeObserver', FakeResizeObserver)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  scrollIntoView.mockClear()
  scrollTo.mockClear()
})

function hosting(): KaraokeStageHosting {
  return {
    byline: () => 'Josh Woodward · CC BY 4.0',
    onOpenLibrary: vi.fn(),
    lyricsSize: () => 'current',
    noteGlyphs: () => false,
  }
}

const LINES = new Map([
  [0, { time: 12, endTime: 16, words: ['Goodbye', 'to', 'spring'], key: 'l0' }],
  [1, { time: 16, endTime: 20, words: ['Hello', 'to', 'summer'], key: 'l1' }],
])

function mount(currentLineIdx: () => number): FakeResizeObserver {
  const props: KaraokeMobileStageProps = {
    hosted: hosting(),
    songTitle: 'Goodbye to Spring',
    playing: () => true,
    loading: () => false,
    loadError: () => '',
    elapsed: () => 17,
    duration: () => 246,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSeekToStart: vi.fn(),
    seekTo: vi.fn(),
    hasPrevItem: () => false,
    hasNextItem: () => true,
    onPrevItem: vi.fn(),
    onNextItem: vi.fn(),
    autoplayEnabled: () => true,
    onToggleAutoplay: vi.fn(),
    vocal: () => ({ muted: false, volume: 0.8 }),
    onToggleVocal: vi.fn(),
    onVocalVolume: vi.fn(),
    parsedLyrics: () => LINES,
    currentLineIdx,
    lyricsLoading: () => false,
    computeActiveWord: () => ({ activeUpTo: -1, charProgress: 0, fraction: 0 }),
    onLineClick: vi.fn(),
    playlistOverlayActive: () => false,
    onPlaylistStart: vi.fn(),
    onPlaylistSkip: vi.fn(),
    onPickSession: vi.fn(),
    alignedWords: () => [],
    onBack: vi.fn(),
  }
  render(() => <KaraokeMobileStage {...props} />)
  const sheet = screen.getByTestId('karaoke-lyrics')
  const watch = FakeResizeObserver.made.find((observer) =>
    observer.observe.mock.calls.some((call) => call[0] === sheet),
  )
  if (watch === undefined) throw new Error('the lyric sheet is not watched')
  // Mounting centres the starting line; the tests are about what follows.
  scrollIntoView.mockClear()
  scrollTo.mockClear()
  return watch
}

/** The text of each element scrollIntoView was called on. */
const centred = (): string[] =>
  scrollIntoView.mock.contexts.map((element) =>
    String((element as Element).textContent),
  )

describe('the lyric sheet after a resize', () => {
  it('centres the line being sung at once when the sheet changes size', () => {
    const watch = mount(() => 1)
    watch.report(240, 120) // the picture-in-picture window
    watch.report(800, 1100) // back in the app

    expect(centred().at(-1)).toContain('summer')
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      block: 'center',
      behavior: 'auto',
    })
  })

  it('leaves the sheet alone on its first size, and when the size is the same', () => {
    const watch = mount(() => 1)
    watch.report(800, 1100)
    watch.report(800, 1100)

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('does not pull the sheet back while the singer has scrolled away', () => {
    const watch = mount(() => 1)
    watch.report(800, 1100)
    fireEvent.touchMove(screen.getByTestId('karaoke-lyrics'))
    watch.report(1100, 800)

    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('goes back to the top before the first line', () => {
    const [line] = createSignal(-1)
    // eslint-disable-next-line solid/reactivity -- read by the stage's own effect
    const watch = mount(line)
    watch.report(800, 1100)
    watch.report(1100, 800)

    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' })
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('follows the line being sung at the time of the resize', () => {
    const [line, setLine] = createSignal(0)
    // eslint-disable-next-line solid/reactivity -- read by the stage's own effect
    const watch = mount(line)
    watch.report(800, 1100)
    setLine(1)
    scrollIntoView.mockClear()
    watch.report(240, 120)

    expect(centred()).toEqual([expect.stringContaining('summer')])
  })
})
