// ============================================================
// Lesson 9 landing tests — Step 5's Play, Pause, Slow and scrub bar
// ============================================================
//
// Step 5 on the page's own markup and deck, its frames run by hand
// (kit/frame-loop.test-fixtures.ts) with reduced motion off unless a test
// turns it on, its timers on the same clock, and the kit's own runs: do
// heard through a spy on the kit's `Sound.voice`, the slide through a
// stand-in for its gliding voice (`contourVoice`). Play sounds do, then the
// slide that lands 80 cents under so and settles 25 under, 3.0 s in the
// soft tone (FACTS 94, 99); the line, the readout in the band chart's
// words, so's band and its lit edge and the scrub bar follow it (WEB-SPEC,
// Toys 1; Tests 4's readouts); Pause leaves the line where it stands and
// Play carries on from there; Slow stretches the landing to 6.0 s, and
// pressed mid-landing carries it on at the new speed; the scrub bar, a
// native range, draws the line to its moment without sound; under reduced
// motion Play draws the whole line at once. A newer sound pauses it, and
// so do leaving Step 5 and choosing another voice; the step shown again
// does not (Tests 14).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type { HandLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import { handLoop } from '@/features/lessons/kit/frame-loop.test-fixtures'
import type * as SoundModule from '@/features/lessons/kit/sound'
import type { ContourPoint, VoiceOptions } from '@/features/lessons/kit/sound'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import type { Voice } from '@/features/lessons/kit/voice-choice'
import { el, loadPage, settle } from './page-dom.test-fixtures'
import { landingSoundFrom, landingTrace } from './sounds'
import type { Steps } from './steps'

/** A voice the landing started: do's note or the slide's points, its tone, when (ms), and whether stopped. */
interface Heard {
  readonly midi?: number
  readonly dur?: number
  readonly points?: readonly ContourPoint[]
  readonly kind?: string
  readonly at: number
  stopped: boolean
}

const ear = vi.hoisted(() => {
  const heard: Heard[] = []
  /** Keeps `h` and stands in for its voice. */
  const hear = (h: Heard): SoundModule.Voice => {
    heard.push(h)
    return {
      alive: true,
      setFreq: () => undefined,
      setGain: () => undefined,
      stop: () => {
        h.stopped = true
      },
    }
  }
  return { heard, hear }
})

vi.mock('@/features/lessons/kit/sound', async (actual) => ({
  ...(await actual<typeof SoundModule>()),
  contourVoice: (points: readonly ContourPoint[], o: VoiceOptions = {}) =>
    ear.hear({ points, kind: o.kind, at: performance.now(), stopped: false }),
}))

let hand: HandLoop
let deck: StepDeck
let steps: Steps
// when the last press came, ms on the test's clock
let pressedAt = 0
// the voice choice the page's fresh copy holds
let choose: (voice: Voice) => void

/** Step 5 on screen, sound on, every voice heard; reduced motion as `reduce`, the voice as `voice`. */
async function mount(reduce = false, voice: Voice = 'lower'): Promise<void> {
  hand = await handLoop(reduce)
  // fresh copies over the hand-run loop, as handLoop's header says
  const { Sound } = await import('@/features/lessons/kit/sound')
  const { VoiceChoice } = await import('@/features/lessons/kit/voice-choice')
  const { createStepDeck } = await import('@/features/lessons/kit/step-deck')
  const { initSteps } = await import('./steps')
  vi.spyOn(Sound, 'canPlay').mockReturnValue(true)
  vi.spyOn(Sound, 'state', 'get').mockReturnValue('on')
  vi.spyOn(Sound, 'voice').mockImplementation((freq: number, o = {}) =>
    ear.hear({
      midi: Math.round(69 + 12 * Math.log2(freq / 440)),
      dur: o.dur,
      kind: o.kind,
      at: performance.now(),
      stopped: false,
    }),
  )
  VoiceChoice.set(voice)
  choose = (v) => VoiceChoice.set(v)
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  steps = initSteps(deck)
  deck.start()
  deck.show(5)
  hand.see(el('#stepsStage'))
  hand.settle()
}

