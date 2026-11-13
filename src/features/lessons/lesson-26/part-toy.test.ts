// ============================================================
// Lesson 26 part toy tests — the steps' toy and free play on the page's own markup
// ============================================================
//
// The WEB-SPEC's Toys 2 and Tests 5, with the kit's runs a recorder: the
// hero's plain "Twinkle" and every control held under the lock line until
// the cold open's choice; then Step 1's pair walking up the scale, Step up
// and Step down playing it, each `aria-disabled` at its end and doing
// nothing there; Play the thirds walking the pair with its notes; Step 2's
// switch moving the copy and stopping a play; Step 3's plays setting the
// switch, and the duet redrawing the band; Step 4's chord held under its
// plays; free play's state switch; and a newer sound on the page cutting a
// play short.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import type * as RunModule from '@/features/lessons/kit/run'
import { live, resetRuns, runs, } from '@/features/lessons/kit/run-recorder.test-fixtures'
import { el, loadPage, settle, soundOn, words } from './page-dom.test-fixtures'
import { PLAIN, PLAIN_SAID, shapeOf, START } from './part-shapes'
import type { PartToy } from './part-toy'
import { mountPartToy } from './part-toy'

vi.mock('@/features/lessons/kit/run', async (actual) => ({
  ...(await actual<typeof RunModule>()),
  ...(await import('@/features/lessons/kit/run-recorder.test-fixtures'))
    .recordedRuns,
}))

const last = () => runs[runs.length - 1]

/** The toy at `root`, Step `n`, on the page's markup. */
function toyAt(root = '#toyTune', n: 1 | 2 | 3 | 4 = 1): PartToy {
  return mountPartToy(el(root), { active: () => true, state: n })
}

const label = (root = '#toyTune'): string =>
  el(`${root} [data-tune-canvas]`).getAttribute('aria-label') ?? ''
const said = (root = '#toyTune'): string =>
  words(el(`${root} [data-tune-said]`))
const button = (sel: string): HTMLButtonElement => el<HTMLButtonElement>(sel)
const down = (root = '#toyTune') => button(`${root} [data-pair="-1"]`)
const up = (root = '#toyTune') => button(`${root} [data-pair="1"]`)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  loadPage()
  soundOn()
  resetRuns()
})

