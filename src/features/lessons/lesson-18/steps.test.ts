// ============================================================
// Lesson 18 steps tests — the reading staff, in each step's state
// ============================================================
//
// On the page's own markup and its own deck, with the beat clock a
// recorder (WEB-SPEC, Toys 2): Step 1's two reads locked until the
// predict's choice, or open for a learner who has done the lesson; the
// note-by-note read naming each note on one beat and singing it on the
// next, each tagged with how late it came; Merc's way with its brackets as
// the cursor reaches them; Step 2's brackets as buttons that play their
// notes; Step 3's count-in, Count and the tap pad's tempo; Step 4's marks
// written as they sound and the light of a note by its level; a tapped
// note; the clef and the names; and leaving a step stops what it plays.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@/features/lessons/kit/browser-doubles.test-fixtures'
import type * as BeatClockModule from '@/features/lessons/kit/beat-clock'
import { hz } from '@/features/lessons/kit/notes'
import { Done } from '@/features/lessons/kit/progress'
import type * as SoundAheadModule from '@/features/lessons/kit/sound-ahead'
import type { StepDeck } from '@/features/lessons/kit/step-deck'
import { createStepDeck } from '@/features/lessons/kit/step-deck'
import type * as WoodblockModule from '@/features/lessons/kit/woodblock'
import { Choice, resetChoice } from './choice'
import { drive, el, finish, loadPage, resetRuns, runs, settle, soundOn, words, } from './page-dom.test-fixtures'
import { READ_LINES } from './reads'
import { initSteps } from './steps'

vi.mock('@/features/lessons/kit/beat-clock', async (actual) => ({
  ...(await actual<typeof BeatClockModule>()),
  BeatClock: (await import('./page-dom.test-fixtures')).FakeBeatClock,
}))
const voices: number[] = []
vi.mock('@/features/lessons/kit/sound-ahead', async (actual) => ({
  ...(await actual<typeof SoundAheadModule>()),
  bookNote: (freq: number) => {
    voices.push(freq)
    return null
  },
}))
vi.mock('@/features/lessons/kit/woodblock', async (actual) => ({
  ...(await actual<typeof WoodblockModule>()),
  bookWood: () => undefined,
}))
vi.mock('@/lib/drum-voices', () => ({ triggerDrumVoice: () => undefined }))

/** The steps on the page's own deck, as main.ts mounts them: the toy, then the deck's start. */
function mountSteps(): StepDeck {
  loadPage()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  const deck = createStepDeck({
    toyFor: () => 1,
    after: { label: 'Sing it', selector: '#sing' },
  })
  initSteps()
  deck.start()
  return deck
}

const toy = () => el('#toyRead')
const play = (id: string) =>
  el<HTMLButtonElement>(`#toyRead [data-read-play="${id}"]`)
const markBtn = (id: string) =>
  el<HTMLButtonElement>(`#toyRead [data-read-mark="${id}"]`)
const texts = (sel: string): string[] =>
  Array.from(toy().querySelectorAll(sel), (e) => words(e))
const said = () => words(el('#toyRead [data-read-said]'))
/** The last run's frame, `beats` from its first, as the clock draws it. */
const frame = (beats: number) =>
  runs[runs.length - 1].o.onFrame?.({ bar: 0, beat: 0, beats })
const G3 = 55
const A3 = 57
const B3 = 59
const C4 = 60

beforeEach(() => {
  resetRuns()
  resetChoice()
  voices.length = 0
  soundOn()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.location.hash = ''
  document.body.textContent = ''
})

