// ============================================================
// Lesson 7 range toy tests — the steps' chart, by keyboard and by press
// ============================================================
//
// On the page's own markup and its own deck: a siren playing stops when
// the viewer leaves its step, and plays on when the step showing is shown
// again; Step 5's singers wait for its predict's guess; the scrub bar and
// the push note move by arrows, Home and End; a held Higher climbs the
// column to its top; Start lower and Start higher move "Twinkle" and its
// readout; the voice switch, the sounds and the singers toggle
// `aria-pressed`, and a voice switch renames the scrub bar's note; a band
// plays its middle note and says its span; one sound at a time; every sound
// stopped (the Sound switch, a hidden page) rests whatever played; and the
// live line is written only when its words change, in spoken names.

import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import { NowPlaying } from '@/features/lessons/kit/now-playing'
import { Sound } from '@/features/lessons/kit/sound'
import { el, listen, mountSteps, press } from './page-dom.test-fixtures'
import { bandMiddle, BANDS, bandSaid, pushReadout, sirenWhere, } from './range-data'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.textContent = ''
})

const toy = (selector: string): HTMLElement => el(`#toyRange ${selector}`)
const pressed = (selector: string): string | null =>
  toy(selector).getAttribute('aria-pressed')
const said = (): string => toy('[data-range-said]').textContent ?? ''

describe("Lesson 7's chart: leaving a step", () => {
  it('stops a siren playing when the viewer presses Next', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    const { deck } = mountSteps()
    toy('[data-siren-play]').click()
    const playing = toy('[data-play-word]').textContent

    // Act
    el('.stage-nav [data-step-go="1"]').click()

    // Assert
    expect(playing).toBe('Pause')
    expect(deck.current).toBe(2)
    expect(toy('[data-play-word]').textContent).toBe('Play')
    expect(toy('[data-siren-play]').classList.contains('is-on')).toBe(false)
  })

  it('plays on when the step showing is shown again, as the layout swaps', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    const { deck } = mountSteps()
    toy('[data-siren-play]').click()

    // Act
    deck.show(1)

    // Assert
    expect(toy('[data-play-word]').textContent).toBe('Pause')
  })

  it("stops Step 3's tune at a jump straight to Step 5, the lesson menu's", () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const { deck } = mountSteps()
    deck.show(3)
    toy('[data-song-play]').click()
    vi.advanceTimersByTime(1200)
    const sung = heard.length

    // Act
    deck.jump(5)
    vi.advanceTimersByTime(9000)

    // Assert
    expect(sung).toBeGreaterThan(1)
    expect(heard).toHaveLength(sung)
    expect(heard.at(-1)?.stopped).toBe(true)
  })
})

describe("Lesson 7's chart: Step 5's predict", () => {
  it('keeps the singers and Show all six locked until a guess, then shows the reveal', () => {
    // Arrange
    const { deck } = mountSteps()
    deck.show(5)
    const locked = [
      '[data-singer="a"]',
      '[data-singer="b"]',
      '[data-show-types]',
    ].map((s) => toy(s).hasAttribute('disabled'))

    // Act
    el('#predictTypes [data-choice="same"]').click()

    // Assert
    expect(locked).toEqual([true, true, true])
    expect(toy('[data-singer="a"]').hasAttribute('disabled')).toBe(false)
    expect(toy('[data-show-types]').hasAttribute('disabled')).toBe(false)
    expect(el('#predictTypes .reveal').hidden).toBe(false)
    expect(el('#predictTypes .reveal .mono').textContent).toBe(
      'You said: yes, the same type',
    )
    for (const p of document.querySelectorAll<HTMLElement>(
      '#step-5 [data-types-reveal]',
    ))
      expect(p.hidden).toBe(false)
  })

  it('shows one singer at a time, or all six bands, each press toggling aria-pressed', () => {
    // Arrange
    const { deck } = mountSteps()
    deck.show(5)
    el('#predictTypes [data-choice="not-always"]').click()

    // Act
    toy('[data-singer="a"]').click()
    const one = [pressed('[data-singer="a"]'), pressed('[data-singer="b"]')]
    toy('[data-show-types]').click()

    // Assert
    expect(one).toEqual(['true', 'false'])
    expect(pressed('[data-show-types]')).toBe('true')
    expect(pressed('[data-singer="a"]')).toBe('false')
    expect(toy('[data-band-grid]').hidden).toBe(false)
    expect(said()).toContain('The six voice types the Vocal Range Test uses')
  })

  it('plays a band’s middle note in the soft tone, and says its span in words', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const { deck } = mountSteps()
    deck.show(5)
    el('#predictTypes [data-choice="not-always"]').click()
    toy('[data-show-types]').click()
    const tenor = BANDS.find((b) => b.id === 'tenor')
    if (tenor === undefined) throw new Error('no tenor band')

    // Act
    toy('[data-band="tenor"]').click()
    vi.advanceTimersByTime(10)

    // Assert
    expect(heard.map((v) => v.midi)).toEqual([bandMiddle(tenor)])
    expect(said()).toBe(bandSaid(tenor))
    expect(toy('[data-band="tenor"]').getAttribute('aria-label')).toBe(
      'Tenor, C 3 to C 5: play its middle note, C 4',
    )
  })
})

