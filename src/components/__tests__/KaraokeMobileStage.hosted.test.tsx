// ============================================================
// KaraokeMobileStage — hosted by the native Karaoke room
// ============================================================
//
// The room is the shell's (REQ-NRM-023): its header carries the Back, the
// room's name and the gear, and the room's own sheets carry the toggles and
// the library. So the zen stage, hosted, draws inside the room's box rather
// than as a portal over the viewport (REQ-NRM-004), has no Back, picture
// button or header toggles of its own (REQ-NRM-032), and takes its lyrics
// size and notes switch from the room. Everything else — the lyrics, the
// sing pill, the bottom bar, the load and error cards — is the stage it has
// always been.

import { cleanup, fireEvent, render, screen, within, } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { KaraokeMobileStageProps, KaraokeStageHosting, } from '@/components/KaraokeMobileStage'
import { HOSTED_REVEAL_GRACE_MS, KaraokeMobileStage, } from '@/components/KaraokeMobileStage'
import { ZEN_LYRICS_SCALE } from '@/features/stem-mixer/zen-navigation'

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

afterEach(cleanup)

function hosting(over: Partial<KaraokeStageHosting> = {}): KaraokeStageHosting {
  return {
    byline: () => 'Josh Woodward · CC BY 4.0',
    onOpenLibrary: vi.fn(),
    lyricsSize: () => 'current',
    noteGlyphs: () => false,
    ...over,
  }
}

function makeProps(
  over: Partial<KaraokeMobileStageProps> = {},
): KaraokeMobileStageProps {
  return {
    songTitle: 'Goodbye to Spring',
    playing: () => false,
    loading: () => false,
    loadError: () => '',
    elapsed: () => 0,
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
    currentLineIdx: () => -1,
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

/** Render inside a box standing in for the room, the way the room does. */
function renderInRoom(props: KaraokeMobileStageProps): HTMLElement {
  render(() => (
    <div data-testid="room-box">
      <KaraokeMobileStage {...props} />
    </div>
  ))
  return screen.getByTestId('room-box')
}

describe('the zen stage, hosted by the Karaoke room', () => {
  it('draws inside the room box, not as a portal over the viewport', () => {
    const box = renderInRoom(makeProps({ hosted: hosting() }))
    const stage = screen.getByTestId('karaoke-mobile-stage')
    expect(box.contains(stage)).toBe(true)
    expect(stage.dataset.hosted).toBe('')
  })

  it('has no Back, picture button or More of its own', () => {
    renderInRoom(makeProps({ hosted: hosting() }))
    expect(screen.queryByLabelText('Back')).toBeNull()
    // The room's options sheet holds the text size, the notes and autoplay.
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull()
    expect(screen.queryByLabelText('Open the song list')).toBeNull()
    expect(screen.queryByText('Stage')).toBeNull()
  })

  it('names the song and its credit, and the line opens the library', () => {
    const onOpenLibrary = vi.fn()
    renderInRoom(makeProps({ hosted: hosting({ onOpenLibrary }) }))
    const line = screen.getByTestId('karaoke-songline')
    expect(line.textContent).toContain('Goodbye to Spring')
    expect(line.textContent).toContain('Josh Woodward · CC BY 4.0')
    fireEvent.click(line)
    expect(onOpenLibrary).toHaveBeenCalledTimes(1)
  })

  it('takes the lyrics size from the room', () => {
    renderInRoom(makeProps({ hosted: hosting({ lyricsSize: () => 'bigger' }) }))
    const lyrics = screen.getByTestId('karaoke-lyrics')
    expect(lyrics.style.getPropertyValue('--lyrics-scale')).toBe(
      String(ZEN_LYRICS_SCALE.bigger),
    )
  })

  it('keeps the transport, the sing pill and the lyrics', () => {
    renderInRoom(makeProps({ hosted: hosting() }))
    expect(screen.getByLabelText('Play')).toBeTruthy()
    expect(screen.getByLabelText('Next song')).toBeTruthy()
    expect(
      screen.getByLabelText('Toggle guide vocals (drag to set their level)'),
    ).toBeTruthy()
    expect(screen.getByTestId('karaoke-lyrics').textContent).toContain(
      'Goodbye',
    )
  })

  it('offers no way out of the load card: the room header has the Back', () => {
    renderInRoom(makeProps({ hosted: hosting(), loading: () => true }))
    expect(screen.getByText('Raising the curtain…')).toBeTruthy()
    expect(screen.queryByText('Go back')).toBeNull()
  })

  it('without a host it is the stage it was: its own Back, and its options in More', () => {
    const onBack = vi.fn()
    renderInRoom(makeProps({ onBack }))
    fireEvent.click(screen.getByLabelText('Back'))
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    const sizes = within(
      screen.getByRole('dialog', { name: 'More' }),
    ).getByRole('group', { name: 'Text size' })

    expect([
      onBack.mock.calls.length,
      sizes.textContent,
      screen.queryByTestId('karaoke-songline'),
    ]).toEqual([1, 'SmallMediumLarge', null])
  })
})

// The room dims its own picture from its first frame. A hosted stage shown
// while its song loaded put its loading card, and the lyric sheet's first
// frame, over that picture for a tenth of a second on the way in, then cut
// them away: the flicker on entering the room (owner, 3 Oct).
describe('arriving in the Karaoke room', () => {
  const revealed = (): boolean =>
    screen.getByTestId('karaoke-mobile-stage').dataset.revealed === ''

  it('stays out of sight and out of reach while its song loads', () => {
    renderInRoom(
      makeProps({ hosted: hosting({ arriving: true }), loading: () => true }),
    )
    expect(revealed()).toBe(false)
    expect(screen.getByTestId('karaoke-mobile-stage').inert).toBe(true)
  })

  it('appears once its song is ready, and stays when another load starts', () => {
    const [loading, setLoading] = createSignal(true)
    renderInRoom(makeProps({ hosted: hosting({ arriving: true }), loading }))
    setLoading(false)
    expect(revealed()).toBe(true)
    expect(screen.getByTestId('karaoke-mobile-stage').inert).toBe(false)
    setLoading(true)
    expect(revealed()).toBe(true)
  })

  it('shows a slow load after a moment, so the singer sees it working', () => {
    vi.useFakeTimers()
    try {
      renderInRoom(
        makeProps({ hosted: hosting({ arriving: true }), loading: () => true }),
      )
      vi.advanceTimersByTime(HOSTED_REVEAL_GRACE_MS - 1)
      expect(revealed()).toBe(false)
      vi.advanceTimersByTime(1)
      expect(revealed()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  // Only the song the room opens with waits. A song changed in the room
  // replaces a stage the singer was already using, so blanking the room
  // until it loaded hid the bar mid-run and lost the taps meant for it.
  it('shows a song changed in the room at once, loading card and all', () => {
    renderInRoom(makeProps({ hosted: hosting(), loading: () => true }))
    expect(revealed()).toBe(true)
    expect(screen.getByTestId('karaoke-mobile-stage').inert).toBe(false)
    expect(screen.getByText('Raising the curtain…')).toBeTruthy()
  })

  it('shows a song that could not load at once', () => {
    renderInRoom(
      makeProps({
        hosted: hosting({ arriving: true }),
        loading: () => true,
        loadError: () => 'This song could not be loaded.',
      }),
    )
    expect(revealed()).toBe(true)
  })
})
