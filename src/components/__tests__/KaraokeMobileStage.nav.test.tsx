// ============================================================
// KaraokeMobileStage — zen transport wiring (nav + autoplay)
// ============================================================
//
// Verifies the button-to-handler wiring for the zen song navigation controls
// (the seek-vs-prev back gesture, the next button's enabled state, and the
// autoplay toggle). The navigation *decisions* are unit-tested in
// src/tests/zen-navigation.test.ts; this mounts the stage and drives the
// controls to confirm they call through to the right props (REQ-ZEN-001/002,
// REQ-ZEN-005, REQ-ZEN-006/007).

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { KaraokeMobileStageProps } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'

beforeAll(() => {
  // The stage reads prefers-reduced-motion at render; jsdom lacks matchMedia.
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
  // jsdom implements neither scroll method the lyrics auto-follow calls.
  Element.prototype.scrollTo = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(cleanup)

function makeProps(
  over: Partial<KaraokeMobileStageProps> = {},
): KaraokeMobileStageProps {
  return {
    songTitle: 'Test Song',
    playing: () => false,
    loading: () => false,
    loadError: () => '',
    elapsed: () => 0,
    duration: () => 200,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onSeekToStart: vi.fn(),
    seekTo: vi.fn(),
    hasPrevItem: () => false,
    hasNextItem: () => false,
    onPrevItem: vi.fn(),
    onNextItem: vi.fn(),
    autoplayEnabled: () => false,
    onToggleAutoplay: vi.fn(),
    vocal: () => ({ muted: false, volume: 0.8 }),
    onToggleVocal: vi.fn(),
    onVocalVolume: vi.fn(),
    parsedLyrics: () => new Map(),
    currentLineIdx: () => -1,
    lyricsLoading: () => false,
    computeActiveWord: () => ({ activeUpTo: -1, charProgress: 0, fraction: 0 }),
    onLineClick: vi.fn(),
    playlistOverlayActive: () => false,
    onPlaylistStart: vi.fn(),
    onPlaylistSkip: vi.fn(),
    // Present so the header autoplay toggle + song-list button render.
    onPickSession: vi.fn(),
    ...over,
  }
}

describe('KaraokeMobileStage back control (REQ-ZEN-001/002)', () => {
  it('past the threshold, seeks to start (does not go to previous)', () => {
    const onSeekToStart = vi.fn()
    const onPrevItem = vi.fn()
    render(() =>
      KaraokeMobileStage(
        makeProps({
          elapsed: () => 30,
          hasPrevItem: () => true,
          onSeekToStart,
          onPrevItem,
        }),
      ),
    )
    fireEvent.click(screen.getByLabelText('Back to the start of the song'))
    expect(onSeekToStart).toHaveBeenCalledTimes(1)
    expect(onPrevItem).not.toHaveBeenCalled()
  })

  it('near the start with a previous item, jumps to previous', () => {
    const onSeekToStart = vi.fn()
    const onPrevItem = vi.fn()
    render(() =>
      KaraokeMobileStage(
        makeProps({
          elapsed: () => 0,
          hasPrevItem: () => true,
          onSeekToStart,
          onPrevItem,
        }),
      ),
    )
    fireEvent.click(screen.getByLabelText('Back to the start of the song'))
    expect(onPrevItem).toHaveBeenCalledTimes(1)
    expect(onSeekToStart).not.toHaveBeenCalled()
  })

  it('near the start with no previous item, still seeks to start', () => {
    const onSeekToStart = vi.fn()
    const onPrevItem = vi.fn()
    render(() =>
      KaraokeMobileStage(
        makeProps({
          elapsed: () => 0,
          hasPrevItem: () => false,
          onSeekToStart,
          onPrevItem,
        }),
      ),
    )
    fireEvent.click(screen.getByLabelText('Back to the start of the song'))
    expect(onSeekToStart).toHaveBeenCalledTimes(1)
    expect(onPrevItem).not.toHaveBeenCalled()
  })
})

describe('KaraokeMobileStage next button (REQ-ZEN-005)', () => {
  it('is disabled when there is no next item', () => {
    render(() => KaraokeMobileStage(makeProps({ hasNextItem: () => false })))
    expect(screen.getByLabelText('Next song')).toBeDisabled()
  })

  it('is enabled and advances when a next item exists', () => {
    const onNextItem = vi.fn()
    render(() =>
      KaraokeMobileStage(makeProps({ hasNextItem: () => true, onNextItem })),
    )
    const next = screen.getByLabelText('Next song')
    expect(next).not.toBeDisabled()
    fireEvent.click(next)
    expect(onNextItem).toHaveBeenCalledTimes(1)
  })
})

describe('KaraokeMobileStage autoplay toggle (REQ-ZEN-006/007)', () => {
  it('reflects the off state and toggles on click', () => {
    const onToggleAutoplay = vi.fn()
    render(() =>
      KaraokeMobileStage(
        makeProps({ autoplayEnabled: () => false, onToggleAutoplay }),
      ),
    )
    const toggle = screen.getByLabelText('Toggle autoplay')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(onToggleAutoplay).toHaveBeenCalledTimes(1)
  })

  it('reflects the on state', () => {
    render(() => KaraokeMobileStage(makeProps({ autoplayEnabled: () => true })))
    expect(screen.getByLabelText('Toggle autoplay')).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