afterEach(() => {
  // a newer sound stops what the test started, before its timers are real again
  NowPlaying.claim(() => undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

describe("the steps' toy before the choice", () => {
  it('draws the hero’s plain "Twinkle" and holds every control under the lock line (FACTS 40)', () => {
    // Act
    const toy = toyAt()

    // Assert
    expect(toy.held).toBe(true)
    expect(toy.line.shape).toEqual(PLAIN)
    expect(label()).toBe(PLAIN_SAID)
    expect(el('#toyTune [data-lock-line]').hidden).toBe(false)
    const controls = Array.from(
      el('#toyTune').querySelectorAll<HTMLButtonElement>('button'),
    )
    expect(controls.length).toBeGreaterThan(8)
    expect(controls.every((b) => b.disabled)).toBe(true)
  })

  it('plays nothing until the choice', async () => {
    const toy = toyAt()
    expect(await toy.play('thirds')).toBe(false)
    expect(runs).toHaveLength(0)
  })
})

describe('Step 1, once the choice is in', () => {
  it("draws its state, opens the controls and puts the lock line away, Step down saying it can't go lower", () => {
    // Act
    const toy = toyAt()
    toy.unlock()

    // Assert
    expect(toy.line.shape).toEqual(shapeOf(1, START))
    expect(label()).toMatch(
      /^C major's lanes lit\. C 4, .*E 4: C up to E, 4 semitones\.$/,
    )
    expect(el('#toyTune [data-lock-line]').hidden).toBe(true)
    expect(down().disabled).toBe(false)
    expect(down().getAttribute('aria-disabled')).toBe('true')
    expect(up().hasAttribute('aria-disabled')).toBe(false)
  })

  it('walks the pair up with Step up, playing its two notes together for 1.0 s and saying them', () => {
    // Arrange
    const toy = toyAt()
    toy.unlock()

    // Act
    up().click()

    // Assert
    expect(toy.settings.pair).toBe(1)
    expect(last().notes.map((n) => [n.t, n.midi, n.dur])).toEqual([
      [0, 62, 1],
      [0, 65, 1],
    ])
    expect(said()).toMatch(/D up to F, 3 semitones/)
    expect(down().hasAttribute('aria-disabled')).toBe(false)
  })

  it('stops at ti: Step up says so and its press does nothing', () => {
    const toy = toyAt()
    toy.unlock()
    for (let i = 0; i < 6; i++) up().click()
    const played = runs.length
    up().click()
    expect(toy.settings.pair).toBe(6)
    expect(up().getAttribute('aria-disabled')).toBe('true')
    expect(runs).toHaveLength(played)
  })

  it('walks the pair with Play the thirds up the scale, a pair a second', async () => {
    // Arrange
    const toy = toyAt()
    toy.unlock()

    // Act
    const heard = toy.play('thirds')
    vi.advanceTimersByTime(2100)
    const at2 = toy.settings.pair
    last().end(true)
    vi.advanceTimersByTime(5000)

    // Assert
    expect(at2).toBe(2)
    expect(last().notes).toHaveLength(14)
    expect(await heard).toBe(true)
    expect(toy.settings.pair).toBe(6)
  })
})

describe('Step 2: the copy', () => {
  it('moves the copy four semitones up by its switch, says so, and stops a play', () => {
    // Arrange
    const toy = toyAt('#toyTune', 2)
    toy.unlock()
    void toy.play('copy')
    const playing = last()

    // Act
    button('#toyTune [data-copy="up4"]').click()

    // Assert
    expect(playing.stopped).toBe(true)
    expect(toy.settings.copy).toBe('up4')
    expect(
      button('#toyTune [data-copy="up4"]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(
      button('#toyTune [data-copy="key"]').getAttribute('aria-pressed'),
    ).toBe('false')
    expect(said()).toMatch(/F sharp 4, G sharp 4 and C sharp 5, off the lanes/)
  })

  it('plays "Twinkle" with the copy the switch sets, 8.0 s', () => {
    const toy = toyAt('#toyTune', 2)
    toy.unlock()
    button('#toyTune [data-copy="up4"]').click()
    button('#toyTune [data-toy-play="copy"]').click()
    const notes = last().notes
    expect(Math.max(...notes.map((n) => n.t + n.dur))).toBe(8)
    expect(notes.some((n) => n.midi === 73)).toBe(true)
  })
})

describe('Step 3: above or below, and Merc and Tavi', () => {
  it('sets the switch as Play below plays, and draws the part below', () => {
    const toy = toyAt('#toyTune', 3)
    toy.unlock()
    button('#toyTune [data-toy-play="below"]').click()
    expect(toy.settings.side).toBe('below')
    expect(
      button('#toyTune [data-side="below"]').getAttribute('aria-pressed'),
    ).toBe('true')
    expect(last().notes.map((n) => n.midi)).toContain(57)
  })

  it("redraws the band for the duet, in Merc's ooh, neither side pressed", () => {
    const toy = toyAt('#toyTune', 3)
    toy.unlock()
    button('#toyTune [data-toy-play="duet"]').click()
    expect(toy.line.shape.window).toEqual([48, 67])
    expect(last().o.kind).toBe('merc')
    expect(
      Array.from(el('#toyTune').querySelectorAll('[data-side]'), (b) =>
        b.getAttribute('aria-pressed'),
      ),
    ).toEqual(['false', 'false'])
    button('#toyTune [data-side="above"]').click()
    expect(toy.settings.duet).toBe(false)
  })
})

describe('Step 4: the chord under the parts', () => {
  it('holds the chord for 3.0 s under Play both', () => {
    const toy = toyAt('#toyTune', 4)
    toy.unlock()
    button('#toyTune [data-toy-play="both"]').click()
    const chord = last().notes.filter((n) => n.midi < 60)
    expect(chord.map((n) => [n.midi, n.t, n.dur])).toEqual([
      [48, 0, 3],
      [52, 0, 3],
      [55, 0, 3],
    ])
  })
})

describe('its states', () => {
  it("shows a step's controls alone, opens its state with its settings back at their start, and keeps the lock line away", () => {
    // Arrange
    const toy = toyAt()
    toy.unlock()
    up().click()

    // Act
    toy.setState(3)

    // Assert
    expect(el('#toyTune .controls[data-part="1"]').hidden).toBe(true)
    expect(el('#toyTune .controls[data-part="3"]').hidden).toBe(false)
    expect(el('#toyTune [data-lock-line]').hidden).toBe(true)
    expect(toy.settings).toEqual(START)
    expect(live()).toHaveLength(0)
  })
})

describe('free play', () => {
  it('holds its state switch with the rest until the choice, then opens a state by its step', () => {
    // Arrange
    const toy = toyAt('#freePlay')
    const three = button('#freePlay [data-state="3"]')
    const held = three.disabled

    // Act
    toy.unlock()
    three.click()

    // Assert
    expect(held).toBe(true)
    expect(toy.state).toBe(3)
    expect(three.getAttribute('aria-pressed')).toBe('true')
    expect(three.getAttribute('aria-label')).toMatch(/^3: /)
    expect(el('#freePlay .controls[data-part="3"]').hidden).toBe(false)
    expect(said('#freePlay')).toMatch(/^Do re mi re do on C 4/)
  })
})

describe('one sound on the page', () => {
  it('stops its play when another sound starts, and says the play was cut short', async () => {
    const toy = toyAt()
    toy.unlock()
    const heard = toy.play('thirds')
    const playing = last()
    NowPlaying.claim(() => undefined)
    await settle()
    expect(playing.stopped).toBe(true)
    expect(await heard).toBe(false)
  })
})