describe("Lesson 7's chart by keyboard", () => {
  it('moves the scrub bar by arrows, a second by Page keys, and jumps by Home and End', () => {
    // Arrange
    mountSteps()
    const scrub = toy('[data-siren-scrub]')

    // Act
    press(scrub, 'ArrowRight')
    press(scrub, 'ArrowRight')
    const nudged = scrub.getAttribute('aria-valuenow')
    press(scrub, 'PageUp')
    const paged = scrub.getAttribute('aria-valuenow')
    press(scrub, 'End')
    const end = scrub.getAttribute('aria-valuenow')
    press(scrub, 'Home')

    // Assert
    expect([nudged, paged, end]).toEqual(['0.2', '1.2', '6.0'])
    expect(scrub.getAttribute('aria-valuenow')).toBe('0.0')
    expect(scrub.getAttribute('aria-valuetext')).not.toMatch(/[♯♭]/)
  })

  it("names the other voice's note on the scrub bar when the voice switches, the time kept", () => {
    // Arrange
    mountSteps()
    const scrub = toy('[data-siren-scrub]')
    press(scrub, 'PageUp')
    press(scrub, 'PageUp')
    press(scrub, 'PageUp')
    const before = scrub.getAttribute('aria-valuetext')

    // Act
    toy('[data-chart-voice="higher"]').click()

    // Assert
    expect(before).toBe(sirenWhere('lower', 3))
    expect(scrub.getAttribute('aria-valuenow')).toBe('3.0')
    expect(scrub.getAttribute('aria-valuetext')).toBe(sirenWhere('higher', 3))
    expect(sirenWhere('higher', 3)).not.toBe(sirenWhere('lower', 3))
  })

  it('moves the push note by arrows, and to the column’s ends by Home and End', () => {
    // Arrange
    const { deck } = mountSteps()
    deck.show(4)
    const handle = toy('[data-push-handle]')

    // Act
    press(handle, 'ArrowUp')
    const up = handle.getAttribute('aria-valuenow')
    press(handle, 'End')
    const top = handle.getAttribute('aria-valuetext')
    press(handle, 'Home')

    // Assert
    expect(handle.hidden).toBe(false)
    expect(up).toBe('46')
    expect(top).toBe(pushReadout('lower', 69).spoken)
    expect(handle.getAttribute('aria-valuenow')).toBe('45')
    expect(toy('[data-range-readout]').textContent).toBe(
      pushReadout('lower', 45).text,
    )
  })

  it('climbs the column to its top while Higher is held, ending on "A4: much more push"', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    listen()
    const { deck } = mountSteps()
    deck.show(4)
    const higher = toy('[data-push="1"]')

    // Act: a long press, as on a phone
    higher.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, button: 0 }),
    )
    vi.advanceTimersByTime(4000)
    higher.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))

    // Assert
    expect(toy('[data-push-handle]').getAttribute('aria-valuenow')).toBe('69')
    expect(toy('[data-range-readout]').textContent).toBe('A4: much more push')
  })

  it('moves "Twinkle" by Start lower and Start higher, its readout following', () => {
    // Arrange
    const { deck } = mountSteps()
    deck.show(3)

    // Act
    toy('[data-slide="1"]').click()
    toy('[data-slide="1"]').click()
    const two = toy('[data-range-readout]').textContent
    toy('[data-slide="1"]').click()

    // Assert
    expect(two).toBe('Moved up 2 semitones: all of it in the lit middle')
    expect(toy('[data-range-readout]').textContent).toBe(
      'Moved up 3 semitones: reaching into the dimmed top end',
    )
    expect(said()).toBe(
      'Twinkle, moved up 3 semitones: reaching into the dimmed top end',
    )
  })

  it('toggles the voice switch and the sounds with aria-pressed, keeping the slide', () => {
    // Arrange
    const { deck } = mountSteps()
    deck.show(3)
    toy('[data-slide="1"]').click()

    // Act
    toy('[data-chart-voice="higher"]').click()
    const readout = toy('[data-range-readout]').textContent
    deck.show(2)
    toy('[data-sound="trill"]').click()

    // Assert
    expect(pressed('[data-chart-voice="higher"]')).toBe('true')
    expect(pressed('[data-chart-voice="lower"]')).toBe('false')
    expect(readout).toBe('Moved up 1 semitone: all of it in the lit middle')
    expect(pressed('[data-sound="trill"]')).toBe('true')
    expect(pressed('[data-sound="ng"]')).toBe('false')
    expect(said()).toBe(
      "Merc's siren on a lip trill, from E 4 up to C sharp 5 and back",
    )
  })

  it('writes its live line only when its words change', () => {
    // Arrange
    const { deck } = mountSteps()
    deck.show(2)
    const writes: string[] = []
    new MutationObserver(() => writes.push(said())).observe(
      toy('[data-range-said]'),
      { childList: true, characterData: true, subtree: true },
    )

    // Act
    toy('[data-sound="oo"]').click()
    toy('[data-sound="oo"]').click()
    toy('[data-sound="oo"]').click()

    // Assert: a microtask later, the observer has seen one write
    return Promise.resolve().then(() => {
      expect(writes).toEqual([
        "Merc's siren on “oo”, from E 3 up to C sharp 4 and back",
      ])
    })
  })
})