describe('Step 1’s lock', () => {
  it('keeps both reads disabled under the lock line until the predict’s choice, then opens them', () => {
    // Arrange
    mountSteps()
    const lock = el('#toyRead [data-read-lock]')

    // Act
    const before = [play('by-name').disabled, play('way').disabled, lock.hidden]
    play('by-name').click()
    const ranLocked = runs.length
    Choice.make()

    // Assert
    expect(before).toEqual([true, true, false])
    expect(ranLocked).toBe(0)
    expect(play('by-name').disabled).toBe(false)
    expect(play('way').disabled).toBe(false)
    expect(lock.hidden).toBe(true)
  })

  it('opens Step 1 unlocked for a learner who has done the lesson', () => {
    // Arrange
    vi.spyOn(Done, 'has').mockImplementation((n) => n === 18)

    // Act
    mountSteps()

    // Assert
    expect(play('by-name').disabled).toBe(false)
    expect(el('#toyRead [data-read-lock]').hidden).toBe(true)
  })
})

describe('Step 1’s reads', () => {
  it('names each note on one beat and sings it on the next, tags each with how late it came, and says so once heard', async () => {
    // Arrange
    mountSteps()
    Choice.make()

    // Act
    play('by-name').click()
    drive()
    const names = texts('.rd-name')
    const tags = texts('.rd-tag')
    await finish()

    // Assert
    expect(names).toEqual(['do', 're', 'mi', 're'])
    expect(tags).toEqual([
      '1 beat late',
      '2 beats late',
      '3 beats late',
      '4 beats late',
    ])
    expect(voices).toEqual([hz(G3), hz(A3), hz(B3), hz(A3)])
    expect(said()).toBe(READ_LINES.byName)
  })

  it('reads Merc’s way after the count-in, a gold bracket fading in as the cursor reaches each pattern, each a button that plays its notes', async () => {
    // Arrange
    mountSteps()
    Choice.make()

    // Act
    play('way').click()
    const first = runs[runs.length - 1].o.bar(0)
    frame(4)
    const one = texts('.rd-bracket text')
    frame(8)
    const two = texts('.rd-bracket text')
    await finish()
    const spots = Array.from(
      toy().querySelectorAll<HTMLButtonElement>('.read-spot.is-bracket'),
      (b) => b.getAttribute('aria-label'),
    )
    voices.length = 0
    toy().querySelector<HTMLButtonElement>('.read-spot.is-bracket')?.click()
    drive()

    // Assert: four clicks alone, then the bars
    expect(first?.beats).toBe(4)
    expect(one).toEqual(['a run of steps'])
    expect(two).toEqual(['a run of steps', 'do-mi-so'])
    expect(said()).toBe(READ_LINES.way)
    expect(spots).toEqual(['a run of steps: G, A, B, A', 'do-mi-so: G, B, D'])
    expect(voices).toEqual([hz(G3), hz(A3), hz(B3), hz(A3)])
  })

  it('stops what Step 1 plays when the learner leaves it', () => {
    // Arrange
    const deck = mountSteps()
    Choice.make()
    play('by-name').click()
    const run = runs[runs.length - 1]

    // Act
    deck.show(2)

    // Assert
    expect(run.stopped).toBe(true)
  })
})

