// ============================================================
// The backing level lives beside the mic, on the surface that needs it
// ============================================================
//
// The first cut of this control was a bare `<input type="range">` in the
// desktop mixer's header. Reported after using it: "the slider is basically
// only visible on desktop in top of the stem mixer, and is ugly as hell. So
// the one place it is needed, can't see it, since stem mixer isn't visible
// on mobile small screens, only the zen mode."
//
// Both halves are real. Under `isNarrow()` StemMixer renders this stage
// INSTEAD of the mixer — the header the slider lived in is not on the page at
// all — and iOS's noise cancelling, which is what turns the backing track
// down, is a phone behaviour. So the control moved here, next to the mic,
// behind a tap: the mic is the trigger, and the level is something you set
// when it drops, not something you ride.
//
// The maths of the level and its ceiling is pinned in
// `src/features/stem-mixer/master-headroom.test.ts`; the wiring from the
// store to this stage in `src/tests/mixer-music-level.test.ts`. This file is
// the control itself.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { KaraokeMobileStageProps } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'
import { MUSIC_LEVEL } from '@/features/stem-mixer/master-headroom'

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
    ...over,
  }
}

/** The stage wired the way StemMixer wires it: mic, level, and the bounds. */
function mountWithLevel(over: Partial<KaraokeMobileStageProps> = {}): {
  onMusicLevel: ReturnType<typeof vi.fn>
} {
  const onMusicLevel = vi.fn()
  render(() =>
    KaraokeMobileStage(
      makeProps({
        micActive: () => false,
        onToggleMic: vi.fn(),
        musicLevel: () => 0.7,
        onMusicLevel,
        musicLevelRange: MUSIC_LEVEL.spec,
        ...over,
      }),
    ),
  )
  return { onMusicLevel }
}

const toggle = (): HTMLElement =>
  screen.getByTestId('mobile-music-level-toggle')
const slider = (): HTMLInputElement =>
  screen.getByTestId('mobile-music-level') as HTMLInputElement

describe('the button', () => {
  it('is there, beside the mic, when the host offers a level', () => {
    mountWithLevel()
    expect(toggle()).toBeTruthy()
    expect(toggle().getAttribute('aria-label')).toBe('Music level')
  })

  it('shares the transport row with the mic', () => {
    // The pairing is the whole idea: one button for what goes in, one for
    // what comes out, on the bar you already have your thumb on. A control
    // that drifted into the header would be the bug this fixes, again.
    mountWithLevel()
    const mic = screen.getByLabelText('Toggle your microphone')
    const row = mic.parentElement?.parentElement
    expect(row).not.toBeNull()
    expect(row?.contains(toggle())).toBe(true)
  })

  it('survives the stage settings being hidden', () => {
    // The moment this matters most is a scored performance run, and that is
    // exactly the preset that passes `showStageSettings: false`. Sharing a
    // gate with the settings sheet would hide the control from the one mode
    // that needs it.
    mountWithLevel({ showStageSettings: false })
    expect(toggle()).toBeTruthy()
  })

  it('is absent when the host cannot offer one', () => {
    // The three props travel together and are optional together, so the
    // singing stage and the tests that predate them still mount.
    render(() => KaraokeMobileStage(makeProps({ onToggleMic: vi.fn() })))
    expect(screen.queryByTestId('mobile-music-level-toggle')).toBeNull()
    expect(screen.queryByTestId('mobile-music-level-sheet')).toBeNull()
  })

  it('needs all three, not just the value', () => {
    // A half-wired host would render a button that opens a sheet whose
    // slider has no bounds and goes nowhere.
    render(() => KaraokeMobileStage(makeProps({ musicLevel: () => 0.7 })))
    expect(screen.queryByTestId('mobile-music-level-toggle')).toBeNull()
  })
})

describe('the sheet', () => {
  it('starts closed — the bar stays a transport', () => {
    mountWithLevel()
    expect(screen.queryByTestId('mobile-music-level-sheet')).toBeNull()
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens on a tap and closes on the next one', () => {
    mountWithLevel()
    fireEvent.click(toggle())
    expect(screen.getByTestId('mobile-music-level-sheet')).toBeTruthy()
    expect(toggle().getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(toggle())
    expect(screen.queryByTestId('mobile-music-level-sheet')).toBeNull()
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('names the region it opens', () => {
    mountWithLevel()
    fireEvent.click(toggle())
    expect(toggle().getAttribute('aria-controls')).toBe('karaoke-music-level')
    expect(screen.getByTestId('mobile-music-level-sheet').id).toBe(
      'karaoke-music-level',
    )
  })

  it('leaves the song playing behind it', () => {
    // Deliberately not a modal: the only way to judge a level is to hear it
    // while you move the slider. Opening it must not pause anything.
    const onPause = vi.fn()
    mountWithLevel({ playing: () => true, onPause })
    fireEvent.click(toggle())
    expect(onPause).not.toHaveBeenCalled()
  })
})

describe('the slider', () => {
  it('carries the store bounds rather than retyped ones', () => {
    // Retyped bounds are how a slider ends up able to set a value the store
    // clamps away, so the UI and the bus disagree.
    mountWithLevel()
    fireEvent.click(toggle())
    expect(slider().min).toBe(String(MUSIC_LEVEL.spec.min))
    expect(slider().max).toBe(String(MUSIC_LEVEL.spec.max))
    expect(slider().step).toBe(String(MUSIC_LEVEL.spec.step))
  })

  it('shows where the level actually is', () => {
    mountWithLevel({ musicLevel: () => 1.4 })
    fireEvent.click(toggle())
    expect(slider().value).toBe('1.4')
  })

  it('reports a number, not the input string', () => {
    const { onMusicLevel } = mountWithLevel()
    fireEvent.click(toggle())
    fireEvent.input(slider(), { target: { value: '1.25' } })
    expect(onMusicLevel).toHaveBeenCalledWith(1.25)
  })

  it('reads out as a percentage of the shipped level', () => {
    // 0.7 is what every mix sounded like before there was a control, so it
    // is the only honest 100%. Reading out raw gain would make the default
    // look like something was already turned down.
    mountWithLevel()
    fireEvent.click(toggle())
    expect(
      screen.getByTestId('mobile-music-level-sheet').textContent,
    ).toContain('100%')

    cleanup()
    mountWithLevel({ musicLevel: () => 1.4 })
    fireEvent.click(toggle())
    expect(
      screen.getByTestId('mobile-music-level-sheet').textContent,
    ).toContain('200%')
  })

  it('says why it exists, without blaming the app', () => {
    // The app does no ducking — audited. Wording that implied it did would
    // send people hunting for a setting that does not exist.
    mountWithLevel()
    fireEvent.click(toggle())
    const text =
      screen.getByTestId('mobile-music-level-sheet').textContent ?? ''
    expect(text).toMatch(/quieten the backing track while your mic is on/i)
  })
})
