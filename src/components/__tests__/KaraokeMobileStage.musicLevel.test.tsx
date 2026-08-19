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
// The second report was about the shape of it. The first cut opened a
// full-width row inside the bottom bar: "it opens a full modal, with a huge
// slider… on my tablet it conceals all playback commands, and none are
// reachable, not even the speaker toggle that opened it". Two faults in one.
// The row was LAYOUT — the bar grew by its height, and a device with no room
// to give pushed the transport out of reach — and the only way to close it
// was the button it had just made unreachable. It is a vertical slider that
// rises over the lyrics now, anchored to its button, closed by a tap
// anywhere or Escape.
//
// The maths of the level and its ceiling is pinned in
// `src/features/stem-mixer/master-headroom.test.ts`; the wiring from the
// store to this stage in `src/tests/mixer-music-level.test.ts`. This file is
// the control itself.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
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

  it('leaves the transport symmetrical either way', () => {
    // The slot is a flex third whether or not it holds anything, so play
    // stays dead centre. Empty, it must also be invisible to a screen
    // reader — an announced blank third is worse than no third.
    mountWithLevel()
    const withLevel = toggle().parentElement
    expect(withLevel?.getAttribute('aria-hidden')).toBeNull()

    cleanup()
    render(() => KaraokeMobileStage(makeProps({ onToggleMic: vi.fn() })))
    const mic = screen.getByLabelText('Toggle your microphone')
    const row = mic.parentElement?.parentElement
    const emptySlot = row?.lastElementChild
    expect(emptySlot?.getAttribute('aria-hidden')).toBe('true')
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

describe('the popover', () => {
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

  it('hangs off the button, not off the bar', () => {
    // The reported fault in one assertion: the panel used to be a sibling of
    // the transport inside the bottom bar, so opening it made the bar taller
    // and moved the transport. Living inside the button's own slot is what
    // lets it be positioned over the lyrics instead.
    mountWithLevel()
    fireEvent.click(toggle())
    const panel = screen.getByTestId('mobile-music-level-sheet')
    const slot = toggle().parentElement
    expect(slot).not.toBeNull()
    expect(slot?.contains(panel)).toBe(true)
  })

  it('is positioned out of the flow, above its own button', () => {
    // Structure alone does not keep the bar from growing — the positioning
    // does, and it is the whole fix. Asserted against the stylesheet because
    // jsdom applies no CSS module rules.
    const css = readFileSync(
      'src/components/KaraokeMobileStage.module.css',
      'utf8',
    )
    const rule = css.slice(
      css.indexOf('.levelPopover {'),
      css.indexOf('}', css.indexOf('.levelPopover {')),
    )
    expect(rule).toContain('position: absolute')
    expect(rule).toContain('bottom: calc(100% + 10px)')
    expect(css).toMatch(/\.levelAnchor \{\s*position: relative;/)
  })

  it('closes on a tap anywhere outside it', () => {
    // The tablet report: the panel covered the transport and the only way
    // out was the button it covered. Any tap outside is a way out now.
    mountWithLevel()
    fireEvent.click(toggle())
    expect(screen.getByTestId('mobile-music-level-sheet')).toBeTruthy()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByTestId('mobile-music-level-sheet')).toBeNull()
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
  })

  it('stays open while you are dragging the slider itself', () => {
    // The outside-tap close must not fire on the control it belongs to, or
    // the panel would shut the instant a thumb landed on the thumb.
    mountWithLevel()
    fireEvent.click(toggle())
    fireEvent.pointerDown(slider())
    expect(screen.getByTestId('mobile-music-level-sheet')).toBeTruthy()
  })

  it('closes on Escape', () => {
    mountWithLevel()
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('mobile-music-level-sheet')).toBeNull()
  })

  it('ignores every other key', () => {
    // The listener is on `document` while the panel is open, so a handler
    // that closed on anything would eat the stage's own typing.
    mountWithLevel()
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'ArrowUp' })
    fireEvent.keyDown(document, { key: 'e' })
    expect(screen.getByTestId('mobile-music-level-sheet')).toBeTruthy()
  })

  it('leaves no listeners behind once it closes', () => {
    // The close paths live on `document`, so an effect that forgot to clean
    // up would keep closing a panel that no longer exists on every stray tap.
    const removed: string[] = []
    const spy = vi
      .spyOn(document, 'removeEventListener')
      .mockImplementation(function (this: Document, ...args: unknown[]) {
        removed.push(args[0] as string)
      } as typeof document.removeEventListener)
    try {
      mountWithLevel()
      fireEvent.click(toggle())
      fireEvent.click(toggle())
      expect(removed).toContain('pointerdown')
      expect(removed).toContain('keydown')
    } finally {
      spy.mockRestore()
    }
  })
})

