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
// Two reports came back about the shape of it. The first cut opened a
// full-width row inside the bottom bar: "it opens a full modal, with a huge
// slider… on my tablet it conceals all playback commands, and none are
// reachable". That row was LAYOUT — the bar grew by its height, and a screen
// with no room to give pushed the transport out of reach.
//
// The second was about the replacement, and it was the better question: "why
// make up this new slider? just reuse the component we already have for our
// mic vocal stem volume control". There was no reason. The stage already had
// a capsule that opens a vertical track under your thumb — PillControl, the
// guide-vocal pill — so this is that, pointed at the backing level, with the
// percentage drawn over the fill.
//
// The maths of the level and its ceiling is pinned in
// `src/features/stem-mixer/master-headroom.test.ts`; the wiring from the
// store to this stage in `src/tests/mixer-music-level.test.ts`. This file is
// the control itself.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { readFileSync } from 'node:fs'
import { createSignal } from 'solid-js'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { KaraokeMobileStageProps } from '@/components/KaraokeMobileStage'
import { KaraokeMobileStage } from '@/components/KaraokeMobileStage'
import { MUSIC_LEVEL } from '@/features/stem-mixer/master-headroom'
import { dragPill } from '@/tests/helpers/pill-drag'

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

const pill = (): HTMLElement => screen.getByTestId('mobile-music-level')
const fill = (): HTMLElement =>
  pill().querySelector('[class*="fill"]') as HTMLElement

/** Press, slide, lift — screen coordinates, so up the range is a smaller y. */
function drag(from: number, to: number): void {
  dragPill(pill(), from, to)
}