describe("Lesson 7's chart: one sound at a time", () => {
  it('stops its tune when another sound on the page takes over', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const { deck } = mountSteps()
    deck.show(3)
    toy('[data-song-play]').click()
    vi.advanceTimersByTime(700)
    const sung = heard.length
    const other = vi.fn()

    // Act: a word's play, the quiz's or Sing it's claims the page's sound
    NowPlaying.claim(other)
    vi.advanceTimersByTime(9000)

    // Assert
    expect(heard).toHaveLength(sung)
    expect(heard.at(-1)?.stopped).toBe(true)
    expect(toy('[data-song-play]').classList.contains('is-on')).toBe(false)
    NowPlaying.release(other)
  })

  it('stops the siren where it stands when the tune starts, and the tune plays', () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const heard = listen()
    const { deck } = mountSteps()
    toy('[data-siren-play]').click()

    // Act
    deck.show(3)
    toy('[data-song-play]').click()
    vi.advanceTimersByTime(100)

    // Assert
    expect(heard.length).toBeGreaterThan(0)
    expect(toy('[data-song-play]').classList.contains('is-on')).toBe(true)
  })
})

describe("Lesson 7's chart: every sound stopped", () => {
  /** Sound on and the chart mounted, with `start` playing one of its sounds. */
  const SOURCES: readonly {
    what: string
    lit: string
    start: (deck: { show(n: number): void }) => void
  }[] = [
    {
      what: 'the siren, its button back to Play',
      lit: '[data-siren-play]',
      start: () => toy('[data-siren-play]').click(),
    },
    {
      what: 'the tune',
      lit: '[data-song-play]',
      start: (deck) => {
        deck.show(3)
        toy('[data-song-play]').click()
      },
    },
    {
      what: "a band's note",
      lit: '[data-band="tenor"]',
      start: (deck) => {
        deck.show(5)
        el('#predictTypes [data-choice="not-always"]').click()
        toy('[data-show-types]').click()
        toy('[data-band="tenor"]').click()
      },
    },
  ]

  it.each(SOURCES)(
    'rests $what at once when every sound stops, as the Sound switch and a hidden page stop it',
    async ({ lit, start }) => {
      // Arrange
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      listen()
      const { deck } = mountSteps()
      start(deck)
      vi.advanceTimersByTime(300)
      const playing = toy(lit).classList.contains('is-on')

      // Act: the run's promise settles a microtask later, long before its own end
      Sound.stopAll()
      await vi.advanceTimersByTimeAsync(0)

      // Assert
      expect(playing).toBe(true)
      expect(toy(lit).classList.contains('is-on')).toBe(false)
      expect(toy('[data-play-word]').textContent).toBe('Play')
    },
  )
})