describe('the slider', () => {
  it('is upright, the way a volume control is', () => {
    // Asked for by name: "like in apple music". A horizontal slider is what
    // forced the full-width row that broke the bar in the first place.
    const css = readFileSync(
      'src/components/KaraokeMobileStage.module.css',
      'utf8',
    )
    const rule = css.slice(
      css.indexOf('.levelSlider {'),
      css.indexOf('}', css.indexOf('.levelSlider {')),
    )
    expect(rule).toContain('writing-mode: vertical-lr')
    expect(rule).toContain('direction: rtl')
    // The keyword older iOS still needs; the writing mode covers the rest.
    expect(rule).toContain('-webkit-appearance: slider-vertical')
  })

  it('is a real range input, so keys and VoiceOver work', () => {
    mountWithLevel()
    fireEvent.click(toggle())
    expect(slider().tagName).toBe('INPUT')
    expect(slider().type).toBe('range')
    expect(slider().getAttribute('aria-label')).toBe('Music level')
  })

  it('carries the store bounds, converted to percent', () => {
    // Retyped bounds are how a slider ends up able to set a value the store
    // clamps away. These are the store's own, divided by the shipped level.
    mountWithLevel()
    fireEvent.click(toggle())
    const asPercent = (value: number): string =>
      String(Math.round((value / MUSIC_LEVEL.spec.defaultValue) * 100))
    expect(slider().min).toBe(asPercent(MUSIC_LEVEL.spec.min))
    expect(slider().max).toBe(asPercent(MUSIC_LEVEL.spec.max))
    expect(slider().step).toBe(asPercent(MUSIC_LEVEL.spec.step))
    // And those divisions land on round numbers, which is why the readout
    // can be trusted as a scale: half, triple, in twentieths.
    expect(slider().min).toBe('50')
    expect(slider().max).toBe('300')
    expect(slider().step).toBe('5')
  })

  it('never lets the step round down to nothing', () => {
    // A host whose step is a hair under half a percent would otherwise hand
    // the input step="0", which Chromium reads as "any" and Safari ignores.
    mountWithLevel({
      musicLevelRange: { min: 0.35, max: 2.1, step: 0.001, defaultValue: 0.7 },
    })
    fireEvent.click(toggle())
    expect(slider().step).toBe('1')
  })

  it('shows where the level actually is', () => {
    mountWithLevel({ musicLevel: () => 1.4 })
    fireEvent.click(toggle())
    expect(slider().value).toBe('200')
  })

  it('converts the percent back to gain before reporting it', () => {
    // The store speaks gain and the audio graph multiplies by it. Reporting
    // the percent straight through would put the master at 125x.
    const { onMusicLevel } = mountWithLevel()
    fireEvent.click(toggle())
    fireEvent.input(slider(), { target: { value: '125' } })
    expect(onMusicLevel).toHaveBeenCalledTimes(1)
    expect(onMusicLevel.mock.calls[0][0]).toBeCloseTo(0.875, 10)
  })

  it('round-trips the ceiling without overshooting the store', () => {
    // 300% of 0.7 must land on the store's maximum, not past it — a value
    // the store would clamp is a slider that lies about where it stopped.
    const { onMusicLevel } = mountWithLevel()
    fireEvent.click(toggle())
    fireEvent.input(slider(), { target: { value: '300' } })
    expect(onMusicLevel.mock.calls[0][0]).toBeLessThanOrEqual(
      MUSIC_LEVEL.spec.max,
    )
    expect(onMusicLevel.mock.calls[0][0]).toBeCloseTo(MUSIC_LEVEL.spec.max, 10)
  })

  it('writes a level with no float tail on it', () => {
    // 160% of 0.7 is 1.1200000000000001 in doubles, and the store writes what
    // it is given straight to localStorage. Caught by the browser test that
    // reads the stored string back.
    const { onMusicLevel } = mountWithLevel()
    fireEvent.click(toggle())
    fireEvent.input(slider(), { target: { value: '160' } })
    expect(String(onMusicLevel.mock.calls[0][0])).toBe('1.12')
  })

  it('round-trips every step of the scale', () => {
    // The readout and the slider position are both computed back OUT of the
    // gain, so a conversion that lost a step would make the thumb jump under
    // the finger, or the percentage disagree with where it sits.
    const { onMusicLevel } = mountWithLevel()
    fireEvent.click(toggle())
    const back: number[] = []
    for (let percent = 50; percent <= 300; percent += 5) {
      onMusicLevel.mockClear()
      fireEvent.input(slider(), { target: { value: String(percent) } })
      const gain = onMusicLevel.mock.calls[0][0] as number
      expect(gain).toBeGreaterThanOrEqual(MUSIC_LEVEL.spec.min)
      expect(gain).toBeLessThanOrEqual(MUSIC_LEVEL.spec.max)
      back.push(Math.round((gain / MUSIC_LEVEL.spec.defaultValue) * 100))
    }
    expect(back).toEqual(
      Array.from({ length: 51 }, (_unused, index) => 50 + index * 5),
    )
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

  it('announces the percentage to a screen reader too', () => {
    // The input's own value is 200; without this a screen reader would read
    // "200" against a control labelled "Music level" and mean nothing by it.
    mountWithLevel({ musicLevel: () => 1.4 })
    fireEvent.click(toggle())
    expect(slider().getAttribute('aria-valuetext')).toBe('200 percent')
  })

  it('says why it exists on the button, without blaming the app', () => {
    // The app does no ducking — audited. Wording that implied it did would
    // send people hunting for a setting that does not exist. The panel is
    // too small for prose, so the sentence lives on the button.
    mountWithLevel()
    expect(toggle().getAttribute('title')).toMatch(
      /turn the backing track back up if your phone quietened it/i,
    )
  })
})
