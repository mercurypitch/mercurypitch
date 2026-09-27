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

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { KaraokeMobileStageProps, KaraokeStageHosting, } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'
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

  it('has no Back, picture button or header toggles of its own', () => {
    renderInRoom(makeProps({ hosted: hosting() }))
    expect(screen.queryByLabelText('Back')).toBeNull()
    expect(screen.queryByLabelText('Cycle the lyrics text size')).toBeNull()
    expect(screen.queryByLabelText('Toggle autoplay')).toBeNull()
    expect(screen.queryByLabelText('Open the song list')).toBeNull()
    expect(
      screen.queryByLabelText('Toggle the sing-this-note labels'),
    ).toBeNull()
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

  it('without a host it is the stage it was: its own Back and toggles', () => {
    renderInRoom(makeProps())
    expect(screen.getByLabelText('Back')).toBeTruthy()
    expect(screen.getByLabelText('Cycle the lyrics text size')).toBeTruthy()
    expect(screen.queryByTestId('karaoke-songline')).toBeNull()
  })
})