const play = (): void => {
  pressedAt = performance.now()
  el('[data-ladder-play="landing"]').click()
}
const slowBtn = (): void => {
  el('[data-ladder-slow]').click()
}
const scrub = (): HTMLInputElement =>
  el<HTMLInputElement>('[data-landing-scrub]')
const scrubTo = (value: number): void => {
  scrub().value = String(value)
  scrub().dispatchEvent(new Event('input', { bubbles: true }))
}
const readout = (): string => el('[data-ladder-readout]').textContent ?? ''
const so = () => steps.ladder.chart.scene.rungs?.find((r) => r.c === 700)

/** The Play button as it reads: its word, its icon, and whether it is lit. */
const button = (): [string | null, string | null, boolean] => {
  const b = el('[data-ladder-play="landing"]')
  return [
    b.querySelector('[data-play-word]')?.textContent ?? null,
    b.querySelector('use')?.getAttribute('href') ?? null,
    b.classList.contains('is-on'),
  ]
}
const PLAYING = ['Pause', '#i-pause', true]
const RESTING = ['Play', '#i-play', false]

/** Every voice heard so far, its start counted from the last press, ms. */
const heardSincePress = (): Heard[] =>
  ear.heard.map((h) => ({ ...h, at: h.at - pressedAt }))

/** The clock run on to `ms` after the last press, and the promises the page awaits settled. */
async function to(ms: number): Promise<void> {
  vi.advanceTimersByTime(pressedAt + ms - performance.now())
  await settle()
}

/** The clock run on to `ms` after the last press, through a frame there. */
async function frameAt(ms: number): Promise<void> {
  await to(ms - 16)
  hand.loop.wake()
  hand.frame()
  await settle()
}

/** What the figure shows: the line and its head, the readout, so's band and the scrub bar's words. */
const shown = () => ({
  line: steps.ladder.chart.scene.line,
  head: steps.ladder.chart.scene.head,
  readout: readout(),
  glow: so()?.glow,
  lit: so()?.lit,
  value: scrub().value,
  words: scrub().getAttribute('aria-valuetext'),
})

/** What the figure should show `t` seconds into the landing, at speed: the line's head at its end. */
const showing = (
  t: number,
  readoutText: string,
  lit: boolean,
  words: string,
) => ({
  line: steps.ladder.lineOf(landingTrace(t)),
  head: steps.ladder.lineOf(landingTrace(t)).at(-1) ?? null,
  readout: readoutText,
  glow: 1,
  lit,
  value: String(t),
  words,
})

const LANDED =
  "80 cents below Merc's note: outside the band; nearest note G sharp 3"
const SETTLED = "25 cents below Merc's note: in the band; nearest note A3"