describe('the control', () => {
  it('is the pill the stage already had, not a second kind of slider', () => {
    // Asked for by name. The vocals pill and this one are the same component
    // with different skins, so a fix to the touch handling lands on both.
    const source = readFileSync('src/components/KaraokeMobileStage.tsx', 'utf8')
    expect(source).toContain('<PillControl')
    expect(source).not.toContain('type="range"')
    expect(source).not.toContain('mobile-music-level-toggle')
  })

  it('is there, beside the mic, when the host offers a level', () => {
    mountWithLevel()
    expect(pill().getAttribute('aria-label')).toBe('Music level')
  })

  it('sits in the same slot as the mic, right beside it', () => {
    // The pairing is the whole idea and it was reported missing: "should it
    // not be next to the mic icon, so users easily connect the dots". Across
    // the transport from it, the level read as an unrelated control.
    mountWithLevel()
    const mic = screen.getByLabelText('Toggle your microphone')
    const slot = mic.parentElement
    expect(slot).not.toBeNull()
    expect(slot?.contains(pill())).toBe(true)
    // Mic first, then the level: cause, then the thing that answers it.
    expect(mic.compareDocumentPosition(pill())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('is boxed in the flow and drawn out of it', () => {
    // Both halves of the placement, and each fixes a different report. The
    // anchor is a real mic-sized box, so the slot's own centring lines the
    // capsule up with the mic — a zero-height slot left it hanging 22px high
    // at every width. The capsule inside is absolute, so opening it cannot
    // make the bottom bar taller and push the transport off a short screen.
    const css = readFileSync(
      'src/components/KaraokeMobileStage.module.css',
      'utf8',
    )
    const rule = (selector: string): string =>
      css.slice(
        css.indexOf(`${selector} {`),
        css.indexOf('}', css.indexOf(`${selector} {`)),
      )

    expect(rule('.levelPill')).toContain('position: absolute')
    expect(rule('.levelPill')).toContain('inset: auto 0 0')

    const anchor = rule('.levelAnchor')
    expect(anchor).toContain('position: relative')
    expect(anchor).toContain('width: 44px')
    expect(anchor).toContain('height: 44px')

    // What actually does the aligning, and what the mic is sized to.
    expect(rule('.transportSide')).toContain('align-items: center')
    expect(rule('.micBtn')).toContain('height: 44px')
  })

  it('survives the stage settings being hidden', () => {
    // The moment this matters most is a scored performance run, and that is
    // exactly the preset that passes `showStageSettings: false`.
    mountWithLevel({ showStageSettings: false })
    expect(pill()).toBeTruthy()
  })

  it('is absent when the host cannot offer one', () => {
    render(() => KaraokeMobileStage(makeProps({ onToggleMic: vi.fn() })))
    expect(screen.queryByTestId('mobile-music-level')).toBeNull()
  })

  it('needs all three props, not just the value', () => {
    render(() => KaraokeMobileStage(makeProps({ musicLevel: () => 0.7 })))
    expect(screen.queryByTestId('mobile-music-level')).toBeNull()
  })

  it('keeps an empty slot opposite it so play stays centred', () => {
    // Both controls live on the left now, so the right slot is pure spacing.
    // It has to be there — without it the transport slides left — and it has
    // to be silent, because there is nothing in it to announce.
    mountWithLevel()
    const row = screen.getByLabelText('Toggle your microphone').parentElement
      ?.parentElement
    const spacer = row?.lastElementChild
    expect(spacer?.getAttribute('aria-hidden')).toBe('true')
    expect(spacer?.childElementCount).toBe(0)
    expect(spacer?.contains(pill())).toBe(false)
  })
})

describe('the fill', () => {
  it('shows where the level sits in its own range', () => {
    // 0.7 of a 0.35..2.1 range is a fifth of the way up, and that is honest:
    // most of this control's travel is above normal, because above normal is
    // what it exists for.
    mountWithLevel()
    expect(fill().style.height).toBe('20%')

    cleanup()
    mountWithLevel({ musicLevel: () => 2.1 })
    expect(fill().style.height).toBe('100%')
  })

  it('carries the percentage over it once the pill is open', () => {
    // Asked for: "we can additionally show the percent info, on top of the
    // white slider fill, nicely integrated". Closed, the capsule is a button
    // like the mic opposite it and says nothing.
    mountWithLevel()
    expect(pill().textContent).not.toContain('%')

    drag(100, 100)
    expect(pill().textContent).toContain('100%')
  })

  it('reads out as a percentage of the shipped level', () => {
    // 0.7 is what every mix sounded like before there was a control, so it
    // is the only honest 100%. Reading out raw gain would make the default
    // look like something was already turned down.
    mountWithLevel({ musicLevel: () => 1.4 })
    drag(100, 100)
    expect(pill().textContent).toContain('200%')
  })
})

describe('the gesture', () => {
  it('sets the level by dragging up the capsule', () => {
    const { onMusicLevel } = mountWithLevel()
    drag(200, 140)
    expect(onMusicLevel).toHaveBeenCalled()
    const last = onMusicLevel.mock.calls.at(-1)?.[0] as number
    expect(last).toBeGreaterThan(0.7)
    expect(last).toBeLessThanOrEqual(MUSIC_LEVEL.spec.max)
  })

  it('drags down as well as up', () => {
    const { onMusicLevel } = mountWithLevel({ musicLevel: () => 1.4 })
    drag(200, 260)
    const last = onMusicLevel.mock.calls.at(-1)?.[0] as number
    expect(last).toBeLessThan(1.4)
    expect(last).toBeGreaterThanOrEqual(MUSIC_LEVEL.spec.min)
  })

  it("snaps to the store's own step, so the readout is a number it can hold", () => {
    const { onMusicLevel } = mountWithLevel()
    drag(200, 173)
    for (const call of onMusicLevel.mock.calls) {
      const percent = Math.round(
        ((call[0] as number) / MUSIC_LEVEL.spec.defaultValue) * 100,
      )
      expect(percent % 5).toBe(0)
    }
  })

  it('never reports a level the store would clamp away', () => {
    const { onMusicLevel } = mountWithLevel()
    drag(200, -400)
    drag(200, 900)
    for (const call of onMusicLevel.mock.calls) {
      expect(call[0]).toBeGreaterThanOrEqual(MUSIC_LEVEL.spec.min)
      expect(call[0]).toBeLessThanOrEqual(MUSIC_LEVEL.spec.max)
    }
  })

  it('stays inside bounds the step does not divide evenly', () => {
    // The snap rounds to the nearest step, and rounding goes both ways: a
    // ceiling that is not a whole number of steps above the floor can be
    // rounded PAST. The store would clamp it back, and the pill would then
    // read out a percentage it is not actually set to.
    const onMusicLevel = vi.fn()
    render(() =>
      KaraokeMobileStage(
        makeProps({
          micActive: () => false,
          onToggleMic: vi.fn(),
          musicLevel: () => 0.7,
          onMusicLevel,
          // 298% of 0.7, which is not a multiple of the 5% step.
          musicLevelRange: { ...MUSIC_LEVEL.spec, max: 2.086 },
        }),
      ),
    )

    drag(400, 0)
    const last = onMusicLevel.mock.calls.at(-1)?.[0] as number
    expect(last).toBeLessThanOrEqual(2.086)
    expect(last).toBe(2.086)
  })

  it('writes a level with no float tail on it', () => {
    // 160% of 0.7 is 1.1200000000000001 in doubles, and the store writes what
    // it is given straight to localStorage.
    const { onMusicLevel } = mountWithLevel()
    drag(200, 160)
    for (const call of onMusicLevel.mock.calls) {
      expect(
        String(call[0]).replace('-', '').split('.')[1]?.length ?? 0,
      ).toBeLessThanOrEqual(3)
    }
  })

  it('leaves the song playing behind it', () => {
    // The only way to judge a level is to hear it while you move it.
    const onPause = vi.fn()
    mountWithLevel({ playing: () => true, onPause })
    drag(200, 150)
    expect(onPause).not.toHaveBeenCalled()
  })
})

describe('the tap', () => {
  it('drops a boosted level back to normal', () => {
    const { onMusicLevel } = mountWithLevel({ musicLevel: () => 1.4 })
    drag(100, 100)
    expect(onMusicLevel).toHaveBeenCalledWith(MUSIC_LEVEL.spec.defaultValue)
  })

  it('puts the boost back on a second tap', () => {
    // The pill beside it toggles the vocals; this one toggles the boost. Once
    // you have found the level that beats your phone's ducking, comparing it
    // against normal should not mean finding it again.
    // A live signal, not a fixed accessor: the toggle has to see the level it
    // set a moment ago. Asserted through the setter so the test never reads a
    // signal outside a tracked scope.
    const [level, setLevel] = createSignal(0.7)
    const onMusicLevel = vi.fn((value: number) => setLevel(value))
    render(() =>
      KaraokeMobileStage(
        makeProps({
          micActive: () => false,
          onToggleMic: vi.fn(),
          musicLevel: level,
          onMusicLevel,
          musicLevelRange: MUSIC_LEVEL.spec,
        }),
      ),
    )

    drag(200, 176)
    expect(onMusicLevel).toHaveBeenLastCalledWith(1.05)
    drag(100, 100)
    expect(onMusicLevel).toHaveBeenLastCalledWith(MUSIC_LEVEL.spec.defaultValue)
    drag(100, 100)
    expect(onMusicLevel).toHaveBeenLastCalledWith(1.05)
  })

  it('does nothing at normal with nothing to go back to', () => {
    // A first tap is how you look at the level; it must not move it.
    const { onMusicLevel } = mountWithLevel()
    drag(100, 100)
    expect(onMusicLevel).not.toHaveBeenCalled()
  })
})

describe('the keyboard', () => {
  it('is a real slider, not a button with a drag on it', () => {
    // The vocals pill can be a toggle for assistive tech because toggling is
    // what it does. Here the value IS the control, so it has to be reachable
    // without a pointer.
    mountWithLevel()
    expect(pill().getAttribute('role')).toBe('slider')
    expect(pill().getAttribute('aria-valuemin')).toBe('0')
    expect(pill().getAttribute('aria-valuemax')).toBe('100')
    expect(pill().getAttribute('aria-valuenow')).toBe('20')
    expect(pill().getAttribute('aria-valuetext')).toBe('100 percent')
    expect(pill().getAttribute('aria-pressed')).toBeNull()
  })

  it('moves a step per arrow key', () => {
    const { onMusicLevel } = mountWithLevel()
    fireEvent.keyDown(pill(), { key: 'ArrowUp' })
    expect(onMusicLevel).toHaveBeenLastCalledWith(0.735)

    cleanup()
    const down = mountWithLevel()
    fireEvent.keyDown(pill(), { key: 'ArrowDown' })
    expect(down.onMusicLevel).toHaveBeenLastCalledWith(0.665)
  })

  it('reaches both ends with Home and End', () => {
    const { onMusicLevel } = mountWithLevel()
    fireEvent.keyDown(pill(), { key: 'End' })
    expect(onMusicLevel).toHaveBeenLastCalledWith(MUSIC_LEVEL.spec.max)

    fireEvent.keyDown(pill(), { key: 'Home' })
    expect(onMusicLevel).toHaveBeenLastCalledWith(MUSIC_LEVEL.spec.min)
  })

  it('opens the track so a keyboard user sees what moved', () => {
    mountWithLevel()
    expect(pill().textContent).not.toContain('%')
    fireEvent.keyDown(pill(), { key: 'ArrowUp' })
    expect(pill().textContent).toContain('%')
  })

  it("ignores keys that are not the slider's", () => {
    const { onMusicLevel } = mountWithLevel()
    fireEvent.keyDown(pill(), { key: 'a' })
    fireEvent.keyDown(pill(), { key: 'Escape' })
    expect(onMusicLevel).not.toHaveBeenCalled()
  })

  it('says why it exists on the button, without blaming the app', () => {
    // The app does no ducking — audited. Wording that implied it did would
    // send people hunting for a setting that does not exist.
    mountWithLevel()
    expect(pill().getAttribute('title')).toMatch(
      /turn the backing track back up if your phone quietened it/i,
    )
  })
})