describe('Steps 2 to 4', () => {
  it('draws no bracket before a tune has played, then each as Play tune A reaches it', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    const before = texts('.rd-bracket text')
    play('tune-a').click()
    frame(0)
    frame(4)

    // Assert
    expect(before).toEqual([])
    expect(texts('.rd-bracket text')).toEqual([
      'a run of steps',
      'a repeated note',
    ])
    expect(
      Array.from(toy().querySelectorAll('.read-spot.is-bracket'), (b) =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual(['a run of steps: G, A, B, C', 'a repeated note: D, D'])
  })

  it('counts in tune C, shows its counts while Count is on, and reads the taps’ tempo from the fourth', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(3)
    const pad = el<HTMLButtonElement>('#toyRead [data-read-tap]')
    const readout = el('#toyRead [data-tap-tempo]')

    // Act
    play('count-in').click()
    const first = runs[runs.length - 1].o.bar(0)
    const counts = toy().querySelectorAll('.rb-count').length
    for (let k = 0; k < 4; k++) {
      const e = new KeyboardEvent('keydown', { key: ' ', bubbles: true })
      Object.defineProperty(e, 'timeStamp', { value: 1000 * (k + 1) })
      pad.dispatchEvent(e)
    }

    // Assert
    expect(first?.beats).toBe(4)
    expect(counts).toBeGreaterThan(0)
    expect(readout.hidden).toBe(false)
    expect(words(readout)).toBe('Your taps: 60 BPM')
  })

  it('writes p as the first note starts and f a beat after the third, the note lit by its level, and makes each mark a button', async () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    markBtn('dynamics').click()
    frame(0.5)
    const quiet = [
      texts('[data-mark]'),
      el<SVGSVGElement>('#toyRead [data-read-viz] svg').style.getPropertyValue(
        '--rd-light',
      ),
    ]
    frame(4.5)
    const loud = texts('[data-mark]')
    await finish()

    // Assert
    expect(quiet).toEqual([['p'], '58%'])
    expect(loud).toEqual(['p', 'f'])
    expect(said()).toBe('p, then f: the same three notes, quiet then loud.')
    expect(
      Array.from(toy().querySelectorAll('.read-spot.is-mark'), (b) =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual(['Play the p, then f again', 'Play the p, then f again'])
  })

  it('writes the breath mark as the breath’s silence starts, over tune C’s bar line', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(4)

    // Act
    markBtn('breath').click()
    frame(3.5)
    const before = texts('[data-mark="breath"]')
    frame(3.6)

    // Assert
    expect(before).toEqual([])
    expect(texts('[data-mark="breath"]')).toEqual([','])
  })
})

/** The staff's figure drawn at `w` px wide, as a desktop's stage or a tablet's draws it. */
function figureWide(w: number): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const h = this.matches('[data-read-viz]') ? 250 : 0
      const width = h > 0 ? w : 0
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width,
        height: h,
        right: width,
        bottom: h,
        toJSON: () => ({}),
      }
    },
  )
}

describe('the staff itself', () => {
  it('plays a tapped note for 0.8 s and says it', async () => {
    // Arrange: a desktop's stage
    figureWide(720)
    mountSteps()

    // Act
    const notes =
      toy().querySelectorAll<HTMLButtonElement>('.read-spot.is-note')
    notes[2].click()
    drive()
    await settle()

    // Assert
    expect(notes).toHaveLength(7)
    expect(notes[2].getAttribute('aria-label')).toBe('B3, mi, a quarter note')
    expect(said()).toBe('B3, mi, a quarter note')
    expect(voices).toEqual([hz(B3)])
  })

  it('makes no note a button on a figure too narrow for each to be 44 px wide, as on a phone, where the brackets still are', () => {
    // Arrange: the figure at a phone's 356 px (jsdom measures none)
    const deck = mountSteps()
    deck.show(2)

    // Act
    play('tune-a').click()
    frame(8)

    // Assert (WEB-SPEC, Contract: touch targets of at least 44 px, none overlapping)
    expect(toy().querySelectorAll('.read-spot.is-note')).toHaveLength(0)
    expect(toy().querySelectorAll('.read-spot.is-bracket')).toHaveLength(2)
  })

  it('moves the staff and the sound to the treble, and writes each note’s syllable while Names is on', () => {
    // Arrange
    const deck = mountSteps()
    deck.show(2)

    // Act
    el<HTMLButtonElement>('#toyRead [data-clef="treble"]').click()
    el<HTMLButtonElement>('#toyRead [data-names="on"]').click()
    play('tune-a').click()
    drive()

    // Assert
    expect(el('#toyRead [data-read-viz]').getAttribute('aria-label')).toBe(
      'Treble staff, two bars of 4/4: G, A, B, C, then a long D and a long D',
    )
    expect(texts('.rd-syl')).toEqual(['do', 're', 'mi', 'fa', 'so', 'so'])
    expect(voices.slice(0, 4)).toEqual([
      hz(G3 + 12),
      hz(A3 + 12),
      hz(B3 + 12),
      hz(C4 + 12),
    ])
  })
})