beforeEach(() => {
  localStorage.clear()
  ear.heard.splice(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe("Lesson 9's landing, played", () => {
  it('sounds do, then the slide that lands 80 cents under so and settles 25 under, in the soft tone, 3.0 s in all', async () => {
    // Arrange
    await mount()

    // Act
    play()
    await to(2999)
    const playing = button()
    await to(3000)

    // Assert
    expect(heardSincePress()).toEqual([
      { midi: 50, dur: 1, kind: 'soft', at: 0, stopped: false },
      {
        points: landingSoundFrom(50, 0).slide.points,
        kind: 'soft',
        at: 1000,
        stopped: false,
      },
    ])
    expect(playing).toEqual(PLAYING)
    expect(button()).toEqual(RESTING)
    expect(steps.landing.t).toBe(3)
    expect(readout()).toBe(SETTLED)
    expect(so()?.lit).toBe(true)
  })

  it("draws the line as it sounds, the readout from the moment the leap lands, so's band glowing and its edge lit once the line is in the band", async () => {
    // Arrange
    await mount()

    // Act: on do, held under so, settled
    play()
    await frameAt(500)
    const onDo = shown()
    await frameAt(1400)
    const held = shown()
    await frameAt(2600)
    const settled = shown()
    await to(3000)
    const ran = hand.settle()

    // Assert
    expect(onDo).toEqual(showing(0.5, '', false, '0.5 seconds of 3'))
    expect(held).toEqual(
      showing(
        1.4,
        LANDED,
        false,
        "1.4 seconds of 3: 80 cents below Merc's note, outside the band",
      ),
    )
    expect(settled).toEqual(
      showing(
        2.6,
        SETTLED,
        true,
        "2.6 seconds of 3: 25 cents below Merc's note, in the band",
      ),
    )
    expect(ran).toBeLessThan(5)
    expect(hand.asked).toEqual([])
  })

  it('leaves the line where it stands on Pause, and Play carries on from there', async () => {
    // Arrange
    await mount()
    play()
    await to(1400)

    // Act
    play()
    const paused = { button: button(), t: steps.landing.t, readout: readout() }
    const cut = heardSincePress().map((h) => h.stopped)
    play()
    await to(1599)
    const playing = button()
    await to(1600)

    // Assert: do had ended; the slide stopped; then the slide from 1.4 s
    expect(paused).toEqual({ button: RESTING, t: 1.4, readout: LANDED })
    expect(cut).toEqual([false, true])
    expect(heardSincePress().slice(2)).toEqual([
      {
        points: landingSoundFrom(50, 1.4).slide.points,
        kind: 'soft',
        at: 0,
        stopped: false,
      },
    ])
    expect(playing).toEqual(PLAYING)
    expect(button()).toEqual(RESTING)
    expect(steps.landing.t).toBe(3)
  })

  it('plays again from the start once the line has ended', async () => {
    // Arrange: the scrub bar at its end
    await mount()
    scrubTo(3)

    // Act
    play()
    await frameAt(500)

    // Assert
    expect(heardSincePress()).toEqual([
      { midi: 50, dur: 1, kind: 'soft', at: 0, stopped: false },
    ])
    expect(steps.landing.t).toBe(0.5)
  })
})

describe("Lesson 9's landing, slowed", () => {
  it('stretches the landing to 6.0 s with Slow, its clock at half speed and no pitch moved', async () => {
    // Arrange
    await mount()
    slowBtn()

    // Act
    play()
    await frameAt(3000)
    const half = steps.landing.t
    await to(5999)
    const playing = button()
    await to(6000)

    // Assert
    expect(heardSincePress()).toEqual([
      { midi: 50, dur: 2, kind: 'soft', at: 0, stopped: false },
      {
        points: landingSoundFrom(50, 0, 2).slide.points,
        kind: 'soft',
        at: 2000,
        stopped: false,
      },
    ])
    expect(half).toBe(1.5)
    expect(playing).toEqual(PLAYING)
    expect(button()).toEqual(RESTING)
  })

  it('carries a landing in flight on from where it stands when Slow is pressed, at the new speed', async () => {
    // Arrange
    await mount()
    play()
    await to(1400)

    // Act
    slowBtn()
    await frameAt(3000)
    const moved = steps.landing.t
    await to(4599)
    const playing = button()
    await to(4600)

    // Assert: the slide stopped and started again from 1.4 s, slowed
    const heard = heardSincePress()
    expect(heard.map((h) => h.stopped)).toEqual([false, true, false])
    expect(heard[2]).toEqual({
      points: landingSoundFrom(50, 1.4, 2).slide.points,
      kind: 'soft',
      at: 1400,
      stopped: false,
    })
    expect(moved).toBeCloseTo(2.2, 9)
    expect(playing).toEqual(PLAYING)
    expect(button()).toEqual(RESTING)
  })
})

describe("Lesson 9's landing, scrubbed", () => {
  it('draws the line to the scrub bar’s moment without a sound, and pauses a landing in flight', async () => {
    // Arrange
    await mount()

    // Act: scrubbed at rest, then while it plays
    scrubTo(1.4)
    const scrubbed = shown()
    const silent = ear.heard.length
    play()
    await to(500)
    scrubTo(2.6)
    const later = shown()
    const ran = hand.settle()

    // Assert
    expect(scrubbed).toEqual(
      showing(
        1.4,
        LANDED,
        false,
        "1.4 seconds of 3: 80 cents below Merc's note, outside the band",
      ),
    )
    expect(silent).toBe(0)
    expect(later).toEqual(
      showing(
        2.6,
        SETTLED,
        true,
        "2.6 seconds of 3: 25 cents below Merc's note, in the band",
      ),
    )
    expect(heardSincePress()).toEqual([
      {
        points: landingSoundFrom(50, 1.4).slide.points,
        kind: 'soft',
        at: 0,
        stopped: true,
      },
    ])
    expect(button()).toEqual(RESTING)
    expect(ran).toBeLessThan(5)
    expect(hand.asked).toEqual([])
  })

  it('is a native range of the landing’s 3 s at speed, a tenth of a second a step, with spoken words', async () => {
    // Arrange
    await mount(false, 'higher')

    // Act
    scrubTo(1.4)

    // Assert
    const s = scrub()
    expect([s.type, s.min, s.max, s.step]).toEqual(['range', '0', '3', '0.1'])
    expect(s.getAttribute('aria-label')).toBe('Scrub the landing')
    expect(s.getAttribute('aria-valuetext')).toBe(
      "1.4 seconds of 3: 80 cents below Merc's note, outside the band",
    )
    expect(readout()).toBe(
      "80 cents below Merc's note: outside the band; nearest note G sharp 4",
    )
  })
})

describe("Lesson 9's landing, among the page's sounds", () => {
  it('draws the whole line at once under reduced motion while the sound plays, and asks for no frame', async () => {
    // Arrange
    await mount(true)

    // Act
    play()
    const ran = hand.settle()
    const drawn = shown()
    await to(2999)
    const playing = { button: button(), asked: hand.asked.length }
    await to(3000)
    const ended = hand.settle()

    // Assert
    expect(drawn).toEqual(
      showing(
        3,
        SETTLED,
        true,
        "3.0 seconds of 3: 25 cents below Merc's note, in the band",
      ),
    )
    expect(ran).toBeLessThan(3)
    expect(playing).toEqual({ button: PLAYING, asked: 0 })
    expect(button()).toEqual(RESTING)
    expect(ended).toBeLessThan(3)
    expect(hand.asked).toEqual([])
    expect(ear.heard).toHaveLength(2)
  })

  it('pauses where it stands when a newer sound starts', async () => {
    // Arrange
    await mount()
    const { NowPlaying } = await import('@/features/lessons/kit/now-playing')
    play()
    await to(1400)

    // Act
    NowPlaying.claim(() => undefined)

    // Assert
    expect(heardSincePress().map((h) => h.stopped)).toEqual([false, true])
    expect(button()).toEqual(RESTING)
    expect(steps.landing.t).toBe(1.4)
  })

  it('pauses when Step 5 is left, and plays on when the step showing is shown again', async () => {
    // Arrange: do sounding
    await mount()
    play()
    await to(500)

    // Act: the same step, as a layout switch shows it; then Step 4; then back
    deck.show(5)
    const stayed = button()
    deck.show(4)
    await to(5000)
    const left = heardSincePress()
    deck.show(5)

    // Assert: do cut short, the slide never started; the line where it was
    expect(stayed).toEqual(PLAYING)
    expect(left).toEqual([
      { midi: 50, dur: 1, kind: 'soft', at: 0, stopped: true },
    ])
    expect(button()).toEqual(RESTING)
    expect(shown()).toEqual(showing(0.5, '', false, '0.5 seconds of 3'))
  })

  it('pauses when another voice is chosen, its line standing where it was over the new layout, in the new names', async () => {
    // Arrange: held under so, sounding
    await mount()
    play()
    await to(1400)

    // Act
    choose('higher')

    // Assert
    expect(heardSincePress().map((h) => h.stopped)).toEqual([false, true])
    expect(button()).toEqual(RESTING)
    expect(steps.ladder.doMidi).toBe(62)
    expect(shown()).toEqual(
      showing(
        1.4,
        "80 cents below Merc's note: outside the band; nearest note G sharp 4",
        false,
        "1.4 seconds of 3: 80 cents below Merc's note, outside the band",
      ),
    )
  })
})
